import { z } from "zod";

export const AGENT_OS_WORKLOAD_CLASSES = ["realtime", "interactive", "routine", "batch"] as const;
export const agentOsWorkloadClassSchema = z.enum(AGENT_OS_WORKLOAD_CLASSES);

export const LOCAL_AI_MAX_CONCURRENCY = 1;
export const RECOMMENDED_HEAVY_BATCH_WINDOW_BKK = { startMinute: 3 * 60 + 30, endMinute: 5 * 60 + 30 } as const;

export type WorkloadPlanItem = {
  key: string;
  workloadClass: z.infer<typeof agentOsWorkloadClassSchema>;
  startMinuteBkk: number;
  durationMinutes: number;
  heavy: boolean;
};

export function validateWorkloadPlanItem(item: WorkloadPlanItem) {
  if (!/^[a-z0-9][a-z0-9._:-]{0,119}$/.test(item.key)) return false;
  if (!AGENT_OS_WORKLOAD_CLASSES.includes(item.workloadClass)) return false;
  if (!Number.isInteger(item.startMinuteBkk) || item.startMinuteBkk < 0 || item.startMinuteBkk >= 1440) return false;
  if (!Number.isInteger(item.durationMinutes) || item.durationMinutes < 1 || item.durationMinutes > 1440) return false;
  return true;
}

function intervals(item: WorkloadPlanItem) {
  const end = item.startMinuteBkk + item.durationMinutes;
  if (end <= 1440) return [[item.startMinuteBkk, end] as const];
  return [[item.startMinuteBkk, 1440] as const, [0, end - 1440] as const];
}

export function detectHeavyWorkloadCollisions(items: WorkloadPlanItem[]) {
  const valid = items.filter(validateWorkloadPlanItem).filter((item) => item.heavy);
  const collisions: Array<{ left: string; right: string }> = [];
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const a = valid[i]!;
      const b = valid[j]!;
      const overlaps = intervals(a).some(([as, ae]) =>
        intervals(b).some(([bs, be]) => as < be && bs < ae),
      );
      if (overlaps) collisions.push({ left: a.key, right: b.key });
    }
  }
  return collisions;
}

export function isInsideRecommendedHeavyWindow(startMinuteBkk: number, durationMinutes: number) {
  if (!Number.isInteger(startMinuteBkk) || !Number.isInteger(durationMinutes) || durationMinutes < 1) return false;
  return startMinuteBkk >= RECOMMENDED_HEAVY_BATCH_WINDOW_BKK.startMinute
    && startMinuteBkk + durationMinutes <= RECOMMENDED_HEAVY_BATCH_WINDOW_BKK.endMinute;
}
