"use client";

import { createContext, Fragment, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type Phase = "idle" | "pending" | "unknown";
type Entry = { leadId: string; data: unknown; dirty: boolean; phase: Phase; revision: number };
class DraftStore {
  readonly scope: string | null;
  // Private ref allocated by the provider; never shared between auth scopes.
  #ref = { current: { active: true, entries: new Map<string, Entry>(), inFlight: new Map<string, number>(), revision: 0 } };
  #listeners = new Set<() => void>();
  constructor(scope: string | null) { this.scope = scope; }
  get active() { return this.#ref.current.active; }
  entry(key: string) { return this.#ref.current.entries.get(key); }
  snapshot() { return new Map(this.#ref.current.entries); }
  inFlight(key: string) { return this.#ref.current.inFlight.has(key); }
  dirty() { return this.#ref.current.inFlight.size > 0 || [...this.#ref.current.entries.values()].some(entry => entry.dirty || entry.phase !== "idle"); }
  getSnapshot = () => this.#ref.current.revision;
  subscribe = (listener: () => void) => { this.#listeners.add(listener); return () => { this.#listeners.delete(listener); }; };
  emit() { this.#ref.current.revision++; this.#listeners.forEach(listener => listener()); }
  remove(key: string) { this.#ref.current.entries.delete(key); this.emit(); }
  write(entries: Map<string, Entry>, key: string, entry: Omit<Entry, "revision">) {
    const revision = ++this.#ref.current.revision;
    entries.set(key, { ...entry, revision }); this.#ref.current.entries = entries; this.emit(); return revision;
  }
  start(key: string, entry: Omit<Entry, "revision">) {
    if (!this.active || this.inFlight(key)) return null;
    const revision = this.write(this.snapshot(), key, entry);
    this.#ref.current.inFlight.set(key, revision); this.emit(); return revision;
  }
  settled(key: string, revision: number) {
    if (this.#ref.current.inFlight.get(key) === revision) {
      this.#ref.current.inFlight.delete(key);
      const entry = this.entry(key);
      if (entry?.phase === "pending") this.write(this.snapshot(), key, { ...entry, dirty: true, phase: "unknown" });
      else this.emit();
    }
  }
  purge(key: string, empty: unknown) {
    const entry = this.entry(key);
    if (entry && (entry.phase !== "idle" || this.inFlight(key))) this.write(this.snapshot(), key, { leadId: entry.leadId, data: empty, dirty: true, phase: entry.phase });
    else this.remove(key);
  }
  revoke(notify = true) { this.#ref.current.active = false; this.#ref.current.entries.clear(); this.#ref.current.inFlight.clear(); if (notify) this.emit(); }
  activate() { this.#ref.current.active = true; }
  destroy() { this.revoke(false); this.#listeners.clear(); }
}
const DraftContext = createContext<DraftStore | null>(null);
const image = (data: unknown): File | null => data && typeof data === "object" && "file" in data ? (data as { file: File | null }).file : null;

// Raw drafts live only in this protected layout, never a module bucket or browser storage.
export function AdminDraftScope({ scope, children }: { scope: string | null; children: ReactNode }) {
  const [store, setStore] = useState(() => new DraftStore(scope));
  if (store.scope !== scope) {
    store.revoke(false);
    setStore(new DraftStore(scope));
  }
  useEffect(() => {
    store.activate();
    return () => { store.destroy(); };
  }, [store]);
  return <DraftContext.Provider value={store}><Fragment key={scope ?? "uncached"}>{children}</Fragment></DraftContext.Provider>;
}

export function useAdminCaseDraft<T>(leadId: string, kind: "note" | "follow-up" | "ocr", initial: () => T, enabled = true) {
  const context = useContext(DraftContext);
  const [local] = useState(() => new DraftStore(null));
  const store = context ?? local;
  const key = JSON.stringify([leadId, kind]);
  const [binding, setBinding] = useState(() => ({ key, store, enabled, fallback: initial(), restored: Boolean(enabled && store.scope && store.entry(key)?.dirty), capacityMessage: null as string | null }));
  if (binding.key !== key || binding.store !== store || binding.enabled !== enabled) setBinding({ key, store, enabled, fallback: initial(), restored: Boolean(enabled && store.scope && store.entry(key)?.dirty), capacityMessage: null });
  const { fallback, restored, capacityMessage } = binding;
  const mounted = useRef(true);
  useSyncExternalStore(store.subscribe, store.getSnapshot, () => 0);
  useEffect(() => {
    mounted.current = true;
    if (!enabled) { store.purge(key, fallback); }
    return () => {
      mounted.current = false;
      if (!store.scope) { store.purge(key, fallback); }
    };
  }, [store, key, enabled, fallback]);
  const current = enabled ? store.entry(key) : undefined;
  const data = (current?.data ?? fallback) as T;
  const capacity = (text: string | null) => { if (mounted.current) setBinding(previous => previous.key === key && previous.store === store ? { ...previous, capacityMessage: text } : previous); };

  function put(next: T, isDirty: boolean, phase: Phase, expected?: number, choose = false): number | null {
    if (!enabled || !store.active || (expected !== undefined && store.entry(key)?.revision !== expected)) return null;
    const candidate = store.snapshot();
    candidate.set(key, { leadId, data: next, dirty: isDirty, phase, revision: 0 });
    const nextImage = image(next);
    if (nextImage && (!Number.isFinite(nextImage.size) || nextImage.size > 8 * 1024 * 1024)) {
      capacity("ภาพเกิน 8 MiB ฉบับเดิมยังอยู่ กรุณาเลือกภาพที่เล็กลง"); return null;
    }
    const otherImages = [...candidate.entries()].filter(([entryKey, entry]) => entryKey !== key && image(entry.data));
    if (nextImage && otherImages.length) {
      if (otherImages.some(([entryKey, entry]) => entry.phase !== "idle" || store.inFlight(entryKey))) {
        capacity("ภาพของเคสอื่นมีคำขอที่ยังไม่ยืนยัน ต้องตรวจผลเดิมก่อนล้างฉบับหรือเก็บภาพใหม่"); return null;
      }
      if (!choose || !window.confirm("เก็บภาพได้ครั้งละหนึ่งเคส ต้องการล้างฉบับ OCR ของเคสอื่นเพื่อใช้ภาพนี้หรือไม่?")) {
        capacity("ยังเก็บภาพใหม่ไม่ได้ ภาพและฉบับของเคสเดิมยังอยู่"); return null;
      }
      otherImages.forEach(([entryKey]) => candidate.delete(entryKey));
    }
    const bytes = () => [...candidate.values()].reduce((sum, entry) => sum + new TextEncoder().encode(JSON.stringify(entry.data, (name, value) => name === "file" ? null : value)).length, 0);
    if (new Set([...candidate.values()].map(entry => entry.leadId)).size > 4 || bytes() > 1024 * 1024) {
      if ([...candidate.entries()].some(([entryKey, entry]) => entry.leadId !== leadId && (entry.phase !== "idle" || store.inFlight(entryKey)))) {
        capacity("เคสอื่นมีคำขอที่ยังไม่ยืนยัน ยังล้างฉบับเพื่อเก็บเคสใหม่ไม่ได้ กรุณาตรวจผลเดิมก่อน"); return null;
      }
      if (!choose || !window.confirm("ความจำฉบับร่างเต็ม (4 เคส / ข้อความ 1 MiB) ต้องการล้างฉบับของเคสอื่นทั้งหมดเพื่อเก็บการแก้ไขนี้หรือไม่?")) {
        capacity("ยังเก็บการแก้ไขใหม่ไม่ได้ ฉบับเดิมยังอยู่ ต้องยืนยันล้างเคสอื่นก่อน"); return null;
      }
      for (const [entryKey, entry] of candidate) if (entry.leadId !== leadId) candidate.delete(entryKey);
      if (bytes() > 1024 * 1024) { capacity("ข้อความเกิน 1 MiB ฉบับเดิมยังอยู่ กรุณาลดข้อความก่อน"); return null; }
    }
    capacity(null);
    return store.write(candidate, key, { leadId, data: next, dirty: isDirty, phase });
  }
  return {
    data, phase: store.inFlight(key) ? "pending" : current?.phase ?? "idle", inFlight: store.inFlight(key), restored, capacityMessage, available: enabled && store.active,
    update: (next: T, isDirty: boolean) => put(next, isDirty, store.entry(key)?.phase === "pending" ? "unknown" : store.entry(key)?.phase ?? "idle", undefined, true),
    begin: () => enabled && store.active && !store.inFlight(key) && (store.entry(key)?.phase ?? "idle") === "idle" ? store.start(key, { leadId, data: store.entry(key)?.data ?? data, dirty: true, phase: "pending" }) : null,
    settled: (revision: number) => store.settled(key, revision),
    complete: (revision: number, next: T, isDirty = false) => put(next, isDirty, "idle", revision),
    unknown: (revision: number) => { const entry = store.entry(key); return entry ? put(entry.data as T, true, "unknown", revision) : null; },
    reviewed: () => store.inFlight(key) ? null : put(data, true, "idle", undefined, true),
    authFailed: (status: number) => { if (status === 401) store.revoke(); },
    refresh: (router: { refresh: () => void }) => { if (store.active && !store.dirty()) router.refresh(); },
  };
}

export default function AdminDataRefresh() {
  const router = useRouter();
  const store = useContext(DraftContext);
  useEffect(() => {
    if (!store) return;
    const refresh = () => { if (store.active && !store.dirty()) router.refresh(); };
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") refresh(); };
    let approvedDocumentExit = false;
    let approvalTimer: number | undefined;
    const confirmLeave = (event: Event, logout = false) => {
      if (store.dirty() && !window.confirm(logout
        ? "มีฉบับที่ยังไม่บันทึก การออกจากระบบจะล้างฉบับในแท็บนี้ ต้องการออกจากระบบหรือไม่?"
        : "มีฉบับที่ยังไม่บันทึก เก็บไว้ได้เมื่อกลับมาในแท็บเดิม แต่การโหลดหน้าใหม่หรือปิดแท็บจะล้างฉบับ ต้องการออกจากหน้านี้หรือไม่?")) {
        event.preventDefault(); event.stopPropagation(); return;
      }
      if (logout) store.revoke();
      approvedDocumentExit = true;
      window.clearTimeout(approvalTimer);
      approvalTimer = window.setTimeout(() => { approvedDocumentExit = false; }, 0);
    };
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      const target = new URL(anchor.href, window.location.href);
      if (target.protocol !== "http:" && target.protocol !== "https:") return;
      if (target.pathname === window.location.pathname && target.search === window.location.search && target.origin === window.location.origin) return;
      confirmLeave(event);
    };
    const logout = (event: Event) => {
      if (event.target instanceof HTMLFormElement && event.target.hasAttribute("data-admin-logout")) confirmLeave(event, true);
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (!store.dirty() || approvedDocumentExit) return;
      event.preventDefault(); event.returnValue = "";
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    document.addEventListener("click", navigate, true);
    document.addEventListener("submit", logout, true);
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      document.removeEventListener("click", navigate, true);
      document.removeEventListener("submit", logout, true);
      window.removeEventListener("beforeunload", unload);
      window.clearTimeout(approvalTimer);
    };
  }, [router, store]);
  return null;
}
