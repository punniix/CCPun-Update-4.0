export const CCPUN_JOURNEY_IDS = [
  "life_health_policy_review",
  "motor_quote_review",
  "investment_before_you_act",
  "human_handoff",
] as const;

export type CcpunJourneyId = (typeof CCPUN_JOURNEY_IDS)[number];
export type CustomerChannel = "line" | "email" | "phone" | "sms" | "web_push";
export type ContactPurpose = "service" | "advisory" | "marketing";
export type ContactDecision = "granted" | "denied" | "revoked" | "unknown";

export type CustomerRef = { customerCode: string };

export type ContactPermission = CustomerRef & {
  channel: CustomerChannel;
  purpose: ContactPurpose;
  decision: ContactDecision;
  occurredAt: string;
};

export type JourneyInstance = CustomerRef & {
  journeyInstanceId: string;
  journey: CcpunJourneyId | string;
  state: "active" | "completed" | "abandoned" | "human_handoff";
  entrypoint: string;
  conversationBound: boolean;
  leadBound: boolean;
  rowVersion: number;
};

export type ConversationTask = CustomerRef & {
  conversationTaskId: string;
  taskType: "follow_up" | "document_review" | "policy_review" | "quote_review" | "investment_review" | "human_handoff";
  status: "open" | "in_progress" | "done" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  rowVersion: number;
};

export type CustomerLifecycleContract = {
  customer: CustomerRef;
  permissions: ContactPermission[];
  journeys: JourneyInstance[];
  tasks: ConversationTask[];
};
