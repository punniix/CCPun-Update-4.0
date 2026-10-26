# v5 release manifest

Status: code release inventory. Live/deployed state was not verified in this code-only task.
Production needs the owner's separate release
approval, merges into `v4-production` and a Production deploy; none of that is authorised by this
document. Last updated 2026-10-26.

The v5 release ships as one coordinated batch. Every entry below must be in the release branch
before Production. Each entry names its source branch and how it is checked.
`tests/admin/line-chat-release-gate.test.ts` (run by `npm run check:foundation`, so also by CI)
fails when the LINE chat manager, its Sanity schema fields, its tests, the FA room route or its
tests are missing, and when the shared LINE chat files drift from the v5 branch.

| # | Entry | Source branch (head at writing) | How it is checked |
|---|---|---|---|
| 1 | Website v5 (public site redesign, UAT `test.ccpun.com`) | `codex/website-v5-uat-20261025` (PR #487, `79cc61a3`) | `npm run check:foundation` on the branch; `qa/website-v5-phase-a-proof.mjs`; UAT screenshots and owner review on test.ccpun.com |
| 2 | LINE chat dock fix (dock works whatever the cookie choice; panel usable above the notice) | in `codex/website-v5-uat-20261025` (`4a0ed6b4`) | website cases in `tests/admin/line-chat-config.test.ts` on the v5 branch; browser check on test.ccpun.com at 390 and 1440 |
| 3 | LINE chat per page, website part (dock reads the page's topics) | in `codex/website-v5-uat-20261025` (merge `79cc61a3` of `codex/website-v5-line-per-page-20261026`, `c61e4131`) | `tests/admin/line-chat-per-page.test.ts` on the v5 branch (website-wiring case) |
| 4 | LINE chat per page, Admin part (Settings > ปุ่มแชท LINE manager, `/api/admin/line/chat/`, additive `lineChatConfig` schema, `lib/line/chat-panel.ts`, `lib/line/chat-config.ts`, `lib/admin/line/chat-config.ts`) | source of truth `codex/website-v5-uat-20261025`; copy on `claude/feat/admin-uat-20261026` for admin-test | release gate + drift guard (`qa/line-chat-drift.json`, `node scripts/line-chat-drift.mjs --check`); `tests/admin/line-chat-config.test.ts`, `tests/admin/line-chat-per-page.test.ts` on both branches |
| 5 | AIA fund tool (separate บลจ. เอไอเอ tool; main Investment Allocation excludes AIA funds) | in `codex/website-v5-uat-20261025` (merge `c00549ee` of `codex/website-v5-aia-funds-20261026`, `0a4c0541`); rate-limit fix PR #490 already merged to `v4-production` | `npm run check:foundation` on v5; `qa/investment-allocation-live.mjs` against UAT |
| 6 | Admin ops (owner decisions A2-A9, Supabase ops telemetry split, cache hardening, copy fixes) | `claude/feat/admin-ops-20261025` (PR #492, approved at `1b2d5780`) | `tests/admin/admin-ops-20261025.test.ts` and its follow-up/copy/cache tests; frozen-proof chain `qa/admin-ops-20261025-proof.mjs`; admin-test build |
| 7 | Owner Admin decisions 2026-10-26 (5.2 วันนี้, 5.3 ลูกค้า & LINE, 5.4 bottom tab bar, 5.5 light theme on every page, 5.6 คุยกับปั้น check) | `claude/feat/admin-uat-20261026` (built from #492; not on the approved PR branch) | `tests/admin/admin-owner-decisions-20261026.test.ts`; admission `qa/admin-owner-decisions-20261026-proof.mjs`; admin-test screenshots at 390 and 1440 |
| 8 | Financial planning room, full (PR #491: households, financial position editor, ratios, CRM notes, retention, owner-only APIs, `db/migrations/20261025_fa_room_v1.sql`) | `claude/feat/fa-room-20261025` (PR #491, `3d244d06`); cherry-picked onto `claude/feat/admin-uat-20261026` for admin-test | `tests/admin/financial-planning-room.test.ts`; release gate (route `/dashboard/planning/` and its tests) |
| 9 | FA room menu entry (8.2: owner-only "ห้องวางแผน FA" group) | `claude/feat/fa-room-menu-20261026` (from #491) and `claude/feat/admin-uat-20261026` | `tests/admin/admin-fa-room-menu-20261026.test.ts` on the menu branch; 8.2 case in `tests/admin/admin-owner-decisions-20261026.test.ts`; menu admission in the owner-decision proof |

## Owner setup needed before release

- FA room (entries 8 and 9) needs its own database and secrets, set by the owner on the Hostinger
  Admin app (never in the repo, never the main Admin database):
  - `CCPUN_FA_DATABASE_URL`: a separate Postgres database; apply
    `db/migrations/20261025_fa_room_v1.sql`, then check it with `db/migrations/20261025_fa_room_v1_readback.sql`.
  - `CCPUN_FA_ENCRYPTION_KEY_V1` (and `CCPUN_FA_ENCRYPTION_KEY_V2` when rotating) and
    `CCPUN_FA_ACTIVE_ENCRYPTION_KEY_VERSION`.
  - Without them the room shows "ห้องวางแผนยังไม่พร้อมใช้งาน". That is expected on admin-test.
- LINE chat (entry 4): the `lineChatConfig` document is created from Admin (draft, then publish)
  in each lane; the website falls back to the shipped defaults until then.
- LINE Rich Menu "คุยกับปั้น" (5.6): the repo definitions already read คุยกับปั้น. If the live
  LINE OA still shows "คุยกับปัน", it is the original v1 image; switching the live menu is an owner
  action (see the 2026-10-26 report). It is not part of this deploy.

## Integration order (suggested)

1. Merge #492 (Admin ops) and #491 (FA room) into the release branch.
2. Bring `claude/feat/admin-uat-20261026` (owner decisions, LINE chat Admin copy, FA menu) on top.
3. Merge `codex/website-v5-uat-20261025`. The LINE chat Admin files are byte-identical on both
   sides (drift guard), so they merge without conflict; the menu location of ปุ่มแชท LINE follows
   owner decision 5.3 (ลูกค้า & LINE), not the v5 branch's ตั้งค่า entry.
4. Run `npm run check:security-baseline`, `npm run check:foundation`, the UAT builds and owner
   review, then the separately approved Production release.

## Refreshing the LINE chat drift pins

The drift guard pins the SHA-256 of the shared LINE chat files at the v5 commit they came from.
When the v5 branch changes one of them on purpose:

1. Copy the changed files into `claude/feat/admin-uat-20261026`:
   `git checkout origin/codex/website-v5-uat-20261025 -- <file> ...`
2. Re-pin: `node scripts/line-chat-drift.mjs --refresh` (refuses unless every pinned file is
   byte-identical to the v5 ref).
3. Check: `node scripts/line-chat-drift.mjs --check`, then `npm run check:foundation`.

Never edit `qa/line-chat-drift.json` by hand, and never change a shared file on only one branch.
