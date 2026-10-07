# Hostinger VPS Filesystem Audit — 2026-10-07

Status: **PHASE 1 INVENTORY CLOSED / NO CLEANUP EXECUTED**

This report records read-only live evidence from the Hostinger VPS `srv908107`. No file, container, image, volume, service, route, cron entry or provider setting was changed during this audit.

## Executive finding

The VPS is not running out of inode capacity, but migration-era build trees and Docker layers explain the very large file count and most of the disk usage.

Observed filesystem state:

- root filesystem: 96 GB total, 64 GB used, 33 GB available, 66% used;
- inode use: 2,831,403 / 12,976,128, about 22%;
- `/opt`: about 45 GB;
- `/var`: about 16 GB;
- `/opt/ccpun-labs`: about 37.7 GiB actual allocated blocks and 1,606,219 files;
- `/opt/ccpun-workers`: about 7.3 GB and 457,634 files;
- `/var/lib/docker`: about 319,749 files, dominated by `overlay2` at about 13 GB and volumes at about 2.8 GB.

The high file count is therefore primarily repeated Node/Next.js build trees, `node_modules`, `.next` caches and Docker overlay filesystems, not one large business-data store.

## Active required runtime

Keep/protect until a separate reviewed change proves otherwise:

| Runtime | State | Important storage |
| --- | --- | --- |
| `root-n8n-1` | active | `n8n_data` (~235 MB), `/local-files` |
| `root-traefik-1` | active | `traefik_data`, Docker socket read-only, current n8n router |
| `ccpun-local-ai-worker-1` | active | `ccpun-local-ai_worker_source`, `ccpun-local-ai_worker_node_modules` (~1.0 GB) |
| `ccpun-ocr-ocr-1` | active/healthy | `ccpun-local-ai_ocr_models` |
| `ccpun-local-ai-ollama-1` | active/healthy | `ccpun-local-ai_ollama_models` (~1.36 GB) |

Do not prune or delete these linked volumes. Do not treat `docker volume prune` as a generic cleanup command.

## Residual browser-runtime containers

Two migration-era Admin containers are still running on the VPS:

1. `ccpun-native-admin-production-8cbbbedd-20261001-route`
   - attached to Traefik;
   - retains a `Host(admin.ccpun.com)` router;
   - bind-mounts the old Production Admin runtime and a Neon client path;
   - its top-level source/runtime directories account for about 3.0 GB + 178 MB.

2. `ccpun-native-admin-uat-025455f0-20260930-runtime`
   - Traefik disabled;
   - bound only to `127.0.0.1:3103`;
   - its old UAT tree accounts for about 2.9 GB, although the active bind is the ~178 MB runtime subdirectory.

These containers are **legacy-active / Phase 2 retirement candidates**, not safe-delete items yet.

Hostinger hPanel exposes `admin.ccpun.com` as a Web App, while public Admin HTTP output differs from a direct request to the VPS Traefik origin. This supports the architecture classification that the VPS Admin containers are residual migration runtime rather than canonical placement authority. Phase 2 must still prove origin/callback independence immediately before stopping them.

## Migration lab trees

`/opt/ccpun-labs` contains about 37.7 GiB of allocated blocks.

Top-level accounting identified:

- about **31.70 GiB** in directories not mounted by the currently running Admin containers;
- about **5.99 GiB** in the three top-level directories conservatively protected because the two residual Admin containers currently mount paths inside them.

The non-mounted group is a cleanup candidate, not an automatic delete list. It consists mainly of old Admin builds/checks, Neon UAT probes, Phase 3 UAT copies and native workflow experiments.

Large repeated Next.js cache files confirm the cause: individual `.next/cache/webpack/*/0.pack` files are roughly 300–675 MB, repeated across many old build directories, alongside repeated `node_modules` trees.

### Largest legacy candidates

Examples include:

- old Production Admin builds: several directories around 2.8–3.4 GB each;
- old Admin focused-check/final trees: around 1.5 GB each by human-readable disk usage;
- old Neon UAT probe trees: around 1.5 GB each;
- Phase 3 UAT source trees: around 1.5 GB each;
- old native workflow test tree: around 1.8 GB.

