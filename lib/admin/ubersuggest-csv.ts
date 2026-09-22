import { normalizeResearchKeyword, type ResearchInput } from "./research-input";

export const UBERSUGGEST_CSV_MAX_BYTES = 2 * 1024 * 1024;
export const UBERSUGGEST_CSV_MAX_ROWS = 200;

export type UbersuggestCsvIntent = ResearchInput["intent"];
export type UbersuggestCsvRow = {
  keyword: string;
  intent?: UbersuggestCsvIntent;
  volume?: number;
  difficulty?: number;
  cpc?: number;
  paidDifficulty?: number;
  sourceRow: number;
};

export type UbersuggestCsvParseResult = {
  reportType: "keyword-ideas";
  headers: string[];
  sourceRows: number;
  rows: UbersuggestCsvRow[];
  duplicateRows: number;
  invalidRows: Array<{ row: number; reason: string }>;
};

const HEADER_ALIASES = {
  keyword: ["keyword", "keywords", "search term", "search terms"],
  intent: ["intent", "search intent"],
  volume: ["volume", "search volume", "monthly volume"],
  cpc: ["cpc", "cost per click"],
  paidDifficulty: ["pd", "paid difficulty"],
  difficulty: ["sd", "seo difficulty", "search difficulty"],
} as const;

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .toLocaleLowerCase("en-US")
    .replace(/[_.\-/]+/g, " ")
    .replace(/[()%]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findColumn(headers: string[], aliases: readonly string[]) {
  const normalized = headers.map(normalizeHeader);
  return normalized.findIndex((header) => aliases.includes(header));
}

function parseCsvRecords(input: string): string[][] {
  if (input.includes("\0")) throw new Error("UBERSUGGEST_CSV_INVALID");
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field === "") {
      quoted = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      record.push(field);
      field = "";
      if (record.some((value) => value.trim())) records.push(record);
      record = [];
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error("UBERSUGGEST_CSV_INVALID");
  record.push(field);
  if (record.some((value) => value.trim())) records.push(record);
  return records;
}

function parseNumber(value: string | undefined) {
  const text = value?.trim();
  if (!text || /^(?:-|—|n\/?a|null)$/i.test(text)) return undefined;
  const normalized = text.replace(/\u00a0/g, " ").replace(/,/g, "").replace(/[^0-9.+-]/g, "");
  if (!normalized) return undefined;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : Number.NaN;
}

function parseIntent(value: string | undefined): UbersuggestCsvIntent | undefined {
  const text = value?.trim().toLocaleLowerCase("en-US");
  if (!text || text === "-" || text === "—") return undefined;

  const found = new Set<Exclude<UbersuggestCsvIntent, undefined>>();
  const compact = text.replace(/[^a-z]/g, "");
  if (text.includes("informational") || compact === "i") found.add("informational");
  if (text.includes("commercial") || compact === "c") found.add("commercial");
  if (text.includes("transactional") || compact === "t") found.add("transactional");
  if (text.includes("navigational") || compact === "n") found.add("navigational");

  for (const token of text.split(/[\s,;/|]+/)) {
    if (token === "i") found.add("informational");
    if (token === "c") found.add("commercial");
    if (token === "t") found.add("transactional");
    if (token === "n") found.add("navigational");
  }

  if (found.size > 1) return "mixed";
  return [...found][0];
}

function completeness(row: UbersuggestCsvRow) {
  return [row.intent, row.volume, row.difficulty, row.cpc, row.paidDifficulty]
    .filter((value) => value !== undefined).length;
}

export function parseUbersuggestKeywordIdeasCsv(input: string): UbersuggestCsvParseResult {
  const records = parseCsvRecords(input);
  if (records.length < 2) throw new Error("UBERSUGGEST_CSV_EMPTY");

  const headers = records[0]!.map((value) => value.trim());
  if (!headers.length || headers.length > 50) throw new Error("UBERSUGGEST_CSV_HEADER_UNSUPPORTED");

  const keywordIndex = findColumn(headers, HEADER_ALIASES.keyword);
  const intentIndex = findColumn(headers, HEADER_ALIASES.intent);
  const volumeIndex = findColumn(headers, HEADER_ALIASES.volume);
  const cpcIndex = findColumn(headers, HEADER_ALIASES.cpc);
  const paidDifficultyIndex = findColumn(headers, HEADER_ALIASES.paidDifficulty);
  const difficultyIndex = findColumn(headers, HEADER_ALIASES.difficulty);

  if (keywordIndex < 0 || [intentIndex, volumeIndex, cpcIndex, paidDifficultyIndex, difficultyIndex].every((index) => index < 0)) {
    throw new Error("UBERSUGGEST_CSV_HEADER_UNSUPPORTED");
  }

  const dataRows = records.slice(1);
  if (dataRows.length > UBERSUGGEST_CSV_MAX_ROWS) throw new Error("UBERSUGGEST_CSV_TOO_MANY_ROWS");

  const byKeyword = new Map<string, UbersuggestCsvRow>();
  const invalidRows: Array<{ row: number; reason: string }> = [];
  let duplicateRows = 0;

  dataRows.forEach((record, offset) => {
    const rowNumber = offset + 2;
    if (record.length > 50) {
      invalidRows.push({ row: rowNumber, reason: "มีจำนวนคอลัมน์มากเกินไป" });
      return;
    }

    const keyword = (record[keywordIndex] ?? "").replace(/\s+/g, " ").trim();
    if (!keyword || keyword.length > 300) {
      invalidRows.push({ row: rowNumber, reason: "คำค้นว่างหรือยาวเกิน 300 ตัวอักษร" });
      return;
    }

    const volume = volumeIndex >= 0 ? parseNumber(record[volumeIndex]) : undefined;
    const difficulty = difficultyIndex >= 0 ? parseNumber(record[difficultyIndex]) : undefined;
    const cpc = cpcIndex >= 0 ? parseNumber(record[cpcIndex]) : undefined;
    const paidDifficulty = paidDifficultyIndex >= 0 ? parseNumber(record[paidDifficultyIndex]) : undefined;

    if (
      [volume, difficulty, cpc, paidDifficulty].some((value) => Number.isNaN(value))
      || (volume != null && volume < 0)
      || (cpc != null && cpc < 0)
      || (difficulty != null && (difficulty < 0 || difficulty > 100))
      || (paidDifficulty != null && (paidDifficulty < 0 || paidDifficulty > 100))
    ) {
      invalidRows.push({ row: rowNumber, reason: "ค่าตัวเลขในแถวนี้ไม่ถูกต้อง" });
      return;
    }

    const row: UbersuggestCsvRow = {
      keyword,
      intent: intentIndex >= 0 ? parseIntent(record[intentIndex]) : undefined,
      volume,
      difficulty,
      cpc,
      paidDifficulty,
      sourceRow: rowNumber,
    };
    const key = normalizeResearchKeyword(keyword);
    const previous = byKeyword.get(key);
    if (previous) {
      duplicateRows += 1;
      if (completeness(row) > completeness(previous)) byKeyword.set(key, row);
    } else {
      byKeyword.set(key, row);
    }
  });

  if (!byKeyword.size) throw new Error("UBERSUGGEST_CSV_NO_VALID_ROWS");

  return {
    reportType: "keyword-ideas",
    headers,
    sourceRows: dataRows.length,
    rows: [...byKeyword.values()],
    duplicateRows,
    invalidRows: invalidRows.slice(0, 30),
  };
}
