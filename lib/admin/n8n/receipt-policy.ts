/** Fail-closed receipt classification for n8n orchestration; metadata only. */
export type N8nReceipt = { httpStatus: number | null; executionState?: string | null; upstreamStatus?: number | null; receiptVerified?: boolean };
export function classifyN8nReceipt(input: N8nReceipt): "verified" | "degraded" | "failed" {
  const { httpStatus, upstreamStatus, executionState, receiptVerified } = input;
  if (httpStatus == null || httpStatus === 408 || httpStatus === 429 || httpStatus >= 500) return "degraded";
  if (httpStatus < 200 || httpStatus >= 300) return "failed";
  if (upstreamStatus == null || upstreamStatus === 408 || upstreamStatus === 429 || upstreamStatus >= 500) return "degraded";
  if (upstreamStatus < 200 || upstreamStatus >= 300) return "failed";
  if (executionState !== "success" || receiptVerified !== true) return "degraded";
  return "verified";
}
