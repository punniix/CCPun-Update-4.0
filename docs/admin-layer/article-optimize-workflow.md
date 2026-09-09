# Article optimization workflow

Task receipt: `sanity-optimize-20260909`. Branch: `codex/admin-sanity-optimize-workflow-20260909`, based on `v4-production@2495dcd`. PR #83 is the reviewed delivery unit. The owner subsequently authorized the Production code patch despite unavailable authenticated UAT visual QA, then separately approved the exact Production normalization scope of 3 raw documents / 8 rows. Neither approval authorizes article publication.

## Owner steps

1. Open the existing Article through its Edit Intent. Edit the Draft; the banner and badge distinguish the existing Live version, unpublished changes, and review status.
2. Open **ตัวอย่างเว็บไซต์** and verify the article. Use **ตรวจสอบ / แหล่งอ้างอิง** for sources and **ตัวอย่าง / สถานะเผยแพร่** for review.
3. Complete the content/fact/compliance review and select **อนุมัติเนื้อหาแล้ว**.
4. Click **ยืนยันอนุมัติและเผยแพร่**, then confirm the exact version. Cancellation makes no changes. Validation errors, unsaved changes, stale revisions, or changed URL/category prevent publication.
5. Verify the resulting Live page. The original `publishedAt` is preserved; `contentUpdatedAt` changes in the same atomic transaction as publication. A failed transaction leaves both versions and dates unchanged. An ambiguous connection failure requires checking Sanity state before retrying.

UAT deliberately retains its no-publish policy. It can test draft editing and previews; mounted synthetic tests cover publication and Published + Draft behavior without publishing UAT fixtures.

## Scope and contracts

Repo-owned `sanity.config.ts` and `cms/sanity/schema/index.ts` remain authoritative. FAQ, sources, tables, migrated/native images and other Article custom object previews have useful Thai labels and empty-state placeholders. Legacy image/HTML/metadata are preserved. Weak references are not converted. Pending draft references require editorial resolution before publishing. Existing URL and category locks remain, plus a publication-time comparison with the actual Published version.

## Read-only Production audit, 2026-09-09

Raw inventory: 48 Article records: 5 Published, 41 Drafts, 2 historical release snapshots; 46 current records represent 41 logical articles. All 5 Published articles have Draft changes. AIA Vitality `drafts.ccpun-wp-published-413` has 5 structured FAQ items and 3 source references intact.

Normalization candidate: 8 legacy rows across `ccpun-wp-published-359` (2), `ccpun-wp-published-413` (4), and `drafts.ccpun-wp-published-359` (2). Historical release snapshots contain 12 further legacy rows but are report-only and excluded from patches. No other missing keys were found in the audited schema-owned arrays.

Four weak references on current Published records resolve to existing Published author/category documents. Eight motor-insurance Drafts reference a category that exists only as `drafts.ccpun-category-motor-insurance`; resolve publication readiness manually. No references were changed.

FAQ duplicate text signals occur in 6 current Drafts (29 exact question matches), plus 3 in a historical release. This is an exact-text heuristic, not exhaustive semantic equivalence. `faq[]` feeds the visible FAQ section in `features/blog/website-43/Website43Article.tsx` and FAQPage JSON-LD in `lib/content/structured-data/article-schema.ts`; `features/blog/pages/ArticlePage.tsx` injects that graph. Body content is separately rendered. Use `faq[]` as the target for new FAQ editing; manually reconcile question/answer parity, extra body-only questions, layout and JSON-LD before any body removal. No FAQ content was removed.

## UAT migration evidence

Target: `ccb9lnw5/uat`. Dry-run identified 16 legacy rows in 3 existing mirror Drafts (196:10, 359:2, 413:4). Applied only those three revision-guarded Draft patches through Sanity MCP. Read-back of all 21 records confirmed that only the expected body normalization and server revision/update timestamps changed. There remain 11 Article Drafts and zero Published Articles. A fresh script dry-run returned zero changes and zero patches.

Private full exports and exact dry-run/patch evidence remain in the current task's `work/` directory and are not committed to this public repository.

## Production migration completion, 2026-09-09

After a fresh dry-run and explicit owner approval, one revision-guarded atomic transaction `F7rHb53lSmZ7ztxhfkkJjd` normalized exactly these raw records in `kyfxgjnq/production`:

