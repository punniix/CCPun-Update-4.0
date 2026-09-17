import { listFundCatalog } from "@/features/investment-allocation/server/sec-v2";
import type { FundCatalogCategory, FundCatalogSubcategory } from "@/features/investment-allocation/domain/types";

export const runtime = "nodejs";

const CATEGORIES = new Set<FundCatalogCategory | "all">(["all", "equity", "mixed", "fixed_income", "alternative", "other"]);
const SUBCATEGORIES = new Set<FundCatalogSubcategory>(["all", "domestic", "foreign", "domestic_foreign", "money_market"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const categoryRaw = url.searchParams.get("category") ?? "all";
  const subcategoryRaw = url.searchParams.get("subcategory") ?? "all";
  const cursor = url.searchParams.get("cursor");
  const limitRaw = Number(url.searchParams.get("limit") ?? "20");

  if (query.length > 120) return Response.json({ error: "query_too_long" }, { status: 400 });
  if (!CATEGORIES.has(categoryRaw as FundCatalogCategory | "all")) return Response.json({ error: "category_invalid" }, { status: 400 });
  if (!SUBCATEGORIES.has(subcategoryRaw as FundCatalogSubcategory)) return Response.json({ error: "subcategory_invalid" }, { status: 400 });
  if (cursor && cursor.length > 2000) return Response.json({ error: "cursor_invalid" }, { status: 400 });

  const result = await listFundCatalog({
    query,
    category: categoryRaw as FundCatalogCategory | "all",
    subcategory: subcategoryRaw as FundCatalogSubcategory,
    cursor,
    limit: Number.isFinite(limitRaw) ? limitRaw : 20,
  });

  return Response.json(result, {
    headers: {
      "Cache-Control": result.source === "sec_v2" ? "private, max-age=0, must-revalidate" : "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
