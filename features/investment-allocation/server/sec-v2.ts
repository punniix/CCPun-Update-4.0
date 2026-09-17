import "server-only";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";
import type { FundSearchResponse, PlanningFund } from "../domain/types";
import { searchDemoFunds } from "./demo-funds";

const SEC_BASE_URL = "https://api.sec.or.th";
const SEC_HEADER = "Ocp-Apim-Subscription-Key";
const SEARCH_PAGE_SIZE = 8;

type SecEnvelope = {
  message?: unknown;
  items?: unknown;
  next_cursor?: unknown;
  page_size?: unknown;
};

type SecProfile = {
  proj_id: string;
  proj_abbr_name: string;
  fund_class_name: string | null;
  last_upd_date: string | null;
};

type SecRiskRow = {
  risk_spectrum: string | null;
  start_date: string | null;
  end_date: string | null;
  prospectus_type: string | null;
};

function getSubscriptionKey(): string | null {
  return process.env.SEC_API_PRIMARY_KEY?.trim() || process.env.SEC_API_SECONDARY_KEY?.trim() || null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeProfile(value: unknown): SecProfile | null {
  const row = asRecord(value);
  if (!row) return null;
  const projId = asString(row.proj_id);
  const shortName = asString(row.proj_abbr_name);
  if (!projId || !shortName) return null;
  return {
    proj_id: projId,
    proj_abbr_name: shortName,
    fund_class_name: asString(row.fund_class_name),
    last_upd_date: asString(row.last_upd_date),
  };
}

function normalizeRisk(value: unknown): SecRiskRow | null {
  const row = asRecord(value);
  if (!row) return null;
  return {
    risk_spectrum: asString(row.risk_spectrum),
    start_date: asString(row.start_date),
    end_date: asString(row.end_date),
    prospectus_type: asString(row.prospectus_type),
  };
}

function riskLevel(value: string | null): number | null {
  if (!value) return null;
  const match = value.toUpperCase().match(/^RS([1-8])$/);
  return match ? Number(match[1]) : null;
}

async function secGet(path: string, key: string): Promise<SecEnvelope> {
  const response = await fetch(`${SEC_BASE_URL}${path}`, {
    method: "GET",
    headers: { [SEC_HEADER]: key, Accept: "application/json" },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`sec_http_${response.status}`);
  const body: unknown = await response.json();
  const envelope = asRecord(body);
  if (!envelope) throw new Error("sec_invalid_envelope");
  return envelope as SecEnvelope;
}

async function loadLatestRisk(projectId: string, key: string): Promise<{ level: number | null; sourceDate: string | null; snapshotId: string }> {
  const params = new URLSearchParams({ proj_id: projectId, start_date: "2020-01-01", page_size: "100" });
  const envelope = await secGet(`/v2/fund/factsheet/risk-spectrum?${params.toString()}`, key);
  const items = Array.isArray(envelope.items) ? envelope.items.map(normalizeRisk).filter((row): row is SecRiskRow => Boolean(row)) : [];
  const latest = items.sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""))[0] ?? null;
  return {
    level: riskLevel(latest?.risk_spectrum ?? null),
    sourceDate: latest?.start_date ?? null,
    snapshotId: `sec-v2:risk-spectrum:${projectId}:${latest?.start_date ?? "unknown"}`,
  };
}

