import { getAdminSanityStatus } from "../sanity-control";
import { getAdminOperationsRuntimeStatus } from "./foundation";
import { readArticleSchedulerModel } from "./article-scheduler-read-model";

export async function readAdminSettingsReadiness() {
  const sanity = getAdminSanityStatus();
  const operations = getAdminOperationsRuntimeStatus();
  const scheduler = await readArticleSchedulerModel({ scheduleLimit: 1, auditLimit: 1 });
  return { sanity, operations, scheduler };
}
