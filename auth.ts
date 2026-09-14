import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import {
  getAdminGoogleOAuthCredentials,
  getLocalAdminCookieNamespace,
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
const localCookieNamespace = getLocalAdminCookieNamespace(adminEnvironment);

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
  cookies: localCookieNamespace
    ? {
        sessionToken: { name: `${localCookieNamespace}.session-token` },
        callbackUrl: { name: `${localCookieNamespace}.callback-url` },
        csrfToken: { name: `${localCookieNamespace}.csrf-token` },
        pkceCodeVerifier: { name: `${localCookieNamespace}.pkce.code_verifier` },
        state: { name: `${localCookieNamespace}.state` },
        nonce: { name: `${localCookieNamespace}.nonce` },
        webauthnChallenge: { name: `${localCookieNamespace}.challenge` },
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
    async jwt({ token, user }) {
      const email = user?.email ?? token.email;
      token.adminRole = getConfiguredAdminRole(email, adminAuthConfigured, adminEnvironment);
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
