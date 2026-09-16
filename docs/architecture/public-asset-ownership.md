# Public Web asset ownership

This document covers static assets used by the non-Blog Public Website: Home, shared navigation/footer, CI Planning, Financial Health Check, legal pages, and other public shell surfaces.

## Scope

The cleanup/audit deliberately excludes Blog/CMS media such as `public/assets/blog-migration/**`. Blog content has its own content lifecycle and must not be deleted just because the application source graph does not contain a literal reference.

## Rules

1. Keep an asset only when it has a current runtime owner, a protocol owner, or an explicitly documented dynamic family owner.
2. Prefer assets beside a clear feature namespace, for example `public/assets/ci-planning/` or `public/assets/website-43/`, instead of adding more unrelated files to the root asset directory.
3. Do not keep multiple PNG/WebP/JPG variants by habit. Keep the format actually referenced by the current owner unless another format has an explicit consumer.
4. Dynamic asset families such as `/assets/icons/${name}.svg` are treated conservatively until replaced by a statically enumerable manifest.
5. Browser/protocol files such as the active favicon may have implicit ownership even when no source file contains a literal path.
6. Do not use docs, tests, old migration scripts, or archived source as proof that a Public asset is still used at runtime.
7. New feature assets should be added with the feature that owns them and removed when that feature stops referencing them.

## Automated audit

`npm run audit:public-assets` uses the shared reachability graph in `scripts/lib/public-reachability.mjs` and reports non-Blog assets with no current runtime reference. The audit intentionally starts as discovery-only during a cleanup pass; after candidates are reviewed and cleaned, the zero-reference baseline can be locked as a regression gate.
