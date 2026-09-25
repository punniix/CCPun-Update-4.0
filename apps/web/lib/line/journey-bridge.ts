import { buildLineContinueLink, parseLineJourneyIntent } from "../../../../lib/line/ecosystem";
import { recordLinePublicEventBestEffort } from "./public-event-bridge";

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

  const stored = await recordLinePublicEventBestEffort({
    kind: "line_continue",
    payload: {
      journey: intent.journey,
      entrypoint: intent.entrypoint,
      event_type: "line_continue",
      content_id: intent.content_id ?? null,
      tool_id: intent.tool_id ?? null,
      saved_result_ref: intent.saved_result_id ?? null,
      campaign_id: intent.campaign_id ?? null,
      attribution: intent.attribution ?? {},
    },
  }, variables);

  return {
    ok: true,
    href: link.href,
    label: link.label,
    stored,
    unavailableReason: stored ? null : "journey-store-failed-closed",
  };
}
