export type ActionCenterLead = {
  leadId: string;
  stage: string;
  materialReceived: boolean;
  unreadCount: number;
  followUpAt: string | null;
  lastActivityAt: string | null;
  latestMessageNeedsHuman: boolean | null;
  caseState: "active" | "waiting" | "completed";
};

export type ActionCenterSignal = {
  leadId: string;
  kind:
    | "human_handoff"
    | "follow_up_overdue"
    | "follow_up_today"
    | "new_lead_unread"
    | "document_ready"
    | "quote_waiting";
  priority: "urgent" | "high" | "normal";
  reason: string;
};

const DAY_MS = 86_400_000;
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

function bkkDayKey(value: string) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

function priorityRank(priority: ActionCenterSignal["priority"]) {
  return priority === "urgent" ? 0 : priority === "high" ? 1 : 2;
}

export function buildActionCenterSignals(
  leads: ActionCenterLead[],
  nowIso: string,
): ActionCenterSignal[] {
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(nowMs)) throw new Error("ACTION_CENTER_NOW_INVALID");
  const today = bkkDayKey(nowIso);
  const signals: ActionCenterSignal[] = [];

  for (const lead of leads) {
    if (lead.caseState === "completed") continue;

    if (lead.latestMessageNeedsHuman) {
      signals.push({
        leadId: lead.leadId,
        kind: "human_handoff",
        priority: "urgent",
        reason: "ข้อความล่าสุดต้องให้คนดูต่อ",
      });
    }

    if (lead.followUpAt) {
      const followMs = Date.parse(lead.followUpAt);
      if (Number.isFinite(followMs) && followMs < nowMs && bkkDayKey(lead.followUpAt) !== today) {
        signals.push({
          leadId: lead.leadId,
          kind: "follow_up_overdue",
          priority: "urgent",
          reason: "เลยเวลาติดตามที่กำหนดไว้แล้ว",
        });
      } else if (bkkDayKey(lead.followUpAt) === today) {
        signals.push({
          leadId: lead.leadId,
          kind: "follow_up_today",
          priority: "high",
          reason: "ถึงเวลาติดตามวันนี้",
        });
      }
    }

    if (lead.stage === "New" && lead.unreadCount > 0) {
      signals.push({
        leadId: lead.leadId,
        kind: "new_lead_unread",
        priority: "high",
        reason: "ลูกค้าใหม่มีข้อความที่ยังไม่ได้อ่าน",
      });
    }

    if (lead.materialReceived && ["New", "Qualified", "Expert Review"].includes(lead.stage)) {
      signals.push({
        leadId: lead.leadId,
        kind: "document_ready",
        priority: "high",
        reason: "ได้รับเอกสารแล้วและยังอยู่ในช่วงตรวจข้อมูล",
      });
    }

    if (lead.stage === "Quote" && !lead.followUpAt && lead.lastActivityAt) {
      const lastMs = Date.parse(lead.lastActivityAt);
      if (Number.isFinite(lastMs) && nowMs - lastMs >= 3 * DAY_MS) {
        signals.push({
          leadId: lead.leadId,
          kind: "quote_waiting",
          priority: "normal",
          reason: "อยู่ขั้นเสนอราคาและไม่มีการเคลื่อนไหวอย่างน้อย 3 วัน",
        });
      }
    }
  }

  return signals.sort((a, b) =>
    priorityRank(a.priority) - priorityRank(b.priority)
    || a.kind.localeCompare(b.kind)
    || a.leadId.localeCompare(b.leadId),
  );
}

export function summarizeActionCenter(signals: ActionCenterSignal[]) {
  return {
    total: signals.length,
    urgent: signals.filter((signal) => signal.priority === "urgent").length,
    high: signals.filter((signal) => signal.priority === "high").length,
    normal: signals.filter((signal) => signal.priority === "normal").length,
  };
}
