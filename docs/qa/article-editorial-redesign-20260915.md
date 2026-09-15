# Article editorial redesign patch — 2026-09-15

Base: `origin/v4-production` @ `f06dbb56fa17b07ac99b967c8b08ca8ad917256d`
Acceptance pages:
- `/blog/life-insurance/aia-senior-happy/`
- `/blog/health-insurance/aia-health-ci-hero-guide/`

## Direction

Owner requested a more newspaper / financial-journal editorial composition after reviewing the live Article layout. Refero references used for design direction:
- Monocle: contained editorial imagery, print-like grid, restrained borders, no heavy elevation.
- Public: financial editorial hierarchy led by typography and disciplined grids.
- New York Times / Washington Post patterns: clear headline/byline/meta hierarchy, contained imagery, narrow reading column, secondary sidebar utility.

The goal is not to copy those brands, but to translate their editorial composition principles into CCPun's existing dark warm palette and Kanit typography.

## Patch

- Article header now uses a tighter 1028px editorial axis.
- Headline hierarchy is stronger and metadata is separated with a thin rule instead of floating as loose text.
- Added author byline in the header.
- Featured Image moved into the Article main column rather than sitting as a detached block between header and reading grid.
- Desktop Article spread is `260px TOC + 48px gap + 720px main column`.
- Featured Image and prose share the same 720px main column.
- TOC changed from a rounded glass card to a restrained sticky editorial index with a hairline divider.
- H2 links remain anchors; H3 items remain independently collapsible/expandable with accessible state.
- First body paragraph receives slightly stronger lead treatment; H2 sections use thin dividers for print-like rhythm.
- Article support sections, including `แหล่งอ้างอิง`, FAQ, author, CTA, related content and disclaimer, align to the 1028px editorial axis.

## Date metadata rule

- If `publishedAt` and `updatedAt` format to the same Bangkok calendar date, display only `เผยแพร่เมื่อ …`.
- If dates differ, display `เผยแพร่เมื่อ … · อัปเดตล่าสุด …`.
- If `publishedAt` is absent, display only `อัปเดตล่าสุด …`.

Real-content checks:
- Senior Happy: `เผยแพร่เมื่อ 14 กันยายน 2569`; redundant updated date hidden.
- Health CI Hero: `เผยแพร่เมื่อ 3 สิงหาคม 2569 · อัปเดตล่าสุด 9 กันยายน 2569`; both dates retained.

## Responsive verification

Senior Happy geometry using Production Sanity in read-only local-production mode:
- 390px: main/Featured 342px, zero overflow.
- 820px: 200px TOC + responsive 500px main, zero overflow.
- 1440px: 260px TOC + 48px gap + 720px main, zero overflow.
- 1920px: 260px TOC + 48px gap + 720px main, zero overflow.

TOC nested groups:
- start collapsed with `aria-expanded=false`;
- expand to reveal the correct H3 links;
- collapse again without affecting the H2 anchor.

## Protected scope

This patch must not change CI Planning / Financial Health Check or their generic tool-shell dependencies:
- `features/ci-planning/**`
- `features/financial-health-check/**`
- `components/layout/ToolHero.tsx`
- `components/layout/Navbar.tsx`
- `components/layout/Footer.tsx`
- `app/components.css`
- `app/globals.css`
