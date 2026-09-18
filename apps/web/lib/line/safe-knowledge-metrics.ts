import { neon } from "@neondatabase/serverless";
import {
  buildSafeKnowledgeEventPayload,
  type SafeKnowledgeDecision,
} from "../../../../lib/line/safe-knowledge";
import { resolveLineIngestRuntime } from "./private-ingestion";

export async function recordSafeKnowledgeDecisionBestEffort(
  input: unknown,
  decision: SafeKnowledgeDecision,
  variables: Record<string, string | undefined> = process.env,
) {
  const payload = buildSafeKnowledgeEventPayload(input, decision);
  if (!payload) return false;

  const runtime = resolveLineIngestRuntime(variables);
  if (!runtime) return false;

  try {
    const sql = neon(runtime.connectionString, {
      fetchOptions: { signal: AbortSignal.timeout(5_000) },
    });
    const rows = await sql.query(
      "SELECT outcome FROM private_line.ingress_record_safe_knowledge_event($1::jsonb)",
      [JSON.stringify(payload)],
    ) as Array<{ outcome?: unknown }>;
    return rows[0]?.outcome === "recorded";
  } catch {
    // Metrics are additive and must never block the approved-answer / handoff response.
    return false;
  }
}
