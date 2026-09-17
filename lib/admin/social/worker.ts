import "server-only";

import { randomUUID } from "node:crypto";
import { executeSocialPublication } from "./execution-store";
import { listSocialOperationalItems } from "./operations-service";

const AUTO_EXECUTABLE_FORMATS = new Set(["text-post", "link-post"]);
const MAX_JOBS_PER_RUN = 6;
const BASE_RETRY_DELAY_MS = 30_000;
const MAX_RETRY_DELAY_MS = 15 * 60_000;

function retryDelayMs(attemptCount: number) {
  return Math.min(BASE_RETRY_DELAY_MS * (2 ** Math.max(0, attemptCount - 1)), MAX_RETRY_DELAY_MS);
}

function retryDue(item: Awaited<ReturnType<typeof listSocialOperationalItems>>[number], now: Date) {
  if (item.status !== "retryable") return true;
  const updatedAt = Date.parse(item.updatedAt);
  if (!Number.isFinite(updatedAt)) return false;
  return now.getTime() >= updatedAt + retryDelayMs(item.attemptCount);
}

function workerEligible(item: Awaited<ReturnType<typeof listSocialOperationalItems>>[number], now: Date) {
  if (!item.capabilities.executeNow) return false;
  if (item.platform !== "facebook") return false;
  if (!AUTO_EXECUTABLE_FORMATS.has(item.format)) return false;
  if (!retryDue(item, now)) return false;
  if (item.executionTarget === "facebook-native-scheduled") {
    const scheduledAt = item.scheduledAt ? Date.parse(item.scheduledAt) : Number.NaN;
    if (!Number.isFinite(scheduledAt) || scheduledAt <= now.getTime()) return false;
  }
  return item.status === "queued" || item.status === "retryable";
}

export type SocialWorkerResult = {
  scanned: number;
  eligible: number;
  executed: number;
  skipped: number;
  results: Array<{
    publicationId: string;
    outcome: "executed" | "replay" | "needs-reconciliation" | "conflict" | "failed";
    code?: string;
  }>;
};

export async function runSocialWorker(input: {
  env?: Record<string, string | undefined>;
  now?: Date;
  maxJobs?: number;
} = {}): Promise<SocialWorkerResult> {
  const env = input.env ?? process.env;
  const now = input.now ?? new Date();
  const maxJobs = Math.max(1, Math.min(input.maxJobs ?? MAX_JOBS_PER_RUN, MAX_JOBS_PER_RUN));
  const items = await listSocialOperationalItems({ limit: 100, env, now });
  const eligible = items.filter((item) => workerEligible(item, now)).slice(0, maxJobs);
  const results: SocialWorkerResult["results"] = [];

  for (const item of eligible) {
    const requestId = `social-worker:${randomUUID()}`;
    try {
      const result = await executeSocialPublication({
        request: {
          publicationId: item.publicationId,
          expectedJobVersion: item.jobVersion,
        },
        actor: "ccpun-social-worker",
        requestId,
        env,
      });
      results.push({
        publicationId: item.publicationId,
        outcome: result.state === "replay" ? "replay" : "executed",
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "SOCIAL_WORKER_UNKNOWN_ERROR";
      if (code === "SOCIAL_EXECUTION_RECONCILIATION_REQUIRED") {
        results.push({ publicationId: item.publicationId, outcome: "needs-reconciliation", code });
        continue;
      }
      if (code === "SOCIAL_EXECUTION_CAS_CONFLICT" || code === "SOCIAL_EXECUTION_ACTIVE_LEASE") {
        results.push({ publicationId: item.publicationId, outcome: "conflict", code });
        continue;
      }
      results.push({ publicationId: item.publicationId, outcome: "failed", code });
    }
  }

  return {
    scanned: items.length,
    eligible: eligible.length,
    executed: results.filter((result) => result.outcome === "executed" || result.outcome === "replay").length,
    skipped: Math.max(0, items.length - eligible.length),
    results,
  };
}
