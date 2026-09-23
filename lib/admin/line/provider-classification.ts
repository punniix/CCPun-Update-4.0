export type LineProviderRetryClass = "retryable" | "permanent";

export function classifyLineProviderFailure(providerStatusCode: number): {
  errorClass: "rate_limited" | "provider_unavailable" | "provider_rejected";
  retryClass: LineProviderRetryClass;
} {
  if (providerStatusCode === 429) {
    return { errorClass: "rate_limited", retryClass: "retryable" };
  }
  if (providerStatusCode >= 500) {
    return { errorClass: "provider_unavailable", retryClass: "retryable" };
  }
  return { errorClass: "provider_rejected", retryClass: "permanent" };
}
