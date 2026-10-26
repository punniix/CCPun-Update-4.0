// Read-through policy for the stored fund catalog (no imports: the SEC adapter tests
// run this exact source in a sandbox).
//
// 1. A stored value younger than the stale limit is served; SEC is not called.
// 2. Otherwise one live SEC fallback may run: in-process single-flight (concurrent
//    visitors on one instance share one call) plus a cross-instance Neon lease (one
//    instance per lease window). When Neon itself is unreachable the lease cannot be
//    taken, so only the in-process single-flight and the SEC data cache apply.
// 3. A visitor who does not get the lease is served the stale stored value, or a
//    "busy" answer when nothing is stored yet. A failed live call also falls back to
//    the stale stored value.

// Daily sync plus slack for one missed run.
export const FUND_STORE_STALE_AFTER_MS = 36 * 60 * 60 * 1000;
export const FUND_LIVE_FALLBACK_LEASE_SECONDS = 60;

export type StoreFallbackResult<S, L> =
  | { kind: "store"; value: S; stale: boolean }
  | { kind: "live"; value: L }
  | { kind: "busy" };

const inFlight = new Map<string, Promise<unknown>>();

/** Concurrent callers with the same key share one in-flight promise. */
export function singleFlight<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = run().finally(() => { inFlight.delete(key); });
  inFlight.set(key, promise);
  return promise;
}

export async function readThroughStore<S, L>(options: {
  read: () => Promise<S | null>;
  fetchedAt: (value: S) => string | null;
  claim: () => Promise<boolean>;
  live: () => Promise<L>;
  liveUsable: (value: L) => boolean;
  flightKey: string;
  now?: number;
  staleAfterMs?: number;
}): Promise<StoreFallbackResult<S, L>> {
  const now = options.now ?? Date.now();
  const staleAfter = options.staleAfterMs ?? FUND_STORE_STALE_AFTER_MS;
  let stored: S | null = null;
  let storeReachable = true;
  try {
    stored = await options.read();
  } catch {
    storeReachable = false;
  }
  if (stored) {
    const at = Date.parse(options.fetchedAt(stored) ?? "");
    if (Number.isFinite(at) && now - at >= 0 && now - at <= staleAfter) return { kind: "store", value: stored, stale: false };
  }
  // A visitor on this instance while its fallback is running joins it without a lease.
  let claimed = true;
  if (storeReachable && !inFlight.has(options.flightKey)) {
    try {
      claimed = await options.claim();
    } catch {
      claimed = true;
    }
  }
  if (!claimed) return stored ? { kind: "store", value: stored, stale: true } : { kind: "busy" };
  let live: L | null = null;
  try {
    live = await singleFlight(options.flightKey, options.live);
  } catch {
    live = null;
  }
  if (live !== null && options.liveUsable(live)) return { kind: "live", value: live };
  if (stored) return { kind: "store", value: stored, stale: true };
  return live !== null ? { kind: "live", value: live } : { kind: "busy" };
}
