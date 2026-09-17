import { NextResponse } from "next/server";
import { isConfiguredAdminOrigin, isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import {
  SocialSheetsExportError,
  exportSocialDataToGoogleSheets,
  socialSheetsExportRequestSchema,
} from "@/lib/admin/social/sheets-export";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;
const MAX_BODY_BYTES = 12_288;

function mappedError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "GOOGLE_SHEETS_AUTH_REQUIRED") return { error: "google-authorization-required", status: 401 };
  if (code === "GOOGLE_SHEETS_RATE_LIMITED") return { error: "google-rate-limited", status: 429 };
  if (["SOCIAL_SHEETS_EXPORT_NOT_CONFIGURED", "SOCIAL_SHEETS_EXPORT_IDENTITY_MISMATCH"].includes(code)) return { error: "database-not-ready", status: 409 };
  if (["GOOGLE_SHEETS_INVALID_EXPORT", "SOCIAL_SHEETS_TOO_MANY_STAT_FAMILIES"].includes(code)) return { error: "export-too-large", status: 409 };
  return { error: "google-export-failed", status: 502 };
}

export async function POST(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
  if (identity.actorType !== "human" || identity.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: NO_STORE_HEADERS });
  }
  if (!isConfiguredAdminOrigin(request.url, process.env.AUTH_URL)
    || !isSameOriginAdminMutation(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "forbidden-origin" }, { status: 403, headers: NO_STORE_HEADERS });
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (!Number.isSafeInteger(contentLength) || contentLength < 2 || contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload-too-large" }, { status: 413, headers: NO_STORE_HEADERS });
  }
  const parsed = socialSheetsExportRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-request" }, { status: 400, headers: NO_STORE_HEADERS });
  try {
    const result = await exportSocialDataToGoogleSheets(parsed.data);
    return NextResponse.json({ export: result }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const mapped = mappedError(error);
    return NextResponse.json({
      error: mapped.error,
      ...(error instanceof SocialSheetsExportError && error.spreadsheetUrl ? { partialSpreadsheetUrl: error.spreadsheetUrl } : {}),
    }, { status: mapped.status, headers: { ...NO_STORE_HEADERS, ...(mapped.status === 429 ? { "Retry-After": "60" } : {}) } });
  }
}
