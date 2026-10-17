import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signIn } from "@/auth";
import { getAdminIdentity } from "@/lib/admin/identity";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { isPostPublishAdminOriginAllowed } from "@/lib/admin/seo-intelligence/post-publish-origin";
import { getGoogleUatContext, GOOGLE_CONNECT_AUTHORIZATION, GOOGLE_INTENT_COOKIE,
  issueGoogleConnectIntent, readGoogleAuthSession } from "@/lib/admin/seo-intelligence/google-session-connection";

export async function POST(request: Request) {
  const denied = (error: string, status: number) => process.env.CCPUN_APP_ENV === "admin-uat"
    && process.env.CCPUN_DEPLOYMENT_PROVIDER === "hostinger" && process.env.CCPUN_DEPLOYMENT_ROLE === "admin"
    && process.env.AUTH_URL === "https://admin-test.ccpun.com"
    ? NextResponse.redirect(new URL(`/seo/opportunities/?googleConnect=${error}`, "https://admin-test.ccpun.com"), 303)
    : NextResponse.json({ error }, { status });
  const identity = await getAdminIdentity();
  if (!identity) return denied("unauthorized", 401);
  if (identity.actorType !== "human" || identity.role !== "owner") return denied("forbidden", 403);
  if (!isPostPublishAdminOriginAllowed(request, process.env, getAdminEnvironment())) {
    return denied("forbidden-origin", 403);
  }
  const context = getGoogleUatContext(process.env, identity);
  if (!context) return denied("configuration-required", 409);
  let intent: string;
  try {
    const session = await readGoogleAuthSession(request, process.env);
    if (!session) throw new Error("GOOGLE_SESSION_CONNECT_REQUIRED");
    intent = issueGoogleConnectIntent(context, session);
  } catch { return denied("connect-required", 409); }
  const jar = await cookies();
  jar.set(GOOGLE_INTENT_COOKIE, intent, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/auth/callback/google", maxAge: 300 });
  // Redirect is owned by Auth.js; do not catch NEXT_REDIRECT or expose OAuth details.
  return signIn("google", { redirectTo: "/seo/opportunities/" }, GOOGLE_CONNECT_AUTHORIZATION);
}
