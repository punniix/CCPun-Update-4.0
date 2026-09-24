import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { getAdminCookieNamespace } from "@/lib/admin/auth-config";
import {
  buildAdminAuthDiagnostic,
  shouldObserveAdminAuthExchange,
} from "@/lib/admin/auth-diagnostics";
import { getAdminEnvironment } from "@/lib/admin/environment";

function observe(request: NextRequest, response?: Response | null, error?: unknown) {
  if (!shouldObserveAdminAuthExchange(request, response, error)) return;
  const environment = getAdminEnvironment();
  const diagnostic = buildAdminAuthDiagnostic({
    request,
    response,
    error,
    environment,
    authUrl: process.env.AUTH_URL,
    cookieNamespace: getAdminCookieNamespace(environment),
  });
  console.warn("[admin-auth-diagnostic]", diagnostic);
}

export async function GET(request: NextRequest) {
  try {
    const response = await handlers.GET(request);
    observe(request, response);
    return response;
  } catch (error) {
    observe(request, null, error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const response = await handlers.POST(request);
    observe(request, response);
    return response;
  } catch (error) {
    observe(request, null, error);
    throw error;
  }
}
