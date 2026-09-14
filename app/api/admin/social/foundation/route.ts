import { NextResponse } from "next/server";
import { isConfiguredAdminOrigin } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { getSocialDatabaseReadiness } from "@/lib/admin/social/database";
import {
  getSocialFoundationRuntimeStatus,
  socialFoundationSnapshotSchema,
  SYNTHETIC_SOCIAL_FOUNDATION,
} from "@/lib/admin/social/foundation";

export async function GET(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasAdminPermission(identity.role, "social:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!isConfiguredAdminOrigin(request.url, process.env.AUTH_URL)) {
    return NextResponse.json({ error: "forbidden-origin" }, { status: 403 });
  }

  const runtime = getSocialFoundationRuntimeStatus();
  if (!runtime.enabled) return NextResponse.json({ error: "not-found" }, { status: 404 });

  return NextResponse.json(
    {
      snapshot: socialFoundationSnapshotSchema.parse(SYNTHETIC_SOCIAL_FOUNDATION),
      operationalDatabase: await getSocialDatabaseReadiness(),
      limitations: [
        "ข้อมูลทั้งหมดเป็น synthetic UAT",
        "ยังไม่เชื่อมบัญชี Social จริง",
        "มีเฉพาะ media metadata contract โดยยังไม่มี upload หรือ storage",
        "ยังไม่มีการส่งงานไปยังแพลตฟอร์มหรือ Production",
      ],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
