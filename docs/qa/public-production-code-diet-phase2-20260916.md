# Public Production Code Diet — Phase 2

Status: audit branch only until usage evidence and regression gates are complete.

## Scope

- audit globally shipped `app/components.css`
- audit shared `components/layout/website-43/Website43.module.css`
- remove only selectors/declarations proven unused or legacy on current Public Production routes
- preserve Home, Blog, Article, CI Planning, FHC, Privacy/Cookie, SEO, analytics/consent and calculator behavior

## Safety

No URL/canonical/robots/sitemap/content/data/provider changes. No selector is removed solely because its name looks legacy; removal requires current-source usage evidence and regression coverage.
