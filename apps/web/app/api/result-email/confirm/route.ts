import { handleResultEmailConfirm } from "../../../../lib/result-email/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleResultEmailConfirm(request);
}
export async function POST(request: Request) {
  return handleResultEmailConfirm(request);
}
