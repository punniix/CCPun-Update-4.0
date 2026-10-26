// Missed/failed 06:00 run check for one Admin lane, without opening Admin.
// Run it from a timer OUTSIDE the Admin process with that lane's Admin server env
// (CCPUN_APP_ENV, CCPUN_SUPABASE_*, optional CCPUN_ALERT_EMAIL_*):
//   node --conditions=react-server --import tsx scripts/admin-daily-job-check.ts [--no-dispatch]
// It prints one JSON line (lane, state, alert outcome; never a key or URL) and
// exits 0 = healthy or alert handled, 1 = status unreadable or refused,
// 2 = job needs attention and no alert was relay-accepted (a cron MAILTO or an
// external monitor can act on this even while email is disabled).
// The logic lives in lib/admin/ops-telemetry/daily-job-check.ts.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { opsLaneForEnvironment } from "../lib/admin/ops-telemetry/store";
import type { DailyJobCheckReport } from "../lib/admin/ops-telemetry/daily-job-check";

type Variables = Record<string, string | undefined>;

export function parseDailyJobCheckArguments(argv: readonly string[], variables: Variables): { dispatch: boolean } {
  if (argv.length > 1 || (argv.length === 1 && argv[0] !== "--no-dispatch")) throw new Error("ADMIN_DAILY_JOB_CHECK_ARGUMENT_DENIED");
  // Never inside a Next.js runtime or build, and only for an explicit Admin lane.
  if (variables.NEXT_RUNTIME !== undefined || variables.NEXT_PHASE !== undefined || !opsLaneForEnvironment(variables.CCPUN_APP_ENV?.trim())) {
    throw new Error("ADMIN_DAILY_JOB_CHECK_LANE_DENIED");
  }
  return { dispatch: argv[0] !== "--no-dispatch" };
}

function adminOrigin(variables: Variables): string | null {
  try { return variables.AUTH_URL ? new URL(variables.AUTH_URL).origin : null; } catch { return null; }
}

export async function runDailyJobCheckCli(argv: readonly string[], variables: Variables = process.env, run?: (options: { dispatch: boolean; adminOrigin: string | null }) => Promise<DailyJobCheckReport>) {
  const { dispatch } = parseDailyJobCheckArguments(argv, variables);
  const execute = run ?? (async (options) => (await import("../lib/admin/ops-telemetry/daily-job-check")).runDailyJobCheck(options));
  const report = await execute({ dispatch, adminOrigin: adminOrigin(variables) });
  return { line: JSON.stringify({ lane: report.lane, storeState: report.storeState, state: report.state, runDate: report.runDate, alert: report.alert.outcome }), exitCode: report.exitCode };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void runDailyJobCheckCli(process.argv.slice(2)).then(({ line, exitCode }) => {
    console.log(line);
    process.exitCode = exitCode;
  }).catch(() => {
    // No credential, URL or provider error reaches logs.
    console.error("ADMIN_DAILY_JOB_CHECK_DENIED");
    process.exitCode = 1;
  });
}
