# Dedicated Web UAT analytics

Default-OFF reference `ff2a4003` has no GA4, GTM or Meta loader. Its Hostinger Web UAT identity,
Sanity UAT dataset, noindex and `CCPUN_ENABLE_PRODUCTION_ANALYTICS=0` remain mandatory.
Production and Admin behavior are unchanged.

The optional UAT path reuses the existing consent, GTM and semantic event components.
Its only activation path is the reviewed, versioned `APPROVED_UAT_ANALYTICS` record in
`apps/web/analytics-configuration.ts`: `enabled: true` plus verified dedicated public
GA Measurement and GTM Container IDs. The valid UAT profile enables the existing
semantic compile flag in the Web Next config. No new environment variable is needed.
Production IDs and invalid deployment identity are rejected. The application's Meta
loader remains blank and its three advertising consent signals remain denied. This
does not suppress Meta tags embedded inside the external GTM container.

Read-only owner metadata verified GA4 account `155865176`, UAT property `551040812`,
Web stream `15481003500` / Measurement ID `G-RQ5C651M5M`, and dedicated GTM account
`6372594273`, container `261968791` / public ID `GTM-N4S93T5T`.
The stream still names an old Vercel UAT URL. The existing UAT container's published
Version 4 targets that UAT Measurement ID but contains two Meta tags. Both must be
confirmed disabled and consent/semantic mappings reviewed before future activation;
these are separately authorized UAT provider prerequisites. A local conditional candidate
may set `enabled: true` for review/build only; it must not be released before those
prerequisites and exact UAT deployment approval. No provider setting activates the
default-OFF reference. Synthetic
IDs in tests are never release configuration. GA Measurement/Container IDs are public
identifiers; Admin reporting OAuth credentials are server-only and unrelated.

Activation needs reviewed destination metadata, an exact versioned config diff and a
separately approved native Hostinger UAT release. The connector's full environment
replacement is unnecessary; never read/copy credentials or replace existing settings.
No provider UI or direct API workaround is authorized. Default-OFF UAT can already prove real page/Copy behavior
and absence of provider loaders; it cannot prove positive GA4 delivery.
