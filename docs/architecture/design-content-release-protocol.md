# Design and content release protocol

Owner: CCPun. Applies to AI agents, developers, designers, content editors and plugins.
Authority: current explicit owner instruction, then workspace/repository instructions. This document grants no publish, deployment, Production, data or spending authority.

## Start from the current design

The current implemented design is the baseline. A FigCraft prototype is a proposal until the owner explicitly approves that design for implementation. Approval to develop or deploy UAT is not design approval. Record the approved page/frame IDs and scope in the task receipt; never infer approval from a file named CURRENT, a passing test or an exported screenshot.

COO standing instruction, 2026-10-29: use only the existing workspace `figcraft-v5/CCPun v5 - Responsive.figcraft`. Finish approved feedback there, save and reopen through the CLI, and check affected pages, responsive states and complete workflows before implementing visual changes in code/UAT. Keep one canonical owner per route; organize theme, viewport and workflow states as components/variants or master-linked instances within that owning page. Do not create competing PROTOTYPE/version pages, duplicate full-page copies or another .figcraft file, and do not make additional backups without an owner request. Preserve unrelated pages, global styles, variables and interactions. Passing layout/tests never approves an unsolicited redesign or content abbreviation; present new concepts for owner review first.

The existing brand is warm brown and gold: Main `#352727`, Deep `#251818`, Surface `#4A3A3A`, Border `#5B4848`, Gold `#E0C985`, Highlight `#EBD9A2`, Text `#FAF9F9`, Muted `#BAABAB`; Kanit typography. New shades must be explicitly named proposed tokens, demonstrated on real UI states and checked for contrast. Do not silently recolour existing tokens, add neon/glows or infer that a prototype replaces the brand contract.

## Keep one owner for each concern

| Concern | Owner | Contract |
| --- | --- | --- |
| Public text, SEO title/description and OG fields | Sanity | Use existing `publicPageCopy` and `pageSeo` documents and stable keys. |
| Layout, responsive rules, calculator formulas, security and rendering | Next.js source | Components consume typed, validated content; CMS does not execute code. |
| Editorial entry, status, workflow and authenticated preview | Admin | Open the canonical Studio document/preview; do not create a second content database/editor. |
| Design proposals and visual references | FigCraft | Named page/frame IDs, review status, breakpoint and source mapping. |
| AI assistance and ChatGPT plugins | Existing scoped integrations | Read/propose or make explicitly authorized UAT draft changes; preserve revision and environment guards. |

UAT is `ccb9lnw5/uat`; Production is `kyfxgjnq/production`. Never substitute one because credentials, documents or schema happen to exist there. Never read `.env*` or copy secrets into prompts, reports or commands.

## Change text and design together safely

1. Inspect the exact branch, dirty work, current task receipt, component and Sanity document before writing. Assign one writer per path. Preserve other worktrees and unfinished work.
2. Map each changed visible text/SEO field to its document ID, scope and stable entry key. Prefer native Studio page/section labels and descriptions so editors can find it. Avoid a parallel page builder or duplicate hardcoded copy.
3. Preserve schema `name`, document IDs, slugs, entry keys and the fallback contract. A deliberate persisted-key migration needs an inventory of old/new consumers, revision checks, UAT migration and rollback evidence; renaming a label does not require renaming the key.
4. Keep approved layout and design tokens in source. Preview must render the same components as the candidate Web release and merge site-wide plus page-scoped copy, including shared footer/labels. Do not certify a separate mock preview as Web parity.
5. Before patching, record the original field and revision. Apply only owned fields with revision checks. Test draft edit -> authenticated preview -> authorized UAT publish -> public readback. Restore test copy using its current revision. Never overwrite another editor's draft or bulk-replace a document to change one field.
6. Verify title, description, OG title/description/image and visible copy from the actual candidate page. Draft-only or schema-only evidence does not prove the public result. Render text safely; do not accept arbitrary HTML, scripts or unrestricted image/link origins from CMS.

## Keep public URLs stable

Build the candidate in UAT, then replace the existing renderer at the same public URLs only after release approval. A visual redesign alone does not need public `/v2/` pages, new slugs, redirects or extra sitemap entries.

