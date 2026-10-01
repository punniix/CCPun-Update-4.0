import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const failures = [];

function expect(name, pass, detail = '') {
  if (pass) {
    console.log(`PASS ${name}`);
    return;
  }
  failures.push(name);
  console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
}

const agents = read('AGENTS.md');
expect('agent workflow protects v4-production', agents.includes('Never edit `v4-production` directly'));
expect('agent workflow requires Preview and human review', agents.includes('Vercel Preview -> human review -> merge'));
expect('agent policy separates canonical URL from semantic topic', agents.includes('Semantic topic classification is a separate knowledge-graph layer'));
expect('agent policy preserves Health CI Hero semantics', agents.includes('AIA Health CI Hero is health/medical-expense insurance') && agents.includes('It is NOT critical-illness lump-sum insurance'));
expect('agent policy locks Health winner pages to Health physical URLs', agents.includes('AIA Health Happy and AIA Health CI Hero have approved final physical/canonical owners under `/blog/health-insurance/...`'));
expect('agent policy protects analytics consent', agents.includes('Consent must remain authoritative'));

const urlContract = read('lib/content/url.ts');
const frozenMovedPaths = [
  ['life-insurance/aia-health-happy-describe', '/blog/health-insurance/aia-health-happy-describe/'],
  ['life-insurance/aia-health-ci-hero-guide', '/blog/health-insurance/aia-health-ci-hero-guide/'],
  ['life-insurance/critical-illness-insurance', '/blog/critical-illness-insurance/what-is-critical-illness-insurance/'],
  ['critical-illness/critical-illness-insurance', '/blog/critical-illness-insurance/what-is-critical-illness-insurance/'],
  ['critical-illness-insurance/critical-illness-insurance', '/blog/critical-illness-insurance/what-is-critical-illness-insurance/'],
];
for (const [source, destination] of frozenMovedPaths) {
  expect(`frozen URL contract ${source}`, urlContract.includes(`"${source}": "${destination}"`), destination);
}
expect(
  'critical illness legacy category redirects directly to the approved hub',
  urlContract.includes('"critical-illness": "/blog/critical-illness-insurance/"'),
);
expect('health winner canonical category override remains protected', urlContract.includes('"aia-health-happy-describe": "health-insurance"') && urlContract.includes('"aia-health-ci-hero-guide": "health-insurance"'));
expect('canonical alignment remains ccpun.com only', urlContract.includes('canonical.origin === "https://ccpun.com"'));

const taxonomy = read('lib/content/taxonomy.ts');
const categoryRegistry = read('lib/content/category-registry.ts');
expect(
  'critical illness physical ownership is registry-gated',
  taxonomy.includes('slug: "critical-illness-insurance"')
    && !taxonomy.includes('ACTIVE_ARTICLE_CATEGORIES')
    && categoryRegistry.includes('CATEGORY_STATUS_VALUES = ["draft", "active"]'),
);
expect(
  'legacy critical illness topic slug aliases to the approved category',
  taxonomy.includes('"critical-illness": "critical-illness-insurance"'),
);
expect(
  'critical illness definition keeps one semantic owner through slug migration',
  taxonomy.includes('"critical-illness-insurance": "critical-illness-insurance"')
    && taxonomy.includes('"what-is-critical-illness-insurance": "critical-illness-insurance"'),
);

const ledger = JSON.parse(read('qa/legacy-url-ledger.json'));
expect('legacy URL ledger remains frozen', typeof ledger.frozenAt === 'string' && ledger.frozenAt.length > 0);
const ledgerText = JSON.stringify(ledger);
for (const destination of [
  '/blog/health-insurance/aia-health-happy-describe/',
  '/blog/health-insurance/aia-health-ci-hero-guide/',
]) {
  expect(`legacy ledger retains approved winner destination ${destination}`, ledgerText.includes(`https://ccpun.com${destination}`));
}
const criticalIllnessLegacy = ledger.mappings.find(({ id }) => id === 'critical-illness-insurance');
expect(
  'critical illness legacy source is frozen to the live final owner',
  criticalIllnessLegacy?.state === 'live'
    && criticalIllnessLegacy?.destination === 'https://ccpun.com/blog/critical-illness-insurance/what-is-critical-illness-insurance/'
    && criticalIllnessLegacy?.plannedDestination === undefined,
);

const intentRegistry = JSON.parse(read('qa/search-intent-owner-registry.json'));
const criticalIllnessOwner = intentRegistry.owners.find(({ intentId }) => intentId === 'critical-illness-insurance-definition');
expect(
  'critical illness search intent owner moves to final canonical',
  criticalIllnessOwner?.ownerUrl === 'https://ccpun.com/blog/critical-illness-insurance/what-is-critical-illness-insurance/'
    && criticalIllnessOwner?.semanticTopic === 'critical-illness-insurance'
    && criticalIllnessOwner?.ownerState === 'published',
);

