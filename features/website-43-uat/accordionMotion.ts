/** Progressive enhancement: native <details> remains usable without JavaScript. */
export function installAccordionMotion(root: HTMLElement, selector: string, preference: MediaQueryList) {
  type Entry = { animation: Animation; expanded: boolean; height: string; overflow: string };
  const running = new Map<HTMLDetailsElement, Entry>();

  const settle = (details: HTMLDetailsElement, entry: Entry) => {
    if (running.get(details) !== entry) return;
    entry.animation.onfinish = null;
    entry.animation.oncancel = null;
    entry.animation.cancel();
    details.open = entry.expanded;
    details.style.height = entry.height;
    details.style.overflow = entry.overflow;
    details.removeAttribute('data-w43-accordion-motion');
    running.delete(details);
  };

  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || preference.matches) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const summary = target.closest('summary');
    const details = summary?.parentElement;
    if (!(details instanceof HTMLDetailsElement) || !root.contains(details) || !details.matches(selector)) return;
    // Links or buttons placed inside a summary retain their own action.
    if (target.closest('a, button, input, select, textarea')) return;
    if (typeof details.animate !== 'function') return;
    event.preventDefault();

    const previous = running.get(details);
    const expanded = !(previous?.expanded ?? details.open);
    const startHeight = details.getBoundingClientRect().height;
    const height = previous?.height ?? details.style.height;
    const overflow = previous?.overflow ?? details.style.overflow;
    if (previous) {
      previous.animation.onfinish = null;
      previous.animation.oncancel = null;
      previous.animation.cancel();
    }

    // Measure the native target in the same frame; do not freeze an open answer's height.
    details.style.height = height;
    details.open = expanded;
    const endHeight = details.getBoundingClientRect().height;
    details.open = true;
    details.style.height = `${endHeight}px`;
    details.style.overflow = 'hidden';
    details.setAttribute('data-w43-accordion-motion', expanded ? 'opening' : 'closing');
    const animation = details.animate(
      [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
      { duration: 240, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
    );
    const entry = { animation, expanded, height, overflow };
    running.set(details, entry);
    animation.onfinish = () => settle(details, entry);
    animation.oncancel = () => settle(details, entry);
  };

  const onPreference = () => {
    if (preference.matches) for (const [details, entry] of running) settle(details, entry);
  };
  root.addEventListener('click', onClick);
  preference.addEventListener('change', onPreference);
  return () => {
    root.removeEventListener('click', onClick);
    preference.removeEventListener('change', onPreference);
    for (const [details, entry] of running) settle(details, entry);
  };
}
