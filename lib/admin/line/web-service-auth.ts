import "server-only";
import { bearerToken, isProductionVercelServiceTokenAuthorized } from "../../runtime/vercel-service-auth";

export async function isProductionWebServiceRequestAuthorized(request: Request) {
  // Keep ingest-event and bridge-health callers restricted to Web Production.
  return isProductionVercelServiceTokenAuthorized(bearerToken(request.headers.get("authorization")), "web");
}
