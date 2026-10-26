// Synthetic SSR layout coverage for CMS-backed pages, using the existing fixture loader.
// No provider calls, product source replacement or public fixture routes.
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { build } from 'esbuild';
import { loadFixtureModule } from './phase1-fixture-loader.mjs';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

export async function v5LayoutFixtures() {
  const imports = new Map();
  for (const root of ['components', 'features']) {
    for (const file of readdirSync(root, { recursive: true }).filter((file) => /\.tsx?$/.test(file))) {
      const owner = path.join(root, file);
      for (const [, id] of readFileSync(owner, 'utf8').matchAll(/from ["']([^"']+\.module\.css)["']/g)) {
        const resolved = id.startsWith('@/') ? id.slice(2) : path.join(path.dirname(owner), id);
        imports.set(id, resolved);
      }
    }
  }
  const files = [...new Set(imports.values())];
  const styles = await build({
    stdin: { contents: files.map((file, i) => `import s${i} from ${JSON.stringify('./' + file)};`).join('\n') + '\nexport default [' + files.map((_, i) => `s${i}`).join(',') + '];', resolveDir: process.cwd() },
    bundle: true, write: false, format: 'cjs', platform: 'node', outfile: 'fixtures.js', external: ['/assets/*', '/images/*'], loader: { '.css': 'local-css', '.webp': 'dataurl', '.png': 'dataurl', '.svg': 'dataurl', '.woff2': 'dataurl' }, logLevel: 'silent',
  });
  const compiled = { exports: {} };
  new Function('module', 'exports', styles.outputFiles.find((file) => file.path.endsWith('.js')).text)(compiled, compiled.exports);
  const classMaps = compiled.exports.default;
  const css = styles.outputFiles.find((file) => file.path.endsWith('.css')).text;
  const cssMocks = [...imports].map(([id, file]) => [id, { __esModule: true, default: classMaps[files.indexOf(file)] }]);
  const hubs = loadFixtureModule('lib/content/taxonomy.ts').BLOG_TOPIC_HUBS;
  const topics = hubs.map((hub) => ({ slug: hub.slug, href: `/blog/${hub.slug}/`, title: hub.title, count: 14 }));
  const cover = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#E0C985"/><path d="M0 0h1200v630H0z" fill="none" stroke="#352727" stroke-width="24"/><text x="30" y="70" font-size="48">1200 × 630 — full cover</text><text x="1170" y="595" text-anchor="end" font-size="48">CCPUN</text></svg>');
  const articles = Array.from({ length: 14 }, (_, i) => ({
    id: `layout-fixture-${i}`, slug: `layout-fixture-${i}`, title: `บทความทดสอบการวางแผนการเงินและการจัดการรายรับรายจ่ายระยะยาว ${i + 1}`,
    excerpt: 'ข้อมูลตัวอย่างสำหรับตรวจระยะห่างของข้อความ รูปภาพ วันที่ และหัวใจ เมื่อความกว้างหน้าจอเปลี่ยนไป', category: 'การเงินส่วนบุคคล', categorySlug: 'personal-finance', semanticTopic: 'personal-finance',
    authorName: 'CCPun', status: 'published', publishedAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z', tags: [],
    featuredImage: { src: cover, width: 1200, height: 630, alt: 'Synthetic full-cover layout fixture' },
    body: [{ type: 'heading', level: 2, text: 'หัวข้อทดสอบการอ่าน' }, { type: 'paragraph', text: 'ข้อความตัวอย่างสำหรับตรวจหน้าอ่านบทความและสารบัญในทุกขนาดหน้าจอ' }, { type: 'table', headers: ['รายการ', 'รายละเอียด'], rows: [['ข้อมูลตัวอย่าง', 'ข้อมูลทดสอบ layout เท่านั้น']] }],
  }));
  const mocks = new Map([
    ...cssMocks,
    ['@/lib/content/public-copy', { getPublicCopy: async () => ({}) }],
    ['@/components/layout/v5/shell-data', { getShellTopics: async () => topics }],
    ['./shell-data', { getShellTopics: async () => topics }],
    ['@/lib/runtime/investment-availability', { INVESTMENT_ALLOCATION_ENABLED: true }],
    ['@/lib/content/line-chat-config', { getLineChatConfig: async () => ({ config: loadFixtureModule('lib/line/chat-panel.ts').LINE_CHAT_DEFAULTS, source: 'default', invalid: false }) }],
    ['@/components/layout/v5/V5HealthHappyCountdown', { __esModule: true, default: () => null }],
    ['@/components/layout/v5/V5ViewTransition', { V5SharedTransition: ({ children }) => children }],
    ['./V5ViewTransition', { V5SharedTransition: ({ children }) => children }],
    ['@/lib/analytics', { trackEvent: () => { throw new Error('SSR fixture must not emit analytics'); } }],
    ['next/navigation', { usePathname: () => '/', notFound: () => { throw new Error('fixture not found'); } }],
  ]);
  const resolve = async (node) => {
    if (Array.isArray(node)) return Promise.all(node.map(resolve));
    if (!React.isValidElement(node)) return node;
    if (typeof node.type === 'function' && (node.type.constructor.name === 'AsyncFunction' || ['V5Page', 'V5BlogIndex', 'V5Category', 'V5Article', 'V5Header', 'V5Footer', 'V5ChatDockServer'].includes(node.type.name))) return resolve(await node.type(node.props));
    const children = await resolve(node.props.children);
    return React.cloneElement(node, {}, ...(Array.isArray(children) ? children : [children]));
  };
  const Blog = loadFixtureModule('features/blog/v5/V5BlogIndex.tsx', { mocks }).default;
  const Category = loadFixtureModule('features/blog/v5/V5Category.tsx', { mocks }).default;
  const Article = loadFixtureModule('features/blog/v5/V5Article.tsx', { mocks }).default;
  const cases = [
    ['blog-fixture', React.createElement(Blog, { articles, featured: articles.slice(0, 3), topics, copy: {}, author: null })],
    ...hubs.map((hub) => [`category-${hub.slug}-fixture`, React.createElement(Category, { slug: hub.slug, title: hub.title, description: 'ข้อมูลทดสอบ layout', hub, articles: articles.map((article) => ({ ...article, category: hub.title, categorySlug: hub.slug, semanticTopic: hub.slug })), topics, copy: {} })]),
    ['article-fixture', React.createElement(Article, { article: articles[0], relatedArticles: articles.slice(1, 5), allArticles: articles })],
  ];
  const result = [];
  for (const [name, element] of cases) {
    const html = renderToStaticMarkup(await resolve(element));
    result.push({ name, html, css });
  }
  return result;
}
