import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const homepageRoot = path.resolve(here, '..');
const defaultInput = path.resolve(homepageRoot, '../UAT-Reports/Published-Blog-Migration-2026-08-19/published-wordpress-export.json');
const defaultOutput = path.resolve(homepageRoot, '../UAT-Reports/Published-Blog-Migration-2026-08-19/published-migration-prepared.json');
const defaultNdjson = path.resolve(homepageRoot, '../UAT-Reports/Published-Blog-Migration-2026-08-19/published-migration-drafts.ndjson');
const assetRoot = path.resolve(homepageRoot, 'public/assets/blog-migration');
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

const inputPath = path.resolve(process.argv[2] || defaultInput);
const outputPath = path.resolve(process.argv[3] || defaultOutput);
const ndjsonPath = path.resolve(process.argv[4] || defaultNdjson);
let source;

const hash = (value, length = 16) => createHash('sha256').update(String(value)).digest('hex').slice(0, length);
const legacyUrlLedger = JSON.parse(await readFile(new URL('../qa/legacy-url-ledger.json', import.meta.url), 'utf8'));
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const safeFilename = (value) => {
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch {}
  const cleaned = decoded.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || `asset-${hash(value, 10)}`;
};
const reviewedCategories = new Map([
  ['personal-finance', { title: 'การเงินส่วนบุคคล', slug: 'personal-finance', documentId: 'ccpun-category-personal-finance' }],
  ['life-insurance', { title: 'ประกันชีวิต', slug: 'life-insurance', documentId: 'ccpun-category-life-insurance' }],
  ['health-insurance', { title: 'ประกันสุขภาพ', slug: 'health-insurance', documentId: 'ccpun-wp-category-127' }],
  ['critical-illness-insurance', { title: 'ประกันโรคร้ายแรง', slug: 'critical-illness-insurance', documentId: 'ccpun-category-critical-illness' }],
]);
const ledgerById = new Map(legacyUrlLedger.mappings.map((mapping) => [mapping.id, mapping]));

function normalizeMigrationTags(tags = []) {
  const seen = new Set();
  const output = [];
  for (const value of tags) {
    const tag = clean(value);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    output.push(tag);
  }
  return output;
}

export function normalizeWordPressTaxonomy({ categoryTitle, categorySlug, tags }) {
  const category = reviewedCategories.get(String(categorySlug ?? '').trim().toLowerCase()) ?? null;
  if (!category) throw new Error(`Refusing migration preparation: unknown WordPress category ${categorySlug || categoryTitle || 'missing'}`);
  return { category: { ...category }, tags: normalizeMigrationTags(tags) };
}

function migrationRoute({ wpId, sourceCategory, sourceCategorySlug, ledgerId }) {
  const mapping = ledgerById.get(ledgerId);
  if (!mapping || mapping.state !== 'live' || mapping.sourceStatus !== 301 || mapping.destinationStatus !== 200) {
    throw new Error(`Refusing migration preparation: invalid frozen legacy mapping ${ledgerId}`);
  }
  const source = new URL(mapping.source);
  const destination = new URL(mapping.destination);
  if (source.origin !== 'https://blog.ccpun.com' || destination.origin !== 'https://ccpun.com' || source.search || source.hash || destination.search || destination.hash) {
    throw new Error(`Refusing migration preparation: unsafe frozen legacy mapping ${ledgerId}`);
  }
  const category = normalizeWordPressTaxonomy({ categoryTitle: sourceCategory, categorySlug: sourceCategorySlug, tags: [] }).category;
  const sourceSlug = source.pathname.split('/').filter(Boolean)[0] ?? '';
  return { wpId, sourceCategory, sourceCategorySlug, ledgerId, sourceSlug, destination: destination.href, category };
}

