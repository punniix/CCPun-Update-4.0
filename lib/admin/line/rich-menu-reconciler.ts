import "server-only";

import { readLineDiscoveryCuration } from "./discovery-config";
import { readLineSystemDeliveryDatabaseReadiness } from "./control-plane";
import { loadLineRichMenuV3Asset } from "./rich-menu-asset";
import {
  activateDefaultLineRichMenu,
  getLineRichMenuProviderReadiness,
  readDefaultLineRichMenuStatus,
} from "./rich-menu-provider";
import { getLineSystemDeliveryProviderReadiness } from "./provider";

export type LineRichMenuReconcileResult =
  | { status: "active_v3" }
  | { status: "hold" }
  | { status: "not_ready" }
  | { status: "provider_unavailable" }
  | { status: "activation_failed" };

export async function reconcileDesiredLineRichMenu(): Promise<LineRichMenuReconcileResult> {
  const curation = await readLineDiscoveryCuration();
  if (curation.desiredRichMenu !== "v3") return { status: "hold" };

  const [database, current] = await Promise.all([
    readLineSystemDeliveryDatabaseReadiness(),
    readDefaultLineRichMenuStatus(),
  ]);
  const menu = getLineRichMenuProviderReadiness();
  const delivery = getLineSystemDeliveryProviderReadiness();

  if (
    !database.ready
    || !menu.tokenPresent
    || !menu.providerWriteEnabled
    || !delivery.enabled
    || !delivery.tokenPresent
    || !delivery.cryptoReady
  ) return { status: "not_ready" };

  if (current.state === "active_v3") return { status: "active_v3" };
  if (current.state === "provider_unavailable") return { status: "provider_unavailable" };

  const asset = await loadLineRichMenuV3Asset();
  const result = await activateDefaultLineRichMenu(asset.blob);
  return result.ok ? { status: "active_v3" } : { status: "activation_failed" };
}
