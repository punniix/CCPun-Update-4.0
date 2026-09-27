import { z } from "zod";

export const lineSafeIdSchema = z.string().trim().min(1).max(80).regex(/^[a-z0-9][a-z0-9_-]{0,79}$/);

export const campaignSegmentSchema = z.object({
  journey: lineSafeIdSchema.optional(),
  stage: z.enum(["New","Qualified","Expert Review","Solution","Quote","Implementation","Won","Lost"]).optional(),
  material_received: z.boolean().optional(),
  priority: z.enum(["low","normal","high","urgent"]).optional(),
  case_state: z.enum(["active","waiting","completed"]).optional(),
  origin: lineSafeIdSchema.optional(),
  campaign_id: lineSafeIdSchema.optional(),
  content_id: lineSafeIdSchema.optional(),
  tool_id: lineSafeIdSchema.optional(),
  tag: lineSafeIdSchema.optional(),
  recency_bucket: z.enum(["day","week","month"]).optional(),
}).strict();

export type CampaignSegment = z.infer<typeof campaignSegmentSchema>;
