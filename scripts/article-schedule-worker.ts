// Private VPS process only: no HTTP listener, provider cron or n8n dependency.
// Start from the reviewed monorepo root with:
// node --conditions=react-server --import tsx scripts/article-schedule-worker.ts
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateNativeNeonSource } from "../apps/admin/scripts/build-provider.mjs";
import { getArticleScheduleBackend, isArticleScheduleExecutionEnabled, startNativeArticleScheduleClock } from "../lib/admin/article-schedule-clock";

const adminRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../apps/admin");
type Clock = { close(): Promise<void> };

export async function startArticleScheduleWorker(variables: Record<string, string | undefined> = process.env, dependencies = {
  validateSource: () => validateNativeNeonSource(adminRoot, variables),
  startClock: (): Promise<Clock | undefined> => startNativeArticleScheduleClock(),
}) {
  if (getArticleScheduleBackend(variables) !== "native-neon" || !isArticleScheduleExecutionEnabled(variables)) {
    throw new Error("NATIVE_SCHEDULE_WORKER_ACTIVATION_DENIED");
  }
  // Validate actual committed Git/ref/lock before importing DB/CMS or polling.
  const seal = dependencies.validateSource();
  if (!seal || seal.schedulerBackend !== "native-neon") throw new Error("NATIVE_SCHEDULE_WORKER_SOURCE_DENIED");
  const clock = await dependencies.startClock();
  if (!clock) throw new Error("NATIVE_SCHEDULE_WORKER_START_DENIED");
  return clock;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void startArticleScheduleWorker().then((clock) => {
    const close = () => { void clock.close().catch(() => { process.exitCode = 1; }); };
    process.once("SIGTERM", close);
    process.once("SIGINT", close);
  }).catch(() => {
    // Never echo source paths, connection strings, tokens or provider errors.
    console.error("NATIVE_SCHEDULE_WORKER_START_DENIED");
    process.exitCode = 1;
  });
}
