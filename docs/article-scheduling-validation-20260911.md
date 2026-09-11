# Article scheduling validation — 2026-09-11

Branch: `feature/free-plan-article-scheduling-20260911`.

Initial private-Neon implementation baseline: `13e9692615da37d8fdcc26ef3233f50ff29cc720`.
GitHub Actions run: `34604435275`.

Verified at that exact SHA:
- Node 24 dependency installation: success.
- Foundation contracts, TypeScript, lint and scheduler unit tests: success.
- Anonymous Sanity API/CDN privacy boundary: success.
- Production-parity Next.js build including Workflow SDK transformation: success.
- Disposable Postgres migration, restricted runtime grants, audit/CAS, duplicate claim and cancellation race tests: success.

Follow-up changes after that baseline need final-head CI: per-operation database timeouts; article-ID-bound UI confirmation; separate request identity for each newly confirmed reschedule; mounted React scheduling controls; this runbook and handoff documentation.

Not established by these tests:
- Authenticated owner browser QA on the deployed Preview.
- Secure Production scheduler role credentials installed in Vercel.
- Active durable delivery against the live data plane.
- A real Production article published on a chosen schedule.

No test in this task authorizes publishing an arbitrary existing Production article. Follow `docs/article-scheduling-free-plan.md` for exact rollout and reconciliation gates.
