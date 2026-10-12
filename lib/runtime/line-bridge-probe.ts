export const LINE_BRIDGE_PROBE_STATUSES = [
  "ready", "durable-not-ready", "unauthorized", "runtime-unavailable", "token-unavailable",
  "gateway-rejected", "invalid-response", "request-failed", "timeout",
] as const;
export type LineBridgeProbeStatus = (typeof LINE_BRIDGE_PROBE_STATUSES)[number];
export type LineBridgeProbeResult = { status: LineBridgeProbeStatus; webSha: string | null };
// This former provider-specific transport is retired. Native LINE ingress and
// one-time system-delivery tokens have separate handlers and are unaffected.
export async function probeLineBridgeFromAdmin(..._arguments: unknown[]): Promise<LineBridgeProbeResult> {
  void _arguments;
  return { status: "runtime-unavailable", webSha: null };
}

export async function probeLineBridgeFromWeb(..._arguments: unknown[]): Promise<LineBridgeProbeResult> {
  void _arguments;
  return { status: "unauthorized", webSha: null };
}
