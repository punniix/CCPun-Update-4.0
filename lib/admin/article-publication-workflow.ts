import { sleep } from "workflow";
import { runScheduledArticlePublication } from "./article-scheduling";

export type ScheduledArticleWorkflowInput = {
  scheduleId: string;
  generation: string;
  delaySeconds: number;
};

async function publishScheduledArticleStep(input: Pick<ScheduledArticleWorkflowInput, "scheduleId" | "generation">) {
  "use step";
  return runScheduledArticlePublication(input);
}

export async function scheduledArticlePublicationWorkflow(input: ScheduledArticleWorkflowInput) {
  "use workflow";
  if (input.delaySeconds > 0) {
    await sleep(`${input.delaySeconds} seconds`);
  }
  return publishScheduledArticleStep({ scheduleId: input.scheduleId, generation: input.generation });
}
