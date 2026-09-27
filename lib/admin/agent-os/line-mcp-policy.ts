export const LINE_MCP_READ_ACTIONS = [
  "oa.status",
  "quota.read",
  "insights.read",
  "webhook.inspect",
  "rich_menu.inspect",
  "audience.inspect",
  "token.verify",
] as const;

export const LINE_MCP_WRITE_ACTIONS = [
  "message.send",
  "broadcast.send",
  "narrowcast.send",
  "rich_menu.deploy",
  "rich_menu.delete",
  "audience.create",
  "audience.delete",
  "coupon.create",
  "coupon.discontinue",
  "webhook.set",
  "liff.mutate",
] as const;

export type LineMcpReadAction = (typeof LINE_MCP_READ_ACTIONS)[number];
export type LineMcpWriteAction = (typeof LINE_MCP_WRITE_ACTIONS)[number];
export type LineMcpAction = LineMcpReadAction | LineMcpWriteAction;

export type LineMcpPolicy = {
  allowed: boolean;
  requiresHumanApproval: boolean;
  requiresControlPlaneJob: boolean;
  reason: "read_only" | "write_requires_human_control_plane" | "unknown_action";
};

export function evaluateLineMcpPolicy(action: string): LineMcpPolicy {
  if ((LINE_MCP_READ_ACTIONS as readonly string[]).includes(action)) {
    return { allowed: true, requiresHumanApproval: false, requiresControlPlaneJob: false, reason: "read_only" };
  }
  if ((LINE_MCP_WRITE_ACTIONS as readonly string[]).includes(action)) {
    return {
      allowed: false,
      requiresHumanApproval: true,
      requiresControlPlaneJob: true,
      reason: "write_requires_human_control_plane",
    };
  }
  return { allowed: false, requiresHumanApproval: false, requiresControlPlaneJob: false, reason: "unknown_action" };
}

export const LINE_MCP_PROHIBITED_DATA = [
  "raw_customer_transcript",
  "customer_health_detail",
  "customer_financial_detail",
  "encryption_key",
  "database_owner_credential",
] as const;