const migrationRoutes = {
  'aia-vitality': migrationRoute({ wpId: 413, sourceCategory: 'ประกันชีวิต', sourceCategorySlug: 'life-insurance', ledgerId: 'aia-vitality' }),
  'aia-health-ci-hero-guide': migrationRoute({ wpId: 359, sourceCategory: 'ประกันสุขภาพและโรคร้ายแรง', sourceCategorySlug: 'health-insurance', ledgerId: 'aia-health-ci-hero' }),
  'aia-health-happy-describe': migrationRoute({ wpId: 196, sourceCategory: 'ประกันสุขภาพและโรคร้ายแรง', sourceCategorySlug: 'health-insurance', ledgerId: 'aia-health-happy' }),
  'critical-illness-insurance': migrationRoute({ wpId: 233, sourceCategory: 'ประกันสุขภาพและโรคร้ายแรง', sourceCategorySlug: 'critical-illness-insurance', ledgerId: 'critical-illness-insurance' }),
  'financial-pyramid': migrationRoute({ wpId: 95, sourceCategory: 'การเงินส่วนบุคคล', sourceCategorySlug: 'personal-finance', ledgerId: 'financial-pyramid' }),
};
if (isMain) {
  source = JSON.parse(await readFile(inputPath, 'utf8'));
  if (source?.source !== 'https://blog.ccpun.com' || source?.status !== 'published' || source?.count !== 5 || !Array.isArray(source.posts)) {
    throw new Error('Refusing migration preparation: unexpected published WordPress inventory');
  }
  const slugs = new Set(source.posts.map((post) => post.slug));
  if (source.posts.length !== Object.keys(migrationRoutes).length || slugs.size !== Object.keys(migrationRoutes).length || source.posts.some((post) => {
    const expected = migrationRoutes[post.slug];
    return !expected || expected.sourceSlug !== post.slug || post.wpId !== expected.wpId || post.category !== expected.sourceCategory;
  })) {
    throw new Error('Refusing migration preparation: published WordPress inventory mismatch');
  }
}

export function rewriteHref(input) {
  const value = String(input ?? '').trim();
  if (!value || value.length > 2048) return '';
  if (value.startsWith('#')) return value;
  try {
    const url = new URL(value, 'https://blog.ccpun.com/');
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) return '';
    if (url.protocol === 'mailto:' || url.protocol === 'tel:') return value;
    if (url.username || url.password) return '';
    if (url.hostname !== 'blog.ccpun.com') return url.href;
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    const slug = pathname.split('/').filter(Boolean)[0];
    if (migrationRoutes[slug]) { const destination = new URL(migrationRoutes[slug].destination); destination.search = url.search; destination.hash = url.hash; return destination.href; }
    return url.href;
  } catch {
    return '';
  }
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const imageTypes = new Map([
  ['.avif', { contentType: 'image/avif', format: 'heif' }],
  ['.gif', { contentType: 'image/gif', format: 'gif' }],
  ['.jpeg', { contentType: 'image/jpeg', format: 'jpeg' }],
  ['.jpg', { contentType: 'image/jpeg', format: 'jpeg' }],
  ['.png', { contentType: 'image/png', format: 'png' }],
  ['.webp', { contentType: 'image/webp', format: 'webp' }],
]);

export function parseApprovedImageUrl(input) {
  const parsed = new URL(input);
  const extension = path.extname(parsed.pathname).toLowerCase();
  const authority = String(input).match(/^https:\/\/([^/?#]+)/)?.[1];
  if (authority !== 'blog.ccpun.com' || parsed.origin !== 'https://blog.ccpun.com' || parsed.username || parsed.password || parsed.port || !parsed.pathname.startsWith('/wp-content/uploads/') || !imageTypes.has(extension)) {
    throw new Error('Refusing migration image outside approved WordPress uploads origin');
  }
  return { parsed, expectedImage: imageTypes.get(extension) };
}

export async function fetchValidatedImage(input, fetchImpl = fetch) {
  const { parsed, expectedImage } = parseApprovedImageUrl(input);
  const response = await fetchImpl(parsed.href, {
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
    headers: { 'user-agent': 'CCPun migration asset copy/2026-08-19' },
  });
  if ((response.status >= 300 && response.status < 400) || response.redirected || (response.url && response.url !== parsed.href)) {
    throw new Error(`Refusing redirected migration image: ${input}`);
  }
  if (!response.ok) throw new Error(`Image fetch failed ${response.status}: ${input}`);
  const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== expectedImage.contentType) throw new Error(`Unexpected migration image content type: ${contentType || 'missing'}`);
  const contentLength = response.headers.get('content-length');
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_IMAGE_BYTES)) {
    throw new Error('Migration image exceeds maximum size');
  }
  if (!response.body) throw new Error('Migration image response has no body');
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.byteLength;
    if (total > MAX_IMAGE_BYTES) throw new Error('Migration image exceeds maximum size');
    chunks.push(Buffer.from(chunk));
  }
  const bytes = Buffer.concat(chunks, total);
  const metadata = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
  if (!metadata.width || !metadata.height || metadata.format !== expectedImage.format) throw new Error(`Unable to validate migration image: ${input}`);
  return { bytes, metadata, parsed };
}

