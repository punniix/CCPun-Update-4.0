import { resolveDeploymentIdentity } from "../../lib/runtime/deployment-identity";
import { deploymentContractFailures, getDeploymentLaneByEnvironment } from "../../lib/runtime/deployment-contract";

type Variables = Record<string, string | undefined>;
type UatAnalyticsDestination = Readonly<{ enabled: boolean; propertyId: string; gaId: string; gtmId: string }>;

// Dedicated public IDs were verified read-only. Keep disabled until the
// GTM's actual tag/consent binding and an exact UAT release are approved.
export const APPROVED_UAT_ANALYTICS: UatAnalyticsDestination = Object.freeze({
  enabled: true,
  propertyId: "551040812",
  gaId: "G-RQ5C651M5M",
  gtmId: "GTM-N4S93T5T",
});

const disabled = Object.freeze({ gaId: "", gtmId: "" });

export function resolveUatWebAnalytics(
  variables: Variables = process.env,
  approved: UatAnalyticsDestination = APPROVED_UAT_ANALYTICS,
): Readonly<{ gaId: string; gtmId: string }> {
  if (approved.enabled !== true) return disabled;

  const identity = resolveDeploymentIdentity(variables, "web");
  const lane = getDeploymentLaneByEnvironment("web-uat");
  if (!lane || !identity.valid || identity.provider !== "hostinger"
    || identity.role !== "web" || identity.environment !== "web-uat"
    || deploymentContractFailures(lane, variables).length) return disabled;

  const { gaId, gtmId } = approved;
  if (!/^\d+$/.test(approved.propertyId) || !/^G-[A-Z0-9]+$/.test(gaId)
    || !/^GTM-[A-Z0-9]+$/.test(gtmId)
    || gaId === "G-5BMX2SKJLZ" || gtmId === "GTM-5DKMGSK3") return disabled;

  return { gaId, gtmId };
}
