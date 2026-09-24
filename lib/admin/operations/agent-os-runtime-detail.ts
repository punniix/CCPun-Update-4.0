import "server-only";

import { classifyRuntimePace, jobIsTerminal } from "./agent-os-job-contract";
import {
  readAgentRuntimeDurationBaseline,
  readAgentRuntimeJobEvents,
  readAgentRuntimeJobs,
} from "./agent-os-runtime";

export async function readAgentRuntimeJobDetail(
  jobId: string,
  variables: Record<string, string | undefined> = process.env,
) {
  const jobs = await readAgentRuntimeJobs(200, variables);
  if (jobs.state !== "ready") return { state: jobs.state, detail: null } as const;
  const job = jobs.jobs.find((item) => item.jobId === jobId);
  if (!job) return { state: "not_found" as const, detail: null };

  const [events, baseline] = await Promise.all([
    readAgentRuntimeJobEvents(jobId, 200, variables),
    readAgentRuntimeDurationBaseline(job.workflowKey, job.stage, variables),
  ]);

  const now = Date.now();
  const started = job.startedAt ? Date.parse(job.startedAt) : job.queuedAt ? Date.parse(job.queuedAt) : Date.parse(job.createdAt);
  const heartbeat = job.heartbeatAt ? Date.parse(job.heartbeatAt) : null;
  const elapsedMs = Math.max(0, (job.completedAt ? Date.parse(job.completedAt) : now) - started);
  const heartbeatAgeMs = heartbeat == null ? null : Math.max(0, now - heartbeat);

  return {
    state: "ready" as const,
    detail: {
      job,
      events: events.state === "ready" ? events.events : [],
      eventsState: events.state,
      baseline,
      pace: jobIsTerminal(job.status)
        ? "normal" as const
        : classifyRuntimePace({ elapsedMs, heartbeatAgeMs, baseline }),
      elapsedMs,
      heartbeatAgeMs,
      serverNow: new Date(now).toISOString(),
      terminal: jobIsTerminal(job.status),
    },
  };
}

export type AgentRuntimeJobDetail = NonNullable<
  Awaited<ReturnType<typeof readAgentRuntimeJobDetail>>["detail"]
>;
