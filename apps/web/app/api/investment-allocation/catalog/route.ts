import { INVESTMENT_ALLOCATION_ENABLED } from "@/lib/runtime/investment-availability";
import { enforceInvestmentApiRateLimit } from "@/features/investment-allocation/server/rate-limit";
import { parseCatalogCursor } from "@/features/investment-allocation/server/catalog-cursor";
import type { FundCatalogCategory, FundCatalogSubcategory } from "@/features/investment-allocation/domain/types";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

const CATEGORIES = new Set<FundCatalogCategory | "all">(["all", "equity", "mixed", "fixed_income", "alternative", "other"]);
const SUBCATEGORIES = new Set<FundCatalogSubcategory>(["all", "domestic", "foreign", "domestic_foreign"]);

export async function GET(request: Request) {
  if (!INVESTMENT_ALLOCATION_ENABLED) {
    return Response.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  }
  const limited = enforceInvestmentApiRateLimit(request, "catalog");
  if (limited) return limited;
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const categoryRaw = url.searchParams.get("category") ?? "all";
  const subcategoryRaw = url.searchParams.get("subcategory") ?? "all";
  const amcId = url.searchParams.get("amc")?.trim() || null;
  const cursor = url.searchParams.get("cursor");
  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  // Tool scope (owner request 2026-10-26): absent = main tool, "aia" = บลจ. เอไอเอ tool.
  const scopeRaw = url.searchParams.get("scope");
  if (scopeRaw !== null && scopeRaw !== "main" && scopeRaw !== "aia") return Response.json({ error: "scope_invalid" }, { status: 400, headers: NO_STORE });
  const scope = scopeRaw === "aia" ? "aia" : "main";

  if (query.length > 120) return Response.json({ error: "query_too_long" }, { status: 400, headers: NO_STORE });
  if (!CATEGORIES.has(categoryRaw as FundCatalogCategory | "all")) return Response.json({ error: "category_invalid" }, { status: 400, headers: NO_STORE });
  if (!SUBCATEGORIES.has(subcategoryRaw as FundCatalogSubcategory)) return Response.json({ error: "subcategory_invalid" }, { status: 400, headers: NO_STORE });
  if (amcId && !/^[A-Za-z0-9_-]{1,64}$/.test(amcId)) return Response.json({ error: "amc_invalid" }, { status: 400, headers: NO_STORE });
  // Only a cursor in the exact shape this server issues may reach the SEC adapter.
  if (cursor !== null && !parseCatalogCursor(cursor)) return Response.json({ error: "cursor_invalid" }, { status: 400, headers: NO_STORE });

  const { listFundCatalog } = await import("@/features/investment-allocation/server/sec-v2");
  const result = await listFundCatalog({
    query,
    category: categoryRaw as FundCatalogCategory | "all",
    subcategory: subcategoryRaw as FundCatalogSubcategory,
    amcId,
    cursor,
    limit: Number.isFinite(limitRaw) ? limitRaw : 20,
    scope,
  });

  return Response.json(result, {
    headers: {
      "Cache-Control": result.source === "sec_v2" ? "private, max-age=0, must-revalidate" : "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
