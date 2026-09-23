if (typeof window !== "undefined") throw new Error("CCPUN_RICH_MENU_PROVIDER_SERVER_ONLY");

import { createHash } from "node:crypto";
import { z } from "zod";

import {
  LINE_RICH_MENU_ITEMS,
  LINE_RICH_MENU_V2,
  LINE_RICH_MENU_V2_ITEMS,
  LINE_RICH_MENU_V3,
} from "../../line/ecosystem";

const LINE_API = "https://api.line.me";
const LINE_DATA_API = "https://api-data.line.me";

type RichMenuItem =
  | (typeof LINE_RICH_MENU_ITEMS)[number]
  | (typeof LINE_RICH_MENU_V2_ITEMS)[number];

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
    definitionVersion: LINE_RICH_MENU_V3.version,
    imageAssetKey: LINE_RICH_MENU_V3.image.assetKey,
  };
}

export type LineRichMenuDefaultStatus =
  | { state: "not_configured" }
  | { state: "not_assigned" }
  | { state: "active_v3" }
  | { state: "active_other" }
  | { state: "provider_unavailable" };

const boundsSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
}).passthrough();

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("uri"), label: z.string(), uri: z.string() }).passthrough(),
  z.object({
    type: z.literal("postback"),
    label: z.string(),
    data: z.string(),
    displayText: z.string().optional(),
  }).passthrough(),
  z.object({ type: z.literal("message"), label: z.string(), text: z.string() }).passthrough(),
]);

const providerDefinitionSchema = z.object({
  size: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }).passthrough(),
  selected: z.boolean(),
  name: z.string(),
  chatBarText: z.string(),
  areas: z.array(z.object({ bounds: boundsSchema, action: actionSchema }).passthrough()),
}).passthrough();

export type LineRichMenuProviderDefinition = {
  size: { width: number; height: number };
  selected: boolean;
  name: string;
  chatBarText: string;
  areas: Array<{
    bounds: { x: number; y: number; width: number; height: number };
    action:
      | { type: "uri"; label: string; uri: string }
      | { type: "postback"; label: string; data: string; displayText?: string }
      | { type: "message"; label: string; text: string };
  }>;
};

export function normalizeLineRichMenuProviderDefinition(value: unknown): LineRichMenuProviderDefinition | null {
  const parsed = providerDefinitionSchema.safeParse(value);
  if (!parsed.success) return null;
  return {
    size: { width: parsed.data.size.width, height: parsed.data.size.height },
    selected: parsed.data.selected,
    name: parsed.data.name,
    chatBarText: parsed.data.chatBarText,
    areas: parsed.data.areas.map((area) => ({
      bounds: {
        x: area.bounds.x,
        y: area.bounds.y,
        width: area.bounds.width,
        height: area.bounds.height,
      },
      action: area.action.type === "uri"
        ? { type: "uri" as const, label: area.action.label, uri: area.action.uri }
        : area.action.type === "message"
          ? { type: "message" as const, label: area.action.label, text: area.action.text }
          : {
              type: "postback" as const,
              label: area.action.label,
              data: area.action.data,
              ...(area.action.displayText === undefined ? {} : { displayText: area.action.displayText }),
            },
    })),
  };
}

export function lineRichMenuDefinitionHash(definition: LineRichMenuProviderDefinition) {
  return createHash("sha256").update(JSON.stringify(definition)).digest("hex");
}

export type LineRichMenuProviderSnapshot =
  | { state: "not_configured" | "not_assigned" | "provider_unavailable" }
  | {
      state: "assigned";
      providerRef: string;
      version: "line-rich-menu-v2" | "line-rich-menu-v3" | "provider-custom";
      definition: LineRichMenuProviderDefinition;
      hash: string;
    };

