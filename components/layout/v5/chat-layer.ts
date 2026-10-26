/**
 * The cookie notice is a modal: while it is open it makes the rest of the page inert
 * (features/analytics/components/CookieConsent.tsx, a protected surface that is not changed here).
 * The page's one LINE element stays visible above the notice (owner decision 2026-10-25), so while the
 * notice is open the dock narrows that inert boundary instead of staying a dead control: the page
 * around it stays inert and its chat layer (dock, backdrop, panel) does not. The notice's own logic,
 * timing, focus guard and stored choice are untouched; it restores its own inert values on close and
 * the dock restores the ones it set.
 */
export type InertRecord = { node: HTMLElement; value: boolean };

const SKIP = new Set(["SCRIPT", "STYLE", "LINK", "TEMPLATE"]);

/** Moves the inert boundary from the layer's ancestors to their other children; records what it set. */
export function exemptFromInert(layer: HTMLElement, records: InertRecord[]): void {
  const view = layer.ownerDocument.defaultView;
  if (!view) return;
  let previous: HTMLElement | null = null;
  for (let blocked = layer.parentElement?.closest<HTMLElement>("[inert]") ?? null; blocked && blocked !== previous; blocked = layer.parentElement?.closest<HTMLElement>("[inert]") ?? null) {
    let branch: HTMLElement = layer;
    while (branch !== blocked && branch.parentElement) {
      const parent: HTMLElement = branch.parentElement;
      for (const sibling of Array.from(parent.children)) {
        if (sibling === branch || !(sibling instanceof view.HTMLElement) || SKIP.has(sibling.tagName) || sibling.inert) continue;
        records.push({ node: sibling, value: false });
        sibling.inert = true;
      }
      branch = parent;
    }
    blocked.inert = false;
    previous = blocked;
  }
  if (layer.inert) layer.inert = false;
}

/** Puts back the inert values exemptFromInert() changed. */
export function restoreInert(records: InertRecord[]): void {
  for (const { node, value } of records.splice(0)) if (node.isConnected) node.inert = value;
}
