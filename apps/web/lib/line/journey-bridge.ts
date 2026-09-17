import { neon } from "@neondatabase/serverless";
import { buildLineContinueLink, parseLineJourneyIntent } from "../../../../lib/line/ecosystem";
import { resolveLineIngestRuntime } from "./private-ingestion";

export type LineJourneyBridgeResult = {
  ok: boolean;
  href: string | null;
  label: string | null;
  stored: boolean;
  unavailableReason: string | null;
};

export async function createLineContinueFromSafeJourney(
  value: unknown,
  variables: Record<string, string | undefined> = process.env,
): Promise<LineJourneyBridgeResult> {
  const intent = parseLineJourneyIntent(value);
  const link = buildLineContinueLink(value, variables.CCPUN_LINE_OFFICIAL_ACCOUNT_ID?.trim() || "@ccpun");
  if (!intent || !link) return { ok: false, href: null, label: null, stored: false, unavailableReason: "invalid-safe-journey" };

  const runtime = resolveLineIngestRuntime(variables);
  if (!runtime) return { ok: true, href: link.href, label: link.label, stored: false, unavailableReason: "journey-store-not-configured" };

  try {
    const sql = neon(runtime.connectionString, { fetchOptions: { signal: AbortSignal.timeout(5_000) } });
    const rows = await sql.query(
      "SELECT outcome FROM private_line.record_safe_web_journey_event($1::jsonb)",
      [JSON.stringify({
        journey: intent.journey,
        entrypoint: intent.entrypoint,
        event_type: "line_continue",
        content_id: intent.content_id ?? null,
        tool_id: intent.tool_id ?? null,
        saved_result_ref: intent.saved_result_id ?? null,
        campaign_id: intent.campaign_id ?? null,
        attribution: intent.attribution ?? {},
      })],
    ) as Array<{ outcome?: unknown }>;
    return {
      ok: true,
      href: link.href,
      label: link.label,
      stored: rows[0]?.outcome === "accepted",
      unavailableReason: rows[0]?.outcome === "accepted" ? null : "journey-store-rejected",
    };
  } catch {
    return { ok: true, href: link.href, label: link.label, stored: false, unavailableReason: "journey-store-failed-closed" };
  }
}
