import {
  buildSafeKnowledgeEventPayload,
  type SafeKnowledgeDecision,
} from "../../../../lib/line/safe-knowledge";
import { recordLinePublicEventBestEffort } from "./public-event-bridge";

export async function recordSafeKnowledgeDecisionBestEffort(
  input: unknown,
  decision: SafeKnowledgeDecision,
  variables: Record<string, string | undefined> = process.env,
) {
  const payload = buildSafeKnowledgeEventPayload(input, decision);
  if (!payload) return false;
  return recordLinePublicEventBestEffort({ kind: "safe_knowledge", payload }, variables);
}
