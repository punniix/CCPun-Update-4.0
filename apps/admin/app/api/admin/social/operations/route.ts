import { NextResponse } from "next/server";
import { isConfiguredAdminOrigin } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import {
  getSocialOperationsRuntimeStatus,
  socialOperationsSnapshotSchema,
  SYNTHETIC_SOCIAL_OPERATIONS,
} from "@/lib/admin/social/operations";

export async function GET(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasAdminPermission(identity.role, "social:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!isConfiguredAdminOrigin(request.url, process.env.AUTH_URL)) {
    return NextResponse.json({ error: "forbidden-origin" }, { status: 403 });
  }
  if (!getSocialOperationsRuntimeStatus().enabled) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      snapshot: socialOperationsSnapshotSchema.parse(SYNTHETIC_SOCIAL_OPERATIONS),
      limitations: [
        "ไม่มีการเรียก Social API",
        "ไม่มีการสร้างหรือแก้ publication job",
        "Native metrics ของแต่ละแพลตฟอร์มไม่ถูกรวมเป็นยอดเดียว",
      ],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
