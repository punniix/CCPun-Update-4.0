"use client";

import { useRouter } from "next/navigation";
import { VisualEditing } from "next-sanity/visual-editing";

/** Native Presentation messages refresh only the authenticated Admin preview. */
export default function LiveVisualEditing() {
  const router = useRouter();
  return <VisualEditing refresh={async () => { router.refresh(); }} />;
}
