# P2.1 Hostinger Cloud Startup Filesystem Inventory — 2026-10-08

Status: **READ-ONLY AUDIT COMPLETE WITH DEEP CACHE LIMITATION**. No Hostinger filesystem deletion, rename, move, upload, deploy or settings mutation was performed for this audit.

## Scope and evidence

Inspected the live site-scoped **Hostinger File Manager** for all four Cloud Startup lanes. Used its recursive folder size/inode assessment, browsed `hbuilds/`, `hbuilds/versions/`, `hbuilds/logs/`, and `public_html/`, and cross-checked release identity with the recent Hostinger deployment status. Measurements are point-in-time and provider-reported, not exact byte-level POSIX `du` evidence.

| Lane | Host | Live SHA observed | `hbuilds/current` target | Retained version directories |
| --- | --- | --- | --- | ---: |
| Web Production | `ccpun.com` | `c867c34a` | `versions/01a119c7-20cf-7130-926a-c429107c90ea` | 1 |
| Web UAT | `test.ccpun.com` | `0ed35b03` | `versions/01a1193a-1c0e-732c-9bd3-616e24f517f2` | 1 |
| Admin Production | `admin.ccpun.com` | `c867c34a` | `versions/01a119cb-1cf1-71ef-b901-f69eec75db4c` | 1 |
| Admin UAT | `admin-test.ccpun.com` | `a8ef55a6` | `versions/01a11745-bd6b-7118-8cb2-7038d0e9c3ba` | 1 |

All four deployments have separate site-scoped `hbuilds` directories. `current` is a symlink into `versions/`; do not delete or replace it, or assume its target is obsolete. Runtime versions are provider-managed. Only the active version was found locally in each lane; older release entries shown in the hPanel deployment history should not be assumed restorable without fetching/rebuilding the pinned rollback release. This audit did not perform a rollback rehearsal.

## Recursive provider-reported size and inode inventory

| Lane | `versions/` (active runtime) | Active-version inodes | `last-source/` | Source inodes | `logs/` | Log inodes | `config/` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Web Production | 117.31 MiB | 3,355 | 36.11 MiB | 1,859 | 77.14 KiB | 21 | 901.05 KiB |
| Web UAT | 299.33 MiB | 3,832 | 237.84 KiB | 65 | 74.18 KiB | 21 | 727.33 KiB |
| Admin Production | 2.52 GiB | 109,068 | 36.11 MiB | 1,859 | 106.38 KiB | 21 | 911.39 KiB |
| Admin UAT | 2.52 GiB | 109,045 | 36.14 MiB | 1,857 | 114.38 KiB | 21 | 913.48 KiB |

Each `logs/` presented ten build-specific subdirectories (40 total across four lanes). Combined measured log directory size is **372.08 KiB (~0.36 MiB)**. This is negligible next to current Runtime and is not a sufficient reason to bypass the provider's log retention lifecycle.

The Hosting Plan's file browser displayed **10.8 GiB of 100 GiB disk space** and approximately **246.7K of 2M inodes** consumed across Cloud Startup. The plan-wide figure is not the same as the sum of the four inspected `hbuilds/` categories; additional use/provider accounting was not itemized. Do not infer that the remainder is reclaimable.

### Runtime composition sample (Admin UAT)

The active Admin UAT version under `nodejs/` includes:
- `node_modules/`: **1.21 GiB, 99,170 inodes**
- `apps/`: **1.28 GiB, 8,452 inodes**
- `.git/`: **13.7 MiB, 42 inodes**

These are **active runtime artifact constituents**, not confirmed stale copies. This helps explain why Admin deployments dominate inode use. Verify actual build/trace and server entrypoint requirements before proposing a deployment packaging change. Avoid a live manual `rm -rf node_modules` or any runtime subtree deletion.

### Other visible surfaces

- `hbuilds/last-source/` contains Hostinger's checked-out source snapshot and Git/project tree (source roots depend on lane); do not treat it as an arbitrary redundant repo.
- Site-scoped `public_html/` contains `.htaccess`; file sizes observed were Web Production 451 B, Web UAT 483 B, Admin Production 1.77 KiB and Admin UAT 512 B. Retain routing/config behavior.
- Site file root contains a zero-byte `DO_NOT_UPLOAD_HERE` marker. Retain it and do not mistake the root as the runtime publish directory.
- `hbuilds/config/` is Hostinger-managed and may contain sensitive environment/settings material. Only its folder size/inode count was inspected; contents were not read or copied.
- Build history in hPanel may have more entries than the single version in the filesystem; historical deployment records are **not** evidence of stale on-disk version directories.

## Classification for follow-on work

| Group | Outcome | Action |
| --- | --- | --- |
| Current `versions/<uuid>` (all 4) | ACTIVE / PROTECTED | Keep; needed for serving and rollback contract |
| `current` symlinks | ACTIVE / PROTECTED | Keep |
| `config/` | PROVIDER-MANAGED / SENSITIVE | No manual cleanup |
| `last-source/` | PROVIDER-MANAGED SOURCE SNAPSHOT | No manual cleanup |
| `node_modules/`, `apps/*/.next` and runtime assets | ACTIVE or potentially required | Do not delete live; any size optimization must change packaging and pass 4-lane build/smoke |
| `public_html/.htaccess`, marker file | HOSTING CONFIG | Keep |
| Build logs | HISTORICAL / TINY | Leave to provider retention; no useful space recovery |
| Retained historical version directories | **NONE CONFIRMED** | Zero verified safe-to-delete directories |
| Standalone build/cache subtrees | PARTIALLY INSPECTED | Detailed byte attribution limited by File Manager intermittently returning 403; do not infer deletability |

## P2.1 closeout and P2.2 guardrails

**No confirmed safe deletion target and no defensible reclaimable-space estimate** beyond the tiny historical log total, whose provider retention behavior remains unverified.

P2.1 records a read-only four-lane inventory. Before implementing P2.2 source deduplication or runtime packaging optimization, preserve:

1. UX Improvement `codex/ux-uat-20261008` and independent `test.ccpun.com` deployment; no overwrite.
2. Draft Investment Allocation PR #165 and its development branch; no accidental merge or Production activation.
3. Pinned Web/Admin Production release SHA `c867c34a`, Sanity/Neon boundaries, URL/SEO behavior, exact rollback provenance.
4. Provider-managed runtime/config/build directories; no destructive cleanup in hPanel.
5. Git/main local WIP and any separate active UX/Investment worktrees.

**Open limitation:** A deeper file- and cache-level assessment, and a reconciliation of the plan-wide 10.8 GiB figure, needs a supported read-only filesystem interface or provider usage breakdown. Some nested File Manager directories intermittently returned HTTP 403; those were recorded as **unverified**, not empty. Do not assert cache-free runtime or zero orphan files.