No running process, systemd unit/timer or cron entry was found referencing these non-mounted lab trees.

## Private worker release cache

`/opt/ccpun-workers/releases` contains five source/build releases, about 1.5 GB each, total about 7.3 GB:

- `e170e5f48b523d4ffd0fa7658bb362b5b0cbc562`
- `9786821020cd7ab819dba63d9009ade25790701c`
- `d5a44f1bdadd5497f3bc14630e6641f92f041dbf`
- `68ce62eabd4e733ce4a40e154aaeaa3fd13e7799`
- `cd146117c193795dcb49109692998e91038911b4`

Direct process, systemd timer/service and cron read-back found no Article Scheduler, Social or LINE background worker consuming these releases.

Classification: **release-cache candidate, preserve until Phase 3 worker activation packet selects the exact reviewed worker release**. Do not delete all five merely to reclaim space before that selection.

## Docker storage

`docker system df` observed:

| Class | Total | Reclaimable reported |
| --- | ---: | ---: |
| Images | 11.26 GB | 1.246 GB |
| Containers | 956.2 MB | 909.3 MB |
| Local volumes | 2.658 GB | 0 B |
| Build cache | 1.448 GB | reported 0 B by Docker |

Notable unused image:

- `node:latest` — about 1.25 GB, zero containers.

There are 39 containers total but only 7 running. Most exited containers are migration/build/probe artifacts. Container writable-layer reclaim is about 909 MB according to Docker.

Do not infer that an image is removable merely because its tag looks old: shared layers and stopped rollback probes must be reconciled against the Phase 2 cleanup set.

## Execution-plane proof

Live host read-back found these long-running application processes:

- Ollama;
- OCR/Uvicorn;
- Local AI worker;
- n8n/task runner.

No `article-schedule-worker` or `admin-background-worker` process was present.

No CCPun Article/Social/LINE autonomous worker owner was found in systemd services, systemd timers or cron.

This closes the Phase 1 evidence gap in the P0 execution-ownership contract: the private worker plane is authorized but Article/Social/LINE activation remains dormant.

## Protected data/config

Do not delete or bulk-prune:

- `n8n_data`;
- Local AI worker source/node_modules volumes until its runtime is deliberately rebuilt;
- Ollama model volume;
- OCR model volume;
- Traefik data while n8n routing still depends on Traefik;
- `/etc/ccpun` migration/runtime configuration and secrets without a separate secret/config retirement inventory;
- current Docker compose definitions;
- backups;
- any directory mounted by a running container.

## Phase 2 cleanup order

Recommended order after a fresh pre-delete read-back:

1. Reconfirm all four canonical browser-facing hosts from Hostinger Cloud Startup and prove no provider callback/private caller uses the VPS Admin Production route or UAT loopback runtime.
2. Stop and remove only the two residual Admin runtime containers after that proof; then release their protected lab directories.
3. Remove explicitly inventoried non-mounted `/opt/ccpun-labs` migration trees. Current conservative candidate pool is about **31.7 GiB** before retiring the two residual Admin trees.
4. Remove exited migration/test containers after matching them to the retired lab set.
5. Remove the unused `node:latest` image if it remains unreferenced.
6. Review Docker build cache separately; do not use blanket volume prune.
7. Preserve the private-worker release set until Phase 3 selects the exact worker release; then retain the selected/rollback release(s) and remove superseded copies.
8. Re-run `df -h`, `df -i`, Docker inventory and runtime smoke checks after each cleanup batch.

## Phase 1 acceptance

Phase 1 is complete because:

- disk and inode use are measured;
- the major storage/file-count sources are identified;
- active runtime and protected volumes are identified;
- residual Admin runtime is explicitly separated from safe cleanup candidates;
- private worker release cache is inventoried;
- cleanup candidates have an evidence-backed order;
- no deletion or runtime mutation was performed.
