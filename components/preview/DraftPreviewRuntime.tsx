import "server-only";

type DraftPreviewRuntimeProps = {
  enabled: boolean;
  isDraftMode: boolean;
};

/**
 * Keep Draft Preview tooling completely off the public production client graph.
 * The client-facing Sanity Live / Visual Editing modules are imported only when
 * this deployment is actually allowed to expose preview behavior.
 *
 * The public fetch entry remains separate: do not import("@/lib/sanity-live")
 * for preview UI here. That compatibility path is intentionally fetch-only.
 */
export default async function DraftPreviewRuntime({ enabled, isDraftMode }: DraftPreviewRuntimeProps) {
  if (!enabled) return null;

  const [{ SanityLive }, { VisualEditing }] = await Promise.all([
    import("@/lib/admin/sanity-preview-live"),
    import("next-sanity/visual-editing"),
  ]);

  return (
    <>
      <SanityLive includeDrafts={isDraftMode} />
      {isDraftMode ? <VisualEditing /> : null}
    </>
  );
}
