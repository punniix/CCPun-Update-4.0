"use client";

import { useMemo, useState } from "react";
import {
  buildLineChatCampaignLink,
  CHAT_TEMPLATE_ISSUE_LABEL,
  CHAT_TEXT_ISSUE_LABEL,
  chatTemplateIssues,
  chatTextIssues,
  countChatCharacters,
  defaultEvergreenReviewAt,
  hasVisibleCode,
  LINE_CHAT_CAMPAIGN_TARGETS,
  LINE_CHAT_DEFAULT_SOURCE_TEMPLATES,
  LINE_CHAT_FIXED_PAGE_GROUPS,
  LINE_CHAT_LIMITS,
  LINE_CHAT_LINK_CHANNELS,
  LINE_CHAT_ROUTES,
  LINE_CHAT_TYPE_OWN,
  lineChatAdminWarnings,
  lineChatConfigSchema,
  lineChatImmutabilityIssues,
  resolveChatPanel,
  type ChatPageContext,
  type ChatPanel,
  type LineChatCampaign,
  type LineChatCampaignTarget,
  type LineChatConfig,
  type LineChatJourney,
  type LineChatLinkChannel,
  type LineChatOverrideTopic,
  type LineChatPageOverride,
  type LineChatSourceTemplates,
  type LineChatTopic,
} from "@/lib/line/chat-config";

type HistoryEntry = { revision: string; timestamp: string; author: string | null };
type DraftInfo = { revision: string; config: LineChatConfig; invalid: boolean; updatedAt: string | null; updatedBy: string | null };
type ArticleOption = { id: string; slug: string; title: string; category: string | null; path: string; context: ChatPageContext };
type CategoryOption = { slug: string; title: string };
type Model = {
  revision: string | null;
  source: "stored" | "default";
  storedInvalid: boolean;
  writeReady: boolean;
  config: LineChatConfig;
  updatedAt: string | null;
  updatedBy: string | null;
  history: HistoryEntry[];
  topicClicks30d: Record<string, number> | null;
  draft: DraftInfo | null;
  articles: ArticleOption[];
};

type Tab = "site" | "category" | "page" | "topics" | "source" | "campaigns" | "switch";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "site", label: "ค่าเริ่มต้นทั้งเว็บ" },
  { id: "category", label: "ตามหมวด" },
  { id: "page", label: "รายหน้า" },
  { id: "topics", label: "คลังหัวข้อ" },
  { id: "source", label: "ประโยคบอกที่มา" },
  { id: "campaigns", label: "แคมเปญ" },
  { id: "switch", label: "สวิตช์หลัก" },
];

const JOURNEY_LABEL: Record<LineChatJourney, string> = { life_health: "ชีวิต / สุขภาพ", motor: "ประกันรถ", investment: "ลงทุน", human: "คุยกับปั้น" };
const GROUP_LABEL: Record<string, string> = {
  all: "ทั้งเว็บ", home: "หน้าแรก", blog_index: "หน้ารวมบทความ", blog_category: "หน้าหมวดบทความทุกหมวด", article: "ทุกบทความ",
  tool_ci: "วางแผนเงินก้อนโรคร้ายแรง", tool_fhc: "ตรวจสุขภาพการเงิน", tool_money_story: "Money Story", tool_investment_allocation: "วางแผนกองทุน (รวมกองทุน บลจ. เอไอเอ)",
  tools_hub: "หน้ารวมเครื่องมือ", about: "เกี่ยวกับปั้น", coming_soon: "หน้าที่กำลังสร้าง", default: "ค่าปกติ (หน้าที่ไม่ได้ตั้ง)",
};
const LAYER_LABEL: Record<string, string> = { page: "ตั้งรายหน้า", category: "ตามหมวด", group: "ค่าเริ่มต้นของกลุ่มหน้า", default: "ค่าปกติทั้งเว็บ" };
const DESTINATIONS = [
  { path: "/", label: "หน้าแรก" },
  { path: "/blog/", label: "หน้ารวมบทความ" },
  { path: "/tools/", label: "หน้ารวมเครื่องมือ" },
  { path: "/ci-planning/", label: "วางแผนเงินก้อนโรคร้ายแรง" },
  { path: "/tools/financial-health-check/", label: "ตรวจสุขภาพการเงิน" },
  { path: "/play/money-story/", label: "Money Story" },
];

const TOPIC_ID = /^[a-z0-9][a-z0-9-]{1,39}$/;
const CAMPAIGN_CODE = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const KEY_SLUG = /^[a-z0-9][a-z0-9-]{0,95}$/;
const SITE_GROUPS = LINE_CHAT_FIXED_PAGE_GROUPS;

function groupLabel(key: string, categories: CategoryOption[] = []): string {
  if (key.startsWith("category:")) {
    const slug = key.slice(9);
    return `หมวด ${categories.find((item) => item.slug === slug)?.title ?? slug}`;
  }
  if (key.startsWith("article:")) return `บทความ ${key.slice(8)} (แบบเดิม)`;
  return GROUP_LABEL[key] ?? key;
}

/** Internal short reference letters for a new campaign (no longer shown to visitors since 2026-10-26). */
function campaignRefFromCode(code: string): string {
  const letters = code.replace(/[^a-z]/g, "").toUpperCase();
  return (letters.length >= 2 ? letters : `${letters}CP`).slice(0, 4).padEnd(2, "X");
}

function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

/** Working copy with the 2026-10-26 fields filled in, so every save writes them explicitly. */
function normalize(config: LineChatConfig): LineChatConfig {
  const copy = JSON.parse(JSON.stringify(config)) as LineChatConfig;
  return { ...copy, sourceTemplates: copy.sourceTemplates ?? { ...LINE_CHAT_DEFAULT_SOURCE_TEMPLATES }, pageOverrides: copy.pageOverrides ?? [] };
}

function randomCustomId(taken: Set<string>): string {
  for (;;) {
    const id = `page-${Math.random().toString(36).slice(2, 8)}`;
    if (!taken.has(id)) return id;
  }
}

const ISSUE_MESSAGE: Record<string, string> = {
  duplicate: "ซ้ำกับรายการอื่น",
  "unknown-topic": "ไม่มีหัวข้อนี้ในคลัง",
  "no-enabled-topic": "ต้องมีหัวข้อที่เปิดใช้อย่างน้อย 1 หัวข้อ",
  "missing-default": "ต้องมีค่าปกติ",
  required: "ต้องกรอก",
  "ends-before-start": "วันจบต้องอยู่หลังวันเริ่ม",
  "evergreen-has-no-end": "แคมเปญต่อเนื่องไม่มีวันจบ",
  "draft-id": "ใช้รหัสบทความที่เผยแพร่แล้วเท่านั้น",
  ...CHAT_TEMPLATE_ISSUE_LABEL,
};

function Counter({ value, max }: { value: string; max: number }) {
  const count = countChatCharacters(value.trim());
  return <span className={`text-xs ${count > max ? "text-red-300" : "text-white/45"}`}>{count}/{max}</span>;
}

function TextIssues({ value, max }: { value: string; max: number }) {
  const issues = chatTextIssues(value, max);
  if (!issues.length) return null;
  return <p className="mt-1 text-xs text-red-300" role="alert">{issues.map((issue) => CHAT_TEXT_ISSUE_LABEL[issue]).join(" · ")}</p>;
}

