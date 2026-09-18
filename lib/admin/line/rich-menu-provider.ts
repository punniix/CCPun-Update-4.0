if (typeof window !== "undefined") throw new Error("CCPUN_RICH_MENU_PROVIDER_SERVER_ONLY");

import {
  LINE_RICH_MENU_ITEMS,
  LINE_RICH_MENU_V1,
} from "../../line/ecosystem";

const LINE_API = "https://api.line.me";
const LINE_DATA_API = "https://api-data.line.me";

type RichMenuItem = (typeof LINE_RICH_MENU_ITEMS)[number];

export type LineRichMenuActivationResult =
  | { ok: true; status: "assigned"; richMenuId: string }
  | {
      ok: false;
      status:
        | "not_configured"
        | "invalid_image"
        | "validation_failed"
        | "create_failed"
        | "upload_failed"
        | "assign_failed"
        | "reconciliation_required";
      richMenuId?: string;
      providerStatusCode?: number;
    };

export function getLineRichMenuProviderReadiness(
  variables: Record<string, string | undefined> = process.env,
) {
  return {
    tokenPresent: Boolean(variables.CCPUN_LINE_CHANNEL_ACCESS_TOKEN?.trim()),
    providerWriteEnabled: variables.CCPUN_LINE_RICH_MENU_PROVIDER_ENABLED?.trim() === "true",
    definitionVersion: LINE_RICH_MENU_V1.version,
    imageAssetKey: LINE_RICH_MENU_V1.image.assetKey,
  };
}

function actionFor(item: RichMenuItem) {
  if (item.action === "uri") {
    return { type: "uri", label: item.label, uri: item.uri };
  }
  return {
    type: "postback",
    label: item.label,
    data: item.postbackData,
    displayText: item.label,
  };
}

export function buildLineRichMenuProviderDefinition() {
  const itemById = new Map(LINE_RICH_MENU_ITEMS.map((item) => [item.id, item] as const));
  return {
    size: LINE_RICH_MENU_V1.size,
    selected: LINE_RICH_MENU_V1.selected,
    name: LINE_RICH_MENU_V1.name,
    chatBarText: LINE_RICH_MENU_V1.chatBarText,
    areas: LINE_RICH_MENU_V1.areas.map((area) => {
      const item = itemById.get(area.itemId);
      if (!item) throw new Error("LINE_RICH_MENU_DEFINITION_INVALID");
      return {
        bounds: area.bounds,
        action: actionFor(item),
      };
    }),
  };
}

function providerHeaders(token: string, contentType = "application/json") {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": contentType,
  };
}

async function safeProviderJson(response: Response) {
  try {
    return await response.json() as unknown;
  } catch {
    return null;
  }
}

export async function activateDefaultLineRichMenu(
  image: Blob,
  variables: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<LineRichMenuActivationResult> {
  const readiness = getLineRichMenuProviderReadiness(variables);
  const token = variables.CCPUN_LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!readiness.tokenPresent || !readiness.providerWriteEnabled || !token) {
    return { ok: false, status: "not_configured" };
  }
  if (
    !image ||
    (image.type !== "image/png" && image.type !== "image/jpeg") ||
    image.size <= 0 ||
    image.size > LINE_RICH_MENU_V1.image.maxBytes
  ) {
    return { ok: false, status: "invalid_image" };
  }

  const definition = buildLineRichMenuProviderDefinition();

  try {
    const validation = await fetchImpl(`${LINE_API}/v2/bot/richmenu/validate`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(7_000),
      headers: providerHeaders(token),
      body: JSON.stringify(definition),
    });
    if (!validation.ok) {
      return { ok: false, status: "validation_failed", providerStatusCode: validation.status };
    }

    const created = await fetchImpl(`${LINE_API}/v2/bot/richmenu`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(7_000),
      headers: providerHeaders(token),
      body: JSON.stringify(definition),
    });
    if (!created.ok) {
      return { ok: false, status: "create_failed", providerStatusCode: created.status };
    }
    const createdJson = await safeProviderJson(created);
    const richMenuId = createdJson && typeof createdJson === "object" && "richMenuId" in createdJson
      ? String((createdJson as { richMenuId?: unknown }).richMenuId ?? "")
      : "";
    if (!/^richmenu-[A-Za-z0-9_-]+$/.test(richMenuId)) {
      return { ok: false, status: "reconciliation_required" };
    }

    const uploaded = await fetchImpl(
      `${LINE_DATA_API}/v2/bot/richmenu/${encodeURIComponent(richMenuId)}/content`,
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: providerHeaders(token, image.type),
        body: image,
      },
    );
    if (!uploaded.ok) {
      return { ok: false, status: "upload_failed", richMenuId, providerStatusCode: uploaded.status };
    }

    const assigned = await fetchImpl(
      `${LINE_API}/v2/bot/user/all/richmenu/${encodeURIComponent(richMenuId)}`,
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(7_000),
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!assigned.ok) {
      return { ok: false, status: "assign_failed", richMenuId, providerStatusCode: assigned.status };
    }
    return { ok: true, status: "assigned", richMenuId };
  } catch {
    return { ok: false, status: "reconciliation_required" };
  }
}
