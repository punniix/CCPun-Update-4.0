# Article scheduling validation and live readback — 2026-09-11

Branch: `feature/free-plan-article-scheduling-20260911`, PR #96, base `v4-production`.

## Exact verified code and checks

Initial baseline `13e9692615da37d8fdcc26ef3233f50ff29cc720` passed Actions run `34604435275`.

Final implementation code SHA `e91c428e9b292d869ec9c6c5b696851628660ae4` passed:
- CCPun Foundation CI `34605930980`: lint, TypeScript, architecture, Admin/SEO/analytics contracts, sitemap, legacy URL checks, read-only Production-content HTTP checks and non-production-lane production-parity build.
- Article scheduling safety CI `34605930932`: Foundation plus mounted React scheduling controls, executor unit tests, anonymous privacy, Workflow build and actual disposable PostgreSQL migration/privilege/CAS/concurrency tests.
- Sanity Free-plan privacy CI `34605931043`: success.
- Vercel Admin Preview `dpl_Hnbhf4x7bAWSJWFtNJA5MhnWWPcb`: READY at the same code SHA; target Preview, not Production.

Later changes to this receipt and handoff pointers are documentation only. Always recheck the resulting PR head and deployment state before merge.

## Applied additive migration and readback

Migration `20260911_article_scheduling_v1`, checksum:
`sha256:b5d08aa5c8abc27e18795de16b14058857b1d115e4414adc9174c8b56ff01db7`.

The SQL was generated from the tested migration builder in immutable Actions artifact `10265698476`, then applied transactionally after checking the actual existing data-plane identity. The artifact ZIP SHA-256 was verified as `01cf37d42684e7514e9f9dadc173f5e823f87212a4d0a4732cd2ab94158dfdab`. No temporary Neon branch was created.

| Readback | UAT | Production |
| --- | --- | --- |
| Neon project | young-term-47483330 | lively-bar-43618798 |
| Branch | br-crimson-mouse-az7ajkv8 | br-long-resonance-b3ys5xrv |
| Endpoint | ep-mute-frost-aztvz394 | ep-broad-butterfly-b3ro7u8w |
| Database | neondb | neondb |
| Sanity lane | ccb9lnw5/uat | kyfxgjnq/production |
| Execution mode | validate-only | publish |
| Enabled | false | false |
| Queue rows | 0 | 0 |
| Audit rows | 0 | 0 |
| Runtime role | ccpun_admin_runtime | ccpun_admin_runtime |
| Runtime LOGIN | existing true retained | false; no password issued |

Both runtime roles were verified non-superuser with no CREATEDB, CREATEROLE, replication or BYPASSRLS. Queue SELECT and state-column UPDATE are granted; queue DELETE, activation-table UPDATE, and audit UPDATE are denied. Production additionally verified queue TRUNCATE denied, zero PUBLIC grants on the three scheduler tables, and no Social-runtime queue SELECT. Social-runtime queue SELECT was also false in UAT. The existing UAT generic Admin migration/version/checksum remains unchanged.

These operations created scheduler infrastructure only. They did not create schedule rows, enable durable publishing, or modify/publish any Sanity article. No subscription upgrade or secret was written to the repository.

## Remaining deployment/activation gates

The available protected Preview fetch returned a Vercel SSO redirect, not an authenticated Admin page. Mounted React tests are not a replacement for a real owner-session Preview walkthrough.

Still required: authenticated owner UAT schedule/reschedule/cancel/changed-Draft workflow delivery QA; dedicated restricted Production credentials installed securely; human review before merge; exact Production deployment readback; explicit activation of both application and durable database gates. Do not interpret `READY` Preview builds or a `publish` mode identity with `enabled=false` as live scheduling.

A real Production publication test requires a separately selected article and time. None was selected or executed. Follow `docs/article-scheduling-free-plan.md` for activation and reconciliation; never bypass owner authentication, borrow Social/owner credentials, drop tables, or blindly replay an uncertain publication.
