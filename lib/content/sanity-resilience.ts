export type SanityRetryOptions = {
  maxAttempts?: number;
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const RETRYABLE_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENOTFOUND",
  "ECONNREFUSED",
]);

function numericStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  const candidates = [
    record.statusCode,
    record.status,
    record.response && typeof record.response === "object"
      ? (record.response as Record<string, unknown>).status
      : undefined,
  ];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

export function isRetryableSanityReadError(error: unknown): boolean {
  const status = numericStatus(error);
  if (status !== null) {
    return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
  }

  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  const code = typeof record.code === "string" ? record.code.toUpperCase() : "";
  if (RETRYABLE_NETWORK_CODES.has(code)) return true;

  const name = typeof record.name === "string" ? record.name : "";
  // ponytail: Only known fetch failures retry; broaden this if a new transport error is observed.
  return name === "ServerError" || name === "FetchError" ||
    (name === "TypeError" && /^(fetch failed|failed to fetch)$/i.test(String(record.message ?? "")));
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function retryTransientSanityRead<T>(
  read: () => Promise<T>,
  options: SanityRetryOptions = {},
): Promise<T> {
  const maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? 2, 3));
  const delayMs = Math.max(0, Math.min(options.delayMs ?? 75, 500));
  const sleep = options.sleep ?? defaultSleep;

  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      return await read();
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableSanityReadError(error)) throw error;
      if (delayMs > 0) await sleep(delayMs);
    }
  }

  throw new Error("SANITY_RETRY_EXHAUSTED");
}
