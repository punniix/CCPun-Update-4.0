import { z } from "zod";

export const AGENT_OS_COMMAND_SOURCES = [
  "admin",
  "shortcut",
  "n8n",
  "system",
  "webhook",
] as const;

export const AGENT_OS_ACTIONS = [
  "crm.capture",
  "crm.followup.create",
  "crm.task.create",
  "content.capture",
  "research.capture",
  "system.health",
  "automation.run",
  "calendar.sync",
  "line.inspect",
  "line.rich_menu.preview",
  "line.campaign.send",
  "privacy.delete.execute",
  "production.deploy",
  "secret.rotate",
  "database.migrate",
] as const;

export const agentOsCommandSourceSchema = z.enum(AGENT_OS_COMMAND_SOURCES);
export const agentOsActionSchema = z.enum(AGENT_OS_ACTIONS);

export type AgentOsCommandSource = z.infer<typeof agentOsCommandSourceSchema>;
export type AgentOsAction = z.infer<typeof agentOsActionSchema>;

export const SHORTCUT_ALLOWED_ACTIONS = new Set<AgentOsAction>([
  "crm.capture",
  "crm.followup.create",
  "crm.task.create",
  "content.capture",
  "research.capture",
  "system.health",
  "calendar.sync",
  "line.inspect",
]);

export const CONSEQUENCE_GATED_ACTIONS = new Set<AgentOsAction>([
  "line.campaign.send",
  "privacy.delete.execute",
  "production.deploy",
  "secret.rotate",
  "database.migrate",
]);

export const agentOsCommandEnvelopeSchema = z.object({
  commandId: z.string().uuid(),
  correlationId: z.string().uuid(),
  requestId: z.string().uuid(),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{15,159}$/),
  source: agentOsCommandSourceSchema,
  action: agentOsActionSchema,
  requestedAt: z.string().datetime(),
  actorType: z.enum(["human", "ai", "system"]),
  payloadKind: z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,79}$/),
  payloadDigestSha256: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();

export type AgentOsCommandEnvelope = z.infer<typeof agentOsCommandEnvelopeSchema>;

export type AgentOsCommandPolicy = {
  allowed: boolean;
  requiresHumanApproval: boolean;
  reason:
    | "allowed"
    | "shortcut_action_not_allowed"
    | "automation_cannot_issue_consequential_action"
    | "consequential_action_requires_human";
};

export function evaluateAgentOsCommandPolicy(input: {
  source: AgentOsCommandSource;
  action: AgentOsAction;
  actorType: "human" | "ai" | "system";
}): AgentOsCommandPolicy {
  if (input.source === "shortcut" && !SHORTCUT_ALLOWED_ACTIONS.has(input.action)) {
    return { allowed: false, requiresHumanApproval: false, reason: "shortcut_action_not_allowed" };
  }

  if (CONSEQUENCE_GATED_ACTIONS.has(input.action)) {
    if (input.source !== "admin" || input.actorType !== "human") {
      return {
        allowed: false,
        requiresHumanApproval: true,
        reason: "automation_cannot_issue_consequential_action",
      };
    }
    return {
      allowed: true,
      requiresHumanApproval: true,
      reason: "consequential_action_requires_human",
    };
  }

  return { allowed: true, requiresHumanApproval: false, reason: "allowed" };
}
