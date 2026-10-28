import "server-only";

import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import {
  decryptNote,
  decryptPosition,
  decryptProfile,
  encryptNote,
  encryptPosition,
  encryptProfile,
  encryptedRowSchema,
  type FaItemSection,
} from "./codec";
import { resolveFinancialPlanningDatabase } from "./config";
import {
  emptyFinancialPosition,
  type ClientStatusRequest,
  type CrmNote,
  type FaClientStatus,
  type FinancialPosition,
  type HouseholdProfile,
} from "./contracts";
import { tryCreateFinancialPlanningCrypto, type FaCrypto } from "./crypto";
import { isPurgeCandidate, retentionUntilFor } from "./retention";

/**
 * Data access for the financial planning room.
 *
 * Reads CCPUN_FA_DATABASE_URL only (never the main Admin database). Every
 * client value is encrypted before it leaves this process. Errors carry fixed
 * codes, never client values, and nothing here writes to logs or analytics.
 */

type Env = Record<string, string | undefined>;

export class FaStoreError extends Error {
  readonly code: FaStoreErrorCode;
  constructor(code: FaStoreErrorCode) {
    super(code);
    this.name = "FaStoreError";
    this.code = code;
  }
}

export type FaStoreErrorCode =
  | "FA_NOT_CONFIGURED"
  | "FA_NOT_FOUND"
  | "FA_REVISION_CONFLICT"
  | "FA_UNREADABLE"
  | "FA_STORE_FAILED";

type Runtime = { sql: ReturnType<typeof neon>; crypto: FaCrypto };

function runtime(variables: Env): Runtime {
  const database = resolveFinancialPlanningDatabase(variables);
  const crypto = tryCreateFinancialPlanningCrypto(variables);
  if (database.state !== "ready" || !crypto) throw new FaStoreError("FA_NOT_CONFIGURED");
  return {
    sql: neon(database.connectionString, { fetchOptions: { signal: AbortSignal.timeout(8_000) } }),
    crypto,
  };
}

function storeFailure(error: unknown): FaStoreError {
  if (error instanceof FaStoreError) return error;
  const code = (error as { code?: unknown } | null)?.code;
  const message = error instanceof Error ? error.message : "";
  if (code === "40001" || message.includes("FA_REVISION_CONFLICT")) return new FaStoreError("FA_REVISION_CONFLICT");
  return new FaStoreError("FA_STORE_FAILED");
}

const isoDate = (value: unknown) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === "string" ? value.slice(0, 10) : null;
};
const isoTime = (value: unknown) => (value instanceof Date ? value.toISOString() : typeof value === "string" ? value : "");

const householdRowSchema = z.object({
  household_id: z.string().uuid(),
  revision: z.coerce.number().int(),
  client_status: z.enum(["active", "former"]),
  relationship_ended_on: z.unknown(),
  retention_until: z.unknown(),
  updated_at: z.unknown(),
  ciphertext_b64: z.string(),
  nonce_b64: z.string(),
  auth_tag_b64: z.string(),
  key_version: z.coerce.number().int(),
});

// Dates are selected as text: driver Date parsing would shift them by the server time zone.
const HOUSEHOLD_COLUMNS = `household_id::text, revision, client_status, relationship_ended_on::text AS relationship_ended_on,
  retention_until::text AS retention_until, updated_at,
  profile_ciphertext_b64 AS ciphertext_b64, profile_nonce_b64 AS nonce_b64,
  profile_auth_tag_b64 AS auth_tag_b64, profile_key_version AS key_version`;

export type FaHouseholdListItem = {
  id: string;
  displayName: string | null;
  clientStatus: FaClientStatus;
  relationshipEndedOn: string | null;
  retentionUntil: string | null;
  updatedAt: string;
};

function toListItem(crypto: FaCrypto, row: z.infer<typeof householdRowSchema>): FaHouseholdListItem & { profile: HouseholdProfile | null; revision: number } {
  const profile = decryptProfile(crypto, row.household_id, row);
  return {
    id: row.household_id,
    displayName: profile?.displayName ?? null,
    clientStatus: row.client_status,
    relationshipEndedOn: isoDate(row.relationship_ended_on),
    retentionUntil: isoDate(row.retention_until),
    updatedAt: isoTime(row.updated_at),
    profile,
    revision: row.revision,
  };
}

