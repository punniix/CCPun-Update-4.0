"use client";

import { useMemo, useState } from "react";

type JourneyId =
  | "life_health_policy_review"
  | "motor_quote_review"
  | "investment_before_you_act";

type DiscoveryItem = { slug: string; enabled: boolean };
type JourneyConfig = { maxCards: number; items: DiscoveryItem[] };
type ArticleOption = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  featuredImage: string | null;
};

type DiscoveryModel = {
  revision: string | null;
  source: "stored" | "default";
  writeReady: boolean;
  journeys: Record<JourneyId, JourneyConfig>;
  articles: ArticleOption[];
};

const JOURNEYS: Array<{ id: JourneyId; label: string }> = [
  { id: "life_health_policy_review", label: "ประกันชีวิต" },
  { id: "motor_quote_review", label: "ประกันรถ" },
  { id: "investment_before_you_act", label: "เรื่องลงทุน" },
];

function cloneJourneys(value: DiscoveryModel["journeys"]): DiscoveryModel["journeys"] {
  return {
    life_health_policy_review: {
      maxCards: value.life_health_policy_review.maxCards,
      items: value.life_health_policy_review.items.map((item) => ({ ...item })),
    },
    motor_quote_review: {
      maxCards: value.motor_quote_review.maxCards,
      items: value.motor_quote_review.items.map((item) => ({ ...item })),
    },
    investment_before_you_act: {
      maxCards: value.investment_before_you_act.maxCards,
      items: value.investment_before_you_act.items.map((item) => ({ ...item })),
    },
  };
}

