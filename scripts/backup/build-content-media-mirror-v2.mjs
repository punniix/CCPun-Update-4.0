import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@sanity/client';

const PROJECT_ID = 'kyfxgjnq';
const DATASET = 'production';
const token = process.env.SANITY_AUTH_TOKEN?.trim();
const root = path.resolve(process.env.MIRROR_ROOT?.trim() || '.ccpun-backup-mirror');
const contentRoot = path.join(root, 'content');
const mediaRoot = path.join(root, 'media');
const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

if (!token) throw new Error('SANITY_AUTH_TOKEN is required for the content/media mirror');
if ((process.env.SANITY_PROJECT_ID?.trim() || PROJECT_ID) !== PROJECT_ID) throw new Error('Mirror is pinned to kyfxgjnq');
if ((process.env.SANITY_DATASET?.trim() || DATASET) !== DATASET) throw new Error('Mirror is pinned to production');

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  token,
  apiVersion: '2026-08-24',
  useCdn: false,
  perspective: 'raw',
});

const query = `*[_type == "article" && defined(slug.current)] | order(_id asc){
  _id,_rev,_createdAt,_updatedAt,_type,
  "slug": slug.current,
  title,excerpt,tags,publishedAt,contentUpdatedAt,
  "category": category->{_id,title,"slug":slug.current},
  "author": author->{_id,name,"slug":slug.current,bio,sameAs},
  seo,geo,faq,sources,review,migration,
  "featuredImage": select(
    defined(featuredImage.asset) => {
      "kind":"sanity","url":featuredImage.asset->url,"assetId":featuredImage.asset->_id,
      "fileName":featuredImage.asset->originalFilename,"mimeType":featuredImage.asset->mimeType,
      "size":featuredImage.asset->size,"sha1":featuredImage.asset->sha1hash,
      "width":featuredImage.asset->metadata.dimensions.width,"height":featuredImage.asset->metadata.dimensions.height,
      "alt":featuredImage.alt,"caption":featuredImage.caption,"credit":featuredImage.credit
    },
    defined(migratedFeaturedImage.src) => {
      "kind":"migrated","url":migratedFeaturedImage.src,"fileName":migratedFeaturedImage.src,
      "width":migratedFeaturedImage.width,"height":migratedFeaturedImage.height,
      "alt":migratedFeaturedImage.alt,"caption":migratedFeaturedImage.caption
    }
  ),
  body[]{
    _key,_type,style,listItem,children[]{_key,_type,text,marks},
    markDefs[]{_key,_type,href,openInNewTab,nofollow,sponsored},
    title,text,alt,caption,credit,label,url,openInNewTab,summary,description,headers,rows,
    "media": select(
      _type == "imageWithAlt" => {"kind":"sanity","url":asset->url,"assetId":asset->_id,"fileName":asset->originalFilename,"mimeType":asset->mimeType,"size":asset->size,"sha1":asset->sha1hash},
      _type == "migratedImage" => {"kind":"migrated","url":src,"fileName":src},
      _type == "pdfDownload" => {"kind":"sanity","url":file.asset->url,"assetId":file.asset->_id,"fileName":file.asset->originalFilename,"mimeType":file.asset->mimeType,"size":file.asset->size,"sha1":file.asset->sha1hash}
    ),
    images[]{_key,alt,caption,credit,"media":{"kind":"sanity","url":asset->url,"assetId":asset->_id,"fileName":asset->originalFilename,"mimeType":asset->mimeType,"size":asset->size,"sha1":asset->sha1hash}}
  }
}`;

