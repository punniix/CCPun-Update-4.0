# Phase 1: behavior-preserving source ownership

Baseline: actual Web Production `7ee7c337473dc6b0ba5fa3d0ab87955ac0fbc40f`; no UAT behavior or PR165 import. Original48/286 protection manifest remains byte-unchanged. Current own-baseline SSR, metadata, read ordering, denial, scheduling and error fixtures exercise the extracted owners.

All30 formerly retained pairs were reviewed individually. Shared bodies now have the domain owner below; real lane contracts remain explicit. 19 pre-existing thin adapters and7 shared routing handlers are already solved and unchanged. Root fallback remains supported.

| Original retained pair | Single implementation owner / real boundary | Why retained configuration is necessary |
|---|---|---|
| `analytics/page` | `existing redirect / AnalyticsDashboard` | Different landing contract; each entry is already thin. |
| `analytics/search/page` | `existing growth/read-model owners / AnalyticsDashboard` | Different stored analytics versus editorial/growth composition; no duplicate business body. |
| `content/articles/[id]/page` | `ArticleDetailPage` | Shared permission/read/find/NotFound/render; per-entry status/dataset text retained. |
| `content/articles/page` | `ContentArticlesPage` | Shared query/filter/order/live-audit/table; display labels retained. |
| `content/calendar/page` | `ContentCalendarPage + page-presentation` | Shared query/group/date/table; each cancellation filter and queue/readiness/error display retained. |
| `dashboard/inbox/page` | `SeoReviewInboxPage / existing AdvisorInbox` | Root proposal inbox shares real body with canonical dashboard/reviews; canonical LINE inbox remains its separate actual feature. |
| `dashboard/page` | `dashboard-summary + existing dashboard features` | Shared editorial reads/count/steps; root business/advisor composition and canonical today composition retained. |
| `error` | `AdminErrorView` | Shared error/reset DOM; client entry remains. |
| `layout` | `AdminProtectedChrome` | Shared header/sidebar/main; lane auth, nav arrays, capability filtering and server logout stay at entry. |
| `not-found` | `AdminNotFoundView` | Shared unavailable DOM; lane copy retained. |
| `operations/[section]/page` | `existing Deployments/Jobs/LocalAI feature owners` | Thin route selection already owned; canonical-only LocalAI is intentional and not added to root. |
| `operations/audit-log/page` | `AuditLogPage + page-presentation` | One permission/read/table owner; raw/friendly date/status and error presentation retained. |
| `operations/health/page` | `HealthStatus + existing LINE/privacy/system read models` | Shared identical Card/Row; genuinely distinct diagnostic data models and warning/partial labels remain. |
| `seo/audits/[id]/page` | `SeoAuditDetailPage` | One audit/context/readiness/proposal renderer; exact title/copy/buttons retained. |
| `seo/page` | `SeoOverviewPage` | One query/score/table owner; own7ee has no c354 published-owner-recheck adoption. |
| `settings/[section]/page` | `ReadinessRows + settings-readiness` | Shared three readiness reads/order and row DOM; integrations/access/system contracts remain per lane. |
| `settings/page` | `SettingsIndexPage` | Shared index renderer; lane menu data retained. |
| `social/posts/page` | `existing operations-page / posts-page` | Both already thin exports to different product feature owners; no new generic router. |
| `login/page` | `AdminLoginView` | Shared login DOM only; per-entry auth/callback/server action retained. |
| `admin-not-found/page` | `AdminNotFoundView` | Shared DOM; exact copy retained. |
| `api/admin/content/[id]/schedule/route` | `article-schedule-handler` | Shared validators/GET/DELETE/errors; root eager legacy and canonical native/disabled/lazy dispatch stay distinct. |
| `api/admin/providers/ubersuggest/sync/route` | `ubersuggest-sync` | Shared provider sync/failure; root reviewed-import and origin/schema branches, local per-route in-flight state retained. |
| `api/auth/[...nextauth]/route` | `auth-route-observer / existing handlers` | Root direct handler identity retained; canonical redacted observer uses receiver-preserving thunk and same Response/Error. |
| `root layout -> Admin layout` | `existing foundation + distinct lane composition` | Public/mixed root versus private Admin composition remains meaningful; Next font calls stay literal compilation boundary. |
| `root layout -> Web layout` | `root-metadata + existing foundation` | Shared public metadata output; root conditional Admin/draft and Web public composition retained. |
| `root page -> Admin page` | `existing canonical Web export / authenticated Admin redirect` | Different entry targets are intentional, no shared-body duplication. |
| `root robots -> Admin robots` | `robots-policy` | One output builder; own predicates and ordered private paths retained, including root-only admin-not-found. |
| `root robots -> Web robots` | `robots-policy` | One output builder; Web sealed indexing and literal force-dynamic retained. |
| `studio/[[...tool]]/page` | `StudioUnavailableView` | Shared unavailable DOM; auth/URL/metadata/viewport/native static exports retained. |
| `studio/[[...tool]]/studio-client` | `canonical Studio client default owner` | Semantic adapter: identical body except relative config import; module/config/default identity tested. |

Literal path changes applied only through parent-reviewed exact patches under current COO complete-Phase1 instruction; no route-fence policy changes. Fonts, literal Next route configs and separate lane dispatch guards remain intentionally in their Next entry boundaries. Projection checks seal each current admitted entry and every current owner; old source strings are used only by frozen parity and original-module execution fixtures. Supplementary source tests inspect the current actual imported owner graph, never old snapshots.

UAT port recipe: preserve existing73 root canonical aliases, extract each current canonical UAT body into the same owners with its own display/contract data; do not port Production legacy root variants or adopt/remove UAT UX/PR165. Admin c354 has an existing published-owner-recheck SEO contract absent7ee; its own extraction retains it via explicit per-route rendering option.

Candidate local verification: `test:architecture` PASS; `test:foundation-contracts` 37 existing +30 Phase1 tests PASS; complete `test:vercel` PASS (analytics/public/calculator contracts included); ESLint PASS with two unchanged image warnings. Focused17 changed Admin consumer files:98PASS/6 existing isolated-child dependency/bootstrap failures. Earlier fullAdmin1026 snapshot987PASS/37FAIL before four body-guard corrections; never reported fully passed. Direct local `tsc --noEmit --incremental false` cannot resolve absent local Next/React/type packages in execute-only dependency setup, so native installed-dependency CI typecheck/build is still required. No installation or symlink workaround.

Runtime-only maintenance size:45 changed entry files +23 new owners;4,399→3,509 lines(-890),340,531→267,825 rawbytes(-72,706). Tests/original-source fixtures are excluded from these totals. No measured load-time claim. No provider/Production change performed by this worker.
