import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { isPostPublishAdminOriginAllowed } from "@/lib/admin/seo-intelligence/post-publish-origin";
import { getPageSeoPage } from "@/lib/content/page-seo-registry";
import { isPageSeoUatAllowed, listPageSeo, parsePageSeoSave, readPageSeoTags, savePageSeo } from "@/lib/admin/page-seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive", "X-Content-Type-Options": "nosniff" } });

async function authorize(request: Request, write: boolean) {
  const identity = await getAdminIdentity();
  if (!identity) return json({ error: "unauthorized" }, 401);
  if (identity.actorType !== "human" || identity.role !== "owner" || !hasAdminPermission(identity.role, write ? "draft:apply" : "seo:read") || !isPageSeoUatAllowed()) return json({ error: "forbidden" }, 403);
  if (!isPostPublishAdminOriginAllowed(request, process.env, "admin-uat") || (write && request.headers.get("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) return json({ error: "forbidden-origin" }, 403);
  return null;
}

export async function GET(request: Request) {
  const denied = await authorize(request, false);
  if (denied) return denied;
  const url = new URL(request.url), pathname = url.searchParams.get("pathname");
  if (pathname && !getPageSeoPage(pathname)) return json({ error: "invalid-input" }, 400);
  try {
    return json(pathname ? await readPageSeoTags(pathname) : { pages: await listPageSeo() });
  } catch { return json({ error: "read-unavailable" }, 503); }
}

export async function PATCH(request: Request) {
  const denied = await authorize(request, true);
  if (denied) return denied;
  if (!request.headers.get("content-type")?.startsWith("application/json") || Number(request.headers.get("content-length") ?? 0) > 8_000) return json({ error: "invalid-input" }, 400);
  let input;
  try {
    if (!request.body) return json({ error: "invalid-input" }, 400);
    const reader = request.body.getReader(), decoder = new TextDecoder();
    let bytes = 0, text = "";
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 8_000) { await reader.cancel(); return json({ error: "invalid-input" }, 400); }
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
    input = parsePageSeoSave(JSON.parse(text));
  } catch { return json({ error: "invalid-input" }, 400); }
  try {
    const saved = await savePageSeo(input);
    return json({ saved: true, revision: saved.revision, fields: saved.fields });
  } catch (error) {
    const conflict = error && typeof error === "object" && "statusCode" in error && error.statusCode === 409;
    if (conflict) return json({ error: "revision-conflict" }, 409);
    if (error instanceof Error && error.message === "PAGE_SEO_WRITE_UNAVAILABLE") return json({ error: "write-unavailable" }, 503);
    return json({ error: "save-failed" }, 502);
  }
}
