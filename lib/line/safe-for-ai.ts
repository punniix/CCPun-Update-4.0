export type LineSafeForAIState = {
  journey: string;
  stage: string;
  material_received: boolean;
  needs_human: boolean;
  content_id?: string;
};

const SAFE_KEYS = new Set([
  "journey",
  "stage",
  "material_received",
  "needs_human",
  "content_id",
]);

const SAFE_ID = /^[a-z0-9][a-z0-9_-]{0,79}$/;

export function parseLineSafeForAIState(value: unknown): LineSafeForAIState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !SAFE_KEYS.has(key))) return null;
  if (typeof record.journey !== "string" || !SAFE_ID.test(record.journey)) return null;
  if (typeof record.stage !== "string" || !SAFE_ID.test(record.stage)) return null;
  if (typeof record.material_received !== "boolean" || typeof record.needs_human !== "boolean") return null;
  if (record.content_id !== undefined && (typeof record.content_id !== "string" || !SAFE_ID.test(record.content_id))) {
    return null;
  }
  return {
    journey: record.journey,
    stage: record.stage,
    material_received: record.material_received,
    needs_human: record.needs_human,
    ...(record.content_id === undefined ? {} : { content_id: record.content_id as string }),
  };
}
