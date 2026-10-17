import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signIn } from "@/auth";
import { getAdminIdentity } from "@/lib/admin/identity";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { isPostPublishAdminOriginAllowed } from "@/lib/admin/seo-intelligence/post-publish-origin";
import { getGoogleSessionContext, getGoogleSessionLane, GOOGLE_CONNECT_AUTHORIZATION,
  issueGoogleConnectIntent, readGoogleAuthSession } from "@/lib/admin/seo-intelligence/google-session-connection";

export async function POST(request: Request) {
  const lane = getGoogleSessionLane(process.env);
  const denied = (error: string, status: number) => lane
    ? NextResponse.redirect(new URL(`/seo/opportunities/?googleConnect=${error}`, lane.origin), 303)
    : NextResponse.json({ error }, { status });
  const identity = await getAdminIdentity();
  if (!identity) return denied("unauthorized", 401);
  if (identity.actorType !== "human" || identity.role !== "owner") return denied("forbidden", 403);
  if (!isPostPublishAdminOriginAllowed(request, process.env, getAdminEnvironment())) {
    return denied("forbidden-origin", 403);
  }
  const context = getGoogleSessionContext(process.env, identity);
  if (!context) return denied("configuration-required", 409);
  let intent: string | null = null;
  let reauthenticate = false;
  try {
    const session = await readGoogleAuthSession(request, process.env);
    if (!session) throw new Error("GOOGLE_SESSION_CONNECT_REQUIRED");
    // A pre-release Owner session cannot issue an account-bound Analytics intent.
    // A normal Google login refreshes its verified account claim, with no Analytics
    // scope or grant; keep the actual Auth.js redirect outside the catch below.
    reauthenticate = context.environment === "admin-uat" && !session.googleConnectionAccount
      && typeof session.sub === "string" && session.sub.length > 0
      && typeof session.email === "string"
      && session.email.trim().toLowerCase() === identity.actor.trim().toLowerCase();
    if (!reauthenticate) intent = issueGoogleConnectIntent(context, session);
  } catch { return denied("connect-required", 409); }
  // NextAuth signIn can throw NEXT_REDIRECT: never consume that inside a catch.
  if (reauthenticate) return signIn("google", { redirectTo: "/seo/opportunities/?googleConnect=account-refreshed" });
  if (!intent) return denied("connect-required", 409);
  const jar = await cookies();
  jar.set(context.intentCookie, intent, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/auth/callback/google", maxAge: 300 });
  // Redirect is owned by Auth.js; do not catch NEXT_REDIRECT or expose OAuth details.
  return signIn("google", { redirectTo: "/seo/opportunities/" }, GOOGLE_CONNECT_AUTHORIZATION);
}
