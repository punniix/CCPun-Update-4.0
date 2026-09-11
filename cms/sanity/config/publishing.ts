import type { AdminEnvironment } from "../../../lib/admin/environment";

export function getStudioPublishingOptions(
  dataset: string,
  environment: AdminEnvironment,
  projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
) {
  void dataset;
  void environment;
  void projectId;
  return {
    // CCPun stays on Sanity Free. Scheduled publication is handled by the owner-only
    // durable workflow instead of Sanity Scheduled Drafts / Content Releases.
    releases: { enabled: false },
    scheduledDrafts: { enabled: false },
    scheduledPublishing: { enabled: false },
  };
}
