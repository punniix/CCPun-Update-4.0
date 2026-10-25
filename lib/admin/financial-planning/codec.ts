import { z } from "zod";
import {
  assetItemSchema,
  cashflowItemSchema,
  crmNoteSchema,
  householdProfileSchema,
  liabilityItemSchema,
  type CrmNote,
  type FinancialPosition,
  type HouseholdProfile,
} from "./contracts";
import { isFaKeyVersion, type FaCrypto, type FaEncryptedValue } from "./crypto";

/**
 * Pure mapping between decrypted domain values and the encrypted columns the
 * database stores. Every purpose string binds the household ID and, for rows,
 * the row ID, so a ciphertext moved to another row or household fails to
 * decrypt. Decrypted values are re-validated against the same contracts that
 * guard writes.
 */

export const FA_ITEM_SECTIONS = ["cashflow", "assets", "liabilities"] as const;
export type FaItemSection = (typeof FA_ITEM_SECTIONS)[number];

const SECTION_PURPOSE: Record<FaItemSection, string> = {
  cashflow: "cashflow",
  assets: "asset",
  liabilities: "liability",
};

export function profilePurpose(householdId: string) {
  return `household:${householdId}:profile`;
}

export function itemPurpose(householdId: string, section: FaItemSection, itemId: string) {
  return `household:${householdId}:${SECTION_PURPOSE[section]}:${itemId}`;
}

export function notePurpose(householdId: string, noteId: string) {
  return `household:${householdId}:note:${noteId}`;
}

/** Wire shape for ccpun_fa.replace_household_plan and direct inserts. */
export type FaEncryptedColumns = {
  ciphertext_b64: string;
  nonce_b64: string;
  auth_tag_b64: string;
  key_version: number;
};

export function toColumns(value: FaEncryptedValue): FaEncryptedColumns {
  return {
    ciphertext_b64: value.ciphertextB64,
    nonce_b64: value.nonceB64,
    auth_tag_b64: value.authTagB64,
    key_version: value.keyVersion,
  };
}

export const encryptedRowSchema = z.object({
  ciphertext_b64: z.string().min(4),
  nonce_b64: z.string().min(16),
  auth_tag_b64: z.string().min(24),
  key_version: z.coerce.number().int(),
});
export type FaEncryptedRow = z.infer<typeof encryptedRowSchema>;

export function fromColumns(row: FaEncryptedRow): FaEncryptedValue | null {
  if (!isFaKeyVersion(row.key_version)) return null;
  return {
    keyVersion: row.key_version,
    ciphertextB64: row.ciphertext_b64,
    nonceB64: row.nonce_b64,
    authTagB64: row.auth_tag_b64,
  };
}

export function encryptProfile(crypto: FaCrypto, householdId: string, profile: HouseholdProfile) {
  return toColumns(crypto.encryptJson(householdProfileSchema.parse(profile), profilePurpose(householdId)));
}

export function decryptProfile(crypto: FaCrypto, householdId: string, row: FaEncryptedRow): HouseholdProfile | null {
  const value = fromColumns(row);
  if (!value) return null;
  try {
    const parsed = householdProfileSchema.safeParse(crypto.decryptJson(value, profilePurpose(householdId)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export type FaEncryptedPlanItems = Record<FaItemSection, Array<FaEncryptedColumns & { id: string }>>;

export function encryptPosition(
  crypto: FaCrypto,
  householdId: string,
  position: FinancialPosition,
  newId: () => string,
): FaEncryptedPlanItems {
  const encode = <T>(section: FaItemSection, items: readonly T[]) =>
    items.map((item) => {
      const id = newId();
      return { id, ...toColumns(crypto.encryptJson(item, itemPurpose(householdId, section, id))) };
    });
  return {
    cashflow: encode("cashflow", position.cashflow.map((item) => cashflowItemSchema.parse(item))),
    assets: encode("assets", position.assets.map((item) => assetItemSchema.parse(item))),
    liabilities: encode("liabilities", position.liabilities.map((item) => liabilityItemSchema.parse(item))),
  };
}

const SECTION_SCHEMA = {
  cashflow: cashflowItemSchema,
  assets: assetItemSchema,
  liabilities: liabilityItemSchema,
} as const;

export type FaDecodedRows = { position: FinancialPosition; unreadableItems: number };

export function decryptPosition(
  crypto: FaCrypto,
  householdId: string,
  rows: Record<FaItemSection, Array<FaEncryptedRow & { item_id: string }>>,
): FaDecodedRows {
  let unreadableItems = 0;
  const decode = <S extends FaItemSection>(section: S) => {
    const out: Array<z.infer<(typeof SECTION_SCHEMA)[S]>> = [];
    for (const row of rows[section]) {
      const value = fromColumns(row);
      if (!value) { unreadableItems += 1; continue; }
      try {
        const parsed = SECTION_SCHEMA[section].safeParse(crypto.decryptJson(value, itemPurpose(householdId, section, row.item_id)));
        if (parsed.success) out.push(parsed.data as z.infer<(typeof SECTION_SCHEMA)[S]>);
        else unreadableItems += 1;
      } catch {
        unreadableItems += 1;
      }
    }
    return out;
  };
  return {
    position: {
      cashflow: decode("cashflow") as FinancialPosition["cashflow"],
      assets: decode("assets") as FinancialPosition["assets"],
      liabilities: decode("liabilities") as FinancialPosition["liabilities"],
    },
    unreadableItems,
  };
}

export function encryptNote(crypto: FaCrypto, householdId: string, noteId: string, note: CrmNote) {
  return toColumns(crypto.encryptJson(crmNoteSchema.parse(note), notePurpose(householdId, noteId)));
}

export function decryptNote(crypto: FaCrypto, householdId: string, noteId: string, row: FaEncryptedRow): CrmNote | null {
  const value = fromColumns(row);
  if (!value) return null;
  try {
    const parsed = crmNoteSchema.safeParse(crypto.decryptJson(value, notePurpose(householdId, noteId)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