Sitemaps contain approved, public canonical URLs only. Keep UAT noindex and out of public sitemap/index feeds. Change sitemap ownership only when an approved content/URL change requires it; use truthful modification dates. A real URL migration must coordinate direct redirects, canonical, sitemap, internal links, schema and regression checks.

## Protect mobile performance and assets

- Public Web must not import Admin UI or scan Admin/generated build output into its CSS. Keep generated folders ignored and the Web-specific Tailwind source boundary intact. Check the actual import graph and built assets before claiming isolation.
- Prefer server-rendered content and native HTML/CSS. Load optional interactive tools only when needed. Do not remove consent, analytics, accessibility or security controls to improve a score.
- Measure what the browser downloads, not only original file size. Existing responsive AVIF/WebP delivery may already solve a large PNG. Convert only when measured results justify it; preserve transparency, readable text and visual detail, comparing decoded pixels for a lossless claim.
- Before removing an asset, check source, styles, Sanity published/draft references in the authorized lane and the old/new release relationship. Remove only proven unused candidate assets; retain recoverable Git history. Release code and required assets atomically; rollback restores both. Do not delete Production data or old worktrees to save space.

## Acceptance before release

Use `npm run check:foundation` as the canonical local gate and the same named checks in CI. Run relevant browser/HTTP checks separately when they require deployed UAT. Do not weaken an assertion to match a failure; investigate whether the contract or implementation is wrong.

Required evidence for affected surfaces:

- Exact source SHA, changed paths, CI run links and genuine PASS/FAIL/SKIP counts. A skip is not a pass. Runtime/provider acceptance tests must execute in their required environment; a mock or source assertion cannot replace them.
- Web and Admin builds, applicable security/privacy and environment guards; authenticated Studio text/SEO editing and preview/readback.
- Functional journeys, validation, back/edit recovery, calculator numeric checks, article navigation/search, consent and analytics semantics; no sensitive answers in analytics.
- Mobile widths 320/360/390/430, tablet 768/820/1024 and desktop 1440 for affected layouts: readable Thai, no overflow, visible focus, keyboard access, touch targets and reduced motion.
- Before/after screenshots. For a performance claim, use comparable device/network settings and three runs per affected representative page; report median and individual results. UAT noindex is intentional, not a public SEO regression.
- If AI Search changes, prove it uses only its authorized public UAT corpus, scoped endpoint/origins and safe rendered links; fail gracefully and preserve Web/Admin boundaries. Production indexing/activation needs separate approval.

## Deployment and rollback

Use the current `ccpun-review` -> `ccpun-deploy` workflow and Hostinger connector. Verify immutable source ref/SHA, provider build and the actual UAT domain/runtime identity. Keep old Git refs and paired source assets available for an authorized rollback. COO standing instruction, 2026-10-29: preserve the enabled Git auto-deploy integration on Web UAT `test.ccpun.com`; do not ask to disable it again unless the owner requests a policy change. After task-specific UAT approval, verify the bound repository/branch and push only reviewed, tested commits, then wait for the exact-SHA automatic build without triggering a duplicate manual deployment. This does not grant Production, merge, Admin, DNS, environment or credential authority.

An opt-in Admin native scheduler acceptance build must use the existing guarded UAT path and UUID-owned synthetic fixtures only. Record the actual zero-skip test result, then restore the ordinary build script at the same SHA. Never enable the Production executor or bypass the sealed UAT data-plane checks.

The completion report must distinguish implemented, built, deployed, verified and owner-approved. Include known failures, exact rollback and a concrete Production release plan. Stop before Production merge/deploy, Production content/data changes, DNS/security-access changes, unsafe cleanup or new spend unless separately and explicitly authorized.

## Handoff record

Keep this small record in the existing task receipt/report rather than a new tracking system:

`design status + approved frame IDs | source SHA | changed routes/components | Sanity IDs/keys/revisions | assets/tokens | test/CI evidence | UAT build/domain | remaining issues | rollback | next owner`

Every design/content PR description and AI handoff must link this protocol and state whether the work follows the current design or an explicitly approved prototype. If they diverge, resolve the mismatch before deployment; passing technical checks is not visual approval.
