# CCPun Backup Automation

This directory contains provider-independent disaster-recovery automation for CCPun.

## Production Sanity backup

Workflow: `.github/workflows/backup-sanity-production.yml`

Schedule: daily at 02:00 Asia/Bangkok (19:00 UTC).

The job exports `kyfxgjnq/production` with the Sanity CLI using the default full export behavior, which includes Draft documents and assets, then uploads both the `.tar.gz` archive and a SHA-256 manifest to:

`CCPun - Financial Advisor Project / 00 — System Backup / 04 — Sanity Exports / Production`

It appends a row to `CCPun Backup Registry` only after both uploads succeed. A 7-day GitHub Actions artifact is also retained as a short-lived emergency copy.

## Required GitHub Actions secrets

- `SANITY_BACKUP_READ_TOKEN` — least-privilege Sanity token that can read the Production dataset, Drafts, and assets.
- `GOOGLE_BACKUP_SERVICE_ACCOUNT_JSON` — Google service-account JSON. The service-account email must have Writer access to the Production backup folder and Editor access to the Backup Registry Sheet.

Never commit either credential to the repository.

## Fixed non-secret destinations

- Sanity project: `kyfxgjnq`
- Dataset: `production`
- Drive Production folder ID: `17OTY--nrou3JjcKeDjl2OLg95n1CpdA2`
- Backup Registry Sheet ID: `12hwLk83xxergE9pmf_5JJICmTuti3FhWiHlPA3ebvpU`

These identifiers are not authentication credentials. Access remains controlled by Sanity/Google permissions.

## Backup validity

A successful export/upload is not yet a tested recovery. Every snapshot is registered as `PENDING RESTORE TEST` until an isolated restore drill verifies documents, Drafts, assets, canonical URLs, and a Preview build. Restore tests must never target Production.

## Recovery principle

CCPun considers a backup valid only when restore has been tested. The intended recovery sequence is:

1. create an isolated recovery dataset/project;
2. import the selected `.tar.gz` archive;
3. verify document counts and asset references;
4. build a noindex Preview from the restored dataset;
5. spot-check Blog, images, slugs, metadata, and redirects;
6. record PASS/FAIL in the Backup Registry.

## Readable content and media mirror

Workflow: `.github/workflows/mirror-content-media.yml`

Schedule: daily at 02:30 Asia/Bangkok (19:30 UTC), after the full export. It reads `kyfxgjnq/production` (Published and Draft variants) with `SANITY_BACKUP_READ_TOKEN`, builds a readable Markdown/JSON plus media mirror, and upserts it into `02 — Blog Content` and `03 — Article Media` on the CCPun Drive with `GOOGLE_BACKUP_SERVICE_ACCOUNT_JSON`. It never deletes Drive files. The versioned `.tar.gz` export above remains the recovery source.

## Branch note

GitHub runs `schedule` triggers only from the default branch. Until these workflows were brought onto `v4-production` (owner decision R11, 2026-10-25) they existed only on `uat` and never ran on schedule. The manual restore drill (`recovery-drill.yml`, resets only `ccb9lnw5/recovery`) is still only on `uat` and needs its own approval and `SANITY_RECOVERY_ADMIN_TOKEN` before it is brought over.
