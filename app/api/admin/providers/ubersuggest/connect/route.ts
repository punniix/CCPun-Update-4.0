import { NextResponse } from "next/server";
import { getAdminIdentity } from "@/lib/admin/identity";
import { beginUbersuggestAuthorization } from "@/lib/admin/ubersuggest";

export async function POST() {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (identity.actorType !== "human" || identity.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    return NextResponse.json(await beginUbersuggestAuthorization());
  } catch {
    return NextResponse.json({ error: "provider-unavailable" }, { status: 503 });
  }
}
