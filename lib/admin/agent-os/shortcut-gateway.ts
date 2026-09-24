import { createHash, timingSafeEqual } from "node:crypto";

import {
  evaluateAgentOsCommandPolicy,
  type AgentOsAction,
} from "../control-plane/agent-os-command-contract";

export function isShortcutGatewayAuthorized(
  request: Request,
  variables: Record<string, string | undefined> = process.env,
) {
  if (variables.CCPUN_SHORTCUT_GATEWAY_ENABLED?.trim() !== "true") return false;
  const expected = variables.CCPUN_SHORTCUT_GATEWAY_TOKEN?.trim();
  const supplied = request.headers.get("authorization")?.trim();
  if (!expected || expected.length < 43 || !supplied?.startsWith("Bearer ")) return false;
  const expectedDigest = createHash("sha256").update(expected).digest();
  const suppliedDigest = createHash("sha256").update(supplied.slice(7).trim()).digest();
  return timingSafeEqual(expectedDigest, suppliedDigest);
}

export function evaluateShortcutAction(action: AgentOsAction) {
  return evaluateAgentOsCommandPolicy({ source: "shortcut", action, actorType: "human" });
}
