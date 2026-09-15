# Article Featured Image + TOC hierarchy hotfix — 2026-09-15

Acceptance page: `/blog/life-insurance/aia-senior-happy/`
Base: `origin/v4-production` @ `8350986ceb01b1dbf506f69ba516f341a6850f11`

## Owner-reported issues

1. Featured Image was still too wide relative to the actual article content column.
2. Article TOC showed H3 items permanently expanded; nested H3 headings could not be collapsed/expanded under their H2 parent.

## Fix

- Featured Image now renders at `min(720px, 100%)`, matching the prose column width.
- Its 1060px wrapper stays aligned with the Article reading grid, while the 720px image is right-aligned inside that wrapper to follow the prose-side composition.
- `next/image` desktop size hint changed from 1060px to 720px.
- Added `Website43ArticleToc` client component.
- H2 remains a normal anchor link to the article section.
- Groups with H3 children receive a separate accessible toggle button using `aria-expanded` and `aria-controls`.
- H3 sublists start collapsed, can be expanded/collapsed independently, and remain keyboard accessible.
- Mobile keeps the existing outer `หัวข้อเนื้อหา` disclosure and receives the same nested H2/H3 behavior once opened.

## Real-content verification

Using the exact Senior Happy article from Production Sanity in local-production read-only mode:

- 390px: Featured Image 342px; prose 342px; zero horizontal overflow.
- 1440px: Featured Image 720px; prose 720px; zero horizontal overflow.
- 1920px: Featured Image 720px; prose 720px; zero horizontal overflow.
- Senior Happy TOC exposes four H2 groups with nested H3 children.
- First nested group starts `aria-expanded=false`; its three H3 links are hidden.
- Clicking the toggle changes to `aria-expanded=true` and shows all three H3 links.
- Clicking again restores the collapsed state.
- H2 remains linked to its `#section-*` anchor throughout.

## Safety boundary

No changes are allowed in this hotfix under CI Planning / FHC or their generic tool shell dependencies. Protected-scope diff against Production is empty for:

- `features/ci-planning/**`
- `features/financial-health-check/**`
- `components/layout/ToolHero.tsx`
- `components/layout/Navbar.tsx`
- `components/layout/Footer.tsx`
- `app/components.css`
- `app/globals.css`
