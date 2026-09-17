import { NextResponse } from "next/server";
import { getAdminIdentity } from "@/lib/admin/identity";
import { finishUbersuggestAuthorization } from "@/lib/admin/ubersuggest";

export async function GET(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity || identity.actorType !== "human" || identity.role !== "owner") {
    return NextResponse.redirect(new URL("/login/", request.url));
  }
  try {
    await finishUbersuggestAuthorization(new URL(request.url).searchParams);
    return NextResponse.redirect(new URL("/content/research/?provider=connected", request.url));
  } catch {
    return NextResponse.redirect(new URL("/content/research/?provider=error", request.url));
  }
}