function clean(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
function safeSegment(value) {
  return clean(value).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'unnamed';
}
function statusOf(article) { return article._id.startsWith('drafts.') ? 'Drafts' : 'Published'; }
function sha256(buffer) { return createHash('sha256').update(buffer).digest('hex'); }
function posixRelative(from, to) { return path.relative(from, to).split(path.sep).join('/'); }

function richText(block) {
  const defs = new Map((block.markDefs ?? []).map((mark) => [mark._key, mark]));
  return (block.children ?? []).map((span) => {
    let text = span.text ?? '';
    const marks = span.marks ?? [];
    const linkKey = marks.find((mark) => defs.has(mark));
    if (marks.includes('strong')) text = `**${text}**`;
    if (marks.includes('em')) text = `*${text}*`;
    if (linkKey) text = `[${text}](${defs.get(linkKey)?.href})`;
    return text;
  }).join('').trim();
}

function markdownTable(headers = [], rows = []) {
  if (!headers.length && !rows.length) return '';
  const width = Math.max(headers.length, ...rows.map((row) => row.length), 1);
  const head = Array.from({ length: width }, (_, index) => headers[index] ?? '');
  const lines = [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`];
  for (const row of rows) lines.push(`| ${Array.from({ length: width }, (_, index) => row[index] ?? '').join(' | ')} |`);
  return lines.join('\n');
}

function bodyToMarkdown(article, mediaPathByKey) {
  const lines = [];
  let listIndex = 0;
  for (const block of article.body ?? []) {
    if (block._type === 'block') {
      const text = richText(block);
      if (!text) continue;
      if (block.listItem === 'bullet') lines.push(`- ${text}`);
      else if (block.listItem === 'number') lines.push(`${++listIndex}. ${text}`);
      else {
        listIndex = 0;
        if (block.style === 'h2') lines.push(`## ${text}`);
        else if (block.style === 'h3') lines.push(`### ${text}`);
        else if (block.style === 'blockquote') lines.push(`> ${text}`);
        else lines.push(text);
      }
      lines.push('');
      continue;
    }
    listIndex = 0;
    if (block._type === 'callout') lines.push(`> **${clean(block.title) || 'หมายเหตุ'}** — ${clean(block.text)}\n`);
    else if (block._type === 'imageWithAlt' || block._type === 'migratedImage') {
      const local = mediaPathByKey.get(block._key) ?? block.media?.url ?? '';
      lines.push(`![${clean(block.alt) || article.title}](${local})\n${clean(block.caption)}\n`);
    } else if (block._type === 'imageGallery') {
      for (const image of block.images ?? []) {
        const local = mediaPathByKey.get(image._key) ?? image.media?.url ?? '';
        lines.push(`![${clean(image.alt) || article.title}](${local})\n${clean(image.caption)}\n`);
      }
    } else if (block._type === 'ctaBlock') lines.push(`[${clean(block.label)}](${clean(block.url)})\n`);
    else if (block._type === 'pdfDownload') {
      const local = mediaPathByKey.get(block._key) ?? block.media?.url ?? '';
      lines.push(`[${clean(block.title) || 'PDF'}](${local})\n${clean(block.description)}\n`);
    } else if (block._type === 'detailsBlock') lines.push(`**${clean(block.summary)}**\n\n${clean(block.text)}\n`);
    else if (block._type === 'simpleTable') lines.push(`${markdownTable(block.headers, block.rows)}\n`);
    else if (block._type === 'divider') lines.push('---\n');
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function fetchSanityAsset(urlValue) {
  const parsed = new URL(urlValue);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'cdn.sanity.io') {
    throw new Error(`Refusing non-Sanity remote media host: ${parsed.hostname}`);
  }
  const response = await fetch(parsed, { redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Media download failed (${response.status})`);
  const advertised = Number(response.headers.get('content-length') ?? 0);
  if (advertised > MAX_MEDIA_BYTES) throw new Error('Media exceeds backup size policy');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_MEDIA_BYTES) throw new Error('Invalid media payload');
  return buffer;
}

async function mirrorMedia({ article, articleDir, key, role, media }) {
  if (!media?.url) return null;
  const status = statusOf(article);
  const slug = safeSegment(article.slug);
  const fallback = `${role}-${safeSegment(key || 'asset')}`;
  let originalName = path.basename(String(media.fileName || media.url).split('?')[0]) || fallback;
  originalName = safeSegment(originalName);
  if (!path.extname(originalName) && media.mimeType) {
    const ext = media.mimeType === 'image/webp' ? '.webp' : media.mimeType === 'image/png' ? '.png' : media.mimeType === 'image/jpeg' ? '.jpg' : media.mimeType === 'application/pdf' ? '.pdf' : '';
    originalName += ext;
  }
  const outputDir = path.join(mediaRoot, status, slug);
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${safeSegment(role)}-${safeSegment(key || 'asset')}-${originalName}`);
  let buffer;
  if (String(media.url).startsWith('/')) {
    const source = path.resolve('public', String(media.url).replace(/^\/+/, ''));
    const info = await stat(source);
    if (!info.isFile() || info.size <= 0 || info.size > MAX_MEDIA_BYTES) throw new Error(`Invalid local migrated media: ${media.url}`);
    await copyFile(source, outputPath);
    buffer = await readFile(outputPath);
  } else {
    buffer = await fetchSanityAsset(media.url);
    await writeFile(outputPath, buffer, { mode: 0o600 });
  }
  return {
    markdownPath: posixRelative(articleDir, outputPath),
    rootRelativePath: posixRelative(root, outputPath),
    bytes: buffer.length,
    sha256: sha256(buffer),
    source: media.url,
    assetId: media.assetId ?? null,
  };
}

const articles = await client.fetch(query);
if (!Array.isArray(articles) || !articles.length) throw new Error('Sanity mirror query returned no articles');
await mkdir(contentRoot, { recursive: true });
await mkdir(mediaRoot, { recursive: true });

const manifest = { schemaVersion: 2, createdAt: new Date().toISOString(), sanity: { projectId: PROJECT_ID, dataset: DATASET }, articles: [], media: [] };
for (const article of articles) {
  const status = statusOf(article);
  const slug = safeSegment(article.slug);
  const articleDir = path.join(contentRoot, status, slug);
  await mkdir(articleDir, { recursive: true });
  const mediaPathByKey = new Map();
  let featuredImagePath = '';

  if (article.featuredImage) {
    const mirrored = await mirrorMedia({ article, articleDir, key: 'featured', role: 'featured', media: article.featuredImage });
    if (mirrored) {
      featuredImagePath = mirrored.markdownPath;
      manifest.media.push({ articleId: article._id, role: 'featured', rootRelativePath: mirrored.rootRelativePath, bytes: mirrored.bytes, sha256: mirrored.sha256, source: mirrored.source, assetId: mirrored.assetId });
    }
  }
  for (const block of article.body ?? []) {
    if (block.media) {
      const mirrored = await mirrorMedia({ article, articleDir, key: block._key, role: block._type, media: block.media });
      if (mirrored) {
        mediaPathByKey.set(block._key, mirrored.markdownPath);
        manifest.media.push({ articleId: article._id, blockKey: block._key, role: block._type, rootRelativePath: mirrored.rootRelativePath, bytes: mirrored.bytes, sha256: mirrored.sha256, source: mirrored.source, assetId: mirrored.assetId });
      }
    }
    for (const image of block.images ?? []) {
      if (!image.media) continue;
      const mirrored = await mirrorMedia({ article, articleDir, key: image._key, role: 'gallery', media: image.media });
      if (mirrored) {
        mediaPathByKey.set(image._key, mirrored.markdownPath);
        manifest.media.push({ articleId: article._id, blockKey: image._key, role: 'gallery', rootRelativePath: mirrored.rootRelativePath, bytes: mirrored.bytes, sha256: mirrored.sha256, source: mirrored.source, assetId: mirrored.assetId });
      }
    }
  }

  const canonicalPath = article.category?.slug && article.slug ? `/blog/${article.category.slug}/${article.slug}/` : null;
  const markdown = [
    `# ${article.title}`,
    '',
    `- Status: ${status === 'Drafts' ? 'Draft' : 'Published'}`,
    `- Sanity ID: ${article._id}`,
    `- Slug: ${article.slug}`,
    `- Category: ${article.category?.title ?? ''} (${article.category?.slug ?? ''})`,
    `- Canonical path: ${canonicalPath ?? ''}`,
    `- Published: ${article.publishedAt ?? ''}`,
    `- Updated: ${article.contentUpdatedAt ?? article._updatedAt ?? ''}`,
    `- SEO title: ${article.seo?.title ?? ''}`,
    `- Meta description: ${article.seo?.description ?? ''}`,
    `- Focus keyword: ${article.seo?.focusKeyword ?? ''}`,
    `- Search intent: ${article.seo?.searchIntent ?? ''}`,
    `- Featured image: ${featuredImagePath}`,
    '',
    article.excerpt ? `> ${clean(article.excerpt)}` : '',
    '',
    bodyToMarkdown(article, mediaPathByKey),
    '',
    ...(article.faq?.length ? ['## คำถามที่พบบ่อย', '', ...article.faq.flatMap((item) => [`### ${clean(item.question)}`, '', clean(item.answer), ''])] : []),
    ...(article.sources?.length ? ['## Sources', '', ...article.sources.map((source) => `- ${clean(source.label)}${source.url ? ` — ${source.url}` : ''}`)] : []),
    '',
  ].filter((line) => line !== undefined).join('\n');

  const jsonPath = path.join(articleDir, 'article.json');
  const mdPath = path.join(articleDir, 'article.md');
  await writeFile(jsonPath, `${JSON.stringify(article, null, 2)}\n`, { mode: 0o600 });
  await writeFile(mdPath, markdown, { mode: 0o600 });
  manifest.articles.push({
    id: article._id,
    status,
    slug: article.slug,
    canonicalPath,
    json: posixRelative(root, jsonPath),
    markdown: posixRelative(root, mdPath),
  });
}

await writeFile(path.join(root, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ articles: manifest.articles.length, media: manifest.media.length, root }, null, 2));