const studioPolicy = read('cms/sanity/policy/studio-policy.ts');
expect('non-production Studio blocks publish', /BLOCKED_NON_PRODUCTION_ACTIONS[^\n]*"publish"/.test(studioPolicy));
expect(
  'production admin uses guarded article lifecycle',
  studioPolicy.includes('protectProductionContentLifecycleActions')
    && studioPolicy.includes('createDraftOnlyDeleteAction')
    && studioPolicy.includes('createSeoSafeUnpublishAction')
    && studioPolicy.includes('ลบฉบับร่าง')
    && studioPolicy.includes('นำออกจากเว็บไซต์'),
);
expect(
  'published URLs remain protected from permanent delete',
  studioPolicy.includes('function wasEverPublished')
    && studioPolicy.includes('if (wasEverPublished(props)) return null;'),
);
expect(
  'disallowed Sanity data plane returns no actions',
  studioPolicy.includes('export function isStudioConfigurationAllowed(')
    && studioPolicy.includes('if (serverRuntime) return isStudioDataPlaneAllowed(dataset, environment, undefined, undefined, projectId);')
    && studioPolicy.includes('if (provider === undefined && role === undefined)')
    && studioPolicy.includes('provider !== "hostinger" || role !== "admin" || vercelProject || productionProject || profile !== "full"')
    && studioPolicy.includes('ref !== "v4-production" || backend !== "disabled" : backend !== "native-neon")) return false;')
    && ['filterStudioAuthProviders', 'filterStudioDocumentActions', 'filterStudioNewDocumentOptions'].every((name) =>
      /\): T\[\] \{\s*if \(!isStudioConfigurationAllowed\(dataset, environment, projectId\)\) return \[\];/.test(
        studioPolicy.split(`export function ${name}`)[1]?.split('\nexport function ')[0] ?? '',
      ),
    ),
);

const authorSanitySchema = read('cms/sanity/schema/documents/author.ts');
const sanityRuntimeSchema = read('lib/content/sanity-schema.ts');
const siteStructuredData = read('lib/seo/structured-data/site-schema.ts');
const entityIds = read('lib/seo/structured-data/entity-ids.ts');
const articleStructuredData = read('lib/content/structured-data/article-schema.ts');
const homePage = read('app/page.tsx');
const webHomePage = read('apps/web/app/page.tsx');
const publicLayout = read('app/layout.tsx');
const webPublicLayout = read('apps/web/app/layout.tsx');

expect(
  'legacy Author credentials contract stays intact while professional qualifications are additive',
  authorSanitySchema.includes('name: "credentials"')
    && authorSanitySchema.includes('of: [defineArrayMember({ type: "string" })]')
    && authorSanitySchema.includes('readOnly: true')
    && authorSanitySchema.includes('deprecated:')
    && authorSanitySchema.includes('name: "professionalQualifications"')
    && authorSanitySchema.includes('name: "identifier"')
    && authorSanitySchema.includes('name: "issuer"'),
);
expect(
  'professional qualification runtime parsing is fail-soft and GROQ keeps Sanity array keys',
  sanityRuntimeSchema.includes('parseProfessionalQualifications')
    && sanityRuntimeSchema.includes('if (!Array.isArray(items)) return []')
    && read('lib/content/sanity.ts').includes('professionalQualifications[]{\n      _key,'),
);
expect(
  'Person entity has one canonical human name with aliases and Article schema references only that entity',
  siteStructuredData.includes('"name": "ชนาธิป ชิตประเสริฐ"')
    && siteStructuredData.includes('"alternateName": ["ปั้น", "CCPun"]')
    && entityIds.includes('export const CCPUN_PERSON_ID = "https://ccpun.com/#person"')
    && articleStructuredData.includes('author: { "@id": CCPUN_PERSON_ID }')
    && !articleStructuredData.includes('name: article.authorName')
    && publicLayout.includes('authors: IS_ADMIN_APPLICATION ? undefined : [{ name: "ชนาธิป ชิตประเสริฐ", url: "https://ccpun.com" }]')
    && !publicLayout.includes('authors: IS_ADMIN_APPLICATION ? undefined : [{ name: "ปั้น (CCPun)"')
    && webPublicLayout.includes('authors: [{ name: "ชนาธิป ชิตประเสริฐ", url: "https://ccpun.com" }]')
    && !webPublicLayout.includes('authors: [{ name: "ปั้น (CCPun)"'),
);
expect(
  'Homepage credential enrichment is fail-soft and does not require a new public page',
  homePage.includes('getPrimaryAuthorProfile')
    && homePage.includes('buildProfessionalQualificationPersonSchema')
    && homePage.includes('<Website43Home authorProfile={authorProfile} />')
    && webHomePage.includes('getPrimaryAuthorProfile')
    && webHomePage.includes('buildProfessionalQualificationPersonSchema')
    && webHomePage.includes('<Website43Home authorProfile={authorProfile} />')
    && !homePage.includes('/about/')
    && !webHomePage.includes('/about/'),
);