function profileToFund(profile: SecProfile, risk: { level: number | null; sourceDate: string | null; snapshotId: string } | null, fetchedAt: string): PlanningFund {
  const classLabel = profile.fund_class_name ? ` · ${profile.fund_class_name}` : "";
  const sourceDate = risk?.sourceDate ?? profile.last_upd_date;
  return {
    id: `sec:${profile.proj_id}:${profile.fund_class_name ?? "project"}`,
    projectId: profile.proj_id,
    className: profile.fund_class_name,
    name: `${profile.proj_abbr_name}${classLabel}`,
    shortName: profile.proj_abbr_name,
    constructionBucket: null,
    policyText: null,
    riskSpectrum: risk?.level ?? null,
    assetAllocation: [],
    liquidity: { rawText: null, normalized: "unknown", sourceDate: null },
    feeSummary: null,
    masterFund: null,
    provenance: {
      source: "sec_v2",
      snapshotIds: [
        `sec-v2:profile:${profile.proj_id}:${profile.last_upd_date ?? "unknown"}`,
        ...(risk ? [risk.snapshotId] : []),
      ],
      sourceDate,
      fetchedAt,
      state: "partial",
      notes: [
        "SEC v2 profile/risk data only in this UAT adapter.",
        "Asset allocation, liquidity, fee and master-fund endpoint paths are not used until current v2 field mapping is verified.",
      ],
    },
  };
}

export async function searchPlanningFunds(query: string): Promise<FundSearchResponse> {
  const normalizedQuery = query.trim().slice(0, 120);
  const fetchedAt = new Date().toISOString();
  const key = getSubscriptionKey();
  if (!normalizedQuery) return { mode: key ? "sec_live" : "uat_demo", state: "unavailable", query: "", funds: [], message: "กรอกชื่อหรือรหัสกองทุนเพื่อค้นหา", fetchedAt };

  const demoRequested = IS_REVIEW_ENVIRONMENT && /(?:^|\s)(uat|demo|ตัวอย่าง)(?:\s|$)/i.test(normalizedQuery);
  if (demoRequested) {
    return {
      mode: "uat_demo",
      state: "demo",
      query: normalizedQuery,
      funds: searchDemoFunds("uat"),
      message: "กำลังแสดงข้อมูลสังเคราะห์สำหรับทดสอบ UAT เท่านั้น ไม่ใช่ข้อมูลกองทุนจริงจาก ก.ล.ต.",
      fetchedAt,
    };
  }

  if (!key) {
    if (!IS_REVIEW_ENVIRONMENT) {
      return {
        mode: "sec_live",
        state: "unavailable",
        query: normalizedQuery,
        funds: [],
        message: "บริการค้นหาข้อมูลกองทุนยังไม่พร้อมใช้งาน",
        fetchedAt,
      };
    }
    return {
      mode: "uat_demo",
      state: "demo",
      query: normalizedQuery,
      funds: searchDemoFunds(normalizedQuery),
      message: "UAT นี้ยังไม่ได้ผูก SEC subscription key จึงใช้ได้เฉพาะข้อมูลสังเคราะห์ที่ติดป้าย UAT ชัดเจน",
      fetchedAt,
    };
  }

  try {
    const params = new URLSearchParams({ project_info: normalizedQuery, page_size: String(SEARCH_PAGE_SIZE) });
    const envelope = await secGet(`/v2/fund/general-info/profiles?${params.toString()}`, key);
    const profiles = Array.isArray(envelope.items) ? envelope.items.map(normalizeProfile).filter((row): row is SecProfile => Boolean(row)) : [];
    const funds = await Promise.all(profiles.map(async (profile) => {
      try {
        const risk = await loadLatestRisk(profile.proj_id, key);
        return profileToFund(profile, risk, fetchedAt);
      } catch {
        return profileToFund(profile, null, fetchedAt);
      }
    }));
    return {
      mode: "sec_live",
      state: funds.length ? "partial" : "unavailable",
      query: normalizedQuery,
      funds,
      message: funds.length
        ? "ผลค้นหาจาก SEC v2; UAT นี้เปิดใช้เฉพาะ endpoint ที่ยืนยันแล้ว จึงอาจยังไม่มี allocation/liquidity/fee"
        : "ไม่พบกองทุนจากคำค้นนี้",
      fetchedAt,
    };
  } catch {
    return {
      mode: "sec_live",
      state: "unavailable",
      query: normalizedQuery,
      funds: [],
      message: "SEC Open API ไม่พร้อมใช้งานชั่วคราว ลองใหม่ภายหลัง โดยข้อมูลที่กรอกไว้ยังอยู่ในหน้านี้",
      fetchedAt,
    };
  }
}
