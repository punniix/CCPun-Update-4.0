import "server-only";

import {
  beginLineRichMenuMutation,
  checkpointLineRichMenuOperation,
  claimLineRichMenuOperation,
  readLineRichMenuControlState,
} from "../control-plane/provider-state";
import { readLineSystemDeliveryDatabaseReadiness } from "./control-plane";
import { loadLineRichMenuV3Asset } from "./rich-menu-asset";
import {
  activateDefaultLineRichMenu,
  assignDefaultLineRichMenu,
  getLineRichMenuProviderReadiness,
  readDefaultLineRichMenuSnapshot,
  type LineRichMenuProviderSnapshot,
} from "./rich-menu-provider";
import { getLineSystemDeliveryProviderReadiness } from "./provider";

export type LineRichMenuReconcileResult =
  | { status: "verified" | "hold" | "idle" | "not_ready" }
  | { status: "provider_unavailable" | "reconciliation_required" | "failed" };

function assignedSnapshot(snapshot: LineRichMenuProviderSnapshot) {
  return snapshot.state === "assigned" ? {
    version: snapshot.version,
    definition: snapshot.definition,
    hash: snapshot.hash,
    providerRef: snapshot.providerRef,
  } : null;
}

export async function reconcileDesiredLineRichMenu(): Promise<LineRichMenuReconcileResult> {
  const state = await readLineRichMenuControlState();
  if (!state || state.desiredMode === "hold") return { status: state ? "hold" : "not_ready" };

  const menu = getLineRichMenuProviderReadiness();
  const delivery = getLineSystemDeliveryProviderReadiness();
  const database = await readLineSystemDeliveryDatabaseReadiness();
  if (
    !database.ready
    || !menu.tokenPresent
    || !menu.providerWriteEnabled
    || !delivery.enabled
    || !delivery.tokenPresent
    || !delivery.cryptoReady
  ) return { status: "not_ready" };

  const operation = await claimLineRichMenuOperation();
  if (!operation) return { status: "idle" };

  const current = await readDefaultLineRichMenuSnapshot();
  if (current.state === "provider_unavailable" || current.state === "not_configured") {
    await checkpointLineRichMenuOperation({
      operationId: operation.operationId,
      leaseTokenDigest: operation.leaseTokenDigest,
      outcome: "reconciliation_required",
      errorClass: "provider_readback_unavailable",
    });
    return { status: "provider_unavailable" };
  }

  if (current.state === "assigned" && current.hash === operation.desiredHash) {
    await checkpointLineRichMenuOperation({
      operationId: operation.operationId,
      leaseTokenDigest: operation.leaseTokenDigest,
      outcome: "verified",
      actual: assignedSnapshot(current)!,
    });
    return { status: "verified" };
  }

  if (!operation.mutationAllowed) {
    await checkpointLineRichMenuOperation({
      operationId: operation.operationId,
      leaseTokenDigest: operation.leaseTokenDigest,
      outcome: "reconciliation_required",
      errorClass: "readback_mismatch_after_ambiguous_result",
    });
    return { status: "reconciliation_required" };
  }

  const mutationReady = await beginLineRichMenuMutation(
    operation.operationId,
    operation.leaseTokenDigest,
    assignedSnapshot(current),
  );
  if (!mutationReady) return { status: "idle" };

  const mutation = operation.desiredMode === "rollback"
    ? operation.desiredProviderRef
      ? await assignDefaultLineRichMenu(operation.desiredProviderRef)
      : { ok: false as const, status: "invalid_provider_ref" as const }
    : await loadLineRichMenuV3Asset()
      .then((asset) => activateDefaultLineRichMenu(asset.blob))
      .catch(() => ({ ok: false as const, status: "invalid_image" as const }));

  if (!mutation.ok) {
    const ambiguous = mutation.status === "reconciliation_required";
    await checkpointLineRichMenuOperation({
      operationId: operation.operationId,
      leaseTokenDigest: operation.leaseTokenDigest,
      outcome: ambiguous ? "reconciliation_required" : "failed",
      ...("providerStatusCode" in mutation ? { providerStatusCode: mutation.providerStatusCode } : {}),
      errorClass: `provider_${mutation.status}`,
    });
    return { status: ambiguous ? "reconciliation_required" : "failed" };
  }

  const readback = await readDefaultLineRichMenuSnapshot();
  if (readback.state !== "assigned" || readback.hash !== operation.desiredHash) {
    await checkpointLineRichMenuOperation({
      operationId: operation.operationId,
      leaseTokenDigest: operation.leaseTokenDigest,
      outcome: "reconciliation_required",
      errorClass: readback.state === "provider_unavailable"
        ? "provider_readback_unavailable_after_mutation"
        : "provider_readback_mismatch_after_mutation",
    });
    return { status: "reconciliation_required" };
  }

  await checkpointLineRichMenuOperation({
    operationId: operation.operationId,
    leaseTokenDigest: operation.leaseTokenDigest,
    outcome: "verified",
    actual: assignedSnapshot(readback)!,
  });
  return { status: "verified" };
}
