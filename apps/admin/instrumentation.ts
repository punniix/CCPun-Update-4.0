let registration: Promise<void> | undefined;

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs"
    && (process.env.CCPUN_ARTICLE_SCHEDULER_BACKEND === "native-neon"
      || process.env.NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND === "native-neon")) {
    if (![undefined, "0"].includes(process.env.CCPUN_NATIVE_WORKFLOW_ENABLED)
      || ![undefined, "0", "1"].includes(process.env.CCPUN_ARTICLE_SCHEDULING_ENABLED)
      || ![undefined, "0"].includes(process.env.CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED)
      || ![undefined, "cloud"].includes(process.env.CCPUN_ARTICLE_SCHEDULE_EXECUTION_PLANE)) throw new Error("NATIVE_SCHEDULE_ACTIVATION_DENIED");
    // Cloud Admin produces durable registrations only. A private VPS entrypoint
    // owns polling/publication; enabling the owner UI must never start a timer.
    return;
  }
  // Preserve Vercel/editorial startup and never import a World during builds.
  if (process.env.NEXT_RUNTIME !== "nodejs"
    || process.env.CCPUN_DEPLOYMENT_PROVIDER !== "hostinger"
    || process.env.CCPUN_NATIVE_WORKFLOW_ENABLED === undefined
    || process.env.CCPUN_NATIVE_WORKFLOW_ENABLED === "0") return;
  if (process.env.NEXT_PHASE === "phase-production-build") throw new Error("NATIVE_WORKFLOW_BUILD_ACTIVATION_DENIED");
  return registration ??= (async () => {
    const { createRequire } = await import("node:module");
    const path = await import("node:path");
    const target = process.env.WORKFLOW_TARGET_WORLD ?? "";
    if (!path.isAbsolute(target) || path.basename(target) !== "ccpun-native-workflow-world.cjs"
      || path.normalize(target) !== target) throw new Error("NATIVE_WORKFLOW_ARTIFACT_DENIED");
    // Do not import a second bundled TS copy or public workflow/runtime (which
    // creates handlers at import time). SDK and lifecycle share this CJS file.
    const factory = createRequire(target)(target) as {
      createWorld(): { start(): Promise<void>; close(): Promise<void> };
    };
    const world = factory.createWorld();
    await world.start();
    // Actual HTTP readiness and graceful process termination are independent
    // Linux runtime gates. These hooks do not override Next's signal handling.
    const close = () => { void world.close().catch(() => { process.exitCode = 1; }); };
    process.once("SIGTERM", close);
    process.once("SIGINT", close);
  })();
}
