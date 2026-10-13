"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PAGE_SEO_FIELDS, validatePageSeoFields, isPageSeoImageUrlAllowed, type PageSeoFields } from "@/lib/content/page-seo-registry";
import type { PageSeoRow, PageSeoReadback } from "@/lib/admin/page-seo";

type Field = typeof PAGE_SEO_FIELDS[number];
type Form = Record<Field, string>;
const labels: Record<Field, string> = { seoTitle: "ชื่อสำหรับผลค้นหา", seoDescription: "คำอธิบายสำหรับผลค้นหา", ogTitle: "ชื่อเมื่อแชร์", ogDescription: "คำอธิบายเมื่อแชร์", ogImageUrl: "URL ภาพเมื่อแชร์" };
const blank = (): Form => ({ seoTitle: "", seoDescription: "", ogTitle: "", ogDescription: "", ogImageUrl: "" });
const formOf = (fields: PageSeoFields): Form => Object.fromEntries(PAGE_SEO_FIELDS.map(key => [key, fields[key] ?? ""])) as Form;
const inputClass = "mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-black/15 px-3 py-2 text-sm text-white focus:border-[#e0c985] focus:outline-none";
const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40";

export function pageSeoSaveFailureMessage(status: number | null, error?: unknown): string {
  const code = status === 503 && error === "write-unavailable" ? "write-unavailable" : status === 502 && error === "save-failed" ? "save-failed" : null;
  const http = status !== null && Number.isInteger(status) && status >= 500 && status <= 599 ? ` (HTTP ${status}${code ? ` · ${code}` : ""})` : "";
  return `ยังยืนยันผลบันทึกไม่ได้${http} กรุณาโหลดค่าปัจจุบันก่อนลองอีกครั้ง เพื่อป้องกันการบันทึกซ้ำ`;
}

