"use client";

import { cloneElement, isValidElement, useState } from "react";
import type { PreviewProps } from "sanity";
import { ImageIcon } from "lucide-react";

const publicOrigin = "https://ccpun.com";
const imageOrigins = new Set([publicOrigin, "https://blog.ccpun.com", "https://cdn.sanity.io"]);

export function resolveMigratedImagePreviewUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim() || value.trim().startsWith("//")) return null;
  try {
    const url = new URL(value.trim(), publicOrigin);
    return url.protocol === "https:" && imageOrigins.has(url.origin) && !url.username && !url.password
      ? url.href : null;
  } catch {
    return null;
  }
}

export default function MigratedImagePreview({ src, alt, large = false }: { src?: unknown; alt?: string; large?: boolean }) {
  const url = resolveMigratedImagePreviewUrl(src);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!url || failedUrl === url) return <ImageIcon role="img" aria-label="ไม่สามารถแสดงตัวอย่างรูปภาพ" />;
  // Sanity card media uses the existing public image URL without creating a new asset.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt || "รูปภาพจากเว็บไซต์เดิม"} loading="lazy" referrerPolicy="no-referrer" style={{ width: "100%", height: large ? "auto" : "100%", maxHeight: large ? 320 : undefined, display: "block", objectFit: "contain" }} onError={() => setFailedUrl(url)} />;
}

/** Keep Sanity's editable block wrapper; enlarge only Portable Text block previews. */
export function MigratedImageBlockPreview(props: PreviewProps) {
  if ((props.layout !== "block" && props.layout !== "blockImage") || !isValidElement<{ large?: boolean }>(props.media)) return props.renderDefault(props);
  return <div>
    {props.renderDefault({ ...props, media: undefined, subtitle: undefined, description: undefined })}
    <div style={{ padding: "0 12px 12px" }}>
      {cloneElement(props.media, { large: true })}
      {typeof props.description === "string" && props.description && <p style={{ margin: "8px 0 0", fontSize: 13 }}>{props.description}</p>}
    </div>
  </div>;
}
