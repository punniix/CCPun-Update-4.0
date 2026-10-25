import { handleResultEmailUnsubscribe } from "../../../../lib/result-email/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleResultEmailUnsubscribe(request);
}
export async function POST(request: Request) {
  return handleResultEmailUnsubscribe(request);
}
