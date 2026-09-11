import { FatalError, sleep } from "workflow";
import { markScheduleStartFailed, runScheduledArticlePublication } from "./article-scheduling";

export type ScheduledArticleWorkflowInput = { articleId: string; generation: string; scheduledAt: string };

async function publishScheduledArticleStep(input: Pick<ScheduledArticleWorkflowInput, "articleId" | "generation">) {
  "use step";
  try { return await runScheduledArticlePublication(input); }
  catch { throw new FatalError("ARTICLE_SCHEDULE_REQUIRES_REVIEW"); }
}
publishScheduledArticleStep.maxRetries = 0;

async function failUnacknowledgedDispatch(input: Pick<ScheduledArticleWorkflowInput, "articleId" | "generation">) {
  "use step";
  try { await markScheduleStartFailed(input.articleId, input.generation); }
  catch { throw new FatalError("ARTICLE_SCHEDULE_DISPATCH_REQUIRES_REVIEW"); }
}
failUnacknowledgedDispatch.maxRetries = 0;

export async function scheduledArticlePublicationWorkflow(input: ScheduledArticleWorkflowInput) {
  "use workflow";
  // Absolute UTC time avoids shifting the schedule by queue/dispatch latency.
  await sleep(new Date(input.scheduledAt));
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = await publishScheduledArticleStep({ articleId: input.articleId, generation: input.generation });
    if (result.status !== "awaiting-dispatch" && result.status !== "not-due") return result;
    await sleep("5s");
  }
  await failUnacknowledgedDispatch({ articleId: input.articleId, generation: input.generation });
  return { status: "dispatch-not-confirmed" };
}
