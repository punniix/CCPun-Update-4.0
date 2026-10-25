import "server-only";

import { NextResponse } from "next/server";
import { getAdminIdentity } from "../identity";
import { authorizeFinancialPlanningRequest, FA_PRIVATE_HEADERS } from "./access";
import { householdIdSchema } from "./contracts";
import { FaStoreError } from "./store";

/**
 * Shared request handling for /api/admin/planning/*. Owner-only, same-origin
 * for mutations, never cached, and errors carry fixed codes only: no client
 * value is echoed back, logged, or sent anywhere else.
 */

export function planningJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: FA_PRIVATE_HEADERS });
}

const STORE_STATUS: Record<FaStoreError["code"], { status: number; error: string }> = {
  FA_NOT_CONFIGURED: { status: 503, error: "planning-not-configured" },
  FA_NOT_FOUND: { status: 404, error: "not-found" },
  FA_REVISION_CONFLICT: { status: 409, error: "revision-conflict" },
  FA_UNREADABLE: { status: 503, error: "unreadable" },
  FA_STORE_FAILED: { status: 503, error: "store-failed" },
};

export async function handlePlanningMutation(
  request: Request,
  run: () => Promise<unknown>,
): Promise<NextResponse> {
  const identity = await getAdminIdentity();
  const decision = authorizeFinancialPlanningRequest({
    identity,
    mutation: true,
    requestUrl: request.url,
    origin: request.headers.get("origin"),
  });
  if (!decision.ok) return planningJson({ error: decision.error }, decision.status);
  try {
    return planningJson(await run());
  } catch (error) {
    if (error instanceof FaInvalidRequestError) return planningJson({ error: "invalid-request" }, 400);
    if (error instanceof FaStoreError) {
      const mapped = STORE_STATUS[error.code];
      return planningJson({ error: mapped.error }, mapped.status);
    }
    return planningJson({ error: "store-failed" }, 503);
  }
}

export async function readJsonBody(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}

export function parseHouseholdId(value: string): string | null {
  const parsed = householdIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Thrown inside a mutation after authorization when input fails validation. */
export class FaInvalidRequestError extends Error {
  constructor() {
    super("FA_INVALID_REQUEST");
    this.name = "FaInvalidRequestError";
  }
}

export function requireValid<T>(result: { success: true; data: T } | { success: false }): T {
  if (!result.success) throw new FaInvalidRequestError();
  return result.data;
}

export function requireHouseholdId(value: string): string {
  const id = parseHouseholdId(value);
  if (!id) throw new FaInvalidRequestError();
  return id;
}
