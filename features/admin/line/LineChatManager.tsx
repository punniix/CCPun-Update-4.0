"use client";

import { useMemo, useState } from "react";
import {
  buildLineChatCampaignLink,
  CHAT_TEXT_ISSUE_LABEL,
  chatTextIssues,
  countChatCharacters,
  defaultEvergreenReviewAt,
  LINE_CHAT_CAMPAIGN_TARGETS,
  LINE_CHAT_FIXED_PAGE_GROUPS,
  LINE_CHAT_LIMITS,
  LINE_CHAT_LINK_CHANNELS,
  LINE_CHAT_TYPE_OWN,
  lineChatAdminWarnings,
  lineChatConfigSchema,
  lineChatImmutabilityIssues,
  resolveChatPanel,
  type ChatPageContext,
  type LineChatCampaign,
  type LineChatCampaignTarget,
  type LineChatConfig,
  type LineChatJourney,
  type LineChatLinkChannel,
  type LineChatTopic,
} from "@/lib/line/chat-config";

type HistoryEntry = { revision: string; timestamp: string; author: string | null };
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
};

type Tab = "topics" | "placements" | "campaigns" | "switch";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "topics", label: "คลังหัวข้อ" },
  { id: "placements", label: "หน้าไหนใช้อะไร" },
  { id: "campaigns", label: "แคมเปญ" },
  { id: "switch", label: "สวิตช์หลัก" },
];

const JOURNEY_LABEL: Record<LineChatJourney, string> = { life_health: "ชีวิต / สุขภาพ", motor: "ประกันรถ", investment: "ลงทุน", human: "คุยกับปั้น" };
const GROUP_LABEL: Record<string, string> = {
  all: "ทั้งเว็บ", home: "หน้าแรก", blog_index: "หน้ารวมบทความ", blog_category: "หน้าหมวดบทความทุกหมวด", article: "ทุกบทความ",
  tool_ci: "วางแผนเงินก้อนโรคร้ายแรง", tool_fhc: "ตรวจสุขภาพการเงิน", tool_money_story: "Money Story", tool_investment_allocation: "วางแผนกองทุน",
  tools_hub: "หน้ารวมเครื่องมือ", about: "เกี่ยวกับปั้น", default: "ค่าปกติ (หน้าที่ไม่ได้ตั้ง)",
};
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

function groupLabel(key: string): string {
  if (key.startsWith("category:")) return `หมวด ${key.slice(9)}`;
  if (key.startsWith("article:")) return `บทความ ${key.slice(8)}`;
  return GROUP_LABEL[key] ?? key;
}