- `ccpun-wp-published-359`: 2 rows.
- `ccpun-wp-published-413`: 4 rows.
- `drafts.ccpun-wp-published-359`: 2 rows.

Post-apply integrity verification covered all 61 exported records. Only the approved normalization paths and expected server revision/update metadata changed; a fresh dry-run returned zero remaining patches. There was no publication, Draft/Published crossover, reference change, FAQ removal, or historical release mutation. AIA Vitality's separate Draft was preserved. Exact before/after exports and transaction evidence remain in the task receipt's private evidence paths.

## Migration execution and rollback

Export full raw records into an envelope `{projectId,dataset,documents}`. Never export a merged draft perspective for migration.

```sh
node --import tsx scripts/normalize-article-structures.ts --input export.json
```

Dry-run is the default. `--apply` requires the exact `--confirm-report` hash and a separately supplied `SANITY_API_TOKEN`; the script never loads credentials. Production additionally requires current explicit owner approval and `--confirm-production kyfxgjnq/production`. `kyfxgjnq/uat` is rejected. Every mutation checks the exact raw document ID/revision and changes only schema-owned arrays. Never substitute Published content for a Draft. No publish action is part of normalization. Re-export after apply and require a zero-change dry-run. If a per-document transaction fails, earlier completed documents remain applied; re-export/review the new report before resuming.

Code rollback: revert the scoped CMS commit through normal reviewed delivery. Data rollback: use the saved raw before-image or Sanity History for only the affected raw ID, compare the current revision and restore only the changed array paths after explicit authorization. Never cross Draft/Published, restore release snapshots, or auto-publish.

## Verification and release gates

Targeted tests cover card previews, state labels, atomic publication, dates, concurrent revision changes, cancellation, validation, reference/URL guards and normalization. Full foundation/build and authenticated Preview evidence belong in the task receipt and PR checks.

Local Studio through Next.js correctly stopped at the unconfigured Auth.js login gate; no authentication bypass was used. Standalone Sanity CLI is not the supported Next.js environment configuration and was not used as acceptance proof.

The baseline audit reported high findings in `js-yaml` and `sharp`. Patch updates to js-yaml 4.3.2, sharp 0.35.4 and @humanfs/node 0.16.8 address the released fixes. Both full and production-only lock audits now report zero high/critical findings. Five moderate records remain downstream of a single adm-zip archive-extraction advisory with no patched upstream release; no forced downgrade or major update was applied. This task does not extract untrusted archives. AgentShield live startup scan was unavailable; cached historical grades are not current security proof.

PR #83 merged as `aea1f3b99bdc9408957b6d1f5dc5a75e2926fa29`. Both Web and Admin Production were read back as READY at that exact merge SHA. Authenticated, read-only Admin visual verification of AIA Vitality is complete as recorded below. The exact approved Production normalization is complete as recorded above; any additional Production mutation requires new scoped authorization. The latest Web/Admin deployment read-backs and final visual evidence belong in PR #83 and receipt `sanity-optimize-20260909`.

Preview `dpl_249XvRLmPvpxJ6UNqTK8igJiND6M` at commit `42f6063` built READY; Web Preview was correctly skipped. Vercel Visit opened the preview root, but `/studio/` failed with Chrome ERR_BLOCKED_BY_CLIENT for both the owner and automation. This is not successful authenticated UAT visual QA. The owner explicitly accepted a Production code patch with read-only Production visual verification instead.

## Final Production provenance, 2026-09-09

Both deployments resolve to merge SHA `aea1f3b99bdc9408957b6d1f5dc5a75e2926fa29`:

- Admin: `dpl_GxvXFGKcurmrniCNXhJBCfakgTLa`, READY, Production alias `admin.ccpun.com`.
- Web: `dpl_H8ksvUhPRB38LbexgEp4rCm3jPz9`, READY, Production alias `ccpun.com`.

Authenticated Chrome tab `1182020171` opened the Production AIA Vitality Article. Read-only inspection confirmed the Thai Live + unpublished changes banner, Draft review status `drafting`, correctly disabled publish action, protected slug/category fields, FAQ question titles, migrated-image alt previews, table title with 4 rows, and 3 readable source titles. Screenshots of the banner and sources were visually checked. This verification made no edits and did not publish. Successful publication and failure/concurrency behavior were verified by automated synthetic tests, not by publishing a Production article.
