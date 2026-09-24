import type { AdminEnvironment } from "./environment";

export type AdminAuthDiagnostic = {
  event: "callback" | "error-response" | "thrown-error";
  environment: AdminEnvironment;
  method: string;
  pathname: string;
  requestHost: string | null;
  forwardedHost: string | null;
  forwardedProto: string | null;
  configuredOriginMatch: boolean;
  secureRequest: boolean;
  cookiePresence: {
    pkce: boolean;
    state: boolean;
    nonce: boolean;
    callbackUrl: boolean;
    csrf: boolean;
  };
  responseStatus: number | null;
  redirectHasError: boolean;
  redirectOriginMatchesRequest: boolean | null;
  errorName: string | null;
};

function firstForwardedValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim().toLowerCase() || null;
}

function cookieHas(cookieHeader: string | null, name: string | null) {
  if (!cookieHeader || !name) return false;
  const prefix = name + "=";
  return cookieHeader.split(";").some((part) => part.trim().startsWith(prefix));
}

function safeRedirectFlags(location: string | null, requestUrl: URL) {
  if (!location) return { redirectHasError: false, redirectOriginMatchesRequest: null as boolean | null };
  try {
    const target = new URL(location, requestUrl);
    return {
      redirectHasError: target.searchParams.has("error"),
      redirectOriginMatchesRequest: target.origin === requestUrl.origin,
    };
  } catch {
    return { redirectHasError: false, redirectOriginMatchesRequest: false };
  }
}

export function buildAdminAuthDiagnostic(input: {
  request: Request;
  response?: Response | null;
  environment: AdminEnvironment;
  authUrl: string | undefined;
  cookieNamespace: string | null;
  error?: unknown;
}): AdminAuthDiagnostic {
  const requestUrl = new URL(input.request.url);
  const pathname = requestUrl.pathname;
  const response = input.response ?? null;
  const redirectFlags = safeRedirectFlags(response?.headers.get("location") ?? null, requestUrl);
  const configuredOriginMatch = (() => {
    if (!input.authUrl) return false;
    try {
      return new URL(input.authUrl).origin === requestUrl.origin;
    } catch {
      return false;
    }
  })();
  const namespace = input.cookieNamespace;
  const cookieHeader = input.request.headers.get("cookie");
  const isCallback = pathname.includes("/api/auth/callback/");
  const errorName = input.error instanceof Error ? input.error.name : null;

  return {
    event: input.error
      ? "thrown-error"
      : isCallback
        ? "callback"
        : "error-response",
    environment: input.environment,
    method: input.request.method,
    pathname,
    requestHost: firstForwardedValue(input.request.headers.get("host")),
    forwardedHost: firstForwardedValue(input.request.headers.get("x-forwarded-host")),
    forwardedProto: firstForwardedValue(input.request.headers.get("x-forwarded-proto")),
    configuredOriginMatch,
    secureRequest: requestUrl.protocol === "https:",
    cookiePresence: {
      pkce: cookieHas(cookieHeader, namespace ? namespace + ".pkce.code_verifier" : null),
      state: cookieHas(cookieHeader, namespace ? namespace + ".state" : null),
      nonce: cookieHas(cookieHeader, namespace ? namespace + ".nonce" : null),
      callbackUrl: cookieHas(cookieHeader, namespace ? namespace + ".callback-url" : null),
      csrf: cookieHas(cookieHeader, namespace ? namespace + ".csrf-token" : null),
    },
    responseStatus: response?.status ?? null,
    ...redirectFlags,
    errorName,
  };
}

export function shouldObserveAdminAuthExchange(request: Request, response?: Response | null, error?: unknown) {
  if (error) return true;
  const pathname = new URL(request.url).pathname;
  if (pathname.includes("/api/auth/callback/")) return true;
  if ((response?.status ?? 200) >= 400) return true;
  const location = response?.headers.get("location");
  if (!location) return false;
  try {
    return new URL(location, request.url).searchParams.has("error");
  } catch {
    return false;
  }
}
