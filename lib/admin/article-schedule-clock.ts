import { getAdminCapabilityProfile } from "./capability-profile";
import { resolveDeploymentIdentity } from "../runtime/deployment-identity";
import { resolveArticleSchedulerLane } from "./operations/article-schedule-contract";

type Variables = Record<string, string | undefined>;
export function getArticleScheduleBackend(variables?: Variables): "workflow" | "native-neon" | "disabled" {
  const values = variables ?? process.env;
  // Literal access is intentional: Next seals these values at compilation.
  const marker = variables ? variables.NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND : process.env.NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND;
  const sourceSha = variables ? variables.NEXT_PUBLIC_CCPUN_GIT_SHA : process.env.NEXT_PUBLIC_CCPUN_GIT_SHA;
  const sourceRef = variables ? variables.NEXT_PUBLIC_CCPUN_GIT_REF : process.env.NEXT_PUBLIC_CCPUN_GIT_REF;
  const release = variables ? variables.NEXT_PUBLIC_CCPUN_RELEASE_ID : process.env.NEXT_PUBLIC_CCPUN_RELEASE_ID;
  const identity = resolveDeploymentIdentity(values, "admin");
  if (!values.CCPUN_ARTICLE_SCHEDULER_BACKEND && !marker && identity.provider !== "hostinger") return "workflow";
  if (values.CCPUN_ARTICLE_SCHEDULER_BACKEND !== "native-neon" || marker !== "native-neon"
    || !identity.valid || identity.provider !== "hostinger" || identity.role !== "admin"
    || values.CCPUN_ADMIN_CAPABILITY_PROFILE !== "full" || getAdminCapabilityProfile(variables) !== "full"
    || !sourceSha || !/^[a-f0-9]{40}$/.test(sourceSha) || values.CCPUN_GIT_SHA !== sourceSha
    || !sourceRef || !/^[a-zA-Z0-9._/-]{1,128}$/.test(sourceRef) || values.CCPUN_GIT_REF !== sourceRef
    || !release || !/^[a-zA-Z0-9._-]{1,128}$/.test(release) || values.CCPUN_RELEASE_ID !== release
    || (identity.environment !== "admin-uat" && !(identity.environment === "production-admin" && sourceRef === "v4-production"))
    || !resolveArticleSchedulerLane(values)
    || values.CCPUN_NATIVE_WORKFLOW_ENABLED === "1") return "disabled";
  return "native-neon";
}

export function isArticleScheduleExecutionEnabled(variables?: Variables): boolean {
  const values = variables ?? process.env;
  if (values.CCPUN_ARTICLE_SCHEDULING_ENABLED !== "1") return false;
  const backend = getArticleScheduleBackend(variables);
  // Retain the existing SDK executor during the controlled consumer transfer.
  if (backend === "workflow") return true;
  return backend === "native-neon"
    && values.CCPUN_ARTICLE_SCHEDULE_EXECUTION_PLANE === "vps"
    && values.CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED === "1"
    && values.CCPUN_NATIVE_WORKFLOW_ENABLED === "0"
    && !values.NEXT_RUNTIME
    && values.NEXT_PHASE !== "phase-production-build";
}

type DueSchedule = { articleId: string; generation: string };
type ClockDependencies = {
  enabled(): boolean;
  listDue(): Promise<DueSchedule[]>;
  execute(input: DueSchedule): Promise<unknown>;
};

// SQL is the publication claim authority. One serialized process clock never
// reclaims expired executions or takes over legacy SDK registrations.
export function createNativeArticleScheduleClock(dependencies: ClockDependencies) {
  let timer: ReturnType<typeof setInterval> | undefined;
  let active: Promise<{ attempted: number; failed: number }> | undefined;
  let closed = false;
  const tick = () => {
    if (closed || active || !dependencies.enabled()) return Promise.resolve({ attempted: 0, failed: 0 });
    active = (async () => {
      let attempted = 0; let failed = 0;
      try {
        const due = await dependencies.listDue();
        if (due.length > 10) throw new Error("NATIVE_SCHEDULE_BATCH_INVALID");
        for (const input of due) {
          if (closed || !dependencies.enabled()) break;
          attempted += 1;
          try { await dependencies.execute(input); } catch { failed += 1; }
        }
      } catch { failed += 1; }
      return { attempted, failed };
    })().finally(() => { active = undefined; });
    return active;
  };
  return {
    tick,
    start() {
      if (closed) throw new Error("NATIVE_SCHEDULE_CLOCK_CLOSED");
      if (!timer) timer = setInterval(() => { void tick(); }, 5_000);
    },
    async close() { closed = true; if (timer) clearInterval(timer); timer = undefined; await active; },
  };
}

let nativeClock: ReturnType<typeof createNativeArticleScheduleClock> | undefined;
let starting: Promise<typeof nativeClock> | undefined;
export async function startNativeArticleScheduleClock() {
  if (getArticleScheduleBackend() !== "native-neon") throw new Error("NATIVE_SCHEDULE_BACKEND_DENIED");
  if (!isArticleScheduleExecutionEnabled()) return undefined;
  if (nativeClock) return nativeClock;
  return starting ??= (async () => {
    const scheduling = await import("./article-scheduling");
    nativeClock = createNativeArticleScheduleClock({
      enabled: () => getArticleScheduleBackend() === "native-neon" && isArticleScheduleExecutionEnabled(),
      listDue: scheduling.listNativeDueArticleSchedules,
      execute: scheduling.runScheduledArticlePublication,
    });
    nativeClock.start();
    return nativeClock;
  })();
}
