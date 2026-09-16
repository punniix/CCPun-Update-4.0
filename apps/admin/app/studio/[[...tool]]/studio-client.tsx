"use client";

import "@sanity/ui/styles.css";
import { Studio } from "sanity";
import { sanityStudioConfig } from "../../../sanity.config";

export default function StudioClient() {
  if (!sanityStudioConfig) return null;

  return (
    <div id="sanity" style={{ height: "100vh", maxHeight: "100dvh", overflow: "auto" }}>
      <Studio config={sanityStudioConfig} unstable_globalStyles />
    </div>
  );
}