function contextForKey(key: string): ChatPageContext {
  return key.startsWith("article:") ? { pageGroup: "default", articleSlug: key.slice(8) } : { pageGroup: key };
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

function clone(config: LineChatConfig): LineChatConfig {
  return JSON.parse(JSON.stringify(config)) as LineChatConfig;
}

const ISSUE_MESSAGE: Record<string, string> = {
  duplicate: "ซ้ำกับรายการอื่น",
  "unknown-topic": "ไม่มีหัวข้อนี้ในคลัง",
  "no-enabled-topic": "ต้องมีหัวข้อที่เปิดใช้อย่างน้อย 1 หัวข้อ",
  "missing-default": "ต้องมีค่าปกติ",
  required: "ต้องกรอก",
  "ends-before-start": "วันจบต้องอยู่หลังวันเริ่ม",
  "evergreen-has-no-end": "แคมเปญต่อเนื่องไม่มีวันจบ",
  ...CHAT_TEXT_ISSUE_LABEL,
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

export default function LineChatManager({ initialModel, canEdit }: { initialModel: Model; canEdit: boolean }) {
  const [model, setModel] = useState(initialModel);
  const [draft, setDraft] = useState(() => clone(initialModel.config));
  const [tab, setTab] = useState<Tab>("topics");
  const [placementKey, setPlacementKey] = useState("home");
  const [previewKey, setPreviewKey] = useState("home");
  const [previewCampaign, setPreviewCampaign] = useState("");
  const [busy, setBusy] = useState<"save" | "reload" | "revert" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newTopicId, setNewTopicId] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newCampaign, setNewCampaign] = useState({ code: "", refCode: "", title: "", type: "temporary" as LineChatCampaign["type"] });
  const [link, setLink] = useState({ code: "", channel: "facebook" as LineChatLinkChannel, path: "/", custom: "" });

  const savedConfig = model.config;
  const savedTopicIds = useMemo(() => new Set(savedConfig.topics.map((topic) => topic.id)), [savedConfig]);
  const savedCampaignCodes = useMemo(() => new Set(savedConfig.campaigns.map((campaign) => campaign.code)), [savedConfig]);
  const validation = useMemo(() => lineChatConfigSchema.safeParse(draft), [draft]);
  const issueAt = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!validation.success) for (const issue of validation.error.issues) {
      const key = issue.path.join(".");
      map.set(key, [...(map.get(key) ?? []), ISSUE_MESSAGE[issue.message] ?? issue.message]);
    }
    return map;
  }, [validation]);
  const immutable = useMemo(() => lineChatImmutabilityIssues(savedConfig, draft), [savedConfig, draft]);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(savedConfig), [draft, savedConfig]);
  const now = new Date();
  const warnings = lineChatAdminWarnings(draft, now, { source: model.source, storedInvalid: model.storedInvalid, topicClicks30d: model.topicClicks30d });
  const topicById = new Map(draft.topics.map((topic) => [topic.id, topic] as const));
  const placementKeys = [...new Set([...LINE_CHAT_FIXED_PAGE_GROUPS, ...draft.placements.map((placement) => placement.key)])];
  const placement = draft.placements.find((item) => item.key === placementKey);
  const preview = resolveChatPanel({ ...contextForKey(previewKey), config: draft, utmCampaign: previewCampaign || null, now, consentGiven: true });
  const canSave = canEdit && model.writeReady && dirty && validation.success && !immutable.length && busy === null;

  function update(next: (value: LineChatConfig) => LineChatConfig) {
    setDraft((previous) => next(clone(previous)));
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
  function pagesUsing(id: string): string[] {
    return draft.placements.filter((item) => item.topicIds.includes(id)).map((item) => groupLabel(item.key));
  }

  async function reload() {
    setBusy("reload");
    setMessage(null);
    try {
      const response = await fetch("/api/admin/line/chat/", { cache: "no-store", headers: { Accept: "application/json" } });
      const payload = await response.json() as Model & { error?: string };
      if (!response.ok) throw new Error(payload.error || "reload-failed");
      setModel(payload);
      setDraft(clone(payload.config));
      setMessage("โหลดค่าล่าสุดแล้ว");
    } catch {
      setMessage("ยังโหลดค่าล่าสุดไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  async function send(body: Record<string, unknown>, kind: "save" | "revert") {
    setBusy(kind);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/line/chat/", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as { revision?: string; config?: LineChatConfig; error?: string };
      if (!response.ok) {
        if (payload.error === "stale-revision") { setMessage("มีการแก้ไขจากที่อื่นแล้ว กด “โหลดค่าล่าสุด” ก่อนบันทึกอีกครั้ง"); return; }
        if (payload.error === "immutable-key") { setMessage("รหัสหัวข้อ เลขอ้างอิง และรหัสแคมเปญที่บันทึกแล้วเปลี่ยนหรือลบไม่ได้ ให้ปิดใช้หรือพักแทน"); return; }
        if (payload.error === "invalid-request") { setMessage("ยังมีช่องที่ไม่ผ่านการตรวจ ดูข้อความสีแดงในแต่ละแท็บ"); return; }
        throw new Error(payload.error || "save-failed");
      }
      await reload();
      setMessage(kind === "save" ? "บันทึกแล้ว · เว็บจะใช้ค่านี้กับการเปิดหน้าครั้งถัดไป" : "ย้อนกลับแล้ว · บันทึกเป็นเวอร์ชันใหม่");
    } catch {
      setMessage("ยังบันทึกไม่ได้ ตรวจว่าพื้นที่เก็บเนื้อหาพร้อมใช้งาน แล้วลองใหม่");
    } finally {
      setBusy(null);
    }
  }

  function addTopic() {
    const id = newTopicId.trim();
    if (!TOPIC_ID.test(id) || topicById.has(id) || id === LINE_CHAT_TYPE_OWN.id) return;
    const ref = Math.max(0, ...draft.topics.map((topic) => topic.ref)) + 1;
    update((value) => ({ ...value, topics: [...value.topics, { id, ref, label: "หัวข้อใหม่", prefill: "อยากคุยเรื่องนี้ครับ", journey: "life_health", enabled: true }] }));
    setNewTopicId("");
  }

  function addCampaign() {
    const code = newCampaign.code.trim().toLowerCase();
    const refCode = newCampaign.refCode.trim().toUpperCase();
    if (!CAMPAIGN_CODE.test(code) || !/^[A-Z]{2,4}$/.test(refCode) || draft.campaigns.some((campaign) => campaign.code === code)) return;
    const start = new Date();
    const campaign: LineChatCampaign = newCampaign.type === "temporary"
      ? { code, refCode, title: newCampaign.title.trim() || code, type: "temporary", startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 14 * 86_400_000).toISOString(), pageGroups: ["all"], pinnedTopicIds: [draft.topics.find((topic) => topic.enabled)?.id ?? ""], paused: false }
      : { code, refCode, title: newCampaign.title.trim() || code, type: "evergreen", reviewAt: defaultEvergreenReviewAt(start), pageGroups: ["all"], pinnedTopicIds: [draft.topics.find((topic) => topic.enabled)?.id ?? ""], paused: false };
    update((value) => ({ ...value, campaigns: [...value.campaigns, campaign] }));
    setNewCampaign({ code: "", refCode: "", title: "", type: "temporary" });
  }

  const linkPath = link.path === "custom" ? link.custom.trim() : link.path;
  const builtLink = link.code ? buildLineChatCampaignLink(link.code, link.channel, linkPath) : null;
  const firstTopicHref = preview.mode === "panel" ? preview.topics[0]?.href : undefined;

  return (
    <section className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]" aria-label="ตั้งค่าปุ่มแชท LINE">
      <div className="min-w-0 rounded-3xl border border-[#e0c985]/20 bg-[#e0c985]/[0.035] p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60">{model.source === "stored" ? "เว็บใช้ค่าที่บันทึกไว้" : "เว็บใช้ค่าเริ่มต้นจากระบบ"}</span>
          <span className={`rounded-full border px-3 py-1.5 text-xs ${model.writeReady ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-amber-200/20 bg-amber-200/10 text-amber-50"}`}>{model.writeReady ? "พร้อมบันทึก" : "ยังบันทึกไม่ได้"}</span>
          {!canEdit ? <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/60">ดูได้อย่างเดียว · แก้ได้เฉพาะเจ้าของ</span> : null}
          <span className="text-xs text-white/45">แก้ล่าสุด {formatDate(model.updatedAt)}{model.updatedBy ? ` · ${model.updatedBy}` : ""}</span>
        </div>

        {warnings.length > 0 && <ul className="mt-4 grid gap-2" aria-label="สิ่งที่ควรดู">
          {warnings.map((warning, index) => (
            <li key={index} className={`rounded-2xl border px-4 py-3 text-sm ${warning.level === "danger" ? "border-red-300/20 bg-red-300/10 text-red-100" : warning.level === "warning" ? "border-amber-200/25 bg-amber-200/10 text-amber-50" : "border-white/10 bg-white/[0.03] text-white/70"}`}>
              {warning.kind === "running-defaults" && (warning.reason === "invalid-config" ? "เว็บกำลังใช้ค่าเริ่มต้น เพราะค่าที่บันทึกไว้อ่านไม่ผ่านการตรวจ บันทึกใหม่เพื่อแก้" : "เว็บกำลังใช้ค่าเริ่มต้น ยังไม่เคยบันทึกค่าจากหน้านี้")}
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

        {tab === "topics" && <div role="tabpanel" id="line-chat-panel-topics" aria-labelledby="line-chat-tab-topics" className="mt-5 grid gap-4">
          <p className="text-sm text-white/60">ชื่อบนปุ่มไม่เกิน {LINE_CHAT_LIMITS.label} ตัวอักษร ข้อความตั้งต้นไม่เกิน {LINE_CHAT_LIMITS.prefill} ตัวอักษร ห้ามลิงก์ เบอร์โทร อีเมล และคำต้องห้าม ระบบต่อรหัสอ้างอิงท้ายข้อความให้เอง</p>
          {draft.topics.map((topic, index) => (
            <div key={topic.id} className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <code className="text-xs text-white/50">{topic.id} · เลข {String(topic.ref).padStart(2, "0")}</code>
                <label className="inline-flex min-h-11 items-center gap-2 text-sm text-white/80">
                  <input type="checkbox" checked={topic.enabled} disabled={!canEdit} onChange={(event) => updateTopic(topic.id, { enabled: event.target.checked })} /> เปิดใช้
                </label>
              </div>
              {!topic.enabled && pagesUsing(topic.id).length > 0 ? <p className="mt-1 text-xs text-amber-100">ปิดแล้วจะหายจาก: {pagesUsing(topic.id).join(", ")}</p> : null}
              <label className="mt-3 block text-sm text-white/70">ชื่อบนปุ่ม <Counter value={topic.label} max={LINE_CHAT_LIMITS.label} />
                <input className={inputClass} value={topic.label} disabled={!canEdit} onChange={(event) => updateTopic(topic.id, { label: event.target.value })} />
              </label>
              <TextIssues value={topic.label} max={LINE_CHAT_LIMITS.label} />
              <label className="mt-3 block text-sm text-white/70">ข้อความตั้งต้น <Counter value={topic.prefill} max={LINE_CHAT_LIMITS.prefill} />
                <textarea className={inputClass} rows={2} value={topic.prefill} disabled={!canEdit} onChange={(event) => updateTopic(topic.id, { prefill: event.target.value })} />
              </label>
              <TextIssues value={topic.prefill} max={LINE_CHAT_LIMITS.prefill} />
              <label className="mt-3 block text-sm text-white/70">หมวด
                <select className={inputClass} value={topic.journey} disabled={!canEdit} onChange={(event) => updateTopic(topic.id, { journey: event.target.value as LineChatJourney })}>
                  {Object.entries(JOURNEY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              {issueAt.get(`topics.${index}.id`) ? <p className="mt-1 text-xs text-red-300">{issueAt.get(`topics.${index}.id`)!.join(" · ")}</p> : null}
              {!savedTopicIds.has(topic.id) && canEdit ? <button type="button" className={`${buttonClass} mt-3`} onClick={() => update((value) => ({ ...value, topics: value.topics.filter((item) => item.id !== topic.id), placements: value.placements.map((item) => ({ ...item, topicIds: item.topicIds.filter((id) => id !== topic.id) })) }))}>ลบหัวข้อที่ยังไม่บันทึก</button> : null}
            </div>
          ))}
          {canEdit ? <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm text-white/70">รหัสหัวข้อใหม่ (a-z, 0-9, -) ตั้งแล้วแก้ไม่ได้
              <input className={inputClass} value={newTopicId} onChange={(event) => setNewTopicId(event.target.value.toLowerCase())} placeholder="เช่น smart-network-check" />
            </label>
            <button type="button" className={buttonClass} disabled={!TOPIC_ID.test(newTopicId) || topicById.has(newTopicId)} onClick={addTopic}>เพิ่มหัวข้อ</button>
          </div> : null}
        </div>}

        {tab === "placements" && <div role="tabpanel" id="line-chat-panel-placements" aria-labelledby="line-chat-tab-placements" className="mt-5 grid gap-4">
          <p className="text-sm text-white/60">เลือกหัวข้อหน้าละ 1–{LINE_CHAT_LIMITS.placementTopics} หัวข้อตามลำดับ “{LINE_CHAT_TYPE_OWN.label}” ต่อท้ายให้เสมอ หน้าที่ไม่ได้ตั้งใช้ค่าปกติ</p>
          <label className="block text-sm text-white/70">กลุ่มหน้า
            <select className={inputClass} value={placementKey} onChange={(event) => setPlacementKey(event.target.value)}>
              {placementKeys.map((key) => <option key={key} value={key}>{groupLabel(key)}{draft.placements.some((item) => item.key === key) ? "" : " (ยังไม่ได้ตั้ง)"}</option>)}
            </select>
          </label>
          <ol className="grid gap-2">
            {(placement?.topicIds ?? []).map((id, index, list) => (
              <li key={id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/10 p-3">
                <span className="min-w-0 flex-1 text-sm text-white/85">{index + 1}. {topicById.get(id)?.label ?? id}{topicById.get(id)?.enabled === false ? " (ปิดอยู่)" : ""}</span>
                {canEdit ? <>
                  <button type="button" className={buttonClass} disabled={index === 0} onClick={() => { const next = [...list]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; setPlacementTopics(placementKey, next); }}>↑ ขึ้น</button>
                  <button type="button" className={buttonClass} disabled={index === list.length - 1} onClick={() => { const next = [...list]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; setPlacementTopics(placementKey, next); }}>↓ ลง</button>
                  <button type="button" className={buttonClass} onClick={() => setPlacementTopics(placementKey, list.filter((item) => item !== id))}>เอาออก</button>
                </> : null}
              </li>
            ))}
          </ol>
          {issueAt.get(`placements.${draft.placements.findIndex((item) => item.key === placementKey)}.topicIds`) ? <p className="text-xs text-red-300">{issueAt.get(`placements.${draft.placements.findIndex((item) => item.key === placementKey)}.topicIds`)!.join(" · ")}</p> : null}
          {canEdit && (placement?.topicIds.length ?? 0) < LINE_CHAT_LIMITS.placementTopics ? <label className="block text-sm text-white/70">เพิ่มหัวข้อให้หน้านี้
            <select className={inputClass} value="" onChange={(event) => { if (event.target.value) setPlacementTopics(placementKey, [...(placement?.topicIds ?? []), event.target.value]); }}>
              <option value="">เลือกหัวข้อ</option>
              {draft.topics.filter((topic) => topic.enabled && !(placement?.topicIds ?? []).includes(topic.id)).map((topic) => <option key={topic.id} value={topic.id}>{topic.label}</option>)}
            </select>
          </label> : null}
          {canEdit && placement && placementKey !== "default"
            ? <button type="button" className={buttonClass} onClick={() => update((value) => ({ ...value, placements: value.placements.filter((item) => item.key !== placementKey) }))}>ให้หน้านี้ใช้ค่าปกติ</button> : null}
          {canEdit ? <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm text-white/70">ตั้งเฉพาะหมวดหรือบทความ
              <input className={inputClass} value={newKey} onChange={(event) => setNewKey(event.target.value.toLowerCase())} placeholder="หมวด: health-insurance หรือ บทความ: aia-health-happy-describe" />
            </label>
            <button type="button" className={buttonClass} disabled={!KEY_SLUG.test(newKey)} onClick={() => { setPlacementTopics(`category:${newKey}`, []); setPlacementKey(`category:${newKey}`); setNewKey(""); }}>เพิ่มหมวด</button>
            <button type="button" className={buttonClass} disabled={!KEY_SLUG.test(newKey)} onClick={() => { setPlacementTopics(`article:${newKey}`, []); setPlacementKey(`article:${newKey}`); setNewKey(""); }}>เพิ่มบทความ</button>
          </div> : null}
        </div>}

        {tab === "campaigns" && <div role="tabpanel" id="line-chat-panel-campaigns" aria-labelledby="line-chat-tab-campaigns" className="mt-5 grid gap-4">
          <p className="text-sm text-white/60">รหัสแคมเปญคือค่า utm_campaign ของลิงก์โฆษณา ตั้งแล้วแก้ไม่ได้ แคมเปญชั่วคราวกลับเป็นปกติเองเมื่อถึงวันจบ แคมเปญต่อเนื่องไม่ปิดเอง แต่ต้องทบทวนทุก 90 วัน</p>
          {draft.campaigns.map((campaign, index) => (
            <div key={campaign.code} className={`rounded-2xl border p-4 ${campaign.type === "evergreen" && campaign.reviewAt && Date.parse(campaign.reviewAt) <= now.getTime() ? "border-red-300/20" : "border-white/10"} bg-black/10`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <code className="text-xs text-white/60">{campaign.code} · รหัส {campaign.refCode} · {campaign.type === "temporary" ? "ชั่วคราว" : "ต่อเนื่อง"}</code>
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
                  {draft.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.label}{topic.enabled ? "" : " (ปิดอยู่)"}</option>)}
                </select>
              </label>
              {issueAt.get(`campaigns.${index}.pinnedTopicIds`) ? <p className="mt-1 text-xs text-red-300">{issueAt.get(`campaigns.${index}.pinnedTopicIds`)!.join(" · ")}</p> : null}
              {!savedCampaignCodes.has(campaign.code) && canEdit ? <button type="button" className={`${buttonClass} mt-3`} onClick={() => update((value) => ({ ...value, campaigns: value.campaigns.filter((item) => item.code !== campaign.code) }))}>ลบแคมเปญที่ยังไม่บันทึก</button> : null}
            </div>
          ))}
          {canEdit ? <div className="grid gap-2 rounded-2xl border border-dashed border-white/15 p-4 sm:grid-cols-2">
            <label className="text-sm text-white/70">รหัสแคมเปญ = utm_campaign<input className={inputClass} value={newCampaign.code} onChange={(event) => setNewCampaign({ ...newCampaign, code: event.target.value.toLowerCase() })} placeholder="เช่น smartnetwork-2611" /></label>
            <label className="text-sm text-white/70">อักษรรหัสอ้างอิง (2–4 ตัว)<input className={inputClass} value={newCampaign.refCode} onChange={(event) => setNewCampaign({ ...newCampaign, refCode: event.target.value.toUpperCase() })} placeholder="เช่น SN" /></label>
            <label className="text-sm text-white/70">ชื่อแคมเปญ<input className={inputClass} value={newCampaign.title} onChange={(event) => setNewCampaign({ ...newCampaign, title: event.target.value })} /></label>
            <label className="text-sm text-white/70">ประเภท<select className={inputClass} value={newCampaign.type} onChange={(event) => setNewCampaign({ ...newCampaign, type: event.target.value as LineChatCampaign["type"] })}><option value="temporary">ชั่วคราว (มีวันจบ)</option><option value="evergreen">ต่อเนื่อง (ลิงก์ใน bio, Rich Menu)</option></select></label>
            <button type="button" className={`${buttonClass} sm:col-span-2`} disabled={!CAMPAIGN_CODE.test(newCampaign.code) || !/^[A-Z]{2,4}$/.test(newCampaign.refCode) || draft.campaigns.some((campaign) => campaign.code === newCampaign.code)} onClick={addCampaign}>เพิ่มแคมเปญ</button>
          </div> : null}

          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <h3 className="text-base font-semibold text-white/90">สร้างลิงก์แคมเปญ</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-sm text-white/70">แคมเปญ<select className={inputClass} value={link.code} onChange={(event) => setLink({ ...link, code: event.target.value })}><option value="">เลือก</option>{draft.campaigns.map((campaign) => <option key={campaign.code} value={campaign.code}>{campaign.title} ({campaign.code})</option>)}</select></label>
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
            <input type="checkbox" checked={draft.enabled} disabled={!canEdit} onChange={(event) => update((value) => ({ ...value, enabled: event.target.checked }))} />
            เปิดแผงหัวข้อทั้งเว็บ
          </label>
          <p className="text-sm text-white/60">ปิดแล้วปุ่มไม่หายจากจอ แต่กลายเป็นปุ่ม LINE ธรรมดาที่เปิดแชท @ccpun ทันที</p>
        </div>}

        {immutable.length > 0 ? <p className="mt-4 text-sm text-red-300" role="alert">มีรหัสที่บันทึกแล้วถูกลบหรือเปลี่ยน ให้โหลดค่าล่าสุด แล้วปิดใช้หรือพักแทน</p> : null}
        {!validation.success ? <p className="mt-4 text-sm text-amber-100">ยังบันทึกไม่ได้: มีช่องที่ไม่ผ่านการตรวจ {validation.error.issues.length} จุด</p> : null}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button type="button" className={primaryClass} disabled={!canSave} onClick={() => send({ revision: model.revision, config: draft }, "save")}>{busy === "save" ? "กำลังบันทึก" : "บันทึกและเผยแพร่"}</button>
          <button type="button" className={buttonClass} disabled={busy !== null} onClick={reload}>โหลดค่าล่าสุด</button>
          <button type="button" className={buttonClass} disabled={!dirty || busy !== null} onClick={() => { setDraft(clone(model.config)); setMessage(null); }}>ยกเลิกที่แก้</button>
          {message ? <p className="text-sm text-white/70" role="status">{message}</p> : null}
        </div>

        <details className="mt-6 rounded-2xl border border-white/10 p-4">
          <summary className="cursor-pointer text-sm text-white/75">ประวัติการแก้และย้อนกลับ</summary>
          {model.history.length === 0 ? <p className="mt-3 text-sm text-white/50">ยังไม่มีประวัติ</p> : <ul className="mt-3 grid gap-2">
            {model.history.map((entry, index) => (
              <li key={entry.revision} className="flex flex-wrap items-center gap-3 text-sm text-white/70">
                <span>{formatDate(entry.timestamp)}</span><code className="text-xs text-white/45">{entry.revision}</code>
                {index === 0 ? <span className="text-xs text-emerald-200/80">ใช้อยู่ตอนนี้</span>
                  : canEdit ? <button type="button" className={buttonClass} disabled={busy !== null || !model.revision} onClick={() => send({ revision: model.revision, revertTo: entry.revision }, "revert")}>ย้อนกลับไปเวอร์ชันนี้</button> : null}
              </li>
            ))}
          </ul>}
        </details>
      </div>

      <aside className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 xl:sticky xl:top-5 xl:self-start" aria-label="ตัวอย่างบนมือถือ">
        <h2 className="text-base font-semibold text-white/90">ตัวอย่างบนมือถือ</h2>
        <label className="mt-3 block text-sm text-white/70">หน้า
          <select className={inputClass} value={previewKey} onChange={(event) => setPreviewKey(event.target.value)}>{placementKeys.map((key) => <option key={key} value={key}>{groupLabel(key)}</option>)}</select>
        </label>
        <label className="mt-3 block text-sm text-white/70">มาจากลิงก์แคมเปญ
          <select className={inputClass} value={previewCampaign} onChange={(event) => setPreviewCampaign(event.target.value)}><option value="">ไม่ได้มาจากแคมเปญ</option>{draft.campaigns.map((campaign) => <option key={campaign.code} value={campaign.code}>{campaign.code}</option>)}</select>
        </label>
        <div className="mx-auto mt-4 w-full max-w-[320px] rounded-[28px] border border-white/20 bg-[#251818] p-4 text-[#faf9f9]">
          {preview.mode === "plain" ? <p className="rounded-full bg-[#e0c985] px-4 py-3 text-center text-sm font-semibold text-[#251818]">คุยกับปั้นทาง LINE</p> : <>
            <p className="text-base font-semibold">{preview.headline}</p>
            <ul className="mt-3 grid gap-2">{preview.topics.map((topic) => <li key={topic.id} className={`rounded-xl border px-3 py-2.5 text-sm ${topic.journey === "type_own" ? "border-dashed border-white/20" : "border-white/20 bg-[#352727]"}`}>{topic.label}</li>)}</ul>
            <p className="mt-3 text-xs text-[#baabab]">{preview.note}</p>
          </>}
        </div>
        {preview.mode === "panel" && preview.topics[0] ? <p className="mt-3 break-words text-xs text-white/50">ข้อความหัวข้อแรก: {preview.topics[0].prefill}</p> : null}
        {firstTopicHref ? <a href={firstTopicHref} target="_blank" rel="noopener noreferrer" className={`${buttonClass} mt-3 w-full`}>ลองเปิดใน LINE</a> : null}
        <p className="mt-3 text-xs text-white/45">ตัวอย่างใช้ค่าที่กำลังแก้ ยังไม่บันทึกก็ดูได้ บนเว็บจริงแคมเปญจะตามคนไปหน้าอื่นเฉพาะคนที่ยินยอมคุกกี้วิเคราะห์</p>
      </aside>
    </section>
  );
}