export async function readDefaultLineRichMenuSnapshot(
  variables: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<LineRichMenuProviderSnapshot> {
  const token = variables.CCPUN_LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!token) return { state: "not_configured" };

  try {
    const current = await fetchImpl(`${LINE_API}/v2/bot/user/all/richmenu`, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(7_000),
      headers: { Authorization: `Bearer ${token}` },
    });
    if (current.status === 404) return { state: "not_assigned" };
    if (!current.ok) return { state: "provider_unavailable" };
    const currentJson = await safeProviderJson(current);
    const providerRef = currentJson && typeof currentJson === "object" && "richMenuId" in currentJson
      ? String((currentJson as { richMenuId?: unknown }).richMenuId ?? "")
      : "";
    if (!/^richmenu-[A-Za-z0-9_-]+$/.test(providerRef)) return { state: "provider_unavailable" };

    const details = await fetchImpl(`${LINE_API}/v2/bot/richmenu/${encodeURIComponent(providerRef)}`, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(7_000),
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!details.ok) return { state: "provider_unavailable" };
    const definition = normalizeLineRichMenuProviderDefinition(await safeProviderJson(details));
    if (!definition) return { state: "provider_unavailable" };
    const hash = lineRichMenuDefinitionHash(definition);
    const v3Hash = lineRichMenuDefinitionHash(buildLineRichMenuProviderDefinition("line-rich-menu-v3"));
    const v2Hash = lineRichMenuDefinitionHash(buildLineRichMenuProviderDefinition("line-rich-menu-v2"));
    return {
      state: "assigned",
      providerRef,
      version: hash === v3Hash ? "line-rich-menu-v3" : hash === v2Hash ? "line-rich-menu-v2" : "provider-custom",
      definition,
      hash,
    };
  } catch {
    return { state: "provider_unavailable" };
  }
}

export async function readDefaultLineRichMenuStatus(
  variables: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<LineRichMenuDefaultStatus> {
  const snapshot = await readDefaultLineRichMenuSnapshot(variables, fetchImpl);
  if (snapshot.state !== "assigned") return snapshot;
  return { state: snapshot.version === "line-rich-menu-v3" ? "active_v3" : "active_other" };
}

function actionFor(item: RichMenuItem) {
  if (item.action === "uri") {
    return { type: "uri" as const, label: item.label, uri: item.uri };
  }
  return {
    type: "postback" as const,
    label: item.label,
    data: item.postbackData,
    displayText: item.label,
  };
}

export function buildLineRichMenuProviderDefinition(
  version: "line-rich-menu-v2" | "line-rich-menu-v3" = "line-rich-menu-v3",
): LineRichMenuProviderDefinition {
  const source = version === "line-rich-menu-v3" ? LINE_RICH_MENU_V3 : {
    ...LINE_RICH_MENU_V3,
    ...LINE_RICH_MENU_V2,
  };
  const items = version === "line-rich-menu-v3" ? LINE_RICH_MENU_ITEMS : LINE_RICH_MENU_V2_ITEMS;
  const itemById = new Map(items.map((item) => [item.id, item] as const));
  return {
    size: source.size,
    selected: source.selected,
    name: source.name,
    chatBarText: source.chatBarText,
    areas: source.areas.map((area) => {
      const item = itemById.get(area.itemId);
      if (!item) throw new Error("LINE_RICH_MENU_DEFINITION_INVALID");
      return {
        bounds: area.bounds,
        action: actionFor(item),
      };
    }),
  };
}

export async function assignDefaultLineRichMenu(
  providerRef: string,
  variables: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  const readiness = getLineRichMenuProviderReadiness(variables);
  const token = variables.CCPUN_LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!readiness.tokenPresent || !readiness.providerWriteEnabled || !token) {
    return { ok: false as const, status: "not_configured" as const };
  }
  if (!/^richmenu-[A-Za-z0-9_-]+$/.test(providerRef)) {
    return { ok: false as const, status: "invalid_provider_ref" as const };
  }
  try {
    const assigned = await fetchImpl(
      `${LINE_API}/v2/bot/user/all/richmenu/${encodeURIComponent(providerRef)}`,
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(7_000),
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return assigned.ok
      ? { ok: true as const, status: "assigned" as const }
      : { ok: false as const, status: "assign_failed" as const, providerStatusCode: assigned.status };
  } catch {
    return { ok: false as const, status: "reconciliation_required" as const };
  }
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
    image.size > LINE_RICH_MENU_V3.image.maxBytes
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
