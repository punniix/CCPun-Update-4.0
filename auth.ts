import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { cookies, headers } from "next/headers";
import {
  consumeGoogleConnectIntent, getGoogleUatContext, GOOGLE_INTENT_COOKIE, readGoogleAuthSession, writeGoogleSessionGrant,
} from "@/lib/admin/seo-intelligence/google-session-connection";
import {
  getAdminGoogleOAuthCredentials,
  getAdminCookieNamespace,
  hasStrongAuthSecret,
  isSecureAdminAuthUrl,
} from "@/lib/admin/auth-config";
import { getAdminEnvironment } from "@/lib/admin/environment";
import {
  getConfiguredAdminRole,
  getVerifiedGoogleAdminRole,
  hasConfiguredAdminUsers,
} from "@/lib/admin/rbac";

const authSecret = process.env.AUTH_SECRET?.trim();
const authUrl = process.env.AUTH_URL?.trim();
const adminEnvironment = getAdminEnvironment();
const googleCredentials = getAdminGoogleOAuthCredentials(adminEnvironment);
const adminCookieNamespace = getAdminCookieNamespace(adminEnvironment);

const googleConfigured = Boolean(googleCredentials);
const adminAuthConfigured = Boolean(
  hasStrongAuthSecret(authSecret) && googleConfigured && hasConfiguredAdminUsers(adminEnvironment) && isSecureAdminAuthUrl(authUrl),
);

export function isAdminAuthConfigured(): boolean {
  return adminAuthConfigured;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret,
  trustHost: true,
  cookies: adminCookieNamespace
    ? {
        sessionToken: { name: `${adminCookieNamespace}.session-token` },
        callbackUrl: { name: `${adminCookieNamespace}.callback-url` },
        csrfToken: { name: `${adminCookieNamespace}.csrf-token` },
        pkceCodeVerifier: { name: `${adminCookieNamespace}.pkce.code_verifier` },
        state: { name: `${adminCookieNamespace}.state` },
        nonce: { name: `${adminCookieNamespace}.nonce` },
        webauthnChallenge: { name: `${adminCookieNamespace}.challenge` },
      }
    : undefined,
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: adminAuthConfigured
    ? [
        Google({
          clientId: googleCredentials!.clientId,
          clientSecret: googleCredentials!.clientSecret,
        }),
      ]
    : [],
  callbacks: {
    async signIn({ user, account, profile }) {
      return (
        getVerifiedGoogleAdminRole({
          provider: account?.provider,
          email: user.email,
          emailVerified: profile?.email_verified,
          environment: adminEnvironment,
        }) !== null
      );
    },
    async jwt({ token, user, account, profile }) {
      const email = user?.email ?? token.email;
      token.adminRole = getConfiguredAdminRole(email, adminAuthConfigured, adminEnvironment);
      if (account && token.adminRole === "owner" && typeof email === "string") {
        const context = getGoogleUatContext(process.env, { actorType: "human", actor: email, role: "owner" });
        if (context) {
          delete token.googleConnectionBinding;
          delete token.googleConnectionAccount;
          if (account.provider === "google" && typeof account.providerAccountId === "string"
            && account.providerAccountId === profile?.sub && profile.email_verified === true) {
            token.googleConnectionAccount = account.providerAccountId;
          }
          try {
            const jar = await cookies();
            const intent = jar.get(GOOGLE_INTENT_COOKIE)?.value;
            if (intent) {
              jar.set(GOOGLE_INTENT_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/api/auth/callback/google", maxAge: 0 });
              const originalSession = await readGoogleAuthSession(new Request("https://admin-test.ccpun.com/api/auth/callback/google", {
                headers: { cookie: (await headers()).get("cookie") ?? "" },
              }), process.env);
              const grant = originalSession ? consumeGoogleConnectIntent({ intent, context, session: originalSession,
                callbackSession: token, account, profile: profile ?? {} }) : null;
              if (grant) {
                await writeGoogleSessionGrant(grant, process.env, (name, value, options) => jar.set(name, value, options));
                token.googleConnectionBinding = grant.sessionBinding;
              }
            }
          } catch { /* Grant failure never changes ordinary login or exposes provider details. */ }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = getConfiguredAdminRole(session.user.email ?? token.email, adminAuthConfigured, adminEnvironment);
      }
      return session;
    },
  },
});
