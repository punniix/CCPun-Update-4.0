import { tryCreateFinancialPlanningCrypto } from "./crypto";

/**
 * Runtime configuration for the financial planning room.
 *
 * CCPUN_FA_DATABASE_URL is dedicated to this module so it can point at its own
 * Neon database or branch without touching the main Admin database. It must
 * not equal CCPUN_ADMIN_DATABASE_URL; if it does, the module stays closed.
 */
export const FA_DATABASE_ENV_KEY = "CCPUN_FA_DATABASE_URL";

export type FaDatabaseConfig =
  | { state: "ready"; connectionString: string }
  | { state: "missing" | "invalid" | "shared-with-admin" };

export function resolveFinancialPlanningDatabase(
  variables: Record<string, string | undefined> = process.env,
): FaDatabaseConfig {
  const value = variables[FA_DATABASE_ENV_KEY]?.trim();
  if (!value) return { state: "missing" };
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { state: "invalid" };
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") return { state: "invalid" };
  const admin = variables.CCPUN_ADMIN_DATABASE_URL?.trim();
  if (admin && admin === value) return { state: "shared-with-admin" };
  return { state: "ready", connectionString: value };
}

export type FaRuntimeStatus = {
  database: FaDatabaseConfig["state"];
  cryptoReady: boolean;
  ready: boolean;
};

/** Status without secrets: safe to render on an owner-only page. */
export function getFinancialPlanningStatus(
  variables: Record<string, string | undefined> = process.env,
): FaRuntimeStatus {
  const database = resolveFinancialPlanningDatabase(variables).state;
  const cryptoReady = Boolean(tryCreateFinancialPlanningCrypto(variables));
  return { database, cryptoReady, ready: database === "ready" && cryptoReady };
}