async function downloadImage(url, slug, role, index) {
  const { bytes, metadata, parsed } = await fetchValidatedImage(url);
  const sourceName = safeFilename(parsed.pathname.split('/').pop() || `image-${index}.webp`);
  const filename = `${role}-${String(index).padStart(2, '0')}-${sourceName}`;
  const dir = path.join(assetRoot, slug);
  const output = path.join(dir, filename);
  const temporary = `${output}.${process.pid}.${hash(bytes, 10)}.tmp`;
  await mkdir(dir, { recursive: true });
  try {
    await writeFile(temporary, bytes, { flag: 'wx' });
    await rename(temporary, output);
  } finally {
    await unlink(temporary).catch(() => {});
  }
  return {
    sourceUrl: url,
    localSrc: `/assets/blog-migration/${slug}/${filename}`,
    width: metadata.width,
    height: metadata.height,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function buildRichChildren(element, post) {
  const markDefs = [];
  const spans = [];
  const walk = (node, inheritedMarks = []) => {
    if (node.nodeType === 3) {
      const text = String(node.nodeValue ?? '').replace(/\s+/g, ' ');
      if (text) spans.push({ _key: hash(`${post.wpId}:span:${spans.length}:${text}`), _type: 'span', marks: inheritedMarks, text });
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (['script','style','noscript'].includes(tag)) return;
    if (tag === 'br') {
      spans.push({ _key: hash(`${post.wpId}:br:${spans.length}`), _type: 'span', marks: inheritedMarks, text: '\n' });
      return;
    }
    let marks = [...inheritedMarks];
    if (tag === 'strong' || tag === 'b') marks = [...marks, 'strong'];
    if (tag === 'em' || tag === 'i') marks = [...marks, 'em'];
    if (tag === 'a') {
      const href = rewriteHref(node.getAttribute('href') || '');
      if (href) {
        const key = `link-${hash(`${post.wpId}:${href}:${markDefs.length}`, 12)}`;
        markDefs.push({ _key: key, _type: 'link', href });
        marks = [...marks, key];
      }
    }
    for (const child of node.childNodes) walk(child, marks);
  };
  for (const child of element.childNodes) walk(child, []);
  const merged = [];
  for (const span of spans) {
    if (!span.text) continue;
    const previous = merged.at(-1);
    if (previous && JSON.stringify(previous.marks) === JSON.stringify(span.marks)) previous.text += span.text;
    else merged.push(span);
  }
  if (!merged.length) merged.push({ _key: hash(`${post.wpId}:empty-span:${clean(element.textContent)}`), _type: 'span', marks: [], text: clean(element.textContent) });
  return { children: merged, markDefs };
}

function buildBody(contentHtml, post, imageMap) {
  const doc = new JSDOM(`<body>${contentHtml}</body>`, { url: post.sourceUrl }).window.document;
  const blocks = [];
  let seq = 0;
  const key = (suffix) => hash(`${post.wpId}:${seq++}:${suffix}`);

  const addTextBlock = (element, style = 'normal', listItem) => {
    const clone = element.cloneNode(true);
    for (const hidden of clone.querySelectorAll('script,style,noscript,[hidden],[aria-hidden="true"]')) hidden.remove();
    const text = clean(clone.textContent);
    if (!text) return;
    const rich = buildRichChildren(clone, post);
    blocks.push({
      _key: key(`${style}:${text}`),
      _type: 'block',
      style,
      ...(listItem ? { listItem, level: 1 } : {}),
      ...rich,
    });
  };

  const addImage = (img, figure) => {
    const absolute = img.src || img.getAttribute('src') || '';
    const mapped = imageMap.get(absolute);
    if (!mapped) throw new Error(`Missing copied image mapping for ${post.slug}: ${absolute}`);
    const caption = clean(figure?.querySelector('figcaption')?.textContent);
    blocks.push({
      _key: key(`image:${absolute}`),
      _type: 'migratedImage',
      src: mapped.localSrc,
      alt: clean(img.alt) || post.title,
      width: mapped.width,
      height: mapped.height,
      ...(caption ? { caption } : {}),
    });
  };

  const visit = (node) => {
    if (node.nodeType === 3) {
      const text = clean(node.nodeValue);
      if (text) {
        const p = doc.createElement('p');
        p.textContent = text;
        addTextBlock(p);
      }
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (['script','style','noscript'].includes(tag)) return;
    if (tag === 'p') return addTextBlock(node, 'normal');
    if (tag === 'h1' || tag === 'h2') return addTextBlock(node, 'h2');
    if (tag === 'h3' || tag === 'h4') return addTextBlock(node, 'h3');
    if (tag === 'blockquote') return addTextBlock(node, 'blockquote');
    if (tag === 'ul' || tag === 'ol') {
      const listItem = tag === 'ul' ? 'bullet' : 'number';
      for (const li of [...node.children].filter((child) => child.tagName?.toLowerCase() === 'li')) {
        const clone = li.cloneNode(true);
        for (const nested of clone.querySelectorAll('ul,ol')) nested.remove();
        addTextBlock(clone, 'normal', listItem);
        for (const nested of li.querySelectorAll(':scope > ul, :scope > ol')) visit(nested);
      }
      return;
    }
    if (tag === 'figure') {
      const table = node.querySelector(':scope > table');
      if (table) return visit(table);
      const img = node.querySelector(':scope > img, :scope > a > img');
      if (img) return addImage(img, node);
      for (const child of node.childNodes) visit(child);
      return;
    }
    if (tag === 'img') return addImage(node, null);
    if (tag === 'table') {
      const headerRow = node.querySelector('thead tr') || [...node.querySelectorAll('tr')].find((row) => row.querySelector('th'));
      const headers = headerRow ? [...headerRow.children].map((cell) => clean(cell.textContent)) : [];
      const allRows = [...node.querySelectorAll('tr')];
      const bodyRows = allRows.filter((row) => row !== headerRow).map((row) => [...row.children].map((cell) => clean(cell.textContent))).filter((row) => row.some(Boolean));
      blocks.push({ _key: key('table'), _type: 'simpleTable', headers, rows: bodyRows });
      return;
    }
    if (tag === 'hr') {
      blocks.push({ _key: key('divider'), _type: 'divider' });
      return;
    }
    for (const child of node.childNodes) visit(child);
  };

  for (const child of doc.body.childNodes) visit(child);
  return blocks;
}

if (isMain) {
const preparedPosts = [];
for (const post of source.posts) {
  const route = migrationRoutes[post.slug];
  const { category, tags } = normalizeWordPressTaxonomy({
    categoryTitle: route.sourceCategory,
    categorySlug: route.sourceCategorySlug,
    tags: post.tags,
  });
  const imageUrls = [...new Set([post.featuredImage?.src, ...(post.bodyImages || []).map((image) => image.src)].filter(Boolean))];
  const imageMap = new Map();
  let imageIndex = 1;
  for (const url of imageUrls) {
    const role = url === post.featuredImage?.src ? 'featured' : 'body';
    const copied = await downloadImage(url, post.slug, role, imageIndex++);
    imageMap.set(url, copied);
  }
  const featured = post.featuredImage?.src ? imageMap.get(post.featuredImage.src) : null;
  const body = buildBody(post.contentHtml, post, imageMap);
  const rankMathFocusKeyword = clean(post.focusKeyword);
  if (rankMathFocusKeyword.length > 200) throw new Error(`Focus keyword evidence is too long for WordPress ID ${post.wpId}`);
  const [focusKeyword] = rankMathFocusKeyword.split(',').map(clean).filter(Boolean);
  const revision = hash(JSON.stringify({
    wpId: post.wpId,
    slug: post.slug,
    title: post.title,
    seoTitle: post.seoTitle,
    metaDescription: post.metaDescription,
    focusKeyword: rankMathFocusKeyword,
    contentHtml: post.contentHtml,
    category,
    tags,
    publishedAt: post.articlePublishedAt || post.publishedAt,
    modifiedAt: post.modifiedAt,
    assets: [...imageMap.values()].map(({ sourceUrl, sha256 }) => ({ sourceUrl, sha256 })),
    body,
    parserVersion: 'published-migration-v2',
  }), 24);
  const articleId = `ccpun-wp-published-${post.wpId}`;
  const article = {
    _id: `drafts.${articleId}`,
    _type: 'article',
    title: post.title,
    slug: { _type: 'slug', current: post.slug },
    excerpt: post.excerpt,
    category: { _type: 'reference', _ref: category.documentId, _weak: true },
    tags,
    author: { _type: 'reference', _ref: 'ccpun-prod-mirror-author-ccpun' },
    ...(featured ? {
      migratedFeaturedImage: {
        _type: 'migratedImage',
        src: featured.localSrc,
        alt: clean(post.featuredImage?.alt) || post.title,
        width: featured.width,
        height: featured.height,
      },
    } : {}),
    body,
    faq: [],
    sources: [],
    review: {
      _type: 'reviewMetadata',
      status: 'approved',
      contentReviewedAt: new Date().toISOString(),
      notes: `Migration copy of live WordPress Published ID ${post.wpId}. No editorial rewrite. Verify visual/content parity before cutover.`,
    },
    seo: {
      _type: 'seoMetadata',
      title: post.seoTitle || post.title,
      description: post.metaDescription || post.excerpt,
      ...(focusKeyword ? { focusKeyword } : {}),
      noindex: false,
    },
    contentUpdatedAt: post.modifiedAt || post.articlePublishedAt || post.publishedAt,
    migration: {
      _type: 'migrationSource',
      platform: 'WordPress',
      sourceId: post.wpId,
      sourceStatus: 'published',
      sourceRevision: revision,
      disposition: 'published-1to1-migration',
      sourceCreatedAt: post.articlePublishedAt || post.publishedAt,
      sourceModifiedAt: post.modifiedAt || post.articlePublishedAt || post.publishedAt,
      importedAt: new Date().toISOString(),
      sourceHtml: post.contentHtml,
      sourceExcerptHtml: post.excerpt,
      sourceCategories: [post.category],
      sourceTags: post.tags,
      rankMathTitle: post.seoTitle || post.title,
      rankMathDescription: post.metaDescription || post.excerpt,
      ...(rankMathFocusKeyword ? { rankMathFocusKeyword } : {}),
      rankMathCanonical: post.canonical,
      rankMathRobots: 'index,follow',
      ...(post.featuredImage?.src ? {
        featuredImageUrl: post.featuredImage.src,
        featuredImageAlt: clean(post.featuredImage.alt) || post.title,
      } : {}),
    },
    publishedAt: post.articlePublishedAt || post.publishedAt,
  };
  preparedPosts.push({
    wpId: post.wpId,
    slug: post.slug,
    oldUrl: post.sourceUrl,
    newUrl: route.destination,
    sourceTextLength: post.contentTextLength,
    bodyBlocks: body.length,
    copiedAssets: [...imageMap.values()],
    sourceRevision: revision,
    article,
  });
}

const documents = preparedPosts.map((post) => post.article);
if (documents.some((document) => !document._id.startsWith('drafts.'))) throw new Error('Prepared migration contains non-draft document IDs');

const prepared = {
  generatedAt: new Date().toISOString(),
  source: source.source,
  mode: 'draft-only',
  count: preparedPosts.length,
  mappings: preparedPosts.map(({ wpId, slug, oldUrl, newUrl, sourceTextLength, bodyBlocks, copiedAssets, sourceRevision }) => ({ wpId, slug, oldUrl, newUrl, sourceTextLength, bodyBlocks, copiedAssets, sourceRevision })),
  documents,
};
await writeFile(outputPath, `${JSON.stringify(prepared, null, 2)}\n`, 'utf8');
await writeFile(ndjsonPath, `${documents.map((document) => JSON.stringify(document)).join('\n')}\n`, 'utf8');
console.log(JSON.stringify({
  ok: true,
  posts: preparedPosts.length,
  supportDocs: 0,
  documents: documents.length,
  totalAssets: preparedPosts.reduce((sum, post) => sum + post.copiedAssets.length, 0),
  mappings: preparedPosts.map((post) => ({ slug: post.slug, oldUrl: post.oldUrl, newUrl: post.newUrl, blocks: post.bodyBlocks, assets: post.copiedAssets.length })),
  outputPath,
  ndjsonPath,
}));
}
