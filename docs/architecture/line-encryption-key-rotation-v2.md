# LINE Encryption Key Rotation V1 → V2

## Purpose

This runbook rotates CCPun LINE private-data encryption without revealing the existing V1 secret and without breaking identity lookup. CCPUN_LINE_IDENTITY_HMAC_KEY_V1 is a separate stable lookup key and is not rotated by this procedure.

## Key contract

- CCPUN_LINE_ENCRYPTION_KEY_V1 decrypts stored key-version 1 ciphertext.
- CCPUN_LINE_ENCRYPTION_KEY_V2 decrypts stored key-version 2 ciphertext.
- CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION selects which key encrypts new values.
- Missing/empty active-version config means version 1. Version 2 is never selected implicitly.
- AAD remains version-specific: ccpun-line:v{version}:{purpose}.
- Decryption always uses the exact stored key_version. The runtime never guesses or falls back to another key.

## Owner-held backup rule

Before any future encryption key is activated in Production, the owner must keep a recoverable copy outside Vercel in a trusted password/secret manager. Sensitive Vercel variables are write-only and are not a backup mechanism.

Never paste encryption keys into chat, GitHub, logs, screenshots, SQL, tickets, or source code.

## Safe activation sequence

1. Keep V1 unchanged in ccpun-web Production.
2. Provision the same V2 secret directly into ccpun-web and ccpun-admin Production.
3. Deploy dual-key-capable code and checksum-locked database rotation functions while the active version remains 1.
4. Verify UAT and Production migration readbacks and least-privilege boundaries.
5. Set CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION=2 on Web and enable CCPUN_LINE_LAZY_KEY_ROTATION_ENABLED=true.
6. Set CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION=2 on Admin so new Admin-created ciphertext uses V2. Admin may operate with V2 only; any remaining V1 item must degrade to legacy_key_unavailable/key-unavailable rather than crash or guess.
7. Redeploy both projects and run controlled LINE ingress tests. Each accepted identity-bearing event may rotate a small bounded batch for that exact identity. Ingestion remains successful even when rotation cannot complete.
8. Read only the aggregate rotation-status function. It exposes counts by key version, no customer/message identifiers or ciphertext.
9. Continue normal/controlled identity-bearing LINE traffic until rotatable_v1_count=0.
10. Admin-only V1 ciphertext (for example historical outbound content or private notes) is not rotated by Web ingress. Keep V1 available to the owner until a separate reviewed Admin-side migration/re-encryption path has reduced admin_only_v1_count=0.
11. V1 may be retired only when all of these are true: total_v1_count=0; unsupported_version_count=0; encrypted_unsent_count=0; all_v1_zero=true; Production readback and Human UAT pass after the final V2-only deployment.

## Do not delete V1 early

V1 must remain in ccpun-web until aggregate verification proves no rotatable V1 ciphertext remains. If Admin has any V1-only outbound/private-note ciphertext, the owner must retain a recoverable V1 backup until those counts also reach zero.

Deleting V1 before zero-count verification can permanently make old ciphertext unreadable.

## Lazy-rotation boundary

Web ingress can request a bounded candidate set only for the exact LINE identity digest associated with the accepted event. Candidates are limited to provider identity encrypted external reference, active/non-unsent provider message ID, and active/non-unsent message content.

Unsent/tombstoned message material is excluded. Web ingress cannot rotate Admin outbound content or advisor private notes. Rotation apply is compare-and-swap-like: source version must still be V1, the record must still belong to the same identity, and purged/unsent content remains ineligible.

No public or Admin endpoint can request raw rotation candidates. PUBLIC execution is revoked; only ccpun_line_ingress can call the candidate/apply functions.

## Provider safety during transition

Admin provider sending decrypts the exact stored recipient/content key version before making a LINE network request. If the required key is unavailable or unsupported, the item is checkpointed with a stable error class and subsequent claim functions exclude it from automatic retry. No ambiguous key failure is sent to LINE.
