import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const packageJson = JSON.parse(read('package.json'));
assert.equal(packageJson.version, '4.1.0');
assert.equal(packageJson.scripts.build, 'next build');
assert.equal(packageJson.scripts.start, 'next start');
assert.match(packageJson.scripts['local:uat'], /CCPUN_APP_ENV=local-uat/);
assert.match(packageJson.scripts['local:uat'], /NEXT_PUBLIC_SANITY_PROJECT_ID=ccb9lnw5/);
assert.match(packageJson.scripts['local:uat'], /NEXT_PUBLIC_SANITY_DATASET=uat/);
assert.match(packageJson.scripts['local:uat'], /AUTH_URL=http:\/\/localhost:3100/);
assert.match(packageJson.scripts['local:uat'], /--hostname 127\.0\.0\.1 --port 3100/);
assert.equal(packageJson.scripts['local:production'], undefined);
assert.match(packageJson.scripts['local:production:read'], /CCPUN_LOCAL_PRODUCTION_DRAFT_WRITES=0/);
assert.match(packageJson.scripts['local:production:draft'], /CCPUN_LOCAL_PRODUCTION_DRAFT_WRITES=1/);
assert.equal(packageJson.scripts['qa:legacy-urls'], 'node qa/legacy-url-regression.mjs');
assert.deepEqual(packageJson.allowScripts, {
  'esbuild@0.28.2': true,
  'fsevents@2.3.3': true,
  'unrs-resolver@1.12.2': true,
});

const vercelConfig = JSON.parse(read('vercel.json'));
assert.equal(vercelConfig.ignoreCommand, 'node scripts/vercel-ignore-build.mjs');

const legacyUrlLedger = JSON.parse(read('qa/legacy-url-ledger.json'));
assert.deepEqual(legacyUrlLedger.mappings.map(({ id, destination }) => [id, destination]), [
  ['blog-root', 'https://ccpun.com/blog/'],
  ['aia-health-happy', 'https://ccpun.com/blog/health-insurance/aia-health-happy-describe/'],
  ['aia-health-ci-hero', 'https://ccpun.com/blog/health-insurance/aia-health-ci-hero-guide/'],
  ['financial-pyramid', 'https://ccpun.com/blog/personal-finance/financial-pyramid/'],
  ['aia-vitality', 'https://ccpun.com/blog/life-insurance/aia-vitality/'],
  ['critical-illness-insurance', 'https://ccpun.com/blog/life-insurance/critical-illness-insurance/'],
]);
assert.match(read('qa/legacy-url-regression.mjs'), /redirect target drifted/);

