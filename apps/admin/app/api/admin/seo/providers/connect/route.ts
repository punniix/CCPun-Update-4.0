import { cookies, headers } from "next/headers";
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
    // Use the same request header source as Auth.js on Hostinger. The rewritten
    // Route Request can differ from Next headers behind the trusted Admin proxy.
    const authHeaders = await headers();
    const trustedRequest = new Request(`${context.origin}/seo/opportunities/`, { headers: authHeaders });
    const session = await readGoogleAuthSession(trustedRequest, process.env)
      ?? await readGoogleAuthSession(request, process.env);
    // A valid Owner application session may predate Google Connect or lack a
    // decodable private account claim. Only ordinary Google login is allowed
    // as recovery, never an Analytics intent or grant from that state.
    reauthenticate = context.environment === "admin-uat" && (!session || (
      !session.googleConnectionAccount && typeof session.sub === "string" && session.sub.length > 0
      && typeof session.email === "string"
      && session.email.trim().toLowerCase() === identity.actor.trim().toLowerCase()));
    if (!reauthenticate) {
      if (!session) throw new Error("GOOGLE_SESSION_CONNECT_REQUIRED");
      intent = issueGoogleConnectIntent(context, session);
    }
  } catch { return denied("connect-required", 409); }
  // NextAuth signIn can throw NEXT_REDIRECT: never consume that inside a catch.
  if (reauthenticate) return signIn("google", { redirectTo: "/seo/opportunities/?googleConnect=account-refreshed" });
  if (!intent) return denied("connect-required", 409);
  const jar = await cookies();
  jar.set(context.intentCookie, intent, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/auth/callback/google", maxAge: 300 });
  // Redirect is owned by Auth.js; do not catch NEXT_REDIRECT or expose OAuth details.
  return signIn("google", { redirectTo: "/seo/opportunities/" }, GOOGLE_CONNECT_AUTHORIZATION);
}
