import { draftMode } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { listAdminArticles } from "@/lib/admin/sanity-control";
import { getArticleCategorySlug } from "@/lib/content/url";

type RouteContext = { params: Promise<{ id: string }> };

const articleIdSchema = z.string().min(1).max(200).regex(/^[A-Za-z0-9_.-]+$/);

export async function POST(_request: Request, context: RouteContext) {
  const identity = await getAdminIdentity();
  if (!identity || !hasAdminPermission(identity.role, "draft:apply")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsedId = articleIdSchema.safeParse((await context.params).id);
  if (!parsedId.success) return new NextResponse("Not Found", { status: 404 });
  const cleanId = parsedId.data.replace(/^drafts\./, "");
  const result = await listAdminArticles();
  const article = result.rows.find((row) => row.isDraft && row.id.replace(/^drafts\./, "") === cleanId);
  if (result.error || !article?.slug) return new NextResponse("Not Found", { status: 404 });

  (await draftMode()).enable();
  const category = getArticleCategorySlug({ category: article.category ?? "", categorySlug: article.categorySlug ?? undefined });
  return NextResponse.redirect(new URL(`/blog/${category}/${article.slug}/`, _request.url), 303);
}