function publicListItem(item: ReturnType<typeof toListItem>): FaHouseholdListItem {
  return {
    id: item.id,
    displayName: item.displayName,
    clientStatus: item.clientStatus,
    relationshipEndedOn: item.relationshipEndedOn,
    retentionUntil: item.retentionUntil,
    updatedAt: item.updatedAt,
  };
}

export async function listHouseholds(variables: Env = process.env): Promise<FaHouseholdListItem[]> {
  const { sql, crypto } = runtime(variables);
  try {
    const rows = z.array(householdRowSchema).parse(await sql.query(
      `SELECT ${HOUSEHOLD_COLUMNS} FROM ccpun_fa.household ORDER BY client_status ASC, updated_at DESC LIMIT 500`,
      [],
    ));
    return rows.map((row) => publicListItem(toListItem(crypto, row)));
  } catch (error) {
    throw storeFailure(error);
  }
}

export async function createHousehold(profile: HouseholdProfile, variables: Env = process.env): Promise<{ id: string }> {
  const { sql, crypto } = runtime(variables);
  const id = randomUUID();
  const encrypted = encryptProfile(crypto, id, profile);
  try {
    await sql.query(
      `INSERT INTO ccpun_fa.household (household_id, profile_ciphertext_b64, profile_nonce_b64, profile_auth_tag_b64, profile_key_version)
       VALUES ($1::uuid, $2, $3, $4, $5::smallint)`,
      [id, encrypted.ciphertext_b64, encrypted.nonce_b64, encrypted.auth_tag_b64, encrypted.key_version],
    );
    return { id };
  } catch (error) {
    throw storeFailure(error);
  }
}

export type FaHouseholdPlan = FaHouseholdListItem & {
  revision: number;
  profile: HouseholdProfile;
  position: FinancialPosition;
  unreadableItems: number;
};

const itemRowSchema = encryptedRowSchema.extend({ item_id: z.string().uuid() });
const itemQuery = (table: string) =>
  `SELECT item_id::text, payload_ciphertext_b64 AS ciphertext_b64, payload_nonce_b64 AS nonce_b64,
          payload_auth_tag_b64 AS auth_tag_b64, payload_key_version AS key_version
   FROM ccpun_fa.${table} WHERE household_id = $1::uuid ORDER BY position ASC`;

export async function readHouseholdPlan(householdId: string, variables: Env = process.env): Promise<FaHouseholdPlan> {
  const { sql, crypto } = runtime(variables);
  let results: unknown[];
  try {
    // One read-only snapshot so the profile revision and items always match.
    results = await sql.transaction([
      sql.query(`SELECT ${HOUSEHOLD_COLUMNS} FROM ccpun_fa.household WHERE household_id = $1::uuid`, [householdId]),
      sql.query(itemQuery("cashflow_item"), [householdId]),
      sql.query(itemQuery("asset"), [householdId]),
      sql.query(itemQuery("liability"), [householdId]),
    ], { readOnly: true, isolationLevel: "RepeatableRead" });
  } catch (error) {
    throw storeFailure(error);
  }
  const household = z.array(householdRowSchema).parse(results[0]);
  if (!household[0]) throw new FaStoreError("FA_NOT_FOUND");
  const item = toListItem(crypto, household[0]);
  if (!item.profile) throw new FaStoreError("FA_UNREADABLE");
  const rows = {
    cashflow: z.array(itemRowSchema).parse(results[1]),
    assets: z.array(itemRowSchema).parse(results[2]),
    liabilities: z.array(itemRowSchema).parse(results[3]),
  } satisfies Record<FaItemSection, unknown>;
  const decoded = decryptPosition(crypto, householdId, rows);
  return { ...item, profile: item.profile, position: decoded.position ?? emptyFinancialPosition(), unreadableItems: decoded.unreadableItems };
}

