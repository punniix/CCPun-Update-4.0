# Final Security and Historical Cleanup — 2026-10-08

Status: **CLOSED — MIGRATION CLEANUP COMPLETE / ROUTINE UPKEEP ONLY**

This receipt closes the final cleanup work after Hostinger release alignment, runtime verification and permanent Vercel deletion.

## Dead Vercel operational artifacts removed

The following source artifacts are deleted because both Vercel projects are permanently gone and these paths can no longer serve a valid recovery or audit function:

- `.github/workflows/line-key-recovery-once.yml`
- `.github/workflows/vercel-monorepo-migration-audit.yml`
- `scripts/operator/web-line-recovery.cjs`
- `scripts/operator/web-line-recovery.test.cjs`
- `scripts/operator/web-line-recovery-workflow.test.mjs`

The execution-ownership contract now asserts these files remain absent so a future change cannot quietly restore a Vercel operational path.

Provider-neutral identity adapters and static Vercel compatibility tests may remain where they exercise fail-closed behavior; they do not imply a Vercel project or runtime exists.

## Git branch cleanup

Thirty-five merged migration-era remote branches were deleted after verifying that they were already ancestors of `v4-production`.

The cleanup removed obsolete Hostinger/Vercel migration, phase-closure, pre-DNS, worker-readiness and superseded release refs.

The following release refs are intentionally preserved because they are current or the immediate rollback generation for an active Hostinger lane:

- Production current: `codex/hostinger-release-production-a8ef55a6e3b4adc2553beda2cc04b89f13528c17`
- Production rollback: `codex/hostinger-release-production-26658e389348a4e7b1fffaa362531a3ece3cbbff`
- Admin UAT current: `admin/hostinger-release-uat-a8ef55a6e3b4adc2553beda2cc04b89f13528c17`
- Admin UAT rollback: `admin/hostinger-release-uat-3162cd26b666801fc5244b09866f7fe0ebeaaa3b`
- Web UAT current: `codex/hostinger-release-uat-cb0d93fe91a54c79ff9bf6ba0ed9ebe2b155fa77`

Long-lived product/development branches were not mass-deleted.

## VPS cleanup boundary

No additional VPS prune is required:

- all seven currently listed containers are active;
- all six Docker images are active;
- Docker reports zero reclaimable image/container bytes;
- the remaining build cache is reported as non-reclaimable;
- n8n, Local AI, OCR, Ollama and the accepted private workers remain healthy;
- temporary private Production environment files created during activation are already absent.

This prevents a cosmetic cleanup from deleting active runtime state.

## Dependency security baseline

Current npm audit result:

- full dependency graph: **13 high, 0 critical**;
- Production dependencies: **11 high, 0 critical**;
- the previously directly patchable `http-cache-semantics` finding is already closed at `4.3.0`.

The remaining finding set is the upstream Sanity/next-sanity CLI/codegen/glob chain plus the Next ESLint glob chain.

Relevant current versions observed:

- `braces` latest = `3.0.3`, which is still inside the advisory range;
- `micromatch` is already `4.0.8`;
- `sanity` current line = 6.x;
- `next-sanity` current line = 13.x;
- `eslint-config-next` current line = 16.x.

`npm audit fix --package-lock-only --dry-run` makes no compatible lockfile change. The audit recommendation for the remaining direct packages is a major downgrade to older framework lines, so it is not adopted.

These advisories are therefore tracked as upstream dependency debt rather than being hidden or “fixed” by incompatible downgrades. GitHub issue #376 owns follow-up until compatible patched current-line releases are available.

## Historical documentation

Dated migration plans and receipts remain in the repository as historical evidence, but the Architecture Index and current runtime baseline remain the only current placement authority.

The final state is:

- browser-facing Web/Admin: Hostinger;
- private automation/compute: Hostinger VPS;
- Sanity/Neon: approved data planes;
- Vercel projects: permanently deleted;
- legacy `/snt-admin/*`: retired;
- autonomous Cloud/Vercel executors: zero.

## Acceptance

Final cleanup is closed when this receipt merges and CI passes.

After closure, remaining security work is normal dependency maintenance: update the upstream Sanity/Next dependency lines when compatible patched releases become available, then re-run the existing architecture, typecheck, build and audit gates.

The Vercel-to-Hostinger migration no longer has an open migration task.