export default function PageSeoEditor() {
  const [pages, setPages] = useState<PageSeoRow[]>([]);
  const [pathname, setPathname] = useState("/");
  const [form, setForm] = useState<Form>(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [served, setServed] = useState<PageSeoReadback | null>(null);
  const [checking, setChecking] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const readSequence = useRef(0);
  const row = pages.find(page => page.pathname === pathname);
  const dirty = row ? PAGE_SEO_FIELDS.some(key => form[key] !== (row.overrides[key] ?? "")) : false;

  const checkServed = useCallback(async (path: string) => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const sequence = ++readSequence.current;
    setChecking(true);
    setServed(null);
    try {
      const response = await fetch(`/api/admin/page-seo/?pathname=${encodeURIComponent(path)}`, { cache: "no-store", signal: abort.signal });
      if (!response.ok) throw new Error("readback-unavailable");
      const result: PageSeoReadback = await response.json();
      if (sequence === readSequence.current) setServed(result);
    } catch {
      if (!abort.signal.aborted && sequence === readSequence.current) setServed({ verified: false, status: null, tags: null, error: "request-failed" });
    } finally { if (!abort.signal.aborted && sequence === readSequence.current) setChecking(false); }
  }, []);

  const loadPages = useCallback(async (path = "/", signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/page-seo/", { cache: "no-store", signal });
      if (!response.ok) throw new Error("read-unavailable");
      const result: { pages: PageSeoRow[] } = await response.json();
      if (signal?.aborted) return;
      setPages(result.pages);
      const current = result.pages.find(page => page.pathname === path);
      setForm(formOf(current?.overrides ?? {}));
      setConflict(false);
      setSaved("");
      void checkServed(path);
    } catch { if (!signal?.aborted) setError("โหลดค่า SEO ไม่สำเร็จ กรุณาลองใหม่ ข้อมูลที่กำลังกรอกยังไม่ได้บันทึก"); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [checkServed]);

  useEffect(() => {
    const initial = new AbortController();
    const readController = controller;
    const timer = setTimeout(() => { void loadPages("/", initial.signal); }, 0);
    return () => { clearTimeout(timer); initial.abort(); readController.current?.abort(); };
  }, [loadPages]);

  const selectPage = (path: string) => {
    if (dirty && !window.confirm("มีค่าที่ยังไม่บันทึก เปลี่ยนหน้าและยกเลิกค่าที่กำลังกรอกไหม?")) return;
    setPathname(path);
    setForm(formOf(pages.find(page => page.pathname === path)?.overrides ?? {}));
    setError(""); setSaved(""); setConflict(false);
    void checkServed(path);
  };

  const save = async () => {
    if (!row || saving || loading) return;
    let fields: PageSeoFields;
    try { fields = validatePageSeoFields(form); }
    catch { setError("ตรวจข้อความและ URL ภาพ: ใช้ข้อความบรรทัดเดียวและภาพสาธารณะของ CCPun หรือ Sanity UAT เท่านั้น"); return; }
    setSaving(true); setError(""); setSaved("");
    try {
      const response = await fetch("/api/admin/page-seo/", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pathname, revision: row.revision, fields }) });
      if (response.status === 409) { setConflict(true); setError("มีการแก้ค่าระหว่างนี้ ยังไม่ได้ทับข้อมูล กรุณาโหลดค่าปัจจุบันก่อนบันทึกใหม่"); return; }
      if (!response.ok) {
        if (response.status >= 500) {
          const detail: unknown = response.headers.get("content-type")?.includes("application/json") ? await response.json().catch(() => null) : null;
          const code = detail && typeof detail === "object" && "error" in detail ? detail.error : undefined;
          setConflict(true); setError(pageSeoSaveFailureMessage(response.status, code));
        }
        else setError("บันทึกไม่สำเร็จ ค่าที่กรอกยังอยู่ กรุณาตรวจข้อมูลหรือสิทธิ์แล้วลองใหม่");
        return;
      }
      const result: { saved: boolean; revision: string; fields: PageSeoFields } = await response.json();
      if (!result.saved) throw new Error("unconfirmed-save");
      setPages(current => current.map(page => page.pathname === pathname ? { ...page, revision: result.revision, overrides: result.fields } : page));
      setForm(formOf(result.fields)); setConflict(false);
      setSaved("บันทึก metadata ลง Sanity UAT แล้ว — การตรวจหน้าเว็บเป็นอีกขั้นด้านล่าง");
      void checkServed(pathname);
    } catch { setError(pageSeoSaveFailureMessage(null)); setConflict(true); }
    finally { setSaving(false); }
  };

  const effective = (key: Field) => form[key].trim() || row?.defaults[key] || "";
  const previewImage = effective("ogImageUrl");
  return <div className="space-y-6">
    <header>
      <Link href="/seo/" className="inline-flex min-h-11 items-center text-sm text-[#e0c985]">← กลับตรวจ SEO</Link>
      <h1 className="mt-2 text-2xl font-semibold">SEO หน้าเว็บ</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">แก้ชื่อ คำอธิบาย และภาพแชร์ของหน้าเว็บบน UAT บทความยังจัดการผ่าน Sanity ตามเดิม เว้นช่องว่างเพื่อใช้ค่าเริ่มต้นของหน้านั้น</p>
      <p className="mt-2 text-xs leading-5 text-white/50">UAT ยังห้าม index · canonical, robots และการเปิดเครื่องมือเป็นค่าระบบที่แก้จากหน้านี้ไม่ได้</p>
    </header>
    {error ? <p role="alert" className="rounded-xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm text-red-100">{error}</p> : null}
    {saved ? <p role="status" className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.05] p-4 text-sm text-emerald-100">{saved}</p> : null}
    <label className="block text-sm">หน้าเว็บ<select className={inputClass} value={pathname} disabled={loading || saving} onChange={event => selectPage(event.target.value)}>{pages.map(page => <option style={{ backgroundColor: "#302322" }} key={page.pathname} value={page.pathname}>{page.label} — {page.pathname}</option>)}</select></label>
    {loading ? <p role="status" className="text-sm text-white/60">กำลังโหลดค่า SEO…</p> : row ? <>
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5" aria-label="แก้ metadata">
        <div className="space-y-5">{PAGE_SEO_FIELDS.map(key => <div key={key} className="grid gap-3 lg:grid-cols-2">
          <div><p className="text-xs text-white/50">ค่าเริ่มต้น · {labels[key]}</p><p className="mt-2 break-words text-sm leading-6 text-white/65">{row.defaults[key] || "ไม่มีค่าเริ่มต้น"}</p></div>
          <label className="block text-sm">{labels[key]}<span className="ml-2 text-xs text-white/50">ค่าที่แก้</span>{key.endsWith("Description") ? <textarea rows={3} maxLength={320} className={inputClass} value={form[key]} disabled={saving || loading} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} placeholder="เว้นว่างเพื่อใช้ค่าเริ่มต้น" /> : <input type={key === "ogImageUrl" ? "url" : "text"} maxLength={key === "ogImageUrl" ? 2048 : 120} className={inputClass} value={form[key]} disabled={saving || loading} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} placeholder="เว้นว่างเพื่อใช้ค่าเริ่มต้น" />}</label>
        </div>)}</div>
        <p className="mt-4 text-xs leading-5 text-white/50">URL ภาพรองรับไฟล์ภาพสาธารณะของ ccpun.com, test.ccpun.com หรือ cdn.sanity.io ของ project/dataset UAT นี้ ไม่มีการอัปโหลดภาพจากหน้านี้</p>
        <div className="mt-5 flex flex-wrap gap-3"><button className={`${buttonClass} border-[#e0c985]/30 bg-[#e0c985] font-medium `} style={{ color: "#302322" }} disabled={!dirty || saving || loading || conflict} onClick={() => void save()}>{saving ? "กำลังบันทึก…" : "บันทึกบน UAT"}</button><button className={buttonClass} disabled={saving || loading} onClick={() => { setForm(blank()); setError(""); }}>ใช้ค่าเริ่มต้นทุกช่อง</button><button className={buttonClass} disabled={saving || loading} onClick={() => { if (!dirty || window.confirm("โหลดค่าปัจจุบันและยกเลิกค่าที่กำลังกรอกไหม?")) void loadPages(pathname); }}>โหลดค่าปัจจุบันใหม่</button></div>
        <p className="mt-3 text-xs text-white/50">การใช้ค่าเริ่มต้นต้องกดบันทึกด้วย เอกสารเดิมจะคงอยู่เพื่อรักษา revision</p>
      </section>
      <section className="grid gap-4 lg:grid-cols-2" aria-label="ตัวอย่างจำลอง">
        <article className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="text-sm font-semibold">ตัวอย่างผลค้นหา · จำลอง</h2><p className="mt-4 break-all text-xs text-white/50">test.ccpun.com{pathname}</p><p className="mt-2 break-words text-lg leading-7 text-[#e0c985]">{effective("seoTitle")}</p><p className="mt-2 break-words text-sm leading-6 text-white/70">{effective("seoDescription")}</p><p className="mt-4 text-xs leading-5 text-white/50">Google อาจเลือกข้อความอื่น รูปแบบนี้ไม่ใช่ผลค้นหาจริง และ UAT ไม่เปิดให้ index</p></article>
        <article className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]"><h2 className="p-5 text-sm font-semibold">ตัวอย่างเมื่อแชร์ · จำลอง</h2>{previewImage && isPageSeoImageUrlAllowed(previewImage) ? <Image src={previewImage} alt="ตัวอย่างภาพแชร์" width={600} height={315} unoptimized className="w-full object-cover" style={{ aspectRatio: "120 / 63" }} /> : null}<div className="p-5"><p className="break-words font-semibold">{effective("ogTitle")}</p><p className="mt-2 break-words text-sm leading-6 text-white/70">{effective("ogDescription")}</p><p className="mt-4 text-xs leading-5 text-white/50">แต่ละแพลตฟอร์มอาจแสดงและ cache ต่างกัน ตัวอย่างนี้ใช้ค่าที่กำลังกรอก</p></div></article>
      </section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5" aria-label="metadata ที่เว็บส่งจริง">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">ค่าที่ Web UAT ส่งจริง</h2><button className={buttonClass} disabled={checking || saving} onClick={() => void checkServed(pathname)}>{checking ? "กำลังตรวจ…" : "ตรวจหน้าเว็บอีกครั้ง"}</button></div>
        <p className="mt-3 text-sm leading-6 text-white/65">{checking ? "กำลังอ่าน tags จากหน้าเว็บ…" : served?.verified ? "อ่าน metadata จาก HTML ที่เว็บส่งสำเร็จ ไม่ใช่หลักฐานว่า Google หรือแพลตฟอร์มแชร์อัปเดตแล้ว" : `ยังตรวจ metadata ไม่สำเร็จ${served?.status ? ` (HTTP ${served.status})` : ""} — สถานะนี้แยกจากผลบันทึก CMS`}</p>
        {served?.tags ? <dl className="mt-4 divide-y divide-white/10">{Object.entries(served.tags).map(([key, value]) => <div key={key} className="grid gap-1 py-3 sm:grid-cols-[150px_minmax(0,1fr)]"><dt className="text-xs text-white/50">{key}</dt><dd className="break-words text-sm leading-6 text-white/75">{value ?? "ไม่มี tag"}</dd></div>)}</dl> : null}
      </section>
    </> : <button className={buttonClass} onClick={() => void loadPages()}>ลองโหลดอีกครั้ง</button>}
  </div>;
}
