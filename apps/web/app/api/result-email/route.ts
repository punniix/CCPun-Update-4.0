import { handleResultEmailRequest } from "../../../lib/result-email/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Email phase 1 (owner-approved 2026-10-25): 404 unless CCPUN_RESULT_EMAIL_ENABLED=1.
export async function POST(request: Request) {
  return handleResultEmailRequest(request);
}