const sanityContent = read('lib/content/sanity.ts');
expect(
  'primary Author lookup is cached, timeout-bounded and falls back cleanly when Sanity is unavailable',
  sanityContent.includes('export const getPrimaryAuthorProfile = unstable_cache')
    && sanityContent.includes('const PRIMARY_AUTHOR_FETCH_TIMEOUT_MS = 2000')
    && sanityContent.includes('settleWithin(')
    && sanityContent.includes('[author-profile] primary author timed out')
    && sanityContent.includes('revalidate: 300')
    && sanityContent.includes('return null;')
    && sanityContent.includes('[author-profile] primary author unavailable'),
);
expect(
  'Sanity list query uses lightweight projection',
  sanityContent.includes('const listQuery = groq`*[_type == "article" && defined(slug.current)] | order(coalesce(publishedAt, _updatedAt) desc) ${baseProjection}`')
    && sanityContent.includes('const bySlugQuery = groq`*[_type == "article" && slug.current == $slug][0] ${articleProjection}`'),
);
expect(
  'Sanity list isolates invalid records',
  sanityContent.includes('listArticles:record-skipped')
    && sanityContent.includes('return rows.flatMap((row) => {')
    && sanityContent.includes('return [toArticleSummary(row)]'),
);
expect(
  'Sanity full article remains strict',
  sanityContent.includes('z.array(bodyItemSchema).parse(raw.body)')
    && sanityContent.includes('Published article is missing required SEO fields'),
);
expect(
  'Sanity errors remain externally redacted with internal typed logging',
  sanityContent.includes('reportSanityError(')
    && sanityContent.includes('Sanity content request failed; details redacted'),
);

const articlePage = read('features/blog/pages/ArticlePage.tsx');
expect(
  'moved article redirect waits for final published owner',
  articlePage.includes('const movedTargetSlug = movedPath.split("/").filter(Boolean).at(-1);')
    && articlePage.includes('movedTargetArticle?.status === "published"')
    && articlePage.includes('permanentRedirect(movedPath)'),
);
expect(
  'related article failure cannot take down article rendering',
  articlePage.includes('let relatedArticles = []')
    && articlePage.includes('[blog-related] related articles unavailable')
    && articlePage.includes('try {')
    && articlePage.includes('catch (error)'),
);
expect(
  'invalid related taxonomy is isolated before article cards render',
  articlePage.includes('getArticlePath(candidate);')
    && articlePage.includes('[blog-related] skipping article with invalid taxonomy')
    && articlePage.includes('return false;'),
);

const blogArchive = read('features/blog/pages/BlogArchivePage.tsx');
expect(
  'blog archive owns Open Graph URL and social metadata',
  blogArchive.includes('const BLOG_URL = "https://ccpun.com/blog/"')
    && blogArchive.includes('openGraph: {')
    && blogArchive.includes('url: BLOG_URL')
    && blogArchive.includes('twitter: {'),
);

const analytics = read('lib/analytics.ts');
expect('analytics remains consent-gated', analytics.includes("import { getConsentData } from './cookie-consent';") && analytics.includes('if (!consent) return;'));
expect('analytics keeps allowlisted parameter sanitizer', analytics.includes('export function sanitizeEventParams'));
expect('analytics keeps semantic dataLayer cutover layer', analytics.includes('export function buildSemanticDataLayerEvent') && analytics.includes("event: 'ccpun_event'"));
expect('analytics keeps central trackEvent dispatcher', analytics.includes('export function trackEvent(eventName: string'));

const allowedStringsMatch = analytics.match(/const ALLOWED_STRINGS:[\s\S]*?\n};/);
const allowlist = allowedStringsMatch?.[0] ?? '';
for (const forbiddenKey of ['email', 'phone', 'income', 'expense', 'health_condition']) {
  const keyPattern = new RegExp(`^\\s*${forbiddenKey}\\s*:`, 'm');
  expect(`analytics allowlist excludes sensitive field ${forbiddenKey}`, !keyPattern.test(allowlist));
}

const migrationContract = read('cms/sanity/migration-contract.md');
expect('content migration remains draft-first', migrationContract.includes('A content import is not publication'));
expect('published migration requires coordinated URL release', migrationContract.includes('redirect + new canonical + sitemap/internal-link ownership together'));

if (failures.length) {
  console.error(`\nFoundation safety regression failed (${failures.length}):`);
  failures.forEach((name) => console.error(`- ${name}`));
  process.exit(1);
}

console.log('\nFoundation safety contracts passed.');
