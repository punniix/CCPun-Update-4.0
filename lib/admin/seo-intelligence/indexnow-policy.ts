type Env = Record<string, string | undefined>;
export function indexNowEnabled(env: Env = process.env) {
  return env.CCPUN_INDEXNOW_ENABLED === "1" && env.CCPUN_APP_ENV === "production-admin"
    && env.CCPUN_BACKGROUND_EXECUTION_PLANE === "vps" && env.CCPUN_SEO_POST_PUBLISH_WORKER_ENABLED === "1"
    && /^[a-f0-9]{32}$/.test(env.CCPUN_INDEXNOW_KEY ?? "");
}
export function indexNowBudget(env: Env = process.env) {
  // An internal budget, not a claimed IndexNow service quota. Unconfigured is closed.
  const budget = Number(env.CCPUN_INDEXNOW_DAILY_BUDGET ?? 0);
  return Number.isSafeInteger(budget) && budget > 0 ? Math.floor(Math.min(budget, 1000) * 0.8) : 0;
}