const nextConfig = read('next.config.ts');
assert.doesNotMatch(nextConfig, /output:\s*["']export["']/);
assert.doesNotMatch(nextConfig, /unoptimized:\s*true/);
assert.match(nextConfig, /APP_ENVIRONMENT === ["']local-uat["'][\s\S]*["']\.ccpun-local\/next-uat["']/);
assert.match(nextConfig, /APP_ENVIRONMENT === ["']local-production["'][\s\S]*["']\.ccpun-local\/next-production["']/);
assert.match(nextConfig, /source:\s*["']\/living-benefits\/:path\*["']/);
assert.match(nextConfig, /destination:\s*["']\/ci-planning\/["']/);
assert.match(nextConfig, /source:\s*["']\/tools\/fhc\/:path\*["']/);
assert.match(nextConfig, /destination:\s*["']\/tools\/financial-health-check\/["']/);
assert.match(nextConfig, /SECURITY_HEADERS/);

for (const legacyStaticArtifact of ['public/CNAME', 'public/.nojekyll', 'public/_headers', 'scripts/postprocess-static.mjs']) {
  assert.equal(existsSync(new URL(`../${legacyStaticArtifact}`, import.meta.url)), false, `${legacyStaticArtifact} must stay retired`);
}

for (const retiredRoute of ['app/living-benefits', 'app/tools/fhc']) {
  assert.equal(existsSync(new URL(`../${retiredRoute}`, import.meta.url)), false, `${retiredRoute} must remain an HTTP redirect, not a rendered route`);
}

for (const requiredRoute of [
  'app/blog/page.tsx',
  'app/blog/[category]/page.tsx',
  'app/blog/[category]/[slug]/page.tsx',
  'features/blog/pages/BlogArchivePage.tsx',
  'features/blog/pages/BlogCategoryPage.tsx',
  'features/blog/pages/ArticlePage.tsx',
  'lib/content/url.ts',
  'app/api/preview/enable/route.ts',
  'app/api/snt-admin/content/[id]/preview/route.ts',
  'app/studio/[[...tool]]/page.tsx',
  'app/studio/[[...tool]]/studio-client.tsx',
  'sanity.config.ts',
  'cms/sanity/schema.ts',
  'cms/sanity/schema/index.ts',
  'cms/sanity/schema/documents/article.ts',
  'cms/sanity/schema/objects/portable-text.ts',
  'lib/content/sanity.ts',
  'app/sitemap.xml/route.ts',
  'app/sitemaps/core.xml/route.ts',
  'app/sitemaps/tools.xml/route.ts',
  'app/sitemaps/blog.xml/route.ts',
  'app/robots.ts',
]) {
  assert.equal(existsSync(new URL(`../${requiredRoute}`, import.meta.url)), true, `missing ${requiredRoute}`);
}

const previewRoute = read('app/api/preview/enable/route.ts');
assert.match(previewRoute, /defineEnableDraftMode/);
assert.match(previewRoute, /IS_DRAFT_PREVIEW_ALLOWED/);
assert.match(previewRoute, /getAdminSanityReadToken/);
assert.doesNotMatch(previewRoute, /draft\.enable\(\)/);
const ownerPreviewRoute = read('app/api/snt-admin/content/[id]/preview/route.ts');
assert.match(ownerPreviewRoute, /hasAdminPermission\(identity\.role, "draft:apply"\)/);
assert.match(ownerPreviewRoute, /row\.isDraft/);
assert.match(ownerPreviewRoute, /draftMode\(\)\)\.enable\(\)/);
assert.doesNotMatch(ownerPreviewRoute, /searchParams\.get\(["'](?:redirect|url|path)["']\)/);

const studioPage = read('app/studio/[[...tool]]/page.tsx');
assert.match(studioPage, /IS_REVIEW_ENVIRONMENT/);
assert.match(studioPage, /StudioClient/);
assert.match(studioPage, /requireAdminPermission\("draft:apply"\)/);
const studioClient = read('app/studio/[[...tool]]/studio-client.tsx');
assert.match(studioClient, /import \{ Studio \} from "sanity"/);
assert.match(studioClient, /<Studio config=\{sanityStudioConfig\}/);

const proxy = read('proxy.ts');
assert.match(proxy, /["']\/studio\/:path\*["']/);
assert.match(proxy, /["']\/api\/preview\/:path\*["']/);
assert.match(proxy, /isStudioPage/);
assert.match(proxy, /isPreviewApi/);
assert.match(proxy, /isProductionEnvironment\(\)/);
assert.match(proxy, /new NextResponse\(["']Not Found["'], \{ status: 404 \}\)/);
assert.match(previewRoute, /getAdminIdentity/);
assert.match(previewRoute, /hasAdminPermission\(identity\.role, ["']draft:apply["']\)/);
const disablePreviewRoute = read('app/api/preview/disable/route.ts');
assert.match(disablePreviewRoute, /getAdminIdentity/);
assert.match(disablePreviewRoute, /hasAdminPermission\(identity\.role, ["']draft:apply["']\)/);

const sanityConfig = read('sanity.config.ts');
const sanityPresentation = read('cms/sanity/config/presentation.ts');
const sanityStructure = read('cms/sanity/config/structure.ts');
assert.match(sanityConfig, /basePath:\s*["']\/studio["']/);
assert.match(sanityConfig, /createStudioPresentationPlugin/);
assert.match(sanityConfig, /createStudioStructurePlugin/);
assert.match(sanityPresentation, /presentationTool/);
assert.match(sanityPresentation, /\/api\/preview\/enable/);
assert.match(sanityStructure, /structureTool/);
assert.match(sanityStructure, /filterStudioStructureItems/);
assert.doesNotMatch(sanityConfig, /SANITY_API_(READ|WRITE)_TOKEN/);

const sanityProvider = read('lib/content/sanity.ts');
assert.match(sanityProvider, /perspective:\s*includeDrafts \? "drafts" : "published"/);
assert.match(sanityProvider, /includeDrafts && !IS_DRAFT_PREVIEW_ALLOWED/);
assert.match(sanityProvider, /import "server-only"/);
assert.match(sanityProvider, /portableTextToArticleBlocks/);
assert.match(sanityProvider, /_type === "imageWithAlt" \|\| item\._type === "migratedImage"/);
assert.match(sanityProvider, /seoTitle: seoTitle \|\| raw\.title/, 'Article title must remain the rendered SEO title fallback');
const seoAudit = read('lib/admin/seo-audit.ts');
assert.match(seoAudit, /const effectiveSeoTitle = seo\.title\?\.trim\(\) \|\| article\.title\?\.trim\(\) \|\| ""/);
assert.match(seoAudit, /faqQuestions: z\.array\(z\.string\(\)\)\.nullish\(\)\.transform\(\(value\) => value \?\? \[\]\)/);
assert.match(sanityProvider, /status === "published" && \(!excerpt \|\| !seoDescription\)/, 'Published articles must keep required excerpt and meta description validation');
assert.match(sanityProvider, /status === "draft" \? parseRenderableBodyItems\(raw\.body\) : z\.array\(bodyItemSchema\)\.parse\(raw\.body\)/, 'Only Draft Preview may omit incomplete body blocks');
assert.match(sanityProvider, /status === "draft"[\s\S]*parseRenderableFaqItems\(raw\.faq\)[\s\S]*z\.array\(faqItemSchema\)\.parse\(raw\.faq\)/, 'Published FAQ must remain strict');
assert.match(sanityProvider, /category->slug\.current/);

const provider = read('lib/content/provider.ts');
assert.match(provider, /hasSanityConfig \? sanityContentProvider : localContentProvider/);

const blogSitemap = read('app/sitemaps/blog.xml/route.ts');
assert.match(blogSitemap, /includeDrafts:\s*false/);
assert.match(blogSitemap, /getArticleCanonical/);
assert.match(blogSitemap, /filter\(isArticleCanonicalAligned\)/);

const articlePage = read('features/blog/pages/ArticlePage.tsx');
const articlePresentation = read('features/blog/website-43/Website43Article.tsx');
const website43Shell = read('components/layout/website-43/Website43Shared.tsx');
assert.match(articlePage, /index:\s*false,\s*follow:\s*false/);
assert.match(articlePage, /isArticleCanonicalAligned\(article\) \? buildArticleSchemaGraph\(article\) : null/);
assert.match(articlePage, /Website43Article/);
assert.match(articlePage, /getArticleCanonical/);
assert.match(articlePresentation, /href="https:\/\/lin\.ee\/tqLCs4f"/);
assert.match(articlePresentation, /data-analytics-location="blog_article"/);
assert.match(website43Shell, /\/tools\/financial-health-check/);
assert.doesNotMatch(articlePage, /ฟรี|ไม่มีค่าใช้จ่าย/);

const publishedWordPressExporter = read('scripts/export-wordpress-published.mjs');
assert.match(publishedWordPressExporter, /const focusEvidencePath = process\.argv\[3\]/);
assert.match(publishedWordPressExporter, /meta\.rank_math_focus_keyword \?\? meta\.focusKeyword/);
assert.match(publishedWordPressExporter, /focusKeywordByWpId\.has\(post\.wpId\)/);
const publishedWordPressPreparer = read('scripts/prepare-wordpress-published-migration.mjs');
assert.match(publishedWordPressPreparer, /const rankMathFocusKeyword = clean\(post\.focusKeyword\)/);
assert.match(publishedWordPressPreparer, /rankMathFocusKeyword\.length > 200/);
assert.match(publishedWordPressPreparer, /focusKeyword \? \{ focusKeyword \}/);
assert.match(publishedWordPressPreparer, /rankMathFocusKeyword \? \{ rankMathFocusKeyword \}/);
assert.match(articlePage, /getArticleCategorySlug/);
assert.match(articlePage, /permanentRedirect\(getArticlePath\(article\)\)/);
assert.match(articlePage, /getMovedArticleRedirectPath/);

assert.equal(existsSync(new URL('../app/blog/[slug]/page.tsx', import.meta.url)), false, 'blog first-level dynamic segment must use one name');
const legacyArticlePage = read('features/blog/pages/BlogCategoryPage.tsx');
assert.match(legacyArticlePage, /permanentRedirect\(getArticlePath\(article\)\)/);
assert.match(legacyArticlePage, /category: slug/);
assert.doesNotMatch(legacyArticlePage, /blog-article-hero/);

const articleUrl = read('lib/content/url.ts');
assert.match(articleUrl, /normalizeArticleTaxonomy/);
assert.match(articleUrl, /getArticleCanonical/);
assert.match(articleUrl, /isArticleCanonicalAligned/);
assert.match(articleUrl, /getLegacyCategoryRedirectPath/);
const articleTaxonomy = read('lib/content/taxonomy.ts');
const blogArchive = read('features/blog/components/BlogArchive.tsx');
for (const [slug, title] of [
  ['personal-finance', 'การเงินส่วนบุคคล'],
  ['life-insurance', 'ประกันชีวิต'],
  ['investment', 'การลงทุน'],
]) {
  assert.match(articleTaxonomy, new RegExp(`slug: ["']${slug}["'], title: ["']${title}["']`));
}
assert.doesNotMatch(articleTaxonomy, /legacyTopic\s*\?\s*["']life-insurance["']/);
assert.match(articleTaxonomy, /isReservedArticleSlug/);
assert.match(blogArchive, /LEGACY_CATEGORY_TOPICS/);
assert.match(blogArchive, /!Object\.hasOwn\(LEGACY_CATEGORY_TOPICS, slug\)/);
const legacyArticles = read('lib/content/legacy.ts');
assert.doesNotMatch(legacyArticles, /category:\s*["']ประกันสุขภาพและโรคร้ายแรง["']/);
assert.match(legacyArticles, /tags:\s*\[["']ประกันสุขภาพ["'],\s*["']ประกันโรคร้ายแรง["']\]/);
assert.match(legacyArticles, /id: "legacy-wp-aia-health-happy-describe"[\s\S]*?categorySlug: "life-insurance"/);
assert.match(legacyArticles, /id: "legacy-wp-aia-health-ci-hero-guide"[\s\S]*?categorySlug: "life-insurance"/);
assert.match(legacyArticles, /id: "legacy-wp-critical-illness-insurance"[\s\S]*?categorySlug: "life-insurance"/);
assert.match(legacyArticles, /id: "legacy-wp-financial-pyramid"[\s\S]*?categorySlug: "personal-finance"/);
assert.match(publishedWordPressPreparer, /'life-insurance': 'ccpun-wp-category-4'/);
assert.doesNotMatch(publishedWordPressPreparer, /ccpun-category-(?:health-insurance|critical-illness)/);

const fhcPage = read('features/financial-health-check/page.tsx');
const fhcDescription = fhcPage.match(/const FHC_DESCRIPTION = '([^']+)'/)?.[1] ?? '';
const fhcDescriptionLength = [...new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(fhcDescription)].length;
assert.ok(fhcDescriptionLength >= 140 && fhcDescriptionLength <= 155, `FHC description must be 140-155 Thai graphemes, received ${fhcDescriptionLength}`);
assert.match(fhcDescription, /เฉพาะความคุ้มครองชีวิต/);
assert.match(read('features/financial-health-check/components/FHCLifeResultImageDownloadButton.tsx'), /ประกันไม่ใช่เงินฝาก/);
assert.match(read('features/financial-health-check/components/FHCLandingIntro.tsx'), /7 เรื่องใน 3 กลุ่มที่ควรทบทวนให้เชื่อมกัน/);

const cookiePolicy = read('app/cookie-policy/page.tsx');
const privacyPolicy = read('app/privacy/page.tsx');
const consentUi = read('features/analytics/components/CookieConsent.tsx');
for (const disclosure of [cookiePolicy, privacyPolicy, consentUi]) {
  assert.match(disclosure, /Google Analytics/);
  assert.match(disclosure, /Meta Pixel/);
  assert.match(disclosure, /Financial Health Check/);
}
assert.match(cookiePolicy, /ccpun_cookie_consent \(localStorage\)/);
assert.match(cookiePolicy, /_fbp \(สูงสุด 90 วัน\), _fbc \(เมื่อเกี่ยวข้อง\)/);
assert.doesNotMatch(cookiePolicy, /ยังไม่เปิดใช้งาน — เตรียมไว้/);
assert.doesNotMatch(cookiePolicy, /ไม่สามารถระบุตัวตนผู้ใช้แต่ละคนได้/);
assert.match(privacyPolicy, /ไม่ขายหรือให้เช่าข้อมูลส่วนบุคคล/);
assert.match(privacyPolicy, /การประมวลผลโดยผู้ให้บริการนี้ไม่ใช่การขายหรือให้เช่าข้อมูล/);
assert.match(consentUi, /Meta Pixel เพื่อการวัดผลและการตลาด/);
assert.match(consentUi, /บันทึกการตั้งค่า/);
assert.match(consentUi, /การจัดเก็บสถานะความยินยอมที่จำเป็น/);
assert.match(consentUi, /บันทึกตัวเลือกความยินยอมไว้ใน localStorage เพื่อให้เว็บไซต์ใช้ตัวเลือกเดิมควบคุมแท็ก/);
assert.doesNotMatch(consentUi, /คุกกี้ที่มีความจำเป็นต่อการใช้งานเว็บไซต์|ช่วยให้เว็บไซต์ทำงานได้อย่างถูกต้อง/);
assert.match(consentUi, /const \[performance, setPerformance\] = useState\(false\)/);
assert.match(consentUi, /setPerformance\(consent\?\.performance \?\? false\)/);
assert.match(consentUi, /status: 'accepted_all',[\s\S]*?performance: true/);
assert.match(consentUi, /status: 'custom',[\s\S]*?performance,/);
assert.match(consentUi, /toggleId="toggle-performance"/);
assert.match(consentUi, /ยังไม่ใช้คุกกี้หรือบริการบุคคลที่สามในหมวดนี้/);
assert.match(cookiePolicy, /คุกกี้เพื่อเพิ่มประสิทธิภาพ — ยังไม่ใช้งาน/);
assert.match(cookiePolicy, /บันทึกเฉพาะสถานะความยินยอมไว้ใน ccpun_cookie_consent บน localStorage/);
assert.match(cookiePolicy, /หากล้างข้อมูลเว็บไซต์ ระบบจะถามตัวเลือกอีกครั้ง/);
assert.doesNotMatch(cookiePolicy, /ไม่ได้ — จำเป็นต่อการทำงานของเว็บไซต์|ปิดไม่ได้ — จำเป็นต่อการทำงานของเว็บไซต์/);
assert.doesNotMatch(consentUi, /ตกลงการตั้งค่า/);

const navbar = read('components/layout/Navbar.tsx');
assert.match(navbar, /href="\/blog\/"/);


const articleSchema = read('lib/content/structured-data/article-schema.ts');
assert.match(articleSchema, /article\.status !== "published"/);
assert.match(articleSchema, /"@type": "BlogPosting"/);
assert.match(articleSchema, /"@type": "BreadcrumbList"/);
assert.match(articleSchema, /getArticleCanonical/);
assert.match(articleSchema, /"@type": "FAQPage"/);

const articleFaq = read('features/blog/components/ArticleFaq.tsx');
assert.match(articleFaq, /คำถามที่พบบ่อย/);
assert.match(articlePresentation, /article\.faq\.map/);
assert.match(articlePresentation, /<details className=\{styles\.faqItem\}/);

const sanityModel = read('cms/sanity/content-model.ts');
assert.match(sanityModel, /reviewWorkflow/);
assert.match(sanityModel, /faqItem/);
assert.match(sanityModel, /reviewMetadata/);
assert.match(sanityModel, /FAQPage structured data may only be emitted/);

const sanitySchema = read('cms/sanity/schema.ts');
const sanityDocuments = [
  'cms/sanity/schema/documents/article.ts',
  'cms/sanity/schema/documents/author.ts',
  'cms/sanity/schema/documents/category.ts',
].map(read).join('\n');
const sanityObjects = [
  'faq-item', 'source-reference', 'review-metadata', 'migration-source', 'seo-metadata',
  'geo-metadata', 'image-with-alt', 'migrated-image', 'table', 'divider', 'callout',
  'image-gallery', 'cta-block', 'pdf-download', 'details-block', 'portable-text',
].map((name) => read(`cms/sanity/schema/objects/${name}.ts`)).join('\n');
const sanityDefinitions = `${sanityDocuments}\n${sanityObjects}`;
assert.match(sanitySchema, /export \{ schemaTypes \} from "\.\/schema\/index"/);
assert.match(sanityDefinitions, /defineArrayMember\(\{ type: "imageWithAlt" \}\)/);
assert.match(sanityDefinitions, /rankMathFocusKeyword/);
assert.match(sanityDefinitions, /name: "contentUpdatedAt"/);
assert.match(sanityProvider, /coalesce\(contentUpdatedAt, migration\.sourceModifiedAt, _updatedAt\)/);
for (const schemaType of ['article', 'author', 'category', 'faqItem', 'sourceReference', 'reviewMetadata', 'seoMetadata', 'geoMetadata', 'imageWithAlt', 'portableText']) {
  assert.match(sanityDefinitions, new RegExp(`name: ["']${schemaType}["']`));
}

// Block Contract gate: every Studio body block must have a data parser and a public renderer.
const portableTextDefinition = read('cms/sanity/schema/objects/portable-text.ts');
const portableTextMembers = [...portableTextDefinition.matchAll(/defineArrayMember\(\{\s*type:\s*["']([^"']+)["']/g)].map((match) => match[1]);
assert.deepEqual(portableTextMembers, [
  'block',
  'callout',
  'imageWithAlt',
  'imageGallery',
  'ctaBlock',
  'pdfDownload',
  'detailsBlock',
  'migratedImage',
  'simpleTable',
  'divider',
]);
const articleBodyRenderer = read('features/blog/components/ArticleBody.tsx');
assert.match(articleBodyRenderer, /ArticleTableOfContents/);
assert.match(articleBodyRenderer, /id=\{headingId\(index\)\}/);
for (const [schemaType, publicType] of [
  ['callout', 'callout'],
  ['imageWithAlt', 'image'],
  ['imageGallery', 'gallery'],
  ['ctaBlock', 'cta'],
  ['pdfDownload', 'pdf'],
  ['detailsBlock', 'details'],
  ['migratedImage', 'image'],
  ['simpleTable', 'table'],
  ['divider', 'divider'],
]) {
  assert.match(sanityProvider, new RegExp(`literal\\(["']${schemaType}["']\\)`), `${schemaType} requires a validated Sanity parser`);
  assert.match(articleBodyRenderer, new RegExp(`block\\.type === ["']${publicType}["']`), `${schemaType} requires a public renderer`);
}

const deploymentEnvironment = read('lib/deployment-environment.ts');
assert.match(deploymentEnvironment, /VERCEL_ENV === "preview"/);
assert.match(deploymentEnvironment, /CCPUN_UAT_MODE === "1"/);
assert.match(deploymentEnvironment, /APP_ENVIRONMENT === "production-admin"/);
assert.match(deploymentEnvironment, /IS_ADMIN_APPLICATION = \["local-uat", "local-production", "lab", "uat", "admin-uat", "production-admin"\]\.includes\(APP_ENVIRONMENT\)/);
assert.match(deploymentEnvironment, /VERCEL_ENV === "production"/);
assert.match(deploymentEnvironment, /CCPUN_ENABLE_PRODUCTION_ANALYTICS === "1"/);

const securityPolicy = read('lib/security-policy.ts');
assert.match(securityPolicy, /import \{ IS_REVIEW_ENVIRONMENT \} from ["']\.\/deployment-environment["']/);
assert.match(
  securityPolicy,
  /const SANITY_REVIEW_SCRIPT_SOURCES = IS_REVIEW_ENVIRONMENT\s*\?\s*["'] https:\/\/core\.sanity-cdn\.com["']\s*:\s*["']["']/,
);
assert.match(securityPolicy, /const SANITY_PROJECT_ID = process\.env\.NEXT_PUBLIC_SANITY_PROJECT_ID \?\? ["']["']/);
assert.match(securityPolicy, /\/\^\[a-z0-9\]\+\$\//);
assert.match(securityPolicy, /https:\/\/\$\{SANITY_PROJECT_ID\}\.api\.sanity\.io/);
assert.match(securityPolicy, /wss:\/\/\$\{SANITY_PROJECT_ID\}\.api\.sanity\.io/);
assert.match(securityPolicy, /script-src[^`]*\$\{SANITY_REVIEW_SCRIPT_SOURCES\}/);
assert.match(securityPolicy, /environment !== ["']local-uat["']/);
assert.match(securityPolicy, /ENFORCE_HTTPS \? \[["']upgrade-insecure-requests["']\] : \[\]/);
assert.match(securityPolicy, /connect-src[^`]*\$\{SANITY_CONNECT_SOURCES\}[^`]*\$\{SANITY_REVIEW_CONNECT_SOURCES\}/);
assert.equal((securityPolicy.match(/core\.sanity-cdn\.com/g) ?? []).length, 1);
assert.equal((securityPolicy.match(/https:\/\/\*\.sanity-cdn\.com/g) ?? []).length, 1);
assert.equal((securityPolicy.match(/https:\/\/sanity-cdn\.com/g) ?? []).length, 1);
assert.doesNotMatch(securityPolicy, /\*\.api\.sanity\.io/);
assert.match(securityPolicy, /IS_DEVELOPMENT \? ["'] 'unsafe-eval'["'] : ["']["']/);

assert.match(studioPage, /["']darkreader-lock["']:\s*["']true["']/);

const robotsRoute = read('app/robots.ts');
assert.match(robotsRoute, /IS_REVIEW_ENVIRONMENT/);
assert.match(robotsRoute, /disallow: "\/"/);

assert.match(nextConfig, /X-Robots-Tag/);
assert.match(nextConfig, /noindex, nofollow, noarchive/);
assert.match(nextConfig, /source:\s*["']\/:path\*["'],\s*headers:\s*\[\.\.\.SECURITY_HEADERS, \.\.\.REVIEW_HEADERS\]/);
assert.match(nextConfig, /source:\s*["']\/snt-admin\/:path\*["'],\s*headers:\s*PRIVATE_SURFACE_ROBOTS_HEADERS/);
assert.match(nextConfig, /source:\s*["']\/studio\/:path\*["'],\s*headers:\s*PRIVATE_SURFACE_ROBOTS_HEADERS/);
assert.match(nextConfig, /source:\s*["']\/api\/snt-admin\/:path\*["'],\s*headers:\s*PRIVATE_ADMIN_API_HEADERS/);
assert.match(nextConfig, /source:\s*["']\/api\/preview\/:path\*["'],\s*headers:\s*PRIVATE_ADMIN_API_HEADERS/);
assert.match(nextConfig, /Cache-Control["'], value: ["']private, no-cache, no-store, max-age=0, must-revalidate/);
assert.match(nextConfig, /PRIVATE_SURFACE_ROBOTS_HEADERS = \[\{ key: ["']X-Robots-Tag["'], value: ["']noindex, nofollow, noarchive["'] \}\]/);

assert.match(proxy, /environment === ["']production-admin["']/);
assert.match(proxy, /environment === ["']local-uat["']/);
assert.match(proxy, /isLocalAdminHost\(request\.headers\.get\(["']host["']\), environment\)/);
assert.match(proxy, /isConfiguredAdminOrigin\(request\.url, process\.env\.AUTH_URL\)/);
assert.match(proxy, /pathname\.startsWith\(["']\/api\/["']\)/);
assert.match(proxy, /ccpun-admin-prod\.vercel\.app/);
assert.match(proxy, /ccpun-admin\.vercel\.app/);
assert.match(proxy, /admin\.ccpun\.com/);
assert.match(proxy, /["']\/api\/auth\/:path\*["']/);

const rootLayout = read('app/layout.tsx');
assert.match(rootLayout, /<html[^>]*suppressHydrationWarning/);
assert.match(rootLayout, /<html lang="th"/);
assert.match(rootLayout, /PRODUCTION_ANALYTICS_ENABLED/);
assert.match(rootLayout, /const GTM_ID = PRODUCTION_ANALYTICS_ENABLED \? "GTM-5DKMGSK3" : ""/);
assert.match(rootLayout, /<ClientWidgets gaId=\{GA_ID\} gtmId=\{GTM_ID\} metaPixelId=\{META_PIXEL_ID\} \/>/);
assert.match(rootLayout, /robots: IS_ADMIN_APPLICATION \|\| IS_REVIEW_ENVIRONMENT/);
assert.match(rootLayout, /openGraph: IS_ADMIN_APPLICATION \? null/);
assert.match(rootLayout, /twitter: IS_ADMIN_APPLICATION \? null/);
assert.match(rootLayout, /alternates: IS_ADMIN_APPLICATION \? \{ canonical: null \}/);
assert.match(rootLayout, /!IS_ADMIN_APPLICATION \? <script type="application\/ld\+json"/);
assert.match(rootLayout, /SanityLive includeDrafts=\{IS_DRAFT_PREVIEW_ALLOWED && isDraftMode\}/);
assert.match(rootLayout, /IS_DRAFT_PREVIEW_ALLOWED && isDraftMode \? <VisualEditing \/> : null/);
assert.match(deploymentEnvironment, /IS_DRAFT_PREVIEW_ALLOWED = isAdminReadDataPlaneAllowed/);

const clientWidgets = read('features/analytics/components/ClientWidgets.tsx');
assert.match(clientWidgets, /import \{ usePathname \} from ['"]next\/navigation['"]/);
assert.match(clientWidgets, /pathname === ['"]\/snt-admin['"]/);
assert.match(clientWidgets, /pathname\.startsWith\(['"]\/snt-admin\/['"]\)/);
assert.match(clientWidgets, /pathname === ['"]\/studio['"]/);
assert.match(clientWidgets, /pathname\.startsWith\(['"]\/studio\/['"]\)/);
assert.match(clientWidgets, /if \(isPrivateSurface\) return null/);

const gtmSource = read('features/analytics/components/GoogleTagManager.tsx');
for (const deniedSignal of ['ad_storage', 'analytics_storage', 'ad_user_data', 'ad_personalization']) {
  assert.match(gtmSource, new RegExp(`${deniedSignal}: 'denied'`));
}
assert.match(gtmSource, /if \(document\.getElementById\('gtm-script'\)\) return false/);

const analyticsSource = read('lib/analytics.ts');
assert.match(analyticsSource, /NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED !== 'true'/);
assert.match(analyticsSource, /if \(!consent\.analytics && !consent\.social\) return null/);
assert.match(analyticsSource, /event: 'ccpun_event'/);
assert.match(analyticsSource, /event_schema_version: 1/);
assert.match(analyticsSource, /if \(!event\.ga\.length && event\.meta === 'none'\) return/);
assert.match(analyticsSource, /window\.dataLayer\.push\(semanticEvent\);\s*return;/);

const analyticsRegression = read('tests/analytics-regression.ts');
assert.match(analyticsRegression, /discard calculator values/);
assert.match(analyticsRegression, /semantic event layer must fail closed without consent/);

for (const landingSource of [
  read('features/ci-planning/components/CILandingIntro.tsx'),
  read('features/financial-health-check/components/LifeCoverageWizard.tsx'),
]) {
  assert.match(landingSource, /landingTrackedRef/);
  assert.match(landingSource, /landingTrackedRef\.current \|\| !getConsentData\(\)\?\.analytics/);
  assert.match(landingSource, /NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED === 'true' && !document\.getElementById\('gtm-script'\)/);
  assert.match(landingSource, /const queueLanding = \(\) => queueMicrotask\(trackLanding\)/);
  assert.match(landingSource, /addEventListener\('ccpun:consent', queueLanding\)/);
  assert.match(landingSource, /addEventListener\('ccpun:gtm-ready', queueLanding\)/);
}

const trackingQa = read('qa/tracking-consent-regression.mjs');
for (const contractCheck of [
  'pre-consent loads no GA script',
  'pre-consent loads GTM-5DKMGSK3 once',
  'pre-consent loads no Meta script',
  'repeat consent does not duplicate GTM script',
  'reject leaves no tracking cookie',
  'repeat accepted consent keeps fhc_landing_view at one',
]) {
  assert.match(trackingQa, new RegExp(contractCheck));
}

const adminLoginPage = read('app/snt-admin/(auth)/login/page.tsx');
const protectedAdminLayout = read('app/snt-admin/(protected)/layout.tsx');
for (const adminSurface of [adminLoginPage, protectedAdminLayout]) {
  assert.match(adminSurface, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false,\s*nocache:\s*true\s*\}/);
}
assert.match(rootLayout, /href="#main-content"/);
assert.match(protectedAdminLayout, /<main id="main-content"/);
assert.doesNotMatch(protectedAdminLayout, /admin-skip-link/);

for (const tablePage of [
  read('app/snt-admin/(protected)/content/page.tsx'),
  read('app/snt-admin/(protected)/seo/page.tsx'),
  read('app/snt-admin/(protected)/audit/page.tsx'),
]) {
  assert.match(tablePage, /text-white\/60 xl:hidden/);
}

const publicDiscoverySurface = [
  read('components/layout/Navbar.tsx'),
  read('lib/nav-config.json'),
  read('public/nav-config.json'),
  read('app/sitemap.xml/route.ts'),
  read('app/sitemaps/core.xml/route.ts'),
  read('app/sitemaps/tools.xml/route.ts'),
  read('app/sitemaps/blog.xml/route.ts'),
].join('\n');
assert.doesNotMatch(publicDiscoverySurface, /\/snt-admin\//, 'Admin routes must stay out of public navigation and sitemaps');

const reviewPage = read('app/snt-admin/(protected)/reviews/page.tsx');
const seoPage = read('app/snt-admin/(protected)/seo/page.tsx');
assert.match(reviewPage, /\/studio\/structure\/article;/, 'Review preview must use the working Studio structure route');
assert.match(seoPage, /\/studio\/structure\/article;/, 'SEO Studio action must use the working Studio structure route');
assert.doesNotMatch(reviewPage, /\/studio\/intent\/edit\//, 'Review preview must not use the trailing-slash-broken Studio intent route');

await import('./website43-blog-article-regression.mjs');

console.log('PASS: Vercel-native regression');
