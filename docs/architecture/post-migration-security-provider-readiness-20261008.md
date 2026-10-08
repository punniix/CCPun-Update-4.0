# CCPun Post-migration Security and Provider Readiness — 2026-10-08

Status: **SOURCE SECURITY PATCH PREPARED; LOCAL CLEANUP COMPLETE WITH WIP PROTECTED; SOCIAL/LINE EXECUTION READY, BUSINESS WRITE GATES PRESERVED**

This is post-migration maintenance, not a request to reactivate Vercel or change the four Hostinger lane assignments. Backup/recovery and Web UAT release parity are deliberately outside the scope of this change.

## 2. Security dependencies

- After a new advisory appeared, the pinned **Next.js 16.3.6** was within an affected range up to 16.3.7.
- The compatible **Next.js 16.3.8** patch and matching **eslint-config-next 16.3.8** are applied to both app workspaces, root package manifest, and lockfile.
- Before patching, the latest observed lock audit was **14 high / 0 critical** overall and **12 high / 0 critical** Production.
- After the patch, the lock audit improved to **13 high / 0 critical** overall and **11 high / 0 critical** Production. The Next.js advisory group no longer appears in the audit.
- Remaining advisories originate from the upstream Sanity/next-sanity/CLI and ESLint glob chains; GitHub Issue #376 remains the dedicated tracking owner. Do not use breaking major downgrades to make the audit superficially green.
- Weekly Dependabot npm patch checks are configured. Updates enter through reviewed pull requests; no auto-merge, direct Production promotion, or automatic live provider mutation is introduced.
- **Source merge does not equal deployed patch**: the deployed Hostinger Production release remains pinned independently. The patched application must go through the existing UAT/security-promotion release gate before the live instance is considered fixed. This step must not silently advance the Web UAT release-parity work while its owner has placed that task on hold.

## 3. Local worktree cleanup

Read-only inspection of the owner's main repository identified many Git worktrees. Cleanup removed **36** clean worktree directories. One newly created active UX worktree was immediately restored to its original path and branch after detecting that it was being used for parallel work: net historical cleanup **35 worktree directories**.

- Only worktrees with **no tracked/untracked changes** were removed via ordinary `git worktree remove`, without `--force`.
- Git branch references/unique committed history were preserved, including for clean but unmerged branches.
- The owner's main working tree was **not** reset/stashed/committed, preserving an in-progress SEO/Post-Publish change set.
- Dirty worktrees retained: Money Story UAT, Admin Ops readiness, Hostinger native scheduler, Hostinger pre-DNS, plus the main working tree.
- Codex-managed worktrees were retained to avoid interrupting separate sessions, and a newly active UX UAT worktree was restored.
- Cleaning these branches further would require a separate owner decision on unfinished work; avoid deleting arbitrary local changes under the rubric of migration cleanup.

## 5. Social/LINE provider readiness

Read-only Production VPS and provider checks:

- Private VPS `ccpun-social-worker.timer` and `ccpun-line-rich-menu-worker.timer`: **active/enabled** on their existing cadence.
- Latest worker receipts reported Social `scanned=0`, `failed=0`, no eligible publication jobs; LINE `idle`, no new mutation.
- Production Neon Social durable job queue: **empty**.
- LINE durable Rich Menu control resource: `desired_version=line-rich-menu-v3`, `state=verified`, `desired_mode=reconcile`.
- Private provider config: Social Operations **ON**; Social Provider Reads **ON**; Social Provider Writes **OFF** by policy.
- LINE Rich Menu Provider **ON**; LINE System Delivery **ON**; LINE Outbound/Campaign Send **OFF** by separate policy.
- External **read-only** checks: LINE bot info HTTP 200, LINE default Rich Menu HTTP 200, Meta configured Page identity HTTP 200 matching the configured target.
- The Meta token's `/me` identity may differ from the configured target Page; a separate `/{pageId}?fields=id` readback confirmed access to the configured target, without posting content.
- No secrets or authorization tokens were printed; no external write was made.
- **Do not enable Social Provider Writes or LINE outbound campaigns without an actual human-approved publication/command**; provider ability and final business authorization are distinct.
- Worker safety gates (identity, approval, CAS/lease/idempotency, revision-bound publication, reconcile) remain unchanged.

## Guardrails

1. Do not change the backup/recovery work (task 1) or the Web UAT release-alignment work (task 4).
2. Do not delete uncommitted work or Codex-managed runtime directories.
3. Do not publish test Social posts or mutate LINE Rich Menu merely to prove a worker.
4. Do not claim the live Next.js security patch is effective until the exact upgraded release has been deployed and smoked in the approved lane.