export async function saveHouseholdPlan(input: {
  householdId: string;
  expectedRevision: number;
  profile: HouseholdProfile;
  position: FinancialPosition;
}, variables: Env = process.env): Promise<{ revision: number }> {
  const { sql, crypto } = runtime(variables);
  const profile = encryptProfile(crypto, input.householdId, input.profile);
  const items = encryptPosition(crypto, input.householdId, input.position, randomUUID);
  try {
    const rows = await sql.query(
      `SELECT ccpun_fa.replace_household_plan($1::uuid, $2::integer, $3::jsonb, $4::jsonb) AS revision`,
      [input.householdId, input.expectedRevision, JSON.stringify(profile), JSON.stringify(items)],
    ) as Array<{ revision?: unknown }>;
    const revision = Number(rows[0]?.revision);
    if (!Number.isInteger(revision)) throw new FaStoreError("FA_STORE_FAILED");
    return { revision };
  } catch (error) {
    throw storeFailure(error);
  }
}

export type FaCrmNoteRecord = { id: string; createdAt: string; note: CrmNote | null };

export async function listCrmNotes(householdId: string, variables: Env = process.env): Promise<FaCrmNoteRecord[]> {
  const { sql, crypto } = runtime(variables);
  try {
    const rows = z.array(encryptedRowSchema.extend({ note_id: z.string().uuid(), created_at: z.unknown() })).parse(await sql.query(
      `SELECT note_id::text, created_at, payload_ciphertext_b64 AS ciphertext_b64, payload_nonce_b64 AS nonce_b64,
              payload_auth_tag_b64 AS auth_tag_b64, payload_key_version AS key_version
       FROM ccpun_fa.crm_note WHERE household_id = $1::uuid ORDER BY created_at DESC LIMIT 100`,
      [householdId],
    ));
    return rows.map((row) => ({ id: row.note_id, createdAt: isoTime(row.created_at), note: decryptNote(crypto, householdId, row.note_id, row) }));
  } catch (error) {
    throw storeFailure(error);
  }
}

export async function addCrmNote(householdId: string, note: CrmNote, variables: Env = process.env): Promise<{ id: string }> {
  const { sql, crypto } = runtime(variables);
  const id = randomUUID();
  const encrypted = encryptNote(crypto, householdId, id, note);
  try {
    const rows = await sql.query(
      `INSERT INTO ccpun_fa.crm_note (note_id, household_id, payload_ciphertext_b64, payload_nonce_b64, payload_auth_tag_b64, payload_key_version)
       SELECT $1::uuid, household_id, $3, $4, $5, $6::smallint FROM ccpun_fa.household WHERE household_id = $2::uuid
       RETURNING note_id::text`,
      [id, householdId, encrypted.ciphertext_b64, encrypted.nonce_b64, encrypted.auth_tag_b64, encrypted.key_version],
    ) as unknown[];
    if (!rows.length) throw new FaStoreError("FA_NOT_FOUND");
    return { id };
  } catch (error) {
    throw storeFailure(error);
  }
}

/**
 * Marks a household active or former (decision F3). Former households get a
 * retention date of relationship end + 2 years. Nothing is ever deleted here.
 */
export async function setClientStatus(householdId: string, request: ClientStatusRequest, variables: Env = process.env) {
  const { sql } = runtime(variables);
  const endedOn = request.status === "former" ? request.relationshipEndedOn : null;
  const retentionUntil = endedOn ? retentionUntilFor(endedOn) : null;
  try {
    const rows = await sql.query(
      `UPDATE ccpun_fa.household
       SET client_status = $2, relationship_ended_on = $3::date, retention_until = $4::date, updated_at = now()
       WHERE household_id = $1::uuid RETURNING household_id::text`,
      [householdId, request.status, endedOn, retentionUntil],
    ) as unknown[];
    if (!rows.length) throw new FaStoreError("FA_NOT_FOUND");
    return { clientStatus: request.status, relationshipEndedOn: endedOn, retentionUntil };
  } catch (error) {
    throw storeFailure(error);
  }
}

/** Households whose retention date has passed. A report only: no deletion. */
export async function listPurgeCandidates(today: string, variables: Env = process.env): Promise<FaHouseholdListItem[]> {
  const { sql, crypto } = runtime(variables);
  try {
    const rows = z.array(householdRowSchema).parse(await sql.query(
      `SELECT ${HOUSEHOLD_COLUMNS} FROM ccpun_fa.household
       WHERE client_status = 'former' AND retention_until < $1::date
       ORDER BY retention_until ASC LIMIT 500`,
      [today],
    ));
    return rows
      .map((row) => toListItem(crypto, row))
      .filter((item) => isPurgeCandidate(item, today))
      .map(publicListItem);
  } catch (error) {
    throw storeFailure(error);
  }
}