const inputClass = "mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-white/90 focus:outline-none focus:ring-2 focus:ring-[#e0c985]/60";
const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-3.5 py-2 text-sm text-white/80 hover:border-[#e0c985]/35 disabled:cursor-not-allowed disabled:opacity-40";
const primaryClass = "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#e0c985] px-4 py-2 text-sm font-semibold text-[#17191d] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40";
const cardClass = "rounded-2xl border border-white/10 bg-black/10 p-4";

type SourceMode = "inherit" | "custom" | "none";
type SourceChoice = { sourceSentence?: string; hideSource?: boolean };
function sourceMode(choice: SourceChoice): SourceMode {
  return choice.hideSource ? "none" : choice.sourceSentence !== undefined ? "custom" : "inherit";
}
function withSourceMode<T extends SourceChoice>(value: T, mode: SourceMode, text = ""): T {
  const { sourceSentence: _sentence, hideSource: _hide, ...rest } = value;
  void _sentence; void _hide;
  if (mode === "none") return { ...rest, hideSource: true } as T;
  if (mode === "custom") return { ...rest, sourceSentence: text } as T;
  return rest as T;
}

function SourcePicker({ value, onChange, disabled, inheritLabel, idPrefix }: { value: SourceChoice; onChange: (next: SourceChoice) => void; disabled: boolean; inheritLabel: string; idPrefix: string }) {
  const mode = sourceMode(value);
  return (
    <div className="mt-3">
      <label className="block text-sm text-white/70" htmlFor={`${idPrefix}-mode`}>ประโยคบอกที่มา (ไม่บังคับ)</label>
      <select id={`${idPrefix}-mode`} className={inputClass} value={mode} disabled={disabled} onChange={(event) => onChange(withSourceMode(value, event.target.value as SourceMode, value.sourceSentence ?? ""))}>
        <option value="inherit">{inheritLabel}</option>
        <option value="custom">เขียนประโยคเอง</option>
        <option value="none">ไม่ต่อประโยคบอกที่มา</option>
      </select>
      {mode === "custom" ? <>
        <label className="mt-2 block text-sm text-white/70">ประโยคเอง <Counter value={value.sourceSentence ?? ""} max={LINE_CHAT_LIMITS.sourceSentence} />
          <input className={inputClass} value={value.sourceSentence ?? ""} disabled={disabled} placeholder="เช่น อ่านบทความเรื่องลดหย่อนภาษีด้วยประกันบำนาญมาครับ" onChange={(event) => onChange(withSourceMode(value, "custom", event.target.value))} />
        </label>
        <TextIssues value={value.sourceSentence ?? ""} max={LINE_CHAT_LIMITS.sourceSentence} />
      </> : null}
    </div>
  );
}

function PhonePreview({ panel }: { panel: ChatPanel }) {
  return (
    <div className="mx-auto mt-4 w-full max-w-[320px] rounded-[28px] border border-white/20 bg-[#251818] p-4 text-[#faf9f9]">
      {panel.mode === "plain" ? <p className="rounded-full bg-[#e0c985] px-4 py-3 text-center text-sm font-semibold text-[#251818]">คุยกับปั้นทาง LINE</p> : <>
        <p className="text-base font-semibold">{panel.headline}</p>
        <ul className="mt-3 grid gap-2">{panel.topics.map((topic) => <li key={topic.id} className={`rounded-xl border px-3 py-2.5 text-sm ${topic.journey === "type_own" ? "border-dashed border-white/20" : "border-white/20 bg-[#352727]"}`}>{topic.label}</li>)}</ul>
        <p className="mt-3 text-xs text-[#baabab]">{panel.note}</p>
      </>}
    </div>
  );
}

export default function LineChatManager({ initialModel, canEdit, categories = [] }: { initialModel: Model; canEdit: boolean; categories?: CategoryOption[] }) {
  const [model, setModel] = useState(initialModel);
  const [working, setWorking] = useState(() => normalize(initialModel.draft && !initialModel.draft.invalid ? initialModel.draft.config : initialModel.config));
  const [tab, setTab] = useState<Tab>("site");
  const [siteKey, setSiteKey] = useState("default");
  const [categoryKey, setCategoryKey] = useState(() => `category:${categories[0]?.slug ?? "health-insurance"}`);
  const [newCategory, setNewCategory] = useState("");
  const [pageSearch, setPageSearch] = useState("");
  const [pageTarget, setPageTarget] = useState<string>(`page:${LINE_CHAT_ROUTES[0].key}`);
  const [previewCampaign, setPreviewCampaign] = useState("");
  const [busy, setBusy] = useState<"draft" | "publish" | "discard" | "reload" | "revert" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newTopicId, setNewTopicId] = useState("");
  const [newCampaign, setNewCampaign] = useState({ code: "", title: "", type: "temporary" as LineChatCampaign["type"] });
  const [link, setLink] = useState({ code: "", channel: "facebook" as LineChatLinkChannel, path: "/", custom: "" });

  const published = model.config;
  const base = useMemo(() => normalize(model.draft && !model.draft.invalid ? model.draft.config : model.config), [model]);
  const savedTopicIds = useMemo(() => new Set(published.topics.map((topic) => topic.id)), [published]);
  const savedCampaignCodes = useMemo(() => new Set(published.campaigns.map((campaign) => campaign.code)), [published]);
  const validation = useMemo(() => lineChatConfigSchema.safeParse(working), [working]);
  const issueAt = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!validation.success) for (const issue of validation.error.issues) {
      const key = issue.path.join(".");
      map.set(key, [...(map.get(key) ?? []), ISSUE_MESSAGE[issue.message] ?? issue.message]);
    }
    return map;
  }, [validation]);
  const immutable = useMemo(() => lineChatImmutabilityIssues(published, working), [published, working]);
  const dirty = useMemo(() => JSON.stringify(working) !== JSON.stringify(base), [working, base]);
  const now = new Date();
  const warnings = lineChatAdminWarnings(working, now, { source: model.source, storedInvalid: model.storedInvalid, topicClicks30d: model.topicClicks30d });
  const topicById = new Map(working.topics.map((topic) => [topic.id, topic] as const));
  const overrides = working.pageOverrides ?? [];
  const templates = working.sourceTemplates ?? LINE_CHAT_DEFAULT_SOURCE_TEMPLATES;
  const ready = canEdit && model.writeReady && validation.success && !immutable.length && busy === null;
  const canSaveDraft = ready && dirty;
  const canPublish = ready && (dirty || Boolean(model.draft));

  // Page targets: site pages/tools by route key, articles by logical document id.
  const routeTargets = LINE_CHAT_ROUTES.map((route) => ({ key: `page:${route.key}`, title: route.label, detail: route.path, context: { pageGroup: route.group, routeKey: route.key } as ChatPageContext }));
  const articleTargets = model.articles.map((article) => ({ key: `doc:${article.id}`, title: article.title, detail: article.category ?? article.path, context: article.context }));
  const allTargets = [...routeTargets, ...articleTargets];
  const query = pageSearch.trim().toLowerCase();
  const visibleTargets = allTargets.filter((target) => !query || `${target.title} ${target.detail} ${target.key}`.toLowerCase().includes(query)).slice(0, 40);
  const selectedTarget = allTargets.find((target) => target.key === pageTarget)
    ?? (overrides.find((override) => override.key === pageTarget) ? { key: pageTarget, title: overrides.find((override) => override.key === pageTarget)!.title, detail: "ไม่พบในรายการบทความที่เผยแพร่", context: { pageGroup: "default" } as ChatPageContext } : routeTargets[0]);
  const selectedOverride = overrides.find((override) => override.key === selectedTarget.key);

  const categoryKeys = [...new Set([...categories.map((item) => `category:${item.slug}`), ...working.placements.map((item) => item.key).filter((key) => key.startsWith("category:"))])];

  // Preview follows the tab: a site group, a category page, or the selected page/article.
  const previewContext: ChatPageContext = tab === "site" ? (siteKey === "default" ? { pageGroup: "default" } : { pageGroup: siteKey, routeKey: LINE_CHAT_ROUTES.find((route) => route.group === siteKey)?.key })
    : tab === "category" ? { pageGroup: categoryKey }
      : selectedTarget.context;
  const previewName = tab === "site" ? groupLabel(siteKey) : tab === "category" ? groupLabel(categoryKey, categories) : selectedTarget.title;
  const preview = resolveChatPanel({ ...previewContext, config: working, utmCampaign: previewCampaign || null, now, consentGiven: true });
  const firstTopicHref = preview.mode === "panel" ? preview.topics[0]?.href : undefined;

  function update(next: (value: LineChatConfig) => LineChatConfig) {
    setWorking((previous) => normalize(next(normalize(previous))));
    setMessage(null);
  }
  function updateTopic(id: string, patch: Partial<LineChatTopic>) {
    update((value) => ({ ...value, topics: value.topics.map((topic) => topic.id === id ? { ...topic, ...patch } : topic) }));
  }
  function updateCampaign(code: string, patch: Partial<LineChatCampaign>) {
    update((value) => ({ ...value, campaigns: value.campaigns.map((campaign) => campaign.code === code ? { ...campaign, ...patch } : campaign) }));
  }
  function setPlacementTopics(key: string, topicIds: string[]) {
    update((value) => {
      const exists = value.placements.some((item) => item.key === key);
      return { ...value, placements: exists ? value.placements.map((item) => item.key === key ? { ...item, topicIds } : item) : [...value.placements, { key, topicIds }] };
    });
  }
  function setTemplates(patch: Partial<LineChatSourceTemplates>) {
    update((value) => ({ ...value, sourceTemplates: { ...(value.sourceTemplates ?? LINE_CHAT_DEFAULT_SOURCE_TEMPLATES), ...patch } }));
  }
  function setOverride(key: string, next: LineChatPageOverride | null) {
    update((value) => {
      const list = value.pageOverrides ?? [];
      const rest = list.filter((item) => item.key !== key);
      if (!next) return { ...value, pageOverrides: rest };
      return { ...value, pageOverrides: list.some((item) => item.key === key) ? list.map((item) => item.key === key ? next : item) : [...list, next] };
    });
  }
  function startOverride() {
    // Starts from what the page shows now (library topics only), so the owner edits rather than retypes.
    const current = resolveChatPanel({ ...selectedTarget.context, config: working, now, consentGiven: false });
    const ids = current.mode === "panel" ? current.topics.filter((topic) => topicById.has(topic.id)).map((topic) => topic.id) : [];
    const first = ids.length ? ids : [working.topics.find((topic) => topic.enabled)?.id ?? "book-a-chat"];
    setOverride(selectedTarget.key, { key: selectedTarget.key, title: selectedTarget.title.slice(0, LINE_CHAT_LIMITS.overrideTitle), enabled: true, topics: first.slice(0, LINE_CHAT_LIMITS.placementTopics).map((id) => ({ kind: "library", id })) });
  }
  function setOverrideTopics(override: LineChatPageOverride, topics: LineChatOverrideTopic[]) {
    setOverride(override.key, { ...override, topics });
  }
  function pagesUsing(id: string): string[] {
    return [
      ...working.placements.filter((item) => item.topicIds.includes(id)).map((item) => groupLabel(item.key, categories)),
      ...overrides.filter((item) => item.topics.some((topic) => topic.kind === "library" && topic.id === id)).map((item) => item.title),
    ];
  }

  async function reload(note?: string) {
    setBusy("reload");
    try {
      const response = await fetch("/api/admin/line/chat/", { cache: "no-store", headers: { Accept: "application/json" } });
      const payload = await response.json() as Model & { error?: string };
      if (!response.ok) throw new Error(payload.error || "reload-failed");
      setModel(payload);
      setWorking(normalize(payload.draft && !payload.draft.invalid ? payload.draft.config : payload.config));
      setMessage(note ?? "โหลดค่าล่าสุดแล้ว");
    } catch {
      setMessage("ยังโหลดค่าล่าสุดไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  async function put(body: Record<string, unknown>): Promise<{ ok: true; revision: string | null } | { ok: false; error: string }> {
    const response = await fetch("/api/admin/line/chat/", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({})) as { revision?: string | null; error?: string };
    return response.ok ? { ok: true, revision: payload.revision ?? null } : { ok: false, error: payload.error || "save-failed" };
  }

  function explain(error: string) {
    if (error === "stale-revision") return "มีการแก้ไขจากที่อื่นแล้ว กด “โหลดค่าล่าสุด” ก่อนบันทึกอีกครั้ง";
    if (error === "immutable-key") return "รหัสหัวข้อ เลขอ้างอิง และรหัสแคมเปญที่บันทึกแล้วเปลี่ยนหรือลบไม่ได้ ให้ปิดใช้หรือพักแทน";
    if (error === "invalid-request") return "ยังมีช่องที่ไม่ผ่านการตรวจ ดูข้อความสีแดงในแต่ละแท็บ";
    return "ยังบันทึกไม่ได้ ตรวจว่าพื้นที่เก็บเนื้อหาพร้อมใช้งาน แล้วลองใหม่";
  }

  async function saveDraft(): Promise<string | null> {
    const result = await put({ action: "draft", revision: model.revision, draftRevision: model.draft?.revision ?? null, config: working });
    if (!result.ok) { setMessage(explain(result.error)); return null; }
    return result.revision;
  }

  async function onSaveDraft() {
    setBusy("draft");
    setMessage(null);
    try {
      if (await saveDraft()) { setBusy(null); await reload("บันทึกร่างแล้ว · เว็บยังใช้ค่าที่เผยแพร่อยู่ จนกว่าจะกด “เผยแพร่”"); return; }
    } catch { setMessage(explain("")); }
    setBusy(null);
  }

  async function onPublish() {
    setBusy("publish");
    setMessage(null);
    try {
      const draftRevision = dirty ? await saveDraft() : model.draft?.revision ?? null;
      if (!draftRevision) { setBusy(null); return; }
      const result = await put({ action: "publish", revision: model.revision, draftRevision });
      if (!result.ok) { setMessage(explain(result.error)); setBusy(null); return; }
      setBusy(null);
      await reload("เผยแพร่แล้ว · เว็บจะใช้ค่านี้กับการเปิดหน้าครั้งถัดไป");
      return;
    } catch { setMessage(explain("")); }
    setBusy(null);
  }

  async function onDiscard() {
    if (!model.draft) { setWorking(normalize(model.config)); return; }
    setBusy("discard");
    try {
      const result = await put({ action: "discard", draftRevision: model.draft.revision });
      setBusy(null);
      if (!result.ok) { setMessage(explain(result.error)); return; }
      await reload("ทิ้งร่างแล้ว · กลับไปใช้ค่าที่เผยแพร่อยู่");
      return;
    } catch { setMessage(explain("")); }
    setBusy(null);
  }

  async function onRevert(revision: string) {
    if (!model.revision) return;
    setBusy("revert");
    try {
      const result = await put({ revision: model.revision, revertTo: revision });
      setBusy(null);
      if (!result.ok) { setMessage(explain(result.error)); return; }
      await reload("ย้อนกลับแล้ว · บันทึกเป็นเวอร์ชันใหม่");
      return;
    } catch { setMessage(explain("")); }
    setBusy(null);
  }

  function addTopic() {
    const id = newTopicId.trim();
    if (!TOPIC_ID.test(id) || topicById.has(id) || id === LINE_CHAT_TYPE_OWN.id) return;
    const ref = Math.max(0, ...working.topics.map((topic) => topic.ref)) + 1;
    update((value) => ({ ...value, topics: [...value.topics, { id, ref, label: "หัวข้อใหม่", prefill: "อยากคุยเรื่องนี้ครับ", journey: "life_health", enabled: true }] }));
    setNewTopicId("");
  }

  function addCampaign() {
    const code = newCampaign.code.trim().toLowerCase();
    if (!CAMPAIGN_CODE.test(code) || working.campaigns.some((campaign) => campaign.code === code)) return;
    const refCode = campaignRefFromCode(code);
    const start = new Date();
    const campaign: LineChatCampaign = newCampaign.type === "temporary"
      ? { code, refCode, title: newCampaign.title.trim() || code, type: "temporary", startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 14 * 86_400_000).toISOString(), pageGroups: ["all"], pinnedTopicIds: [working.topics.find((topic) => topic.enabled)?.id ?? ""], paused: false }
      : { code, refCode, title: newCampaign.title.trim() || code, type: "evergreen", reviewAt: defaultEvergreenReviewAt(start), pageGroups: ["all"], pinnedTopicIds: [working.topics.find((topic) => topic.enabled)?.id ?? ""], paused: false };
    update((value) => ({ ...value, campaigns: [...value.campaigns, campaign] }));
    setNewCampaign({ code: "", title: "", type: "temporary" });
  }

  const linkPath = link.path === "custom" ? link.custom.trim() : link.path;
  const builtLink = link.code ? buildLineChatCampaignLink(link.code, link.channel, linkPath) : null;

  function renderPlacementEditor(placementKey: string, allowReset: boolean) {
    const placement = working.placements.find((item) => item.key === placementKey);
    const index = working.placements.findIndex((item) => item.key === placementKey);
    const list = placement?.topicIds ?? [];
    return (
      <div className="grid gap-3">
        {!placement ? <p className="text-sm text-white/55">ยังไม่ได้ตั้ง หน้านี้ใช้ค่าจากชั้นที่กว้างกว่า (ค่าปกติทั้งเว็บ)</p> : null}
        <ol className="grid gap-2">
          {list.map((id, position) => (
            <li key={id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/10 p-3">
              <span className="min-w-0 flex-1 text-sm text-white/85">{position + 1}. {topicById.get(id)?.label ?? id}{topicById.get(id)?.enabled === false ? " (ปิดอยู่)" : ""}</span>
              {canEdit ? <>
                <button type="button" className={buttonClass} disabled={position === 0} aria-label={`เลื่อน ${topicById.get(id)?.label ?? id} ขึ้น`} onClick={() => { const next = [...list]; [next[position - 1], next[position]] = [next[position], next[position - 1]]; setPlacementTopics(placementKey, next); }}>↑ ขึ้น</button>
                <button type="button" className={buttonClass} disabled={position === list.length - 1} aria-label={`เลื่อน ${topicById.get(id)?.label ?? id} ลง`} onClick={() => { const next = [...list]; [next[position + 1], next[position]] = [next[position], next[position + 1]]; setPlacementTopics(placementKey, next); }}>↓ ลง</button>
                <button type="button" className={buttonClass} onClick={() => setPlacementTopics(placementKey, list.filter((item) => item !== id))}>เอาออก</button>
              </> : null}
            </li>
          ))}
        </ol>
        {index >= 0 && issueAt.get(`placements.${index}.topicIds`) ? <p className="text-xs text-red-300">{issueAt.get(`placements.${index}.topicIds`)!.join(" · ")}</p> : null}
        {canEdit && list.length < LINE_CHAT_LIMITS.placementTopics ? <label className="block text-sm text-white/70">เพิ่มหัวข้อจากคลัง
          <select className={inputClass} value="" onChange={(event) => { if (event.target.value) setPlacementTopics(placementKey, [...list, event.target.value]); }}>
            <option value="">เลือกหัวข้อ</option>
            {working.topics.filter((topic) => topic.enabled && !list.includes(topic.id)).map((topic) => <option key={topic.id} value={topic.id}>{topic.label}</option>)}
          </select>
        </label> : null}
        {canEdit && placement && allowReset ? <button type="button" className={buttonClass} onClick={() => update((value) => ({ ...value, placements: value.placements.filter((item) => item.key !== placementKey) }))}>ให้หน้านี้ใช้ค่าปกติ</button> : null}
      </div>
    );
  }

  const overrideIndex = selectedOverride ? overrides.findIndex((item) => item.key === selectedOverride.key) : -1;
  const customIds = new Set([...working.topics.map((topic) => topic.id), ...overrides.flatMap((item) => item.topics.map((topic) => topic.id)), LINE_CHAT_TYPE_OWN.id]);

  return (
    <section className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]" aria-label="ตั้งค่าปุ่มแชท LINE">
      <div className="min-w-0 rounded-3xl border border-[#e0c985]/20 bg-[#e0c985]/[0.035] p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60">{model.source === "stored" ? "เว็บใช้ค่าที่เผยแพร่ไว้" : "เว็บใช้ค่าเริ่มต้นจากระบบ"}</span>
          <span className={`rounded-full border px-3 py-1.5 text-xs ${model.writeReady ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-amber-200/20 bg-amber-200/10 text-amber-50"}`}>{model.writeReady ? "พร้อมบันทึก" : "ยังบันทึกไม่ได้"}</span>
          {model.draft ? <span className="rounded-full border border-sky-200/20 bg-sky-200/10 px-3 py-1.5 text-xs text-sky-50">มีร่างที่ยังไม่เผยแพร่ · {formatDate(model.draft.updatedAt)}{model.draft.updatedBy ? ` · ${model.draft.updatedBy}` : ""}</span> : null}
          {!canEdit ? <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/60">ดูได้อย่างเดียว · แก้ได้เฉพาะเจ้าของ</span> : null}
          <span className="text-xs text-white/45">เผยแพร่ล่าสุด {formatDate(model.updatedAt)}{model.updatedBy ? ` · ${model.updatedBy}` : ""}</span>
        </div>

        <p className="mt-4 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm leading-6 text-white/75">
          ลำดับที่เว็บใช้: <strong className="text-[#f4df9b]">แคมเปญที่ดันหัวข้อ</strong> → <strong className="text-[#f4df9b]">ตั้งรายหน้า</strong> → <strong className="text-[#f4df9b]">ตามหมวด</strong> → <strong className="text-[#f4df9b]">ค่าเริ่มต้นทั้งเว็บ</strong> (ชั้นที่เจาะจงกว่าชนะ) ข้อความใน LINE = ข้อความหัวข้อ + ประโยคบอกที่มา ไม่มีรหัสในข้อความ
        </p>

        {model.draft?.invalid ? <p className="mt-3 rounded-2xl border border-amber-200/25 bg-amber-200/10 px-4 py-3 text-sm text-amber-50">ร่างที่บันทึกไว้อ่านไม่ผ่านการตรวจ จึงเริ่มจากค่าที่เผยแพร่อยู่ บันทึกร่างใหม่หรือทิ้งร่างได้</p> : null}
        {warnings.length > 0 && <ul className="mt-4 grid gap-2" aria-label="สิ่งที่ควรดู">
          {warnings.map((warning, index) => (
            <li key={index} className={`rounded-2xl border px-4 py-3 text-sm ${warning.level === "danger" ? "border-red-300/20 bg-red-300/10 text-red-100" : warning.level === "warning" ? "border-amber-200/25 bg-amber-200/10 text-amber-50" : "border-white/10 bg-white/[0.03] text-white/70"}`}>
              {warning.kind === "running-defaults" && (warning.reason === "invalid-config" ? "เว็บกำลังใช้ค่าเริ่มต้น เพราะค่าที่บันทึกไว้อ่านไม่ผ่านการตรวจ บันทึกใหม่เพื่อแก้" : "เว็บกำลังใช้ค่าเริ่มต้น ยังไม่เคยเผยแพร่ค่าจากหน้านี้")}
              {warning.kind === "campaign-expiring" && `แคมเปญ ${warning.code} จะหมดใน 3 วัน (${formatDate(warning.endsAt)}) แล้วปุ่มจะกลับเป็นปกติเอง`}
              {warning.kind === "evergreen-overdue" && `แคมเปญต่อเนื่อง ${warning.code} เลยวันทบทวนแล้ว (${formatDate(warning.reviewAt)}) เปิดดูว่าข้อความยังถูกไหม แล้วกด “ยังใช้ได้”`}
              {warning.kind === "topic-no-clicks" && `หัวข้อ ${warning.id} ไม่มีคนกดใน 30 วัน`}
            </li>
          ))}
        </ul>}
        {model.topicClicks30d === null ? <p className="mt-3 text-xs text-white/45">ยอดกดรายหัวข้อ 30 วันยังไม่ได้เชื่อมกับรายงาน GA4 จึงยังไม่เตือนหัวข้อที่ไม่มีคนกด</p> : null}

        <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="ส่วนที่แก้">
          {TABS.map((item) => (
            <button key={item.id} type="button" role="tab" id={`line-chat-tab-${item.id}`} aria-selected={tab === item.id} aria-controls={`line-chat-panel-${item.id}`}
              className={`${buttonClass} ${tab === item.id ? "border-[#e0c985] text-[#f4df9b]" : ""}`} onClick={() => setTab(item.id)}>{item.label}</button>
          ))}
        </div>

        {tab === "site" && <div role="tabpanel" id="line-chat-panel-site" aria-labelledby="line-chat-tab-site" className="mt-5 grid gap-4">
          <p className="text-sm text-white/60">หัวข้อของแต่ละกลุ่มหน้า และค่าปกติของหน้าที่ไม่ได้ตั้ง เลือกหน้าละ 1–{LINE_CHAT_LIMITS.placementTopics} หัวข้อตามลำดับ “{LINE_CHAT_TYPE_OWN.label}” ต่อท้ายให้เสมอ</p>
          <label className="block text-sm text-white/70">กลุ่มหน้า
            <select className={inputClass} value={siteKey} onChange={(event) => setSiteKey(event.target.value)}>
              {SITE_GROUPS.map((key) => <option key={key} value={key}>{groupLabel(key)}{working.placements.some((item) => item.key === key) ? "" : " (ยังไม่ได้ตั้ง)"}</option>)}
            </select>
          </label>
          {renderPlacementEditor(siteKey, siteKey !== "default")}
        </div>}

        {tab === "category" && <div role="tabpanel" id="line-chat-panel-category" aria-labelledby="line-chat-tab-category" className="mt-5 grid gap-4">
          <p className="text-sm text-white/60">ใช้กับทุกบทความในหมวด และหน้าหมวดนั้น บทความจับคู่กับหมวดตามหัวข้อเนื้อหา (semantic topic) ก่อน แล้วจึงดูหมวดใน URL หมวดยังมาจากโครงสร้างเว็บเดิม ที่นี่เลือกได้แค่หัวข้อแชท</p>
          <label className="block text-sm text-white/70">หมวด
            <select className={inputClass} value={categoryKey} onChange={(event) => setCategoryKey(event.target.value)}>
              {categoryKeys.map((key) => <option key={key} value={key}>{groupLabel(key, categories)}{working.placements.some((item) => item.key === key) ? "" : " (ยังไม่ได้ตั้ง)"}</option>)}
            </select>
          </label>
          {renderPlacementEditor(categoryKey, true)}
          {canEdit ? <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm text-white/70">หมวดอื่น (slug ของหมวดใน URL)
              <input className={inputClass} value={newCategory} onChange={(event) => setNewCategory(event.target.value.toLowerCase())} placeholder="เช่น travel-insurance" />
            </label>
            <button type="button" className={buttonClass} disabled={!KEY_SLUG.test(newCategory)} onClick={() => { setPlacementTopics(`category:${newCategory}`, []); setCategoryKey(`category:${newCategory}`); setNewCategory(""); }}>เพิ่มหมวด</button>
          </div> : null}
        </div>}

        {tab === "page" && <div role="tabpanel" id="line-chat-panel-page" aria-labelledby="line-chat-tab-page" className="mt-5 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="min-w-0">
            <label className="block text-sm text-white/70">ค้นหาบทความหรือหน้า
              <input type="search" className={inputClass} value={pageSearch} onChange={(event) => setPageSearch(event.target.value)} placeholder="เช่น บำนาญ ลดหย่อนภาษี" />
            </label>
            <ul className="mt-3 grid max-h-[460px] gap-1.5 overflow-y-auto pr-3" aria-label="บทความและหน้า">
              {visibleTargets.map((target) => {
                const set = overrides.find((item) => item.key === target.key);
                return (
                  <li key={target.key}>
                    <button type="button" aria-pressed={target.key === selectedTarget.key} onClick={() => setPageTarget(target.key)}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${target.key === selectedTarget.key ? "border-[#e0c985] bg-[#e0c985]/10" : "border-white/10 hover:border-white/25"}`}>
                      <span className="block text-white/90">{target.title}</span>
                      <span className="mt-0.5 block text-xs text-white/50">{target.key.startsWith("page:") ? "หน้าเว็บ" : "บทความ"} · {target.detail}{set ? ` · ${set.enabled ? "ตั้งแล้ว" : "ตั้งไว้แต่ปิด"}` : ""}</span>
                    </button>
                  </li>
                );
              })}
              {visibleTargets.length === 0 ? <li className="text-sm text-white/50">ไม่พบ ลองคำอื่น</li> : null}
            </ul>
            {model.articles.length === 0 ? <p className="mt-2 text-xs text-white/45">ยังอ่านรายการบทความที่เผยแพร่ไม่ได้ ตั้งได้เฉพาะหน้าเว็บและเครื่องมือ</p> : null}
          </div>

          <div className="min-w-0 rounded-2xl border border-white/10 p-4">
            <h3 className="text-base font-semibold text-white/90">{selectedTarget.title}</h3>
            <p className="mt-1 text-xs text-white/50">{selectedTarget.detail}</p>
            {!selectedOverride ? <>
              <p className="mt-3 text-sm text-white/65">ตอนนี้ใช้หัวข้อจาก: {preview.mode === "panel" ? LAYER_LABEL[preview.layer] : "ปุ่ม LINE ธรรมดา"}</p>
              {canEdit ? <button type="button" className={`${primaryClass} mt-3`} onClick={startOverride}>ตั้งหัวข้อเฉพาะหน้านี้</button> : null}
            </> : <>
              <label className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-white/80">
                <input type="checkbox" checked={selectedOverride.enabled} disabled={!canEdit} onChange={(event) => setOverride(selectedOverride.key, { ...selectedOverride, enabled: event.target.checked })} /> ใช้หัวข้อเฉพาะหน้านี้
              </label>
              <ol className="mt-2 grid gap-3">
                {selectedOverride.topics.map((item, position, list) => {
                  const library = item.kind === "library" ? topicById.get(item.id) : undefined;
                  const move = (delta: number) => { const next = [...list]; [next[position + delta], next[position]] = [next[position], next[position + delta]]; setOverrideTopics(selectedOverride, next); };
                  const change = (next: LineChatOverrideTopic) => setOverrideTopics(selectedOverride, list.map((topic, index) => index === position ? next : topic));
                  return (
                    <li key={item.id} className={cardClass}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-white/85">{position + 1}. {item.kind === "library" ? `จากคลัง: ${library?.label ?? item.id}${library && !library.enabled ? " (ปิดอยู่)" : ""}` : "หัวข้อเฉพาะหน้านี้"}</span>
                        {canEdit ? <span className="flex flex-wrap gap-2">
                          <button type="button" className={buttonClass} disabled={position === 0} onClick={() => move(-1)}>↑ ขึ้น</button>
                          <button type="button" className={buttonClass} disabled={position === list.length - 1} onClick={() => move(1)}>↓ ลง</button>
                          <button type="button" className={buttonClass} disabled={list.length === 1} onClick={() => setOverrideTopics(selectedOverride, list.filter((_, index) => index !== position))}>เอาออก</button>
                        </span> : null}
                      </div>
                      {item.kind === "library" ? <p className="mt-2 break-words text-xs text-white/55">ข้อความ: {library?.prefill ?? "ไม่มีหัวข้อนี้ในคลัง"}</p> : <>
                        <label className="mt-3 block text-sm text-white/70">ชื่อบนปุ่ม <Counter value={item.label} max={LINE_CHAT_LIMITS.label} />
                          <input className={inputClass} value={item.label} disabled={!canEdit} onChange={(event) => change({ ...item, label: event.target.value })} />
                        </label>
                        <TextIssues value={item.label} max={LINE_CHAT_LIMITS.label} />
                        <label className="mt-3 block text-sm text-white/70">ข้อความ <Counter value={item.prefill} max={LINE_CHAT_LIMITS.prefill} />
                          <textarea className={inputClass} rows={3} value={item.prefill} disabled={!canEdit} onChange={(event) => change({ ...item, prefill: event.target.value })} />
                        </label>
                        <TextIssues value={item.prefill} max={LINE_CHAT_LIMITS.prefill} />
                      </>}
                      <SourcePicker idPrefix={`source-${item.id}`} value={item} disabled={!canEdit} inheritLabel="ใช้ประโยคของหน้านี้" onChange={(next) => change({ ...item, ...next, sourceSentence: next.sourceSentence, hideSource: next.hideSource } as LineChatOverrideTopic)} />
                      {issueAt.get(`pageOverrides.${overrideIndex}.topics.${position}.id`) ? <p className="mt-1 text-xs text-red-300">{issueAt.get(`pageOverrides.${overrideIndex}.topics.${position}.id`)!.join(" · ")}</p> : null}
                    </li>
                  );
                })}
              </ol>
              {issueAt.get(`pageOverrides.${overrideIndex}.topics`) ? <p className="mt-2 text-xs text-red-300">{issueAt.get(`pageOverrides.${overrideIndex}.topics`)!.join(" · ")}</p> : null}
              {canEdit && selectedOverride.topics.length < LINE_CHAT_LIMITS.placementTopics ? <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="block text-sm text-white/70">เพิ่มหัวข้อจากคลัง
                  <select className={inputClass} value="" onChange={(event) => { if (event.target.value) setOverrideTopics(selectedOverride, [...selectedOverride.topics, { kind: "library", id: event.target.value }]); }}>
                    <option value="">เลือกหัวข้อ</option>
                    {working.topics.filter((topic) => topic.enabled && !selectedOverride.topics.some((item) => item.id === topic.id)).map((topic) => <option key={topic.id} value={topic.id}>{topic.label}</option>)}
                  </select>
                </label>
                <button type="button" className={`${buttonClass} self-end`} onClick={() => setOverrideTopics(selectedOverride, [...selectedOverride.topics, { kind: "custom", id: randomCustomId(customIds), label: "", prefill: "" }])}>เพิ่มหัวข้อเฉพาะหน้านี้</button>
              </div> : null}
              <div className="mt-4 border-t border-white/10 pt-3">
                <SourcePicker idPrefix="source-page" value={selectedOverride} disabled={!canEdit} inheritLabel="ใช้แม่แบบ (แท็บประโยคบอกที่มา)" onChange={(next) => setOverride(selectedOverride.key, { ...selectedOverride, sourceSentence: next.sourceSentence, hideSource: next.hideSource })} />
              </div>
              {canEdit ? <button type="button" className={`${buttonClass} mt-4`} onClick={() => setOverride(selectedOverride.key, null)}>ลบการตั้งรายหน้า (กลับไปใช้ตามหมวด)</button> : null}
            </>}
          </div>
        </div>}

        {tab === "topics" && <div role="tabpanel" id="line-chat-panel-topics" aria-labelledby="line-chat-tab-topics" className="mt-5 grid gap-4">
          <p className="text-sm text-white/60">ชื่อบนปุ่มไม่เกิน {LINE_CHAT_LIMITS.label} ตัวอักษร ข้อความไม่เกิน {LINE_CHAT_LIMITS.prefill} ตัวอักษร ห้ามลิงก์ เบอร์โทร อีเมล รหัสอ้างอิง และคำต้องห้าม ระบบต่อประโยคบอกที่มาท้ายข้อความให้เอง</p>
          {working.topics.map((topic, index) => (
            <div key={topic.id} className={cardClass}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <code className="text-xs text-white/50">{topic.id}</code>
                <label className="inline-flex min-h-11 items-center gap-2 text-sm text-white/80">
                  <input type="checkbox" checked={topic.enabled} disabled={!canEdit} onChange={(event) => updateTopic(topic.id, { enabled: event.target.checked })} /> เปิดใช้
                </label>
              </div>
              {!topic.enabled && pagesUsing(topic.id).length > 0 ? <p className="mt-1 text-xs text-amber-100">ปิดแล้วจะหายจาก: {pagesUsing(topic.id).join(", ")}</p> : null}
              <label className="mt-3 block text-sm text-white/70">ชื่อบนปุ่ม <Counter value={topic.label} max={LINE_CHAT_LIMITS.label} />
                <input className={inputClass} value={topic.label} disabled={!canEdit} onChange={(event) => updateTopic(topic.id, { label: event.target.value })} />
              </label>
              <TextIssues value={topic.label} max={LINE_CHAT_LIMITS.label} />
              <label className="mt-3 block text-sm text-white/70">ข้อความ <Counter value={topic.prefill} max={LINE_CHAT_LIMITS.prefill} />
                <textarea className={inputClass} rows={2} value={topic.prefill} disabled={!canEdit} onChange={(event) => updateTopic(topic.id, { prefill: event.target.value })} />
              </label>
              <TextIssues value={topic.prefill} max={LINE_CHAT_LIMITS.prefill} />
              <label className="mt-3 block text-sm text-white/70">หมวด
                <select className={inputClass} value={topic.journey} disabled={!canEdit} onChange={(event) => updateTopic(topic.id, { journey: event.target.value as LineChatJourney })}>
                  {Object.entries(JOURNEY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              {issueAt.get(`topics.${index}.id`) ? <p className="mt-1 text-xs text-red-300">{issueAt.get(`topics.${index}.id`)!.join(" · ")}</p> : null}
              {!savedTopicIds.has(topic.id) && canEdit ? <button type="button" className={`${buttonClass} mt-3`} onClick={() => update((value) => ({ ...value, topics: value.topics.filter((item) => item.id !== topic.id), placements: value.placements.map((item) => ({ ...item, topicIds: item.topicIds.filter((id) => id !== topic.id) })) }))}>ลบหัวข้อที่ยังไม่เผยแพร่</button> : null}
            </div>
          ))}
          {canEdit ? <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm text-white/70">รหัสหัวข้อใหม่ (a-z, 0-9, -) ตั้งแล้วแก้ไม่ได้ ใช้ในสถิติเท่านั้น
              <input className={inputClass} value={newTopicId} onChange={(event) => setNewTopicId(event.target.value.toLowerCase())} placeholder="เช่น annuity-plan" />
            </label>
            <button type="button" className={buttonClass} disabled={!TOPIC_ID.test(newTopicId) || topicById.has(newTopicId)} onClick={addTopic}>เพิ่มหัวข้อ</button>
          </div> : null}
        </div>}

        {tab === "source" && <div role="tabpanel" id="line-chat-panel-source" aria-labelledby="line-chat-tab-source" className="mt-5 grid gap-4">
          <p className="text-sm text-white/60">ประโยคบอกที่มา (ไม่บังคับ) ต่อท้ายข้อความ เพื่อให้รู้ว่าคนทักมาจากหน้าไหน เขียนเหมือนคนอ่านพิมพ์เอง ห้ามมีรหัส เว้นว่างเพื่อปิด ตั้งแทนได้รายหน้าและรายหัวข้อในแท็บ “รายหน้า” ถ้าชื่อบทความมีอะไรที่ดูเป็นรหัส ระบบจะไม่ต่อประโยคให้หน้านั้น</p>
          {([
            { kind: "article", label: "หน้าบทความ", hint: "{title} = ชื่อบทความ (ตัดส่วนหลัง ? หรือ : และยาวไม่เกิน 60 ตัวอักษร)" },
            { kind: "tool", label: "หน้าเครื่องมือ", hint: "{toolName} = ชื่อเครื่องมือ เช่น วางแผนเงินก้อนโรคร้ายแรง" },
          ] as const).map((item) => {
            const issues = chatTemplateIssues(templates[item.kind], item.kind);
            return (
              <div key={item.kind} className={cardClass}>
                <label className="block text-sm text-white/70">ประโยคบอกที่มา (ไม่บังคับ) · {item.label} <Counter value={templates[item.kind]} max={LINE_CHAT_LIMITS.sourceSentence} />
                  <input className={inputClass} value={templates[item.kind]} disabled={!canEdit} onChange={(event) => setTemplates({ [item.kind]: event.target.value })} />
                </label>
                <p className="mt-1 text-xs text-white/45">{item.hint}</p>
                {issues.length ? <p className="mt-1 text-xs text-red-300" role="alert">{issues.map((issue) => CHAT_TEMPLATE_ISSUE_LABEL[issue]).join(" · ")}</p> : null}
                {canEdit && templates[item.kind] !== LINE_CHAT_DEFAULT_SOURCE_TEMPLATES[item.kind] ? <button type="button" className={`${buttonClass} mt-2`} onClick={() => setTemplates({ [item.kind]: LINE_CHAT_DEFAULT_SOURCE_TEMPLATES[item.kind] })}>ใช้ค่าเริ่มต้น</button> : null}
              </div>
            );
          })}
          <p className="text-xs text-white/45">หน้าแรก หน้ารวมบทความ หน้าหมวด และหน้าเกี่ยวกับปั้นไม่ต่อประโยค ยกเว้นตั้งเองในแท็บ “รายหน้า”</p>
        </div>}

        {tab === "campaigns" && <div role="tabpanel" id="line-chat-panel-campaigns" aria-labelledby="line-chat-tab-campaigns" className="mt-5 grid gap-4">
          <p className="text-sm text-white/60">รหัสแคมเปญคือค่า utm_campaign ของลิงก์โฆษณา ตั้งแล้วแก้ไม่ได้ แคมเปญดันหัวข้อขึ้นบนสุดเหนือหัวข้อของหน้า (ทั้งตั้งรายหน้า ตามหมวด และค่าเริ่มต้น) แคมเปญชั่วคราวกลับเป็นปกติเองเมื่อถึงวันจบ แคมเปญต่อเนื่องไม่ปิดเอง แต่ต้องทบทวนทุก 90 วัน</p>
          {working.campaigns.map((campaign, index) => (
            <div key={campaign.code} className={`rounded-2xl border p-4 ${campaign.type === "evergreen" && campaign.reviewAt && Date.parse(campaign.reviewAt) <= now.getTime() ? "border-red-300/20" : "border-white/10"} bg-black/10`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <code className="text-xs text-white/60">{campaign.code} · {campaign.type === "temporary" ? "ชั่วคราว" : "ต่อเนื่อง"}</code>
                <label className="inline-flex min-h-11 items-center gap-2 text-sm text-white/80"><input type="checkbox" checked={campaign.paused} disabled={!canEdit} onChange={(event) => updateCampaign(campaign.code, { paused: event.target.checked })} /> พักแคมเปญ</label>
              </div>
              <label className="mt-3 block text-sm text-white/70">ชื่อแคมเปญ (เห็นเฉพาะใน Admin)
                <input className={inputClass} value={campaign.title} disabled={!canEdit} onChange={(event) => updateCampaign(campaign.code, { title: event.target.value })} />
              </label>
              <label className="mt-3 block text-sm text-white/70">หัวแผงแชท (ถ้าไม่ใส่ใช้ “คุยกับปั้นทาง LINE”) <Counter value={campaign.headline ?? ""} max={LINE_CHAT_LIMITS.headline} />
                <input className={inputClass} value={campaign.headline ?? ""} disabled={!canEdit} onChange={(event) => updateCampaign(campaign.code, { headline: event.target.value || undefined })} />
              </label>
              {campaign.headline ? <TextIssues value={campaign.headline} max={LINE_CHAT_LIMITS.headline} /> : null}
              {campaign.type === "temporary" ? <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm text-white/70">เริ่ม<input type="datetime-local" className={inputClass} value={toLocalInput(campaign.startsAt)} disabled={!canEdit} onChange={(event) => updateCampaign(campaign.code, { startsAt: fromLocalInput(event.target.value) })} /></label>
                <label className="block text-sm text-white/70">จบ<input type="datetime-local" className={inputClass} value={toLocalInput(campaign.endsAt)} disabled={!canEdit} onChange={(event) => updateCampaign(campaign.code, { endsAt: fromLocalInput(event.target.value) })} /></label>
              </div> : <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="block text-sm text-white/70">วันทบทวน<input type="datetime-local" className={inputClass} value={toLocalInput(campaign.reviewAt)} disabled={!canEdit} onChange={(event) => updateCampaign(campaign.code, { reviewAt: fromLocalInput(event.target.value) })} /></label>
                {canEdit ? <button type="button" className={buttonClass} onClick={() => updateCampaign(campaign.code, { reviewAt: defaultEvergreenReviewAt(new Date()) })}>ยังใช้ได้ (ต่ออีก 90 วัน)</button> : null}
              </div>}
              {["startsAt", "endsAt", "reviewAt"].map((field) => issueAt.get(`campaigns.${index}.${field}`) ? <p key={field} className="mt-1 text-xs text-red-300">{issueAt.get(`campaigns.${index}.${field}`)!.join(" · ")}</p> : null)}
              <fieldset className="mt-3">
                <legend className="text-sm text-white/70">หน้าที่ใช้</legend>
                <div className="mt-1 flex flex-wrap gap-x-4">
                  {LINE_CHAT_CAMPAIGN_TARGETS.map((target) => (
                    <label key={target} className="inline-flex min-h-11 items-center gap-2 text-sm text-white/80">
                      <input type="checkbox" checked={campaign.pageGroups.includes(target)} disabled={!canEdit}
                        onChange={(event) => updateCampaign(campaign.code, { pageGroups: event.target.checked ? [...campaign.pageGroups, target] : campaign.pageGroups.filter((item) => item !== target) as LineChatCampaignTarget[] })} />
                      {GROUP_LABEL[target]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="mt-3 block text-sm text-white/70">หัวข้อที่ดันขึ้นบนสุด (ไม่เกิน {LINE_CHAT_LIMITS.placementTopics})
                <select multiple className={`${inputClass} min-h-36`} value={campaign.pinnedTopicIds} disabled={!canEdit}
                  onChange={(event) => updateCampaign(campaign.code, { pinnedTopicIds: Array.from(event.target.selectedOptions, (option) => option.value).slice(0, LINE_CHAT_LIMITS.placementTopics) })}>
                  {working.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.label}{topic.enabled ? "" : " (ปิดอยู่)"}</option>)}
                </select>
              </label>
              {issueAt.get(`campaigns.${index}.pinnedTopicIds`) ? <p className="mt-1 text-xs text-red-300">{issueAt.get(`campaigns.${index}.pinnedTopicIds`)!.join(" · ")}</p> : null}
              {!savedCampaignCodes.has(campaign.code) && canEdit ? <button type="button" className={`${buttonClass} mt-3`} onClick={() => update((value) => ({ ...value, campaigns: value.campaigns.filter((item) => item.code !== campaign.code) }))}>ลบแคมเปญที่ยังไม่เผยแพร่</button> : null}
            </div>
          ))}
          {canEdit ? <div className="grid gap-2 rounded-2xl border border-dashed border-white/15 p-4 sm:grid-cols-2">
            <label className="text-sm text-white/70">รหัสแคมเปญ = utm_campaign<input className={inputClass} value={newCampaign.code} onChange={(event) => setNewCampaign({ ...newCampaign, code: event.target.value.toLowerCase() })} placeholder="เช่น smartnetwork-2611" /></label>
            <label className="text-sm text-white/70">ชื่อแคมเปญ<input className={inputClass} value={newCampaign.title} onChange={(event) => setNewCampaign({ ...newCampaign, title: event.target.value })} /></label>
            <label className="text-sm text-white/70">ประเภท<select className={inputClass} value={newCampaign.type} onChange={(event) => setNewCampaign({ ...newCampaign, type: event.target.value as LineChatCampaign["type"] })}><option value="temporary">ชั่วคราว (มีวันจบ)</option><option value="evergreen">ต่อเนื่อง (ลิงก์ใน bio, Rich Menu)</option></select></label>
            <button type="button" className={`${buttonClass} sm:col-span-2`} disabled={!CAMPAIGN_CODE.test(newCampaign.code) || working.campaigns.some((campaign) => campaign.code === newCampaign.code)} onClick={addCampaign}>เพิ่มแคมเปญ</button>
          </div> : null}

          <div className={cardClass}>
            <h3 className="text-base font-semibold text-white/90">สร้างลิงก์แคมเปญ</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-sm text-white/70">แคมเปญ<select className={inputClass} value={link.code} onChange={(event) => setLink({ ...link, code: event.target.value })}><option value="">เลือก</option>{working.campaigns.map((campaign) => <option key={campaign.code} value={campaign.code}>{campaign.title} ({campaign.code})</option>)}</select></label>
              <label className="text-sm text-white/70">ช่องทาง<select className={inputClass} value={link.channel} onChange={(event) => setLink({ ...link, channel: event.target.value as LineChatLinkChannel })}>{Object.entries(LINE_CHAT_LINK_CHANNELS).map(([value, channel]) => <option key={value} value={value}>{channel.label}</option>)}</select></label>
              <label className="text-sm text-white/70">หน้าปลายทาง<select className={inputClass} value={link.path} onChange={(event) => setLink({ ...link, path: event.target.value })}>{DESTINATIONS.map((item) => <option key={item.path} value={item.path}>{item.label}</option>)}<option value="custom">ใส่ path เอง</option></select></label>
            </div>
            {link.path === "custom" ? <label className="mt-3 block text-sm text-white/70">Path บน ccpun.com<input className={inputClass} value={link.custom} onChange={(event) => setLink({ ...link, custom: event.target.value })} placeholder="/blog/health-insurance/" /></label> : null}
            {builtLink ? <div className="mt-3 flex flex-wrap items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-xl bg-black/25 px-3 py-2 text-xs text-white/80">{builtLink}</code><button type="button" className={buttonClass} onClick={() => navigator.clipboard?.writeText(builtLink).then(() => setMessage("คัดลอกลิงก์แล้ว")).catch(() => setMessage("คัดลอกไม่ได้ เลือกข้อความเพื่อคัดลอกเอง"))}>คัดลอก</button></div>
              : <p className="mt-3 text-xs text-white/45">เลือกแคมเปญที่บันทึกแล้ว ช่องทาง และหน้าปลายทาง (path ต้องขึ้นต้นและลงท้ายด้วย /)</p>}
          </div>
        </div>}

        {tab === "switch" && <div role="tabpanel" id="line-chat-panel-switch" aria-labelledby="line-chat-tab-switch" className="mt-5 grid gap-3">
          <label className="inline-flex min-h-11 items-center gap-3 text-sm text-white/85">
            <input type="checkbox" checked={working.enabled} disabled={!canEdit} onChange={(event) => update((value) => ({ ...value, enabled: event.target.checked }))} />
            เปิดแผงหัวข้อทั้งเว็บ
          </label>
          <p className="text-sm text-white/60">ปิดแล้วปุ่มไม่หายจากจอ แต่กลายเป็นปุ่ม LINE ธรรมดาที่เปิดแชท @ccpun ทันที</p>
        </div>}

        {immutable.length > 0 ? <p className="mt-4 text-sm text-red-300" role="alert">มีรหัสที่บันทึกแล้วถูกลบหรือเปลี่ยน ให้โหลดค่าล่าสุด แล้วปิดใช้หรือพักแทน</p> : null}
        {!validation.success ? <p className="mt-4 text-sm text-amber-100">ยังบันทึกไม่ได้: มีช่องที่ไม่ผ่านการตรวจ {validation.error.issues.length} จุด</p> : null}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button type="button" className={buttonClass} disabled={!canSaveDraft} onClick={onSaveDraft}>{busy === "draft" ? "กำลังบันทึกร่าง" : "บันทึกร่าง"}</button>
          <button type="button" className={primaryClass} disabled={!canPublish} onClick={onPublish}>{busy === "publish" ? "กำลังเผยแพร่" : "เผยแพร่"}</button>
          <button type="button" className={buttonClass} disabled={busy !== null} onClick={() => reload()}>โหลดค่าล่าสุด</button>
          <button type="button" className={buttonClass} disabled={busy !== null || !dirty} onClick={() => { setWorking(base); setMessage(null); }}>ยกเลิกที่แก้</button>
          {model.draft && canEdit ? <button type="button" className={buttonClass} disabled={busy !== null} onClick={onDiscard}>{busy === "discard" ? "กำลังทิ้งร่าง" : "ทิ้งร่าง"}</button> : null}
          {message ? <p className="text-sm text-white/70" role="status">{message}</p> : null}
        </div>
        <p className="mt-2 text-xs text-white/45">“บันทึกร่าง” เก็บไว้ก่อน เว็บยังไม่เปลี่ยน “เผยแพร่” ตรวจค่าทั้งหมดอีกครั้งแล้วให้เว็บใช้ทันที</p>

        <details className="mt-6 rounded-2xl border border-white/10 p-4">
          <summary className="cursor-pointer text-sm text-white/75">ประวัติการเผยแพร่และย้อนกลับ</summary>
          {model.history.length === 0 ? <p className="mt-3 text-sm text-white/50">ยังไม่มีประวัติ</p> : <ul className="mt-3 grid gap-2">
            {model.history.map((entry, index) => (
              <li key={entry.revision} className="flex flex-wrap items-center gap-3 text-sm text-white/70">
                <span>{formatDate(entry.timestamp)}</span><code className="text-xs text-white/45">{entry.revision}</code>
                {index === 0 ? <span className="text-xs text-emerald-200/80">ใช้อยู่ตอนนี้</span>
                  : canEdit ? <button type="button" className={buttonClass} disabled={busy !== null || !model.revision} onClick={() => onRevert(entry.revision)}>ย้อนกลับไปเวอร์ชันนี้</button> : null}
              </li>
            ))}
          </ul>}
        </details>
      </div>

      <aside className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 xl:sticky xl:top-5 xl:self-start" aria-label="ตัวอย่างบนมือถือ">
        <h2 className="text-base font-semibold text-white/90">ตัวอย่างบนมือถือ</h2>
        <p className="mt-1 text-sm text-white/65">{previewName}{preview.mode === "panel" ? ` · ใช้หัวข้อจาก ${LAYER_LABEL[preview.layer]}${preview.campaignCode ? " + แคมเปญ" : ""}` : ""}</p>
        <label className="mt-3 block text-sm text-white/70">มาจากลิงก์แคมเปญ
          <select className={inputClass} value={previewCampaign} onChange={(event) => setPreviewCampaign(event.target.value)}><option value="">ไม่ได้มาจากแคมเปญ</option>{working.campaigns.map((campaign) => <option key={campaign.code} value={campaign.code}>{campaign.code}</option>)}</select>
        </label>
        <PhonePreview panel={preview} />
        {preview.mode === "panel" ? <div className="mt-4">
          <h3 className="text-sm font-semibold text-white/85">ข้อความที่ลูกค้าจะเห็นและส่งใน LINE</h3>
          <ol className="mt-2 grid gap-2">
            {preview.topics.map((topic) => <li key={topic.id} className="rounded-xl bg-emerald-300/10 px-3 py-2 text-xs leading-5 text-white/80"><span className="block text-white/50">{topic.label}</span>{topic.prefill}{hasVisibleCode(topic.prefill) ? <span className="mt-1 block text-red-300">มีข้อความที่ดูเป็นรหัส</span> : null}</li>)}
          </ol>
          <p className="mt-2 text-xs text-emerald-100/80">{preview.topics.every((topic) => !hasVisibleCode(topic.prefill)) ? "ไม่มีรหัสในข้อความ ระบบเก็บหัวข้อ หน้า และแคมเปญไว้หลังบ้านในสถิติเท่านั้น (เฉพาะคนที่ยินยอมคุกกี้วิเคราะห์)" : ""}</p>
        </div> : null}
        {firstTopicHref ? <a href={firstTopicHref} target="_blank" rel="noopener noreferrer" className={`${buttonClass} mt-3 w-full`}>ลองเปิดใน LINE</a> : null}
        <p className="mt-3 text-xs text-white/45">ตัวอย่างใช้ค่าที่กำลังแก้ ยังไม่บันทึกก็ดูได้ บนเว็บจริงแคมเปญจะตามคนไปหน้าอื่นเฉพาะคนที่ยินยอมคุกกี้วิเคราะห์</p>
      </aside>
    </section>
  );
}
