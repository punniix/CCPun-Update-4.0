import "server-only";

import { neon } from "@neondatabase/serverless";

// The runtime role can only EXECUTE these three SECURITY DEFINER functions
// (db/migrations/20261025_result_email_v1.sql). Nothing here reads or lists addresses.
export type DigestStore = {
  requestDigest(email: string, doiTokenHash: string, expiresAt: Date): Promise<{ subscriberId: string; state: "pending" | "confirmed" }>;
  confirmDigest(doiTokenHash: string): Promise<{ state: "confirmed" | "expired" | "invalid" }>;
  unsubscribe(subscriberId: string): Promise<{ state: "unsubscribed" | "unknown" }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function createNeonDigestStore(databaseUrl: string): DigestStore {
  const sql = neon(databaseUrl, { fetchOptions: { signal: AbortSignal.timeout(5000) } });
  return {
    async requestDigest(email, doiTokenHash, expiresAt) {
      const rows = await sql.query("SELECT * FROM ccpun_email.request_digest($1::text,$2::text,$3::timestamptz)", [email, doiTokenHash, expiresAt.toISOString()]);
      const row = rows[0];
      if (!row || typeof row.subscriber_id !== "string" || !UUID.test(row.subscriber_id) || (row.state !== "pending" && row.state !== "confirmed")) throw new Error("INVALID_DIGEST_RESULT");
      return { subscriberId: row.subscriber_id, state: row.state };
    },
    async confirmDigest(doiTokenHash) {
      const rows = await sql.query("SELECT * FROM ccpun_email.confirm_digest($1::text)", [doiTokenHash]);
      const state = rows[0]?.state;
      if (state !== "confirmed" && state !== "expired" && state !== "invalid") throw new Error("INVALID_CONFIRM_RESULT");
      return { state };
    },
    async unsubscribe(subscriberId) {
      const rows = await sql.query("SELECT * FROM ccpun_email.unsubscribe_digest($1::uuid)", [subscriberId]);
      const state = rows[0]?.state;
      if (state !== "unsubscribed" && state !== "unknown") throw new Error("INVALID_UNSUBSCRIBE_RESULT");
      return { state };
    },
  };
}
