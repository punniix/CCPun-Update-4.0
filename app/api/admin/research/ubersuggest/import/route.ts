import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { getAdminIdentity } from "@/lib/admin/identity";
import { evaluateAdminAction } from "@/lib/admin/policy";
import { hasAdminPermission } from "@/lib/admin/rbac";
import {
  createResearchSnapshotsBatch,
  isResearchWriteReady,
  listResearchSnapshots,
} from "@/lib/admin/research";
import { normalizeResearchKeyword, type ResearchInput } from "@/lib/admin/research-input";
import {
  parseUbersuggestKeywordIdeasCsv,
  UBERSUGGEST_CSV_MAX_BYTES,
  type UbersuggestCsvRow,
} from "@/lib/admin/ubersuggest-csv";

const requestSchema = z.object({
  action: z.enum(["preview", "import"]),
  location: z.string().trim().max(120).optional(),
  language: z.string().trim().max(80).optional(),
});

type ExistingResearch = {
  keyword: string;
  volume: number | null;
  difficulty: number | null;
  intent: string | null;
  checkedAt: string;
};

function nullable(value: unknown) {
  return value === undefined ? null : value;
}

function rowStatus(row: UbersuggestCsvRow, existing: ExistingResearch | undefined) {
  if (!existing) return "new" as const;
  const unchanged =
    nullable(row.volume) === nullable(existing.volume)
    && nullable(row.difficulty) === nullable(existing.difficulty)
    && nullable(row.intent) === nullable(existing.intent);
  return unchanged ? "existing" as const : "changed" as const;
}

function csvErrorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "UBERSUGGEST_CSV_INVALID";
  if (code === "UBERSUGGEST_CSV_TOO_LARGE") return NextResponse.json({ error: "csv-too-large" }, { status: 413 });
  if (code === "UBERSUGGEST_CSV_TOO_MANY_ROWS") return NextResponse.json({ error: "csv-too-many-rows" }, { status: 413 });
  if (code === "UBERSUGGEST_CSV_HEADER_UNSUPPORTED") return NextResponse.json({ error: "csv-header-unsupported" }, { status: 400 });
  if (code === "UBERSUGGEST_CSV_EMPTY" || code === "UBERSUGGEST_CSV_NO_VALID_ROWS") {
    return NextResponse.json({ error: "csv-no-valid-rows" }, { status: 400 });
  }
  return NextResponse.json({ error: "csv-invalid" }, { status: 400 });
}

async function parseRequest(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const parsed = requestSchema.safeParse({
    action: String(form.get("action") || ""),
    location: String(form.get("location") || "").trim() || undefined,
    language: String(form.get("language") || "").trim() || undefined,
  });
  if (!parsed.success || !(file instanceof File) || !file.name.toLocaleLowerCase("en-US").endsWith(".csv")) {
    throw new Error("UBERSUGGEST_CSV_INVALID");
  }
  if (file.size <= 0) throw new Error("UBERSUGGEST_CSV_EMPTY");
  if (file.size > UBERSUGGEST_CSV_MAX_BYTES) throw new Error("UBERSUGGEST_CSV_TOO_LARGE");
  return {
    ...parsed.data,
    fileName: file.name.slice(0, 180),
    parsedCsv: parseUbersuggestKeywordIdeasCsv(await file.text()),
  };
}

function toResearchInput(
  row: UbersuggestCsvRow,
  meta: { location?: string; language?: string; checkedAt: string },
): ResearchInput {
  return {
    keyword: row.keyword,
    provider: "ubersuggest",
    scope: "ubersuggest:web-csv:keyword-ideas",
    location: meta.location,
    language: meta.language,
    volume: row.volume,
    difficulty: row.difficulty,
    cpc: row.cpc,
    paidDifficulty: row.paidDifficulty,
    intent: row.intent,
    sourceMethod: "web-csv-import",
    checkedAt: meta.checkedAt,
  };
}

export async function POST(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (identity.actorType !== "human" || !hasAdminPermission(identity.role, "research:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let input: Awaited<ReturnType<typeof parseRequest>>;
  try {
    input = await parseRequest(request);
  } catch (error) {
    return csvErrorResponse(error);
  }

  const existingResult = await listResearchSnapshots(500);
  if (existingResult.error) {
    return NextResponse.json({ error: "research-read-unavailable" }, { status: 503 });
  }

  const latest = new Map<string, ExistingResearch>();
  for (const row of existingResult.rows) {
    if (row.provider !== "ubersuggest") continue;
    const key = normalizeResearchKeyword(row.keyword);
    if (!latest.has(key)) {
      latest.set(key, {
        keyword: row.keyword,
        volume: row.volume,
        difficulty: row.difficulty,
        intent: row.intent,
        checkedAt: row.checkedAt,
      });
    }
  }

  const previewRows = input.parsedCsv.rows.map((row) => {
    const existing = latest.get(normalizeResearchKeyword(row.keyword));
    return {
      ...row,
      status: rowStatus(row, existing),
      previous: existing ?? null,
    };
  });
  const counts = {
    sourceRows: input.parsedCsv.sourceRows,
    validRows: previewRows.length,
    newRows: previewRows.filter((row) => row.status === "new").length,
    changedRows: previewRows.filter((row) => row.status === "changed").length,
    existingRows: previewRows.filter((row) => row.status === "existing").length,
    duplicateRows: input.parsedCsv.duplicateRows,
    invalidRows: input.parsedCsv.invalidRows.length,
  };

  if (input.action === "preview") {
    return NextResponse.json({
      fileName: input.fileName,
      reportType: input.parsedCsv.reportType,
      headers: input.parsedCsv.headers,
      counts,
      invalidRows: input.parsedCsv.invalidRows,
      rows: previewRows,
    });
  }

  const policy = evaluateAdminAction({
    actorType: identity.actorType,
    role: identity.role,
    action: "research:create",
    environment: getAdminEnvironment(),
  });
  if (!policy.allowed || !hasAdminPermission(identity.role, "research:create")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!isResearchWriteReady()) {
    return NextResponse.json({ error: "research-write-not-configured" }, { status: 503 });
  }

  const importable = previewRows.filter((row) => row.status !== "existing");
  if (!importable.length) {
    return NextResponse.json({
      requestId: randomUUID(),
      counts,
      imported: 0,
      reused: 0,
      failed: 0,
      skippedExisting: counts.existingRows,
    });
  }

  const requestId = randomUUID();
  const checkedAt = new Date().toISOString();
  try {
    const result = await createResearchSnapshotsBatch(
      importable.map((row) => toResearchInput(row, {
        location: input.location,
        language: input.language,
        checkedAt,
      })),
      { actor: identity.actor, actorType: "human", requestId },
    );
    return NextResponse.json({
      requestId,
      counts,
      imported: result.inserted,
      reused: result.reused,
      failed: result.failed,
      skippedExisting: counts.existingRows,
      failures: result.failures,
    }, { status: result.failed ? 207 : result.inserted ? 201 : 200 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "RESEARCH_BATCH_INVALID") return NextResponse.json({ error: "csv-too-many-rows", requestId }, { status: 413 });
    if (code === "ADMIN_DATABASE_NOT_CONFIGURED") return NextResponse.json({ error: "research-write-not-configured", requestId }, { status: 503 });
    return NextResponse.json({ error: "research-import-failed", requestId }, { status: 502 });
  }
}
