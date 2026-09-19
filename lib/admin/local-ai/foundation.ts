import { adminOperationsRuntimeInputFromEnvironment, resolveAdminOperationsRuntimeIdentity } from "../operations/foundation";
import { getLocalAiCryptoStatus } from "../../local-ai/crypto";

export const LOCAL_AI_MIGRATION_VERSION = "20260919_local_ai_control_plane_v1";
export const LOCAL_AI_MIGRATION_CHECKSUM = "sha256:b49fe8d024c279710eb4eb3b45b06e40ffc960a3ec57b21792c63c98514ceef6";

export const LOCAL_AI_LANES = {
  uat: {
    lane: "uat",
    projectId: "young-term-47483330",
    branchId: "br-crimson-mouse-az7ajkv8",
    endpointId: "ep-mute-frost-aztvz394",
    database: "neondb",
    runtimeRole: "ccpun_admin_runtime",
  },
  production: {
    lane: "production",
    projectId: "lively-bar-43618798",
    branchId: "br-long-resonance-b3ys5xrv",
    endpointId: "ep-broad-butterfly-b3ro7u8w",
    database: "neondb",
    runtimeRole: "ccpun_admin_runtime",
  },
} as const;

export function resolveLocalAiAdminRuntime(
  variables: Record<string, string | undefined> = process.env,
) {
  const resolved = resolveAdminOperationsRuntimeIdentity(
    adminOperationsRuntimeInputFromEnvironment(variables),
  );
  if (!resolved) return null;
  const expected = LOCAL_AI_LANES[resolved.lane];
  if (
    resolved.identity.projectId !== expected.projectId ||
    resolved.identity.branchId !== expected.branchId ||
    resolved.identity.endpointId !== expected.endpointId ||
    resolved.identity.database !== expected.database ||
    resolved.identity.runtimeRole !== expected.runtimeRole
  ) return null;
  return { ...resolved, localAiIdentity: expected };
}

export function getLocalAiAdminStatus(
  variables: Record<string, string | undefined> = process.env,
) {
  const runtime = resolveLocalAiAdminRuntime(variables);
  const crypto = getLocalAiCryptoStatus(variables);
  const enabled = variables.CCPUN_LOCAL_AI_ENABLED?.trim() === "true";
  return {
    enabled,
    runtimeIdentityValid: Boolean(runtime),
    cryptoReady: crypto.ready,
    keyVersion: crypto.activeKeyVersion,
    lane: runtime?.lane ?? null,
    readyToEnqueue: enabled && Boolean(runtime) && crypto.ready,
    directOllamaAccess: false as const,
  };
}
