# Home learning card + Article spacing patch — 2026-09-15

Base: `origin/v4-production` @ `b12b811d98fb0605f33e4a87438dad8ee21dc78b`
Owner authorization: apply as a Production improvement patch; CI Planning / FHC remain excluded.

## Owner-reported issues

1. Article header still showed author name in the left side of the metadata row; owner wants only date metadata there.
2. Article CTA → `อ่านต่อ` transition still contained too much empty vertical space.
3. Home `READ / บทความการเงิน` card used a different visual composition from the two TRY cards.

## Patch

### Article header
- Removed the author name from the header metadata row.
- Date metadata remains right-aligned on desktop and left-aligned on mobile.
- The existing lower Author card remains unchanged, so author identity/profile information is still available in the Article.

### Article CTA → related content rhythm
- CTA section now uses `40px` top / `24px` bottom padding.
- Related content uses `24px` top / `48px` bottom padding.
- On Senior Happy at 1440px the measured distance from CTA button bottom to the `อ่านต่อ` heading is ~68px; mobile is ~64px.
- This replaces the former double-large section spacing while preserving section separation.

### Home learning cards
- Rebuilt the first READ card with the exact same structural composition as both TRY cards: background image + shared overlay + `toolCtaContent` + bottom CTA.
- Replaced the vertical `about-pun.png` crop with horizontal `blog-hero.png` (1774×887), using a 68% horizontal focal point.
- Removed the unique heart/icon treatment from the READ card so hierarchy matches the two TRY cards.
- 1440px measured card geometry: all three cards are 416×220 with the same content/CTA flow.

## Visual / responsive verification

- Home learning section scrolled into view and lazy images allowed to load before capture.
- 1440px: all 3 cards share equal width/height and the READ card visibly uses the same composition.
- Senior Happy Article:
  - 390px: header metadata contains only publish date; CTA→related heading gap ~64px; zero overflow.
  - 820px: CTA→related heading gap ~68px; zero overflow.
  - 1440px: CTA→related heading gap ~68px; zero overflow.

## Protected scope

No changes are allowed in this patch under:
- `features/ci-planning/**`
- `features/financial-health-check/**`
- `components/layout/ToolHero.tsx`
- `components/layout/Navbar.tsx`
- `components/layout/Footer.tsx`
- `app/components.css`
- `app/globals.css`

Protected-scope diff against Production is empty.