export default function LineDiscoveryManager({ initialModel }: { initialModel: DiscoveryModel }) {
  const [activeJourney, setActiveJourney] = useState<JourneyId>("life_health_policy_review");
  const [revision, setRevision] = useState(initialModel.revision);
  const [source, setSource] = useState(initialModel.source);
  const [writeReady, setWriteReady] = useState(initialModel.writeReady);
  const [articles, setArticles] = useState(initialModel.articles);
  const [journeys, setJourneys] = useState(() => cloneJourneys(initialModel.journeys));
  const [draggingSlug, setDraggingSlug] = useState<string | null>(null);
  const [addSlug, setAddSlug] = useState("");
  const [busy, setBusy] = useState<"save" | "reload" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const articleBySlug = useMemo(
    () => new Map(articles.map((article) => [article.slug, article] as const)),
    [articles],
  );

  const current = journeys[activeJourney];
  const selected = new Set(current.items.map((item) => item.slug));
  const availableToAdd = articles.filter((article) => !selected.has(article.slug));

  const previewArticles = current.items
    .filter((item) => item.enabled)
    .map((item) => articleBySlug.get(item.slug))
    .filter((article): article is ArticleOption => Boolean(article))
    .slice(0, current.maxCards);

  const hasUnavailable = Object.values(journeys).some((journey) =>
    journey.items.some((item) => !articleBySlug.has(item.slug)),
  );
  const hasEmptyActive = Object.values(journeys).some(
    (journey) => !journey.items.some((item) => item.enabled),
  );

  function updateJourney(journey: JourneyId, updater: (value: JourneyConfig) => JourneyConfig) {
    setJourneys((previous) => ({
      ...previous,
      [journey]: updater(previous[journey]),
    }));
    setMessage(null);
  }

  function moveItem(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    updateJourney(activeJourney, (value) => {
      const items = [...value.items];
      const [moved] = items.splice(fromIndex, 1);
      if (!moved) return value;
      items.splice(toIndex, 0, moved);
      return { ...value, items };
    });
  }

  function addArticle() {
    if (!addSlug || selected.has(addSlug)) return;
    updateJourney(activeJourney, (value) => ({
      ...value,
      items: [...value.items, { slug: addSlug, enabled: true }],
    }));
    setAddSlug("");
  }

  function removeArticle(slug: string) {
    updateJourney(activeJourney, (value) => ({
      ...value,
      items: value.items.filter((item) => item.slug !== slug),
    }));
  }

  function toggleArticle(slug: string) {
    updateJourney(activeJourney, (value) => ({
      ...value,
      items: value.items.map((item) =>
        item.slug === slug ? { ...item, enabled: !item.enabled } : item,
      ),
    }));
  }

  async function reload() {
    setBusy("reload");
    setMessage(null);
    try {
      const response = await fetch("/api/admin/line/discovery/", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json() as DiscoveryModel & { error?: string };
      if (!response.ok) throw new Error(payload.error || "reload-failed");
      setRevision(payload.revision);
      setSource(payload.source);
      setWriteReady(payload.writeReady);
      setArticles(payload.articles);
      setJourneys(cloneJourneys(payload.journeys));
      setMessage("โหลดค่าล่าสุดแล้ว");
    } catch {
      setMessage("ยังโหลดค่าล่าสุดไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!writeReady || hasUnavailable || hasEmptyActive) return;
    setBusy("save");
    setMessage(null);
    try {
      const response = await fetch("/api/admin/line/discovery/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision, journeys }),
      });
      const payload = await response.json() as { status?: string; revision?: string; error?: string };
      if (!response.ok) {
        if (response.status === 409 && payload.error === "stale-revision") {
          setMessage("มีการแก้ไขจากที่อื่นแล้ว กรุณากด “โหลดค่าล่าสุด” ก่อนบันทึกอีกครั้ง");
          return;
        }
        if (payload.error === "article-not-published") {
          setMessage("มีบทความที่ไม่ได้เผยแพร่แล้ว กรุณาโหลดข้อมูลล่าสุดและจัดรายการใหม่");
          return;
        }
        throw new Error(payload.error || "save-failed");
      }
      if (payload.revision) setRevision(payload.revision);
      setSource("stored");
      setMessage("บันทึกแล้ว · LINE จะใช้ลำดับนี้กับการกดครั้งถัดไป");
    } catch {
      setMessage("ยังบันทึกไม่ได้ กรุณาตรวจ Sanity write readiness แล้วลองใหม่");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-7 rounded-3xl border border-[#e0c985]/20 bg-[#e0c985]/[0.035] p-5 md:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">บทความแนะนำใน LINE</p>
          <h2 className="mt-2 text-xl font-semibold text-white/90">จัดลำดับการ์ดบทความ</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
            ลากเพื่อเรียงบนคอมพิวเตอร์ หรือใช้ปุ่มขึ้น/ลงบนมือถือ เมื่อบันทึกแล้ว ข้อความครั้งถัดไปจะใช้ลำดับใหม่ทันที
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60">
            {source === "stored" ? "ใช้ค่าที่บันทึกใน Sanity" : "ใช้ค่าเริ่มต้นจากระบบ"}
          </span>
          <span className={`rounded-full border px-3 py-1.5 text-xs ${
            writeReady
              ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
              : "border-amber-200/20 bg-amber-200/10 text-amber-100"
          }`}>
            {writeReady ? "แก้ไขได้" : "อ่านอย่างเดียว"}
          </span>
        </div>
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {JOURNEYS.map((journey) => (
          <button
            key={journey.id}
            type="button"
            onClick={() => {
              setActiveJourney(journey.id);
              setAddSlug("");
            }}
            className={`min-h-11 shrink-0 rounded-xl border px-4 text-sm font-medium transition ${
              activeJourney === journey.id
                ? "border-[#e0c985]/45 bg-[#e0c985]/10 text-[#f4df9b]"
                : "border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.06]"
            }`}
          >
            {journey.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div className="min-w-0">
          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/10 p-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1">
              <label htmlFor="line-discovery-add" className="text-xs font-medium text-white/55">เพิ่มบทความที่เผยแพร่แล้ว</label>
              <select
                id="line-discovery-add"
                value={addSlug}
                onChange={(event) => setAddSlug(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#2b2020] px-3 text-sm text-white"
              >
                <option value="">เลือกบทความ…</option>
                {availableToAdd.map((article) => (
                  <option key={article.slug} value={article.slug}>
                    {article.title} · {article.category}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={!addSlug}
              onClick={addArticle}
              className="min-h-11 rounded-xl border border-[#e0c985]/30 px-4 text-sm font-medium text-[#f4df9b] transition hover:bg-[#e0c985]/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              เพิ่มบทความ
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {current.items.map((item, index) => {
              const article = articleBySlug.get(item.slug);
              return (
                <article
                  key={item.slug}
                  draggable
                  onDragStart={() => setDraggingSlug(item.slug)}
                  onDragEnd={() => setDraggingSlug(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (!draggingSlug) return;
                    const fromIndex = current.items.findIndex((candidate) => candidate.slug === draggingSlug);
                    moveItem(fromIndex, index);
                    setDraggingSlug(null);
                  }}
                  className={`rounded-2xl border p-4 transition ${
                    draggingSlug === item.slug
                      ? "border-[#e0c985]/40 bg-[#e0c985]/[0.07]"
                      : "border-white/10 bg-white/[0.025]"
                  }`}
                >
                  <div className="flex gap-3">
                    <button
                      type="button"
                      aria-label={`ลากเพื่อเรียง ${article?.title ?? item.slug}`}
                      title="ลากเพื่อเรียง"
                      className="hidden h-11 w-9 shrink-0 cursor-grab items-center justify-center rounded-lg border border-white/10 text-lg text-white/35 md:flex"
                    >
                      ☰
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-[#e0c985]">#{index + 1} · {article?.category ?? "ไม่พบบทความที่เผยแพร่แล้ว"}</p>
                          <h3 className="mt-1 text-sm font-medium leading-6 text-white/85">
                            {article?.title ?? item.slug}
                          </h3>
                          <p className="mt-1 break-all text-xs text-white/35">{item.slug}</p>
                        </div>
                        <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-white/65">
                          <input
                            type="checkbox"
                            checked={item.enabled}
                            onChange={() => toggleArticle(item.slug)}
                            className="h-4 w-4 accent-[#e0c985]"
                          />
                          แสดง
                        </label>
                      </div>

                      {!article ? (
                        <p className="mt-3 rounded-xl border border-amber-200/15 bg-amber-200/[0.05] px-3 py-2 text-xs leading-5 text-amber-100">
                          บทความนี้ไม่ได้เผยแพร่หรือไม่เปิดให้เครื่องมือค้นหาเก็บแล้ว ต้องลบหรือโหลดค่าล่าสุดก่อนบันทึก
                        </p>
                      ) : null}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveItem(index, index - 1)}
                          className="min-h-10 rounded-lg border border-white/10 px-3 text-xs text-white/60 disabled:opacity-30"
                        >
                          ↑ ขึ้น
                        </button>
                        <button
                          type="button"
                          disabled={index === current.items.length - 1}
                          onClick={() => moveItem(index, index + 1)}
                          className="min-h-10 rounded-lg border border-white/10 px-3 text-xs text-white/60 disabled:opacity-30"
                        >
                          ↓ ลง
                        </button>
                        <button
                          type="button"
                          onClick={() => removeArticle(item.slug)}
                          className="min-h-10 rounded-lg border border-rose-300/15 px-3 text-xs text-rose-100/80"
                        >
                          เอาออก
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <label htmlFor="line-discovery-max" className="text-sm font-medium text-white/80">แสดงสูงสุด</label>
              <p className="mt-1 text-xs text-white/45">เรียงตามรายการด้านบน แล้วตัดตามจำนวนนี้</p>
            </div>
            <select
              id="line-discovery-max"
              value={current.maxCards}
              onChange={(event) =>
                updateJourney(activeJourney, (value) => ({ ...value, maxCards: Number(event.target.value) }))
              }
              className="min-h-11 rounded-xl border border-white/10 bg-[#2b2020] px-4 text-sm text-white"
            >
              {[1, 2, 3, 4, 5].map((count) => <option key={count} value={count}>{count} ใบ</option>)}
            </select>
          </div>
        </div>

        <aside className="min-w-0 rounded-2xl border border-white/10 bg-[#251818] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.1em] text-[#e0c985]">PREVIEW</p>
              <h3 className="mt-1 text-base font-semibold text-white/85">การ์ดบทความใน LINE</h3>
            </div>
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/45">
              {previewArticles.length}/{current.maxCards}
            </span>
          </div>

          <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-2">
            {previewArticles.map((article) => (
              <article key={article.slug} className="w-[280px] shrink-0 snap-start overflow-hidden rounded-2xl border border-[#5B4848] bg-[#352727]">
                {article.featuredImage ? (
                  <div className="aspect-[20/13] overflow-hidden bg-[#302222]">
                    <img src={article.featuredImage} alt="" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex aspect-[20/13] items-center justify-center bg-[#302222] text-xs text-white/35">ไม่มีภาพหน้าปก</div>
                )}
                <div className="p-4">
                  <p className="text-xs font-semibold text-[#e0c985]">
                    {JOURNEYS.find((journey) => journey.id === activeJourney)?.label}
                  </p>
                  <h4 className="mt-2 line-clamp-3 text-base font-semibold leading-6 text-[#faf9f9]">{article.title}</h4>
                  <p className="mt-2 line-clamp-4 text-xs leading-5 text-[#baabab]">{article.excerpt}</p>
                  <div className="mt-4 border-t border-white/10 pt-3 text-center text-sm font-medium text-[#e0c985]">อ่านต่อบน CCPun</div>
                </div>
              </article>
            ))}
            {!previewArticles.length ? (
              <div className="flex min-h-56 w-full items-center justify-center rounded-2xl border border-dashed border-white/10 px-5 text-center text-sm leading-6 text-white/45">
                ยังไม่มีการ์ดบทความที่เปิดใช้งาน
              </div>
            ) : null}
          </div>
          <p className="mt-3 text-xs leading-5 text-white/40">ตัวอย่างนี้ใช้ข้อมูลเดียวกับการ์ดบทความจริง แต่เป็นเพียงภาพจำลองในศูนย์จัดการและไม่ได้ส่งข้อความหา LINE</p>
        </aside>
      </div>

      {hasEmptyActive ? (
        <p className="mt-5 rounded-xl border border-amber-200/15 bg-amber-200/[0.05] px-4 py-3 text-sm text-amber-100">
          ทุกเส้นทางต้องมีบทความที่เปิดแสดงอย่างน้อย 1 รายการ เพื่อไม่ให้ลูกค้ากดเมนูแล้วพบหน้าว่าง
        </p>
      ) : null}
      {hasUnavailable ? (
        <p className="mt-3 rounded-xl border border-amber-200/15 bg-amber-200/[0.05] px-4 py-3 text-sm text-amber-100">
          พบรายการที่ไม่ได้เผยแพร่หรือไม่เปิดให้เครื่องมือค้นหาเก็บแล้ว กรุณาเอาออกก่อนบันทึก
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!writeReady || busy !== null || hasUnavailable || hasEmptyActive}
          onClick={() => void save()}
          className="min-h-11 rounded-xl bg-[#e0c985] px-5 text-sm font-semibold text-[#251818] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === "save" ? "กำลังบันทึก…" : "บันทึกลำดับ"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void reload()}
          className="min-h-11 rounded-xl border border-white/10 px-4 text-sm text-white/65 transition hover:bg-white/[0.05] disabled:opacity-40"
        >
          {busy === "reload" ? "กำลังโหลด…" : "โหลดค่าล่าสุด"}
        </button>
        {message ? <p role="status" className="text-sm text-white/65">{message}</p> : null}
      </div>
    </section>
  );
}
