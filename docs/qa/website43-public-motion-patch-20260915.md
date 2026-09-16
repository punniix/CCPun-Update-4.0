# Website 4.3 public motion patch — 2026-09-15

Base: `origin/v4-production` @ `369612469970b0c612fdee4127c261d1f9c86f64`
Scope: Home / Blog / Article public Website 4.3 surfaces only. CI Planning and FHC remain excluded.

## Motion DNA

This patch restores the previously reviewed Website 4.3 motion direction in a restrained form:

- below-the-fold reveal: 8px travel, opacity .9 → 1
- card hover: 3px lift + 1.015 image scale + restrained shadow
- FAQ / Article detail / nested TOC disclosure: 180ms
- dropdown/menu entrance: 6px / 180ms
- no hero entrance animation
- no H1 / Article Featured Image animation
- no loops, particles, 3D/perspective, cursor-follow effects or heavy blur
- `prefers-reduced-motion: reduce` removes decorative movement

## Rejected implementation

A first prototype used a small native client Motion Boundary with IntersectionObserver + Web Animations. Interaction behavior was correct, but the optimized mobile benchmark failed the performance gate:

- Production baseline median LCP: ~912ms
- JS motion prototype median LCP: ~1204ms
- delta: +292ms
- extra client script: +1 script / ~5KB transferred

That implementation was fully reverted and is not part of this patch.

## Selected implementation: CSS-only progressive enhancement

The final implementation lives only in `Website43.module.css` and adds no client hydration boundary.

- Scroll reveal uses `animation-timeline: view()` only inside `@supports`.
- Browsers without scroll-driven animation support retain the static Production presentation.
- Targeted content is never fully hidden before entering the viewport; the reveal starts at opacity `.9` and 8px offset.
- Hero/LCP-critical selectors are excluded from the scroll-reveal list.
- Card hover uses `transform` while scroll reveal uses individual `translate`, allowing the two effects to compose without fighting over one property.

## Performance benchmark

Same optimized local builds, 390×844 mobile emulation, cache disabled, 150ms latency, ~1.6Mbps download, five runs each:

### Baseline Production
- median LCP: 912ms
- median FCP: 896ms
- median CLS: 0
- script count: 11
- median script transfer: 160,141 bytes

### CSS-only motion patch
- median LCP: 928ms
- median FCP: 904ms
- median CLS: 0
- script count: 11
- median script transfer: 160,265 bytes

Delta: LCP +16ms / FCP +8ms, with identical script count. This is within local measurement noise and is accepted. The rejected JS prototype (+292ms LCP) is not shipped.

## Runtime interaction verification

Chrome optimized-build runtime:

- `CSS.supports('animation-timeline: view()')` = true
- Home Hero subtree animations = 0
- no horizontal overflow
- Home learning card before viewport: opacity .9 / translate 8px
- during viewport entry: opacity ~.98 / translate ~1.5px
- fully inside viewport: opacity 1 / translate 0
- hover after reveal: transform translateY(-3px) + image scale 1.015
- FAQ open animation: 180ms
- reduced-motion: no card lift, no image scale, no FAQ animation, no scroll-driven card animation

Blog / Article retain zero horizontal overflow. CI / FHC do not use Website 4.3 public-motion selectors or any new client runtime.

## Gates

- `website43-public-motion-regression.mjs`: PASS 6/6
- TypeScript: PASS
- Foundation suite: PASS
- optimized Turbopack build: PASS
- `git diff --check`: PASS
- protected CI/FHC diff against Production: empty
