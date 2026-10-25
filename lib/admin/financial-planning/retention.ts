import type { FaClientStatus } from "./contracts";

/**
 * Retention policy (decision F3): keep data while the person is a client, plus
 * 2 years after the relationship ends. Only ปั้น may view it.
 *
 * The system never deletes automatically. It only lists purge candidates for
 * ปั้น to review. The database migration also gives the runtime role no DELETE
 * privilege on households or notes.
 */
export const FA_RETENTION_YEARS_AFTER_CLIENT = 2;

export function retentionUntilFor(relationshipEndedOn: string, years = FA_RETENTION_YEARS_AFTER_CLIENT): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(relationshipEndedOn);
  if (!match) throw new Error("FA_RETENTION_DATE_INVALID");
  const year = Number(match[1]) + years;
  const month = Number(match[2]);
  const day = Number(match[3]);
  // 29 Feb + 2 years has no 29 Feb: keep the data until 1 Mar (never shorter
  // than the policy). Postgres clamps to 28 Feb, so the DB check (>=) still holds.
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCMonth() !== month - 1) return `${year}-03-01`;
  return candidate.toISOString().slice(0, 10);
}

export type RetentionState = {
  clientStatus: FaClientStatus;
  relationshipEndedOn: string | null;
  retentionUntil: string | null;
};

/** A household becomes a purge candidate only after retention_until has passed. */
export function isPurgeCandidate(state: RetentionState, today: string): boolean {
  if (state.clientStatus !== "former" || !state.relationshipEndedOn || !state.retentionUntil) return false;
  return state.retentionUntil < today;
}

export function bangkokToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
