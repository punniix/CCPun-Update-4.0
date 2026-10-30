import { adminCmsBridgePredecessor } from "./admin-cms-web-bridge-successor.mjs";
import { cmsCopyScopePredecessor, cmsCopyLocationsPredecessor } from "./v5-cms-copy-scope-successor.mjs";
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const sha = value => createHash('sha256').update(value).digest('hex');
// Exact owner-approved 2026-10-29 cover/404/category CSS, countdown, article TOC and additive copy source successor.
// Only these complete reviewed files can reconstruct 6456e71a; historical pins stay frozen.
export const ownerReviewSourcePins = Object.freeze({
  "components/layout/v5/V5.module.css": {
    "before": "c297679c24477de582ba1d086963bd314234c48a14f828c54a3fce724f82a88b",
    "after": "f5ac130e4627c2f141128fd6fc8517e69f81d650913e22e7141e39a34848d703",
    "edits": [
      [
        "  :is(.cardGrid, .cardGrid2) > .articleCard:only-child, :is(.cardGrid, .cardGrid2) > :only-child > .articleCard { flex-direction: row; --v5-card-meta-top: 0; }\n  :is(.cardGrid, .cardGrid2) > .articleCard:only-child > .articleCardImage, :is(.cardGrid, .cardGrid2) > :only-child > .articleCard > .articleCardImage { width: 40%; height: auto; aspect-ratio: auto; align-self: flex-start; flex: none; border-radius: var(--v5-card-image-radius) 0 0 var(--v5-card-image-radius); }\n  :is(.cardGrid, .cardGrid2) > .articleCard:only-child > .articleCardBody, :is(.cardGrid, .cardGrid2) > :only-child > .articleCard > .articleCardBody { justify-content: center; padding: 24px 32px; }\n",
        "  :is(.cardGrid, .cardGrid2) > .articleCard:only-child, :is(.cardGrid, .cardGrid2) > :only-child > .articleCard { flex-direction: row; --v5-card-meta-top: 0; }\n  :is(.cardGrid, .cardGrid2) > .articleCard:only-child > .articleCardImage, :is(.cardGrid, .cardGrid2) > :only-child > .articleCard > .articleCardImage { width: 40%; height: auto; aspect-ratio: 1200 / 630; align-self: center; flex: none; border-radius: var(--v5-card-image-radius) 0 0 var(--v5-card-image-radius); }\n  :is(.cardGrid, .cardGrid2) > .articleCard:only-child > .articleCardBody, :is(.cardGrid, .cardGrid2) > :only-child > .articleCard > .articleCardBody { justify-content: center; padding: 24px 32px; }\n"
      ],
      [
        ".articleCard:has(.articleCardTitle a:focus-visible) { outline: 3px solid var(--v5-focus); outline-offset: 3px; }\n/* Informative covers use their source dimensions, including legacy shapes with baked-in text. */\n.articleCardImage { display: block; width: 100%; height: auto; aspect-ratio: auto; object-fit: contain; object-position: top; background: var(--v5-surface); border-radius: var(--v5-card-image-radius) var(--v5-card-image-radius) 0 0; }\n.articleCardImage:not(img) { aspect-ratio: 1200 / 630; }\n.articleCardBody { display: flex; flex: 1; flex-direction: column; gap: 8px; padding: 20px 20px 20px; }\n",
        ".articleCard:has(.articleCardTitle a:focus-visible) { outline: 3px solid var(--v5-focus); outline-offset: 3px; }\n/*\n  Covers (owner request 2026-10-25): every Production cover is 1200 x 630 with baked-in text and the CCPUN logo,\n  so a cover always shows whole at 1200 / 630 and is never stretched or cropped by the card layout. object-fit\n  stays only as a safety for legacy images of another shape.\n*/\n.articleCardImage { display: block; width: 100%; height: auto; aspect-ratio: 1200 / 630; object-fit: cover; object-position: center; background: var(--v5-surface); border-radius: var(--v5-card-image-radius) var(--v5-card-image-radius) 0 0; }\n.articleCardBody { display: flex; flex: 1; flex-direction: column; gap: 8px; padding: 20px 20px 20px; }\n"
      ],
      [
        ".articleCardHorizontal { flex-direction: row; align-items: stretch; --v5-card-meta-top: 0; }\n/* Horizontal covers hug their intrinsic height and align with the start of the text column. */\n.articleCardHorizontal .articleCardImage { width: 38%; height: auto; aspect-ratio: auto; align-self: flex-start; flex: none; border-radius: var(--v5-card-image-radius) 0 0 var(--v5-card-image-radius); }\n.articleCardHorizontal .articleCardBody { justify-content: center; padding: 16px 16px; }\n",
        ".articleCardHorizontal { flex-direction: row; align-items: stretch; --v5-card-meta-top: 0; }\n/*\n  Horizontal cards (owner bug report 2026-10-26, options a + c): the whole 1200 x 630 cover keeps a fixed width at\n  its natural height and is centred in its column, so a taller text column leaves even card background above and\n  below it instead of an empty block under the cover; the text group is centred too, so the date row follows the\n  title. Where the text column would be far taller than the cover (phones and the two-up rows from 900 to 1279px)\n  the card stacks. The cover's outer corners follow the card radius.\n*/\n.articleCardHorizontal .articleCardImage { width: 38%; height: auto; aspect-ratio: 1200 / 630; align-self: center; flex: none; border-radius: var(--v5-card-image-radius) 0 0 var(--v5-card-image-radius); }\n.articleCardHorizontal .articleCardBody { justify-content: center; padding: 16px 16px; }\n"
      ],
      [
        "  .articleCardHorizontal { flex-direction: column; --v5-card-meta-top: auto; }\n  .articleCardHorizontal .articleCardImage { width: 100%; min-height: 0; aspect-ratio: auto; }\n  .articleCardHorizontal .articleCardImage { border-radius: var(--v5-card-image-radius) var(--v5-card-image-radius) 0 0; }\n",
        "  .articleCardHorizontal { flex-direction: column; --v5-card-meta-top: auto; }\n  .articleCardHorizontal .articleCardImage { width: 100%; min-height: 0; aspect-ratio: 1200 / 630; }\n  .articleCardHorizontal .articleCardImage { border-radius: var(--v5-card-image-radius) var(--v5-card-image-radius) 0 0; }\n"
      ],
      [
        "@media (min-width:1024px) { :global(#v5-blog-scope) .articleCardTitle a::after, :global(section[aria-labelledby=\"not-found-latest\"]) .articleCardTitle a::after { right:calc(248px - var(--v5-gutter)); } }\n\n/* 404 recovery controls leave the same fixed LINE corner clear as the reading surfaces. */\n.notFoundTools { padding-inline-end: max(var(--v5-gutter), 80px); }\n@media (min-width: 1024px) { .notFoundTools { padding-inline-end: max(var(--v5-gutter), 248px); } }\n",
        "@media (min-width:1024px) { :global(#v5-blog-scope) .articleCardTitle a::after, :global(section[aria-labelledby=\"not-found-latest\"]) .articleCardTitle a::after { right:calc(248px - var(--v5-gutter)); } }\n"
      ]
    ]
  },
  "features/blog/v5/V5Article.tsx": {
    "before": "5882c19a0704e82b3184524689e1c0d7e585b7259441cde3770819c260b142c5",
    "after": "0893228fb8d19ed772325f9cc0e07f101771f3d2b38cc352be8dfac0491a4db8",
    "edits": [
      [
        "import { estimateArticleReadingMinutes } from \"@/features/blog/website-43/articleReadingTime\";\nimport styles from \"./V5Blog.module.css\";\nimport Toc from \"./V5ArticleToc\";\nimport { renderV5ArticleBody } from \"./V5ArticleBody\";\nimport { resolveNextSteps } from \"./next-step\";\n",
        "import { estimateArticleReadingMinutes } from \"@/features/blog/website-43/articleReadingTime\";\nimport styles from \"./V5Blog.module.css\";\nimport { renderV5ArticleBody } from \"./V5ArticleBody\";\nimport { resolveNextSteps } from \"./next-step\";\n"
      ],
      [
        "type Heading = { index: number; id: string; label: string; level: number };\n\n\nexport default async function V5Article({ article, relatedArticles = [], allArticles = [], preview = false }: { article: Article; relatedArticles?: Article[]; allArticles?: readonly Article[]; preview?: boolean }) {\n",
        "type Heading = { index: number; id: string; label: string; level: number };\n\nfunction Toc({ groups }: { groups: Array<{ primary: Heading; children: Heading[] }> }) {\n  return (\n    <ol>\n      {groups.map(({ primary, children }) => (\n        <li key={primary.id}>\n          <a href={`#${primary.id}`}>{primary.label}</a>\n          {children.length > 0 && <ol>{children.map((child) => <li key={child.id}><a href={`#${child.id}`}>{child.label}</a></li>)}</ol>}\n        </li>\n      ))}\n    </ol>\n  );\n}\n\nexport default async function V5Article({ article, relatedArticles = [], allArticles = [], preview = false }: { article: Article; relatedArticles?: Article[]; allArticles?: readonly Article[]; preview?: boolean }) {\n"
      ]
    ]
  },
  "features/blog/v5/V5Blog.module.css": {
    "before": "b3d16a11dc6c0b61ef0a4a1879bc4124d7d23e1885cb3e83e69b55bcc3d283cb",
    "after": "1f96a110081cc38dbdb2059170187f620c3f69eecd68b31cb0deb868014d4054",
    "edits": [
      [
        ".heroLead { color: var(--v5-muted); font-size: clamp(16px, 1.6vw, 19px); margin-top: 12px; }\n.search { position: relative; }\n",
        ".heroLead { color: var(--v5-muted); font-size: clamp(16px, 1.6vw, 19px); margin-top: 12px; }\n.authorChip { display: inline-flex; align-items: center; gap: 12px; margin-top: 16px; font-size: var(--v5-text-meta); font-weight: 500; font-family: var(--v5-font-display); }\n.authorChip img { width: 36px; height: 36px; border-radius: 999px; object-fit: cover; object-position: top; background: var(--v5-surface); }\n.search { position: relative; }\n"
      ],
      [
        ".chipRow { margin-top: 24px; overflow-x: auto; scrollbar-width: none; margin-inline: calc(var(--v5-gutter) * -1); padding-inline: var(--v5-gutter); }\n.chipRow [aria-current=\"page\"] { background: var(--v5-text); border-color: var(--v5-text); color: var(--v5-bg); }\n.chipRow::-webkit-scrollbar { display: none; }\n",
        ".chipRow { margin-top: 24px; overflow-x: auto; scrollbar-width: none; margin-inline: calc(var(--v5-gutter) * -1); padding-inline: var(--v5-gutter); }\n.chipRow::-webkit-scrollbar { display: none; }\n"
      ],
      [
        ".featuredLead { flex-direction: column; }\n/* The lead card turns horizontal from 1024px (owner bug report 2026-10-26): the whole cover keeps its intrinsic height at the start of its half. */\n@media (min-width: 1024px) {\n  .featuredLead { flex-direction: row; --v5-card-meta-top: 0; }\n  .featuredLead > img { width: 50%; height: auto; aspect-ratio: auto; align-self: flex-start; flex: none; border-radius: var(--v5-card-image-radius) 0 0 var(--v5-card-image-radius); }\n  .featuredLead > div { justify-content: center; padding: 32px 36px; }\n",
        ".featuredLead { flex-direction: column; }\n/* The lead card turns horizontal from 1024px (owner bug report 2026-10-26): the whole cover is centred in its half. */\n@media (min-width: 1024px) {\n  .featuredLead { flex-direction: row; --v5-card-meta-top: 0; }\n  .featuredLead > img { width: 50%; height: auto; aspect-ratio: 1200 / 630; align-self: center; flex: none; border-radius: var(--v5-card-image-radius) 0 0 var(--v5-card-image-radius); }\n  .featuredLead > div { justify-content: center; padding: 32px 36px; }\n"
      ],
      [
        ".toc a { display: flex; align-items: center; min-height: 44px; padding: 8px; text-wrap: balance; border-radius: 10px; color: var(--v5-muted); font-size: 14px; line-height: 1.5; text-decoration: none; }\n.toc a:hover, .toc a[aria-current=\"location\"] { background: var(--v5-bg-alt); color: var(--v5-text); }\n.toc ol[hidden] { display: none; }\n.tocRow { display: flex; align-items: start; gap: 4px; }\n.tocRow > a { flex: 1; min-width: 0; }\n.tocRow > button { display: grid; place-items: center; flex: 0 0 44px; min-height: 44px; padding: 8px; border: 0; border-radius: 10px; background: transparent; color: var(--v5-muted); font: inherit; cursor: pointer; }\n.tocRow > button:hover { background: var(--v5-bg-alt); color: var(--v5-text); }\n.tocMobile { border: 1px solid var(--v5-border-soft); border-radius: var(--v5-radius-sm); background: var(--v5-card); margin-bottom: 24px; }\n",
        ".toc a { display: flex; align-items: center; min-height: 44px; padding: 8px; text-wrap: balance; border-radius: 10px; color: var(--v5-muted); font-size: 14px; line-height: 1.5; text-decoration: none; }\n.toc a:hover { background: var(--v5-bg-alt); color: var(--v5-text); }\n.tocMobile { border: 1px solid var(--v5-border-soft); border-radius: var(--v5-radius-sm); background: var(--v5-card); margin-bottom: 24px; }\n"
      ],
      [
        ".prose h3 { font-size: clamp(19px, 2vw, 22px); line-height: 1.45; margin-top: 32px; scroll-margin-top: 96px; }\n.prose h4 { font-size: 18px; font-weight: 400; line-height: 1.5; color: var(--v5-muted); margin-top: 24px; scroll-margin-top: 96px; }\n@media (min-width: 1024px) { .prose h4 { font-size: 20px; } }\n.prose a:not([class]), .imageLink { color: var(--v5-gold-text); text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }\n",
        ".prose h3 { font-size: clamp(19px, 2vw, 22px); line-height: 1.45; margin-top: 32px; scroll-margin-top: 96px; }\n.prose h4 { font-size: 18px; margin-top: 24px; scroll-margin-top: 96px; }\n.prose a:not([class]), .imageLink { color: var(--v5-gold-text); text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }\n"
      ]
    ]
  },
  "features/investment-allocation/InvestmentAllocation.module.css": {
    "before": "05b29e203fbf4eda01a6d98d9e6986551f0ec5f3cfcccf4791faa453fb4cf995",
    "after": "d2f2349dddbab2678c4d4f1dfaa07329b9f44d4a083a2e8853fce6b8220ea732",
    "edits": [
      [
        ".handoffFallback{margin-top:1rem;max-width:100%;overflow-wrap:anywhere}.handoffFallback summary{cursor:pointer}.handoffFallback label{display:block;margin-top:.75rem}.handoffFallback textarea{box-sizing:border-box;width:100%;margin:.5rem 0;padding:.75rem;border:1px solid var(--w43-border);border-radius:.5rem;background:var(--w43-deep);color:inherit;font:inherit;resize:vertical}.handoffFallback textarea:focus-visible,.handoffFallback a:focus-visible{outline:2px solid currentColor;outline-offset:3px}\n\n/* The v5 six-choice grid shares the tallest natural row; selected borders retain their reserved width. */\n:global([data-v5-header] ~ main) .categoryGrid { grid-auto-rows: 1fr; align-items: stretch; }\n:global([data-v5-header] ~ main) .categoryCard { box-sizing: border-box; width: 100%; min-width: 0; height: 100%; }\n",
        ".handoffFallback{margin-top:1rem;max-width:100%;overflow-wrap:anywhere}.handoffFallback summary{cursor:pointer}.handoffFallback label{display:block;margin-top:.75rem}.handoffFallback textarea{box-sizing:border-box;width:100%;margin:.5rem 0;padding:.75rem;border:1px solid var(--w43-border);border-radius:.5rem;background:var(--w43-deep);color:inherit;font:inherit;resize:vertical}.handoffFallback textarea:focus-visible,.handoffFallback a:focus-visible{outline:2px solid currentColor;outline-offset:3px}\n"
      ]
    ]
  },
  "lib/content/blog-copy-defaults.ts": {
    "before": "ad1a4df17d901a41180de6daaf159c11a12b440b276c06dc9c0479d8d8a4d2d6",
    "after": "a663d7ce27c12b22f466fae632d5d9a096e202eed1b4771e94542848a9bce480",
    "edits": [
      [
        "  \"blog.category.description\": \"รวมบทความและความรู้เรื่อง{title}จาก CCPun\",\n  \"blog.categoryAccounts.title\": \"เปิดบัญชีลงทุน\",\n  \"blog.categoryAccounts.phillip\": \"เปิดบัญชี Phillip\",\n  \"blog.categoryAccounts.maybank\": \"เปิดบัญชี Maybank\",\n  \"blog.category.heading\": \"ทำความเข้าใจ{title}ก่อนตัดสินใจ\",\n",
        "  \"blog.category.description\": \"รวมบทความและความรู้เรื่อง{title}จาก CCPun\",\n  \"blog.category.heading\": \"ทำความเข้าใจ{title}ก่อนตัดสินใจ\",\n"
      ]
    ]
  },
  "components/ui/health-happy/HealthHappyCountdown.tsx": {
    "before": "9c5bc7b625a49755d3be90ef885e4cb3bade1d9bf9fb0fff2ea68f8e609d1618",
    "after": "a397d1ef6b34c81cc07660b01cbc8b2860d0807497c5b4a1313cdb72f5e1fd80",
    "edits": [
      [
        "\nexport default function HealthHappyCountdown({ placement, splitDigits = false }: { placement: Placement; splitDigits?: boolean }) {\n  const text = usePublicCopy();\n",
        "\nexport default function HealthHappyCountdown({ placement }: { placement: Placement }) {\n  const text = usePublicCopy();\n"
      ],
      [
        "  return (\n    <aside ref={countdownRef} className={splitDigits ? `${styles.outside} ${styles.splitDigits}` : styles.outside} data-countdown-style={splitDigits ? \"tiles\" : undefined} aria-label={text(\"site.extra.healthHappyCountdownarialabel\")} data-campaign=\"aia-health-happy-2026\" data-campaign-placement={placement}>\n      <div className={styles.frame}>\n",
        "  return (\n    <aside ref={countdownRef} className={styles.outside} aria-label={text(\"site.extra.healthHappyCountdownarialabel\")} data-campaign=\"aia-health-happy-2026\" data-campaign-placement={placement}>\n      <div className={styles.frame}>\n"
      ],
      [
        "              <span className={styles.timeUnit}>\n                <strong className={styles.numeral}>\n                  {splitDigits ? <>\n                    <span className={styles.srOnly}>{value === undefined ? '--' : String(value).padStart(2, '0')}</span>\n                    <span className={styles.digits} aria-hidden=\"true\">{Array.from(value === undefined ? '--' : String(value).padStart(2, '0')).map((digit, index) => <span className={styles.digit} key={index}>{digit}</span>)}</span>\n                  </> : value === undefined ? '--' : String(value).padStart(2, '0')}\n                </strong>\n                <span className={styles.timeLabel}>{label}</span>\n",
        "              <span className={styles.timeUnit}>\n                <strong className={styles.numeral}>{value === undefined ? '--' : String(value).padStart(2, '0')}</strong>\n                <span className={styles.timeLabel}>{label}</span>\n"
      ]
    ]
  },
  "components/ui/health-happy/HealthHappyCountdown.module.css": {
    "before": "680f964d475b51ed3a2be9c092257fc17554916626d57c03668ad28ca4cad804",
    "after": "913c4c25b5b9ee8a0508a69854a453f2b147a66605df46dc7264df8d0ddda5da",
    "edits": [
      [
        "}\n\n/* The v5 opt-in uses static split tiles; the shared clock, actions and legacy presentation stay unchanged. */\n.splitDigits .frame { min-height: 0; align-items: center; padding-block: 24px; overflow: visible; }\n.splitDigits .info { overflow-wrap: anywhere; }\n.splitDigits .timer { padding: 12px 0; gap: 12px; border: 0; background: transparent; }\n.splitDigits .timePart:first-child { flex: 1 1 0; }\n.splitDigits .numeral { color: #faf6f0; }\n.digits { display: flex; justify-content: center; gap: 4px; }\n.digit { position: relative; display: grid; place-items: center; width: .95em; padding-block: 4px; border: 1px solid #5b4848; border-radius: 6px; background: #352727; color: #faf6f0; }\n.digit::after { content: \"\"; position: absolute; inset-inline: 0; top: 50%; border-top: 1px solid rgb(250 246 240 / 25%); }\n.srOnly { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }\n@media (max-width: 650px) {\n  .splitDigits .frame { padding: 16px; gap: 16px; }\n  .splitDigits .brandLine { gap: 8px; }\n  .splitDigits .timer { gap: 8px; padding: 0; }\n}\n",
        "}\n"
      ]
    ]
  },
  "apps/web/app/not-found.tsx": {
    "before": "8f337f74f2cce92b35478abd857fd9274ea785445df72ce3ea89c9e57186d3a2",
    "after": "ee65b97ebeb55c26615f1f549c62b9e3d4f02e0984e182045d02a07c963c37b6",
    "edits": [
      [
        "import { getPublishedArticles } from '@/components/layout/v5/shell-data';\nimport { V5_AIA_FUND_TOOL, V5_INVESTMENT_TOOL, V5_TOOL_LINKS } from \"@/components/layout/v5/constants\";\nimport { INVESTMENT_ALLOCATION_ENABLED } from \"@/lib/runtime/investment-availability\";\n\n",
        "import { getPublishedArticles } from '@/components/layout/v5/shell-data';\n\n"
      ],
      [
        "  const text = publicCopyText(await getPublicCopy(\"site\"));\n  const tools = [\n    ...V5_TOOL_LINKS.map((tool) => ({ href: tool.href, label: text(tool.nameKey) })),\n    ...(INVESTMENT_ALLOCATION_ENABLED ? [V5_INVESTMENT_TOOL, V5_AIA_FUND_TOOL] : []),\n  ];\n  // v5 404 (FigCraft 12): recovery links plus the latest articles; a CMS outage still renders the page.\n",
        "  const text = publicCopyText(await getPublicCopy(\"site\"));\n  // v5 404 (FigCraft 12): recovery links plus the latest articles; a CMS outage still renders the page.\n"
      ],
      [
        "      </section>\n      <section className={shell.section} style={{ paddingTop: 0 }} aria-labelledby=\"not-found-tools\">\n        <div className={`${shell.inner} ${shell.notFoundTools}`}>\n          <h2 id=\"not-found-tools\" className={shell.h2} style={{ marginBottom: 24 }}>{text.node(\"site.nav.tools\")}</h2>\n          <nav aria-label={text(\"site.nav.tools\")}><ul className={shell.chips}>{tools.map((tool) => <li key={tool.href}><Link className={shell.buttonOutline} href={tool.href}>{tool.label}</Link></li>)}</ul></nav>\n        </div>\n      </section>\n      {latest.length > 0 && <section className={shell.section} style={{ paddingTop: 0 }} aria-labelledby=\"not-found-latest\">\n",
        "      </section>\n      {latest.length > 0 && <section className={shell.section} style={{ paddingTop: 0 }} aria-labelledby=\"not-found-latest\">\n"
      ]
    ]
  },
  "next.config.ts": {
    "before": "4196891a2f0f1b680ba2cef07d07c1dd6db122fea09b16aa78382a9613ba39f5",
    "after": "a0c8d5d4de393babacb57972b7a92008744290b36b1e9ab1c432df3b721fce50",
    "edits": [
      [
        "  images: {\n    formats: [\"image/webp\"],\n    qualities: [75, 90],\n",
        "  images: {\n    formats: [\"image/avif\", \"image/webp\"],\n    qualities: [75, 90],\n"
      ]
    ]
  },
  "apps/web/next.config.ts": {
    "before": "0e4e2029ba44044d103da94cb10b60359e0e53f4c8ba19cf0ad338bf8be0d3aa",
    "after": "40b525e82ee76ce5ec0ea30b0b50c2032a3451d25f1e0cdce9b9edd89e8a6f4a",
    "edits": [
      [
        "  images: {\n    formats: [\"image/webp\"],\n    qualities: [75, 90],\n",
        "  images: {\n    formats: [\"image/avif\", \"image/webp\"],\n    qualities: [75, 90],\n"
      ]
    ]
  },
  "features/blog/pages/BlogCategoryPage.tsx": {
    "before": "a69647fc9d9a02a514031a989be3907a2af7f5ed6096e5d07e17132afb04384f",
    "after": "4cb067e053c534c5ac962ee985d63fa06840216fda76188dacc09cefb135296b",
    "edits": [
      [
        "        articles={relevantArticles}\n        totalArticleCount={visibleArticles.length}\n        topics={linkableTopics(registry, visibleArticles)}\n",
        "        articles={relevantArticles}\n        topics={linkableTopics(registry, visibleArticles)}\n"
      ],
      [
        "      articles={relevantArticles}\n      totalArticleCount={publishedArticles.length}\n      topics={linkableTopics(registry, publishedArticles)}\n",
        "      articles={relevantArticles}\n      topics={linkableTopics(registry, publishedArticles)}\n"
      ]
    ]
  }
});

// Exact native-approved About layout and mobile AIA text reserve; all historical CSS pins remain unchanged.
export const aboutToolsLayoutPins = Object.freeze({
  "features/about/About.module.css": {
    "before": "d0ed667b13e0434cf7d3d06682095f9a3546be580cfea51e5da7b1676421ba07",
    "after": "a3e209f3a607d98e23b8e6596e31a223224af686bcf168253b1fbd3d2ba1e33a",
    "edits": [
      [
        ".fatherStory ul { list-style: disc; padding-left: 1.4em; display: grid; gap: 12px; }\n.fatherPhrase { white-space: normal; }\n/* Keep the existing LINE corner clear while the story uses the stacked layout. */\n@media (max-width: 1279px) {\n  .fatherStory > p, .fatherStoryBody, .fatherPhoto figcaption { max-width: min(760px, 100%, calc(100vw - var(--v5-gutter) - 80px)); }\n}\n@media (min-width: 1024px) and (max-width: 1279px) {\n  .fatherStory > p, .fatherStoryBody, .fatherPhoto figcaption { max-width: min(760px, 100%, calc(100vw - var(--v5-gutter) - 248px)); }\n}\n@media (min-width: 900px) {\n",
        ".fatherStory ul { list-style: disc; padding-left: 1.4em; display: grid; gap: 12px; }\n@media (min-width: 900px) {\n"
      ],
      [
        "@media (min-width: 900px) {\n  /* The approved UAT story uses the full shared width; Production has no father trial. */\n  .split:has(.fatherStory) { grid-template-columns: minmax(0, 1fr); }\n  .split:has(.fatherStory) > .story { max-width: none; }\n  .split:has(.fatherStory) > h2,\n  .split:has(.fatherStory) > .story > :not(.fatherStory) { max-width: 760px; }\n}\n@media (min-width: 1280px) {\n  .fatherStory { grid-template-columns: minmax(0, 5fr) minmax(0, 3fr); gap: 20px 64px; padding-block: 20px; align-items: start; }\n  .fatherStory h3 { grid-column: 1; grid-row: 1; }\n  .fatherStory > p { grid-column: 1; grid-row: 2; }\n  .fatherPhoto { grid-column: 2; grid-row: 1 / 4; max-width: none; }\n  .fatherPhoto figcaption { max-width: min(280px, calc(100% - max(0px, calc(248px - var(--v5-gutter))))); }\n  .fatherStoryBody { grid-column: 1; grid-row: 3; }\n}\n",
        "@media (min-width: 900px) {\n  .fatherStory { grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); align-items: start; }\n  .fatherStory h3 { grid-column: 1 / -1; }\n  .fatherStory > p { grid-column: 2; grid-row: 2; }\n  .fatherPhoto { grid-column: 1; grid-row: 2 / 4; }\n  .fatherStoryBody { grid-column: 2; }\n}\n"
      ]
    ]
  },
  "features/tools-hub/ToolsHub.module.css": {
    "before": "83c1feee22ea57e01d6213ef019057dcb8e5a0c2c0b360a141df85cd0a80ae1a",
    "after": "1c8997d0e9fcd537db2e570d06b32b0ace9738fc7238810201d59c4911906f82",
    "edits": [
      [
        "@media (max-width:1023px) { .card h2 a::after { right:calc(80px - var(--v5-gutter)); } }\n@media (max-width:479px) {\n  .card:has(h2 a[href=\"/tools/financial-health-check/\"]) > p,\n  .card:has(h2 a[href=\"/tools/aia-fund-allocation/\"]) > p { padding-right:40px; }\n}\n@media (min-width:1024px) { .card h2 a::after { right:calc(248px - var(--v5-gutter)); } }\n",
        "@media (max-width:1023px) { .card h2 a::after { right:calc(80px - var(--v5-gutter)); } }\n@media (max-width:479px) { .card:has(h2 a[href=\"/tools/financial-health-check/\"]) > p { padding-right:40px; } }\n@media (min-width:1024px) { .card h2 a::after { right:calc(248px - var(--v5-gutter)); } }\n"
      ]
    ]
  },
  "features/about/page.tsx": {
    "before": "6cd93cd1349a38cbe53641619880e7cc5c60e3a9bb7908e2651a0c77bdd3f140",
    "after": "d2070ede6bcaec4dcc56cb39e71aa7fcb11a8ef41973b85bb3bc87425cd92a23",
    "edits": [
      [
        "    <figure className={styles.fatherPhoto} data-uat-placeholder=\"about-father-photo\">\n      <Image src=\"/assets/ccpun-father-v5-colour.webp\" alt={text(\"about.father.photoAlt\")} width={1086} height={1448} sizes=\"(max-width: 1279px) min(420px, calc(100vw - 40px)), (max-width: 1439px) calc(37.5vw - 84px), 456px\" />\n      <figcaption>{typeof caption === \"string\" ? caption.split(\"\\n\").map((line, index) => <span key={line}>{index > 0 ? <br /> : null}{keepFatherPhrase(line)}</span>) : caption}</figcaption>\n",
        "    <figure className={styles.fatherPhoto} data-uat-placeholder=\"about-father-photo\">\n      <Image src=\"/assets/ccpun-father-v5-colour.webp\" alt={text(\"about.father.photoAlt\")} width={1086} height={1448} sizes=\"(max-width: 899px) calc(100vw - 40px), 280px\" />\n      <figcaption>{typeof caption === \"string\" ? caption.split(\"\\n\").map((line, index) => <span key={line}>{index > 0 ? <br /> : null}{keepFatherPhrase(line)}</span>) : caption}</figcaption>\n"
      ],
      [
        "/** Match the existing licence-card `keep` mechanism without changing the plain text. */\nfunction keepFatherPhrase(value: ReactNode, wrapTerms = false) {\n  if (typeof value !== \"string\") return value;\n",
        "/** Match the existing licence-card `keep` mechanism without changing the plain text. */\nfunction keepFatherPhrase(value: ReactNode) {\n  if (typeof value !== \"string\") return value;\n"
      ],
      [
        "  if (at < 0) return value;\n  const phrase = wrapTerms ? <span className={styles.fatherPhrase}>{FATHER_STORY_KEEP.split(\" \").flatMap((term, index) => [\n    index ? \" \" : null, <span className={flipStyles.keep} key={term}>{term}</span>,\n  ])}</span> : <span className={flipStyles.keep}>{FATHER_STORY_KEEP}</span>;\n  return <>{value.slice(0, at)}{phrase}{value.slice(at + FATHER_STORY_KEEP.length)}</>;\n}\n",
        "  if (at < 0) return value;\n  return <>{value.slice(0, at)}<span className={flipStyles.keep}>{FATHER_STORY_KEEP}</span>{value.slice(at + FATHER_STORY_KEEP.length)}</>;\n}\n"
      ],
      [
        "      <h3>{text.node(\"about.father.heading\")}</h3>\n      <p>{keepFatherPhrase(text.node(\"about.father.paragraph1\"), true)}</p>\n      <FatherPhotoSlot text={text} />\n",
        "      <h3>{text.node(\"about.father.heading\")}</h3>\n      <p>{keepFatherPhrase(text.node(\"about.father.paragraph1\"))}</p>\n      <FatherPhotoSlot text={text} />\n"
      ]
    ]
  }
});
export function aboutToolsLayoutPredecessor(file, source) {
  const pin = Object.hasOwn(aboutToolsLayoutPins, file) ? aboutToolsLayoutPins[file] : null;
  if (!pin || sha(source) !== pin.after) return source;
  for (const [current, prior] of pin.edits) {
    assert.equal(source.split(current).length, 2, 'Exactly one complete approved layout fragment');
    source = source.replace(current, prior);
  }
  assert.equal(sha(source), pin.before, 'Every original layout byte reconstructed');
  return source;
}

export function ownerReviewSourcePredecessor(file, source) {
  source = ownerReviewVisualSourcePredecessor(file, source);
  source = ownerReviewEditorSourcePredecessor(file, source);
  source = ownerReviewStaticCredentialsPredecessor(file, source);
  source = aboutToolsLayoutPredecessor(file, source);
  source = adminCmsBridgePredecessor(file, source);
  source = cmsCopyScopePredecessor(file, source);
  source = fullCountdownSourcePredecessor(file, source);
  const pin = Object.hasOwn(ownerReviewSourcePins, file) ? ownerReviewSourcePins[file] : null;
  if (!pin || sha(source) !== pin.after) return source;
  for (const [current, prior] of pin.edits) {
    assert.equal(source.split(current).length, 2, 'Exactly one complete reviewed source fragment');
    source = source.replace(current, prior);
  }
  assert.equal(sha(source), pin.before, 'Every original source byte reconstructed');
  return source;
}

// Only the complete default article fixture gains TOC row wrappers; body/anchors/dates remain literal.
export function ownerReviewHtmlPredecessor(html, key) {
  html = visualHtmlPredecessor(html, key);
  if ((key === 'about:true:false' || key === 'about:true:true') && sha(html) === '3b0cb4e5ab93c1f9e0008d35b9a4fcfe06ca85421a824fba0cea61e1cd9d5d9c') {
    const current = "<span class=\"fatherPhrase\"><span class=\"keep\">บริหารเวลา</span> <span class=\"keep\">บริหารเงิน</span> <span class=\"keep\">บริหารชีวิต</span></span>";
    assert.equal(html.split(current).length, 2, 'Only one complete paragraph quote wrapper');
    let prior = html.replace(current, "<span class=\"keep\">บริหารเวลา บริหารเงิน บริหารชีวิต</span>");
    const imageHint = '(max-width: 1279px) min(420px, calc(100vw - 40px)), (max-width: 1439px) calc(37.5vw - 84px), 456px';
    assert.equal(prior.split(imageHint).length, 3, 'One father image hint in img and React preload metadata only');
    prior = prior.replaceAll(imageHint, '(max-width: 899px) calc(100vw - 40px), 280px');
    assert.equal(sha(prior), '2e759121f0b0941c2c52f763fe663fdf290a68f90b99f3e195ea8e9c0d9817af', 'Every prior default About byte, including caption markup, retained');
    return prior;
  }

  if (key !== 'v5Article' || sha(html) !== 'c4f55c6eb7dba38573575c2d55cc73c885a96e6181f2ddac1d79787928158765') return html;
  let count = 0;
  const prior = html.replace(/<div class="tocRow">(<a href="[^"]+">[^<>]+<\/a>)<\/div>/g, (_, link) => { count++; return link; });
  assert.equal(count, 2, 'One original heading anchor in each desktop/mobile TOC');
  assert.equal(sha(prior), '1cac44d3f282dd8c6d84908a56ad457b7aa108bf54c8e9821899b0a92afaa906', 'Every prior integrated article byte restored');
  return prior;
}

// Exact generated metadata successor: move the five reviewed entries back; never copy a whole map.
export function ownerReviewLocationsPredecessor(source) {
  source = visualLocationsPredecessor(source);
  // Exactly eight About-only copy additions; preserve every historical pin and other scope.
  if (sha(source) === "0faebca850664af8aa5feb64eb988c7d78293524b04a129ce8d08c72f8b80631") {
    const locations = JSON.parse(source);
    for (const key of ["about.storyV2.photoAlt.scbs", "about.storyV2.photoAlt.phillip", "about.storyV2.photoAlt.bitkub", "about.storyV2.verify.tfpa", "about.storyV2.verify.sec", "about.storyV2.verify.oic", "about.storyV2.verify.back", "about.storyV2.verify.help"]) delete locations.about.entries[key];
    Object.values(locations.about.entries).forEach((entry, order) => { entry.order = order; });
    locations.about.entries["about.father.photoAlt"].section = "บทเรียนที่คุณพ่อสอน · ฉบับทดลอง UAT";
    locations.about.sections = locations.about.sections.filter(section => section !== "คุณวุฒิและใบอนุญาต");
    source = JSON.stringify(locations) + "\n";
    assert.equal(sha(source), "e4420a73bf940ee3b6260e53f90bf034fd64c254f93d2539c71a4b90220f987b", "Exact preceding About metadata; no other scope changed");
  }
  source = cmsCopyLocationsPredecessor(source);
  if (sha(source) !== 'f1f110371ce02eb8dfb9e20360b71795d2c55e105c1603c5d95d1f637f6a6e79') return source;
  const locations = JSON.parse(source);
  const site = locations.site, blog = locations.blog;
  for (const key of ['blog.categoryAccounts.title','blog.categoryAccounts.phillip','blog.categoryAccounts.maybank']) delete blog.entries[key];
  site.sections = site.sections.filter(section => section !== 'เครื่องมือ');
  blog.sections = blog.sections.filter(section => section !== 'ข้อความที่ระบบเลือกแสดงตามสถานการณ์');
  site.entries['site.nav.tools'].section = 'สำรวจ';
  blog.entries['blog.topicTools.title'].section = '… บทความ';
  blog.entries['blog.topicTools.title'].kind = 'หัวข้อส่วน';
  blog.entries['blog.topicTools.description'].section = '… บทความ';
  blog.entries['blog.topicTools.description'].kind = 'ย่อหน้า';
  for (const key of ['blog.lead','blog.faqCta']) blog.entries[key].section = 'อยากจัดลำดับแผนให้เหมาะกับชีวิตคุณ?';
  for (const [scope, moves] of [[site, [['site.nav.tools',10]]], [blog, [['blog.topicTools.title',20],['blog.topicTools.description',21],['blog.lead',58],['blog.faqCta',59]]]]) {
    const moved = new Map(moves.map(([key]) => [key, scope.entries[key]]));
    const entries = Object.entries(scope.entries).filter(([key]) => !moved.has(key));
    for (const [key, index] of moves) entries.splice(index,0,[key,moved.get(key)]);
    scope.entries = Object.fromEntries(entries.map(([key, value], order) => [key, { ...value, order }]));
  }
  const prior = JSON.stringify(locations) + '\n';
  assert.equal(sha(prior), '41ac751407cc2c2d5556db517d40ba7243363b81d02ac56eed73ae345ab96bc0', 'Every original generated map byte reconstructed');
  return prior;
}

// Owner 2026-10-29: show every existing countdown action; retain all older source admissions.
export function fullCountdownSourcePredecessor(file, source) {
  source = oneRowCountdownSourcePredecessor(file, source);
  if (file === 'components/ui/health-happy/HealthHappyCountdown.module.css' && sha(source) === 'bdf0ab886e7c3076913299ab605db68f9e11abd9838482ce26ea5149c9983fda') {
    assert.equal(source.split(".splitDigits .timer { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 12px 0; gap: 12px; border: 0; background: transparent; }").length, 2);
    source = source.replace(".splitDigits .timer { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 12px 0; gap: 12px; border: 0; background: transparent; }", ".splitDigits .timer { padding: 12px 0; gap: 12px; border: 0; background: transparent; }");
    assert.equal(source.split("  .splitDigits .timer { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 0; }").length, 2);
    source = source.replace("  .splitDigits .timer { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 0; }", "  .splitDigits .timer { gap: 8px; padding: 0; }");
    assert.equal(sha(source), ownerReviewSourcePins[file].after, 'Only the responsive full-size timer grid is restored');
    return source;
  }
  if (file !== 'components/layout/v5/V5.module.css' || sha(source) !== '3cbe59379e46a41539d41622e270d466a5fc651d612c7f48f39f19c06bc317fd') return source;
  const clearance = "/* Full campaign actions in Blog/Article keep the existing fixed LINE corner clear; Home owns its frame. */\n.countdownSlot:has(:global([data-campaign-placement=\"blog\"])), .countdownSlot:has(:global([data-campaign-placement=\"article\"])) { padding-inline-end: max(0px, calc(80px - var(--v5-gutter))); }\n@media (min-width: 1024px) { .countdownSlot:has(:global([data-campaign-placement=\"blog\"])), .countdownSlot:has(:global([data-campaign-placement=\"article\"])) { padding-inline-end: max(0px, calc(248px - var(--v5-gutter))); } }\n";
  assert.equal(source.split(clearance).length, 2);
  source = source.replace(clearance, '');
  const anchor = ':global(html[data-v5-countdown-ended]) .countdownSlot { display: none; }\n';
  assert.equal(source.split(anchor).length, 2);
  const prior = source.replace(anchor, anchor + "/* One LINE OA button per page (owner decision 2026-10-25): the dock is it, so the countdown's own\n   LINE action is not rendered in v5; its \"read details\" action and its analytics stay unchanged. */\n.countdownSlot :global([data-campaign-action=\"line\"]) { display: none; }\n");
  assert.equal(sha(prior), 'f5ac130e4627c2f141128fd6fc8517e69f81d650913e22e7141e39a34848d703', 'Only the old campaign LINE hide block is restored for historic proofs');
  return prior;
}

// Owner correction: all four units stay in one horizontal row. The rejected two-row bytes are proof history only.
export function oneRowCountdownSourcePredecessor(file, source) {
  if (file !== 'components/ui/health-happy/HealthHappyCountdown.module.css' || sha(source) !== '05b5e5726c6227036dbf0a18b63cc8a05420a51ec32464be4e0b713c9647e14c') return source;
  const current = "  .splitDigits .timer { gap: 4px; padding: 0; }\n  .splitDigits .numeral { font-size: clamp(18px, 6vw, 24px); }\n";
  assert.equal(source.split(current).length, 2);
  const prior = source.replace(current, "  .splitDigits .timer { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 0; }\n");
  assert.equal(sha(prior), 'bdf0ab886e7c3076913299ab605db68f9e11abd9838482ce26ea5149c9983fda', 'Only mobile numeral sizing and spacing change; every earlier byte stays frozen');
  return prior;
}

// Admit only the exact About word-markup and descendant-selector corrections.
export function ownerReviewAboutWordsPredecessor(file, source) {
  source = ownerReviewStaticCredentialsPredecessor(file, source);
  if (file === "features/about/page.tsx" && sha(source) === "f1540c85d551a708b02254e56383a4f4b67571264afb21e3bae0b958014ee9c0") {
    source = source.replace('import OwnerStoryV2, { keepWords } from "./OwnerStoryV2";', 'import OwnerStoryV2 from "./OwnerStoryV2";')
      .replace('  const aboutWords = (value: ReactNode) => IS_REVIEW_ENVIRONMENT ? keepWords(value) : value;\n', '')
      .replace(/aboutWords\(((?:home|text)\.node\("[^"]+"\)|displayName|role|partner\.name|partner\.role)\)/g, '$1');
    assert.equal(sha(source), "82c6d9416b4c3c633e90fc2c463dd4cfdd25ec39e1125a8590165f7c1162e463", "Exact preceding About renderer");
  }
  if (file === "features/about/About.module.css" && sha(source) === "cf9c85e787b5e5ae7f0a696f4ca428002c8fa7478737c77605b0c64e69424fe4") {
    source = source.replace('.credentials > li:last-child:has(button)', '.credentials > li:last-child:has(> button)');
    assert.equal(sha(source), "dd4c912f5ca4f0f22c1b983f70f1f3e60cd550447c498c3073712db83951ce58", "Exact preceding About CSS; LINE reserve retained");
  }
  return source;
}

// COO 30-Oct: only these exact static credential successors enter the historical proof chain.
export const staticCredentialSourcePins = Object.freeze({
  "features/about/About.module.css": {
    "before": "cf9c85e787b5e5ae7f0a696f4ca428002c8fa7478737c77605b0c64e69424fe4",
    "after": "9287a5320eec10b026d9f46d43633876b1bf9c7d062e0011d44d22726df3d9ae",
    "edits": [
      [
        "\n/* The static story cards own their borders; keep one 20px page gutter on both sides. */\n.ownerStoryV2 .credentials { grid-template-columns: minmax(0, 1fr); align-items: stretch; margin: 0; padding: 0; border: 0; background: none; }\n.ownerStoryV2 .credentials > li { height: 100%; padding: 0; }\n@media (min-width: 640px) { .ownerStoryV2 .credentials { grid-template-columns: repeat(2, minmax(0, 1fr)); } }\n@media (min-width: 1024px) { .ownerStoryV2 .credentials { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; } }\n",
        ""
      ]
    ]
  },
  "features/home/v5/V5Home.module.css": {
    "before": "70527d8d17452244f2ed2089374141ae6a5569682ea0e66c298e7a652a2da6ba",
    "after": "6bd76ed4714b066d6f78e7a2c27c70141218d1f50c541cec153f8fbce336f809",
    "edits": [
      [
        "\n/* The existing native compact strip/grid is scoped to the owner-selected static UAT badges. */\n.staticCredentials { grid-auto-columns: max-content; gap: 8px; padding: 0 20px 0 0; }\n@media (min-width: 1024px) { .staticCredentials { grid-auto-columns: auto; gap: 12px 16px; padding: 16px; border: 1px solid var(--v5-border); border-radius: var(--v5-radius); } }\n",
        ""
      ]
    ]
  },
  "features/home/v5/V5Home.tsx": {
    "before": "ae4cdb7cb2b0c43c2aad88068a1ae9d571f5c4004671f67b86ff4b888ff2e800",
    "after": "714b243154c0217b9e2f2d3b2a1dbd437ef3c11ad4bc2b97a3794e4928081070",
    "edits": [
      [
        "import { IS_REVIEW_ENVIRONMENT } from \"@/lib/deployment-environment\";\n",
        ""
      ],
      [
        "<V5CredentialCards className={IS_REVIEW_ENVIRONMENT ? `${styles.credentials} ${styles.staticCredentials}` : styles.credentials} qualification={qualification} licenceCards={licenceCards} compact />",
        "<V5CredentialCards className={styles.credentials} qualification={qualification} licenceCards={licenceCards} />"
      ]
    ]
  }
});
export function ownerReviewStaticCredentialsPredecessor(file, source) {
  source = ownerReviewVisualSourcePredecessor(file, source);
  const pin = Object.hasOwn(staticCredentialSourcePins, file) ? staticCredentialSourcePins[file] : null;
  if (!pin || typeof source !== "string" || sha(source) !== pin.after) return source;
  for (const [current, previous] of pin.edits) {
    assert.equal(source.split(current).length, 2, "Only one complete reviewed static credential edit");
    source = source.replace(current, previous);
  }
  assert.equal(sha(source), pin.before, "Every prior credential caller/layout byte restored");
  return source;
}

// Exact approved editor label/field-target successor; every earlier safety byte remains pinned.
export const editorSourcePins = Object.freeze({
  "lib/content/public-copy-registry.ts": {
    "before": "4a426876b5c37e45fcdc883bdcc38572e8c16a6f51a3aad3b1ced697939005ae",
    "after": "cb72ea9412d855c0568c4a93f4fc8002849a6a239219251e8b9f1261122f60e3",
    "edits": [
      [
        "label: \"\u0e23\u0e39\u0e49\u0e08\u0e31\u0e01\u0e1b\u0e31\u0e49\u0e19\"",
        "label: \"\u0e23\u0e39\u0e49\u0e08\u0e31\u0e01\u0e1b\u0e31\u0e49\u0e19 (\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e40\u0e14\u0e34\u0e21\u0e23\u0e30\u0e2b\u0e27\u0e48\u0e32\u0e07\u0e15\u0e23\u0e27\u0e08 UAT)\""
      ]
    ]
  },
  "lib/admin/public-copy-preview.ts": {
    "before": "08f1737857833796f02404adb8a38a671d157abc59a564fae23f4c7125c32498",
    "after": "e1bd50132677eae1406c71e071a728cc2c0ac023034a6ff7526dc430d104f56e",
    "edits": [
      [
        "    return [key, encodeCopyValue(stegaCombine(text, { origin: \"sanity.io\", href, baseUrl: \"/studio\", id, type: \"publicPageCopy\", path }), style)];",
        "    return [key, encodeCopyValue(stegaCombine(text, { origin: \"sanity.io\", href }), style)];"
      ],
      [
        "function withEditTargets(scope: PublicCopyScope, values: Record<string, string>, entries: Array<{ key: string; _key: string }> = []) {",
        "function withEditTargets(scope: PublicCopyScope, values: Record<string, string>) {"
      ],
      [
        "    const persistedKey = entries.find(entry => entry.key === key)?._key;\n    const entryKey = typeof persistedKey === \"string\" && persistedKey ? persistedKey : key.replaceAll(\".\", \"-\");\n    const path = `entries[_key==${JSON.stringify(entryKey)}].text`;",
        "    const path = `entries[_key==\"${key.replaceAll(\".\", \"-\")}\"].text`;"
      ],
      [
        "    const values = parsePublicCopy(scope, data) as Record<string, string>;\n    return withEditTargets(scope, values, data?.entries);",
        "    return withEditTargets(scope, parsePublicCopy(scope, data) as Record<string, string>);"
      ]
    ]
  }
});
export function ownerReviewEditorSourcePredecessor(file, source) {
  const pin = Object.hasOwn(editorSourcePins, file) ? editorSourcePins[file] : null;
  if (!pin || typeof source !== "string" || sha(source) !== pin.after) return source;
  for (const [current, previous] of pin.edits) {
    assert.equal(source.split(current).length, 2, "one reviewed editor change");
    source = source.replace(current, previous);
  }
  assert.equal(sha(source), pin.before, "complete historical editor source restored");
  return source;
}

// Exact 30-Oct native-approved visual successor. Unknown, partial and duplicate files stay unmodified.
export const visualSourcePins = Object.freeze({
  "features/about/About.module.css": {
    "before": "9287a5320eec10b026d9f46d43633876b1bf9c7d062e0011d44d22726df3d9ae",
    "after": "7f42284c880e0d94befef1d9863d80d0b6886aa7fa0f19f696caa8a2b5441b11",
    "edits": [
      [
        ".credentials { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; } }\n\n/* Saved native timeline: decorative rails share the actual heading/body grid rows. */\n.ownerStoryV2 { --owner-story-gap: 72px; --owner-chapter-gap: 24px; --owner-timeline-offset: 24px; --owner-timeline-dot: 10px; --owner-timeline-rule: color-mix(in srgb, var(--v5-gold) 35%, transparent); }\n.ownerStoryChapter { position: relative; grid-template-rows: auto auto; }\n.ownerStoryChapter > h2 { position: relative; grid-area: 1 / 1; }\n.ownerStoryChapterBody { grid-area: 2 / 1; display: grid; gap: inherit; min-width: 0; }\n.ownerStoryChapter::before, .ownerStoryChapter::after { content: \"\"; grid-column: 1; width: 2px; justify-self: start; align-self: stretch; transform: translateX(calc(-1 * var(--owner-timeline-offset) - 1px)); background: var(--owner-timeline-rule); pointer-events: none; }\n.ownerStoryChapter::before { grid-row: 1; }\n.ownerStoryChapter::after { grid-row: 2; margin-top: calc(-1 * var(--owner-chapter-gap)); margin-bottom: calc(-1 * var(--owner-story-gap)); }\n.ownerStoryChapter:first-child::before { background: linear-gradient(to bottom, transparent 50%, var(--owner-timeline-rule) 50%); }\n.ownerStoryChapter:last-child::before { background: linear-gradient(to bottom, var(--owner-timeline-rule) 50%, transparent 50%); }\n.ownerStoryChapter:last-child::after { display: none; }\n.ownerStoryChapter > h2::before { content: \"\"; position: absolute; left: calc(-1 * var(--owner-timeline-offset)); top: 50%; width: var(--owner-timeline-dot); height: var(--owner-timeline-dot); border-radius: 50%; transform: translate(-50%, -50%); background: var(--v5-gold); pointer-events: none; }\n@media (max-width: 899px) { .ownerStoryV2 { --owner-story-gap: 56px; --owner-chapter-gap: 20px; --owner-timeline-offset: 10px; --owner-timeline-dot: 6px; } }\n\n/* The approved alpha portrait stays inside its existing rounded frame, with the full head visible. */\n.portrait { object-fit: contain; }\n",
        ".credentials { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; } }\n"
      ]
    ]
  },
  "features/about/OwnerStoryV2.tsx": {
    "before": "a70f02f6417f7a768ea7cb5597c075c9aee249ad7f88d7bff5a678be5a8e8c20",
    "after": "eaef878ba49c1ecc9008d83861d2c4cc06b7c4b504b213523a66c873dab1ef5f",
    "edits": [
      [
        "rds(text.node(university.heading))}</h2>\n      <div className={styles.ownerStoryChapterBody}>\n        <div className={styles.ownerStoryPair}>\n          <div className={styles.ownerStoryCopy}><Paragraphs keys={university.paragraphs.slice(0, 7)} text={text} /></div>\n          <OwnerPhoto src=\"/assets/owner-scbs-u-invest.webp\" alt={text(\"about.storyV2.photoAlt.scbs\")} width={2448} height={3060} />\n        </div>\n        <div className={styles.ownerStoryPair}>\n          <div className={styles.ownerStoryCopy}><Paragraphs keys={university.paragraphs.slice(7)} text={text} /></div>\n          <div className={styles.ownerStoryCareerPhotos}>\n            <OwnerPhoto src=\"/assets/owner-phillip-seminar.webp\" alt={text(\"about.storyV2.photoAlt.phillip\")} width={1040} height={1040} />\n            <OwnerPhoto src=\"/assets/owner-bitkub.webp\" alt={text(\"about.storyV2.photoAlt.bitkub\")} width={1364} height={1364} />\n          </div>\n        </div>\n      </div>\n    </section>\n    <section className={styles.ownerStoryChapter} aria-labelledby=\"about-owner-story-two\">\n      <h2 id=\"about-owner-story-two\">{keepWords(text.node(father.heading))}</h2>\n      <div className={styles.ownerStoryChapterBody}>\n        <div className={styles.ownerStoryPair}>\n          <div className={styles.ownerStoryCopy}>\n            <Paragraphs keys={father.paragraphs.slice(0, 2)} text={text} />\n            <blockquote className={styles.ownerStoryMotto}>{keepWords(text.node(father.paragraphs[2]))}</blockquote>\n          </div>\n          <OwnerPhoto src=\"/assets/ccpun-father-v5-colour.webp\" alt={text(\"about.father.photoAlt\")} width={1086} height={1448} />\n        </div>\n        <div className={styles.ownerStoryCopy}><Paragraphs keys={father.paragraphs.slice(3)} text={text} /></div>\n      </div>\n    </section>\n    <section className={styles.ownerStoryChapter} aria-labelledby=\"about-owner-story-three\">\n      <h2 id=\"about-owner-story-three\">{keepWords(text.node(career.heading))}</h2>\n      <div className={styles.ownerStoryChapterBody}>\n        <div className={styles.ownerStoryCopy}><Paragraphs keys={career.paragraphs} text={text} /></div>\n        <V5CredentialCards className={styles.credentials} qualification={qualification} licenceCards={licenceCards} verification={{ afpt: tfpa, life: oic, investment: sec, nonLife: oic }} />\n        <p className={flipStyles.verifyHelp}>{text.node(\"about.storyV2.verify.help\")}</p>\n      </div>\n    </section>\n    <section className={styles.ownerStoryChapter} aria-labelledby=\"about-owner-story-four\">\n      <h2 id=\"about-owner-story-four\">{keepWords(text.node(today.heading))}</h2>\n      <div className={styles.ownerStoryChapterBody}>\n        <div className={styles.ownerStoryCopy}><Paragraphs keys={today.paragraphs} text={text} /></div>\n        <V5ChatLink href={V5_LINE_URL} className={styles.ownerStoryChatLink}>{text.node(\"about.storyV2.ctaLabel\")}</V5ChatLink>\n      </div>\n    </section>\n  </article>;\n}\n",
        "rds(text.node(university.heading))}</h2>\n      <div className={styles.ownerStoryPair}>\n        <div className={styles.ownerStoryCopy}><Paragraphs keys={university.paragraphs.slice(0, 7)} text={text} /></div>\n        <OwnerPhoto src=\"/assets/owner-scbs-u-invest.webp\" alt={text(\"about.storyV2.photoAlt.scbs\")} width={2448} height={3060} />\n      </div>\n      <div className={styles.ownerStoryPair}>\n        <div className={styles.ownerStoryCopy}><Paragraphs keys={university.paragraphs.slice(7)} text={text} /></div>\n        <div className={styles.ownerStoryCareerPhotos}>\n          <OwnerPhoto src=\"/assets/owner-phillip-seminar.webp\" alt={text(\"about.storyV2.photoAlt.phillip\")} width={1040} height={1040} />\n          <OwnerPhoto src=\"/assets/owner-bitkub.webp\" alt={text(\"about.storyV2.photoAlt.bitkub\")} width={1364} height={1364} />\n        </div>\n      </div>\n    </section>\n    <section className={styles.ownerStoryChapter} aria-labelledby=\"about-owner-story-two\">\n      <h2 id=\"about-owner-story-two\">{keepWords(text.node(father.heading))}</h2>\n      <div className={styles.ownerStoryPair}>\n        <div className={styles.ownerStoryCopy}>\n          <Paragraphs keys={father.paragraphs.slice(0, 2)} text={text} />\n          <blockquote className={styles.ownerStoryMotto}>{keepWords(text.node(father.paragraphs[2]))}</blockquote>\n        </div>\n        <OwnerPhoto src=\"/assets/ccpun-father-v5-colour.webp\" alt={text(\"about.father.photoAlt\")} width={1086} height={1448} />\n      </div>\n      <div className={styles.ownerStoryCopy}><Paragraphs keys={father.paragraphs.slice(3)} text={text} /></div>\n    </section>\n    <section className={styles.ownerStoryChapter} aria-labelledby=\"about-owner-story-three\">\n      <h2 id=\"about-owner-story-three\">{keepWords(text.node(career.heading))}</h2>\n      <div className={styles.ownerStoryCopy}><Paragraphs keys={career.paragraphs} text={text} /></div>\n      <V5CredentialCards className={styles.credentials} qualification={qualification} licenceCards={licenceCards} verification={{ afpt: tfpa, life: oic, investment: sec, nonLife: oic }} />\n      <p className={flipStyles.verifyHelp}>{text.node(\"about.storyV2.verify.help\")}</p>\n    </section>\n    <section className={styles.ownerStoryChapter} aria-labelledby=\"about-owner-story-four\">\n      <h2 id=\"about-owner-story-four\">{keepWords(text.node(today.heading))}</h2>\n      <div className={styles.ownerStoryCopy}><Paragraphs keys={today.paragraphs} text={text} /></div>\n      <V5ChatLink href={V5_LINE_URL} className={styles.ownerStoryChatLink}>{text.node(\"about.storyV2.ctaLabel\")}</V5ChatLink>\n    </section>\n  </article>;\n}\n"
      ]
    ]
  },
  "features/about/page.tsx": {
    "before": "f1540c85d551a708b02254e56383a4f4b67571264afb21e3bae0b958014ee9c0",
    "after": "20437b1ed0e13c69167edc0ed5b0ffeb00f3a37ef546ec1533f18ea47fa30030",
    "edits": [
      [
        "`;\nconst DESCRIPTION = personSchema.description;\nconst PORTRAIT_DARK = \"/assets/website-v5/about-dark-white-outline-821c292b.png\";\nconst PORTRAIT_LIGHT = \"/assets/website-v5/about-light-white-outline-d013c999.png\";\n// The existing father-trial strings remain UAT-only and keep their original approval status.\ntype AboutText = ReturnType<typeof publicCopyText>;\n\nexport const metadata: Metadata = {\n  title: TITLE,\n  description: DESCRIPTION,\n  alternates: { canonical: URL },\n  // UAT stays noindex like every other review page; Production indexes the About page.\n  robots: IS_REVIEW_ENVIRONMENT ? { index: false, follow: false } : { index: true, follow: true },\n  openGraph: { type: \"profile\", locale: \"th_TH\", url: URL, title: TITLE, description: DESCRIPTION, siteName: \"CCPun Financial Advisor\", images: [{ url: \"https://ccpun.com/og-image-20260610.webp?v=68ae8d8\", width: 1200, height: 630 }] },\n  twitter: { card: \"summary_large_image\", title: TITLE, description: DESCRIPTION },\n};\n\n/** UAT-only slot for owner copy that does not exist yet. Production builds never render it. */\nfunction OwnerCopySlot({ slot, note }: { slot: string; note: string }) {\n  if (!IS_REVIEW_ENVIRONMENT) return null;\n  return <p className={styles.slot} data-uat-placeholder={slot}><strong>UAT</strong> {note}</p>;\n}\n\n/**\n * The owner-chosen father photo (treatment a, colour, 2026-10-25) accompanies the UAT story trial.\n * The story and caption await final owner approval; Production builds never render this photo.\n */\nfunction FatherPhotoSlot({ text }: { text: AboutText }) {\n  if (!IS_REVIEW_ENVIRONMENT) return null;\n  const caption = text.node(\"about.father.caption\");\n  return (\n    <figure className={styles.fatherPhoto} data-uat-placeholder=\"about-father-photo\">\n      <Image src=\"/assets/ccpun-father-v5-colour.webp\" alt={text(\"about.father.photoAlt\")} width={1086} height={1448} sizes=\"(max-width: 1279px) min(420px, calc(100vw - 40px)), (max-width: 1439px) calc(37.5vw - 84px), 456px\" />\n      <figcaption>{typeof caption === \"string\" ? caption.split(\"\\n\").map((line, index) => <span key={line}>{index > 0 ? <br /> : null}{keepFatherPhrase(line)}</span>) : caption}</figcaption>\n    </figure>\n  );\n}\n\n/** Match the existing licence-card `keep` mechanism without changing the plain text. */\nfunction keepFatherPhrase(value: ReactNode, wrapTerms = false) {\n  if (typeof value !== \"string\") return value;\n  const at = value.indexOf(FATHER_STORY_KEEP);\n  if (at < 0) return value;\n  const phrase = wrapTerms ? <span className={styles.fatherPhrase}>{FATHER_STORY_KEEP.split(\" \").flatMap((term, index) => [\n    index ? \" \" : null, <span className={flipStyles.keep} key={term}>{term}</span>,\n  ])}</span> : <span className={flipStyles.keep}>{FATHER_STORY_KEEP}</span>;\n  return <>{value.slice(0, at)}{phrase}{value.slice(at + FATHER_STORY_KEEP.length)}</>;\n}\n\nfunction FatherStory({ text }: { text: AboutText }) {\n  if (!IS_REVIEW_ENVIRONMENT) return null;\n  return (\n    <div className={styles.fatherStory} data-uat-trial=\"about-father-story\">\n      <h3>{text.node(\"about.father.heading\")}</h3>\n      <p>{keepFatherPhrase(text.node(\"about.father.paragraph1\"), true)}</p>\n      <FatherPhotoSlot text={text} />\n      <div className={styles.fatherStoryBody}>\n        {([2, 3, 4, 5, 6] as const).map(index => <p key={index}>{text.node(`about.father.paragraph${index}`)}</p>)}\n        <ul>{([1, 2, 3] as const).map(index => <li key={index}>{text.node(`about.father.question${index}`)}</li>)}</ul>\n        <p>{text.node(\"about.father.paragraph7\")}</p>\n      </div>\n    </div>\n  );\n}\n\nexport async function renderAboutPage(copy?: PublicCopyValues, siteCopy?: PublicCopyValues, homeCopy?: PublicCopyValues, authorOverride?: ArticleAuthorProfile | null) {\n  const [authorProfile, homeValues, siteValues, pageValues] = await Promise.all([\n    authorOverride === undefined ? getPrimaryAuthorProfile().catch(() => null) : authorOverride,\n    homeCopy ?? getPublicCopy(\"home\"), siteCopy ?? getPublicCopy(\"site\"), copy ?? getPublicCopy(\"about\"),\n  ]);\n  const text = publicCopyText(pageValues);\n  const aboutWords = (value: ReactNode) => IS_REVIEW_ENVIRONMENT ? keepWords(value) : value;\n  const home = publicCopyText(homeValues);\n  const site = publicCopyText(siteValues);\n  const { displayName, role, qualification, licenceCards } = v5AdvisorProfile(authorProfile, home);\n  const partners = v5Partners(home);\n  const aboutLabel = site(\"site.footer.about\");\n\n  const schema = {\n    \"@context\": \"https://schema.org\",\n    \"@graph\": [\n      {\n        \"@type\": \"ProfilePage\",\n        \"@id\": `${URL}#profilepage`,\n        url: URL,\n        name: TITLE,\n        description: DESCRIPTION,\n        inLanguage: \"th\",\n        isPartOf: { \"@id\": \"https://ccpun.com/#website\" },\n        breadcrumb: { \"@id\": `${URL}#breadcrumb` },\n        mainEntity: { \"@id\": CCPUN_PERSON_ID },\n        about: { \"@id\": CCPUN_PERSON_ID },\n      },\n      // The full Person entity (credentials, organisation, sameAs) is emitted site-wide by the\n      // layout graph under the same @id; this node only adds the portrait shown on this page.\n      { \"@type\": \"Person\", \"@id\": CCPUN_PERSON_ID, name: personSchema.name, image: `https://ccpun.com${PORTRAIT_DARK}` },\n      {\n        \"@type\": \"BreadcrumbList\",\n        \"@id\": `${URL}#breadcrumb`,\n        itemListElement: [\n          { \"@type\": \"ListItem\", position: 1, name: text(\"about.breadcrumb.home\"), item: \"https://ccpun.com/\" },\n          { \"@type\": \"ListItem\", position: 2, name: aboutLabel, item: URL },\n        ],\n      },\n    ],\n  };\n\n  return (\n    <V5Page current=\"/about/\" siteCopy={siteValues}>\n      <script type=\"application/ld+json\" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, \"\\\\u003c\") }} />\n      <section className={styles.hero} aria-labelledby=\"about-title\">\n        <div className={shell.inner}>\n          <V5Breadcrumbs label={site(\"site.nav.mainLabel\")} items={[{ href: \"/\", label: text(\"about.breadcrumb.home\") }, { label: aboutLabel }]} />\n          <div className={styles.heroGrid}>\n            <div>\n              <h1 id=\"about-title\" className={shell.h1}>{aboutWords(home.node(\"home.eyebrow2\"))}</h1>\n              <p className={styles.identity}><strong>{aboutWords(displayName)}</strong><span>{aboutWords(role)}</span></p>\n              {IS_REVIEW_ENVIRONMENT ? <p className={styles.ownerHeroIntro}>{aboutWords(text.node(\"about.storyV2.heroIntro\"))}</p> : null}\n              {!IS_REVIEW_ENVIRONMENT ? <V5CredentialCards className={styles.credentials} qualification={qualification} licenceCards={licenceCards} /> : null}\n            </div>\n            <div className={styles.portraitFrame}>\n              {/* Owner-approved portrait (photo 4, v5b set, 2026-10-25), art-directed per theme. Next's theme-image\n                  pattern: both stay lazy with high fetch priority, so only the visible theme's file is fetched. */}\n              <Image className={`${styles.portrait} ${styles.portraitDark}`} src={PORTRAIT_DARK} alt={home(\"home.website43Homealt8\")} width={1248} height={1872} sizes=\"(max-width: 899px) calc(100vw - 40px), 440px\" fetchPriority=\"high\" />\n              <Image className={`${styles.portrait} ${styles.portraitLight}`} src={PORTRAIT_LIGHT} alt={home(\"home.website43Homealt8\")} width={1248} height={1872} sizes=\"(max-width: 899px) calc(100vw - 40px), 440px\" fetchPriority=\"high\" />\n ",
        "`;\nconst DESCRIPTION = personSchema.description;\nconst PORTRAIT_DARK = \"/assets/ccpun-portrait-v5-about-dark.webp\";\nconst PORTRAIT_LIGHT = \"/assets/ccpun-portrait-v5-about-light.webp\";\n// The existing father-trial strings remain UAT-only and keep their original approval status.\ntype AboutText = ReturnType<typeof publicCopyText>;\n\nexport const metadata: Metadata = {\n  title: TITLE,\n  description: DESCRIPTION,\n  alternates: { canonical: URL },\n  // UAT stays noindex like every other review page; Production indexes the About page.\n  robots: IS_REVIEW_ENVIRONMENT ? { index: false, follow: false } : { index: true, follow: true },\n  openGraph: { type: \"profile\", locale: \"th_TH\", url: URL, title: TITLE, description: DESCRIPTION, siteName: \"CCPun Financial Advisor\", images: [{ url: \"https://ccpun.com/og-image-20260610.webp?v=68ae8d8\", width: 1200, height: 630 }] },\n  twitter: { card: \"summary_large_image\", title: TITLE, description: DESCRIPTION },\n};\n\n/** UAT-only slot for owner copy that does not exist yet. Production builds never render it. */\nfunction OwnerCopySlot({ slot, note }: { slot: string; note: string }) {\n  if (!IS_REVIEW_ENVIRONMENT) return null;\n  return <p className={styles.slot} data-uat-placeholder={slot}><strong>UAT</strong> {note}</p>;\n}\n\n/**\n * The owner-chosen father photo (treatment a, colour, 2026-10-25) accompanies the UAT story trial.\n * The story and caption await final owner approval; Production builds never render this photo.\n */\nfunction FatherPhotoSlot({ text }: { text: AboutText }) {\n  if (!IS_REVIEW_ENVIRONMENT) return null;\n  const caption = text.node(\"about.father.caption\");\n  return (\n    <figure className={styles.fatherPhoto} data-uat-placeholder=\"about-father-photo\">\n      <Image src=\"/assets/ccpun-father-v5-colour.webp\" alt={text(\"about.father.photoAlt\")} width={1086} height={1448} sizes=\"(max-width: 1279px) min(420px, calc(100vw - 40px)), (max-width: 1439px) calc(37.5vw - 84px), 456px\" />\n      <figcaption>{typeof caption === \"string\" ? caption.split(\"\\n\").map((line, index) => <span key={line}>{index > 0 ? <br /> : null}{keepFatherPhrase(line)}</span>) : caption}</figcaption>\n    </figure>\n  );\n}\n\n/** Match the existing licence-card `keep` mechanism without changing the plain text. */\nfunction keepFatherPhrase(value: ReactNode, wrapTerms = false) {\n  if (typeof value !== \"string\") return value;\n  const at = value.indexOf(FATHER_STORY_KEEP);\n  if (at < 0) return value;\n  const phrase = wrapTerms ? <span className={styles.fatherPhrase}>{FATHER_STORY_KEEP.split(\" \").flatMap((term, index) => [\n    index ? \" \" : null, <span className={flipStyles.keep} key={term}>{term}</span>,\n  ])}</span> : <span className={flipStyles.keep}>{FATHER_STORY_KEEP}</span>;\n  return <>{value.slice(0, at)}{phrase}{value.slice(at + FATHER_STORY_KEEP.length)}</>;\n}\n\nfunction FatherStory({ text }: { text: AboutText }) {\n  if (!IS_REVIEW_ENVIRONMENT) return null;\n  return (\n    <div className={styles.fatherStory} data-uat-trial=\"about-father-story\">\n      <h3>{text.node(\"about.father.heading\")}</h3>\n      <p>{keepFatherPhrase(text.node(\"about.father.paragraph1\"), true)}</p>\n      <FatherPhotoSlot text={text} />\n      <div className={styles.fatherStoryBody}>\n        {([2, 3, 4, 5, 6] as const).map(index => <p key={index}>{text.node(`about.father.paragraph${index}`)}</p>)}\n        <ul>{([1, 2, 3] as const).map(index => <li key={index}>{text.node(`about.father.question${index}`)}</li>)}</ul>\n        <p>{text.node(\"about.father.paragraph7\")}</p>\n      </div>\n    </div>\n  );\n}\n\nexport async function renderAboutPage(copy?: PublicCopyValues, siteCopy?: PublicCopyValues, homeCopy?: PublicCopyValues, authorOverride?: ArticleAuthorProfile | null) {\n  const [authorProfile, homeValues, siteValues, pageValues] = await Promise.all([\n    authorOverride === undefined ? getPrimaryAuthorProfile().catch(() => null) : authorOverride,\n    homeCopy ?? getPublicCopy(\"home\"), siteCopy ?? getPublicCopy(\"site\"), copy ?? getPublicCopy(\"about\"),\n  ]);\n  const text = publicCopyText(pageValues);\n  const aboutWords = (value: ReactNode) => IS_REVIEW_ENVIRONMENT ? keepWords(value) : value;\n  const home = publicCopyText(homeValues);\n  const site = publicCopyText(siteValues);\n  const { displayName, role, qualification, licenceCards } = v5AdvisorProfile(authorProfile, home);\n  const partners = v5Partners(home);\n  const aboutLabel = site(\"site.footer.about\");\n\n  const schema = {\n    \"@context\": \"https://schema.org\",\n    \"@graph\": [\n      {\n        \"@type\": \"ProfilePage\",\n        \"@id\": `${URL}#profilepage`,\n        url: URL,\n        name: TITLE,\n        description: DESCRIPTION,\n        inLanguage: \"th\",\n        isPartOf: { \"@id\": \"https://ccpun.com/#website\" },\n        breadcrumb: { \"@id\": `${URL}#breadcrumb` },\n        mainEntity: { \"@id\": CCPUN_PERSON_ID },\n        about: { \"@id\": CCPUN_PERSON_ID },\n      },\n      // The full Person entity (credentials, organisation, sameAs) is emitted site-wide by the\n      // layout graph under the same @id; this node only adds the portrait shown on this page.\n      { \"@type\": \"Person\", \"@id\": CCPUN_PERSON_ID, name: personSchema.name, image: `https://ccpun.com${PORTRAIT_DARK}` },\n      {\n        \"@type\": \"BreadcrumbList\",\n        \"@id\": `${URL}#breadcrumb`,\n        itemListElement: [\n          { \"@type\": \"ListItem\", position: 1, name: text(\"about.breadcrumb.home\"), item: \"https://ccpun.com/\" },\n          { \"@type\": \"ListItem\", position: 2, name: aboutLabel, item: URL },\n        ],\n      },\n    ],\n  };\n\n  return (\n    <V5Page current=\"/about/\" siteCopy={siteValues}>\n      <script type=\"application/ld+json\" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, \"\\\\u003c\") }} />\n      <section className={styles.hero} aria-labelledby=\"about-title\">\n        <div className={shell.inner}>\n          <V5Breadcrumbs label={site(\"site.nav.mainLabel\")} items={[{ href: \"/\", label: text(\"about.breadcrumb.home\") }, { label: aboutLabel }]} />\n          <div className={styles.heroGrid}>\n            <div>\n              <h1 id=\"about-title\" className={shell.h1}>{aboutWords(home.node(\"home.eyebrow2\"))}</h1>\n              <p className={styles.identity}><strong>{aboutWords(displayName)}</strong><span>{aboutWords(role)}</span></p>\n              {IS_REVIEW_ENVIRONMENT ? <p className={styles.ownerHeroIntro}>{aboutWords(text.node(\"about.storyV2.heroIntro\"))}</p> : null}\n              {!IS_REVIEW_ENVIRONMENT ? <V5CredentialCards className={styles.credentials} qualification={qualification} licenceCards={licenceCards} /> : null}\n            </div>\n            <div className={styles.portraitFrame}>\n              {/* Owner-approved portrait (photo 4, v5b set, 2026-10-25), art-directed per theme. Next's theme-image\n                  pattern: both stay lazy with high fetch priority, so only the visible theme's file is fetched. */}\n              <Image className={`${styles.portrait} ${styles.portraitDark}`} src={PORTRAIT_DARK} alt={home(\"home.website43Homealt8\")} width={1200} height={1800} sizes=\"(max-width: 899px) calc(100vw - 40px), 440px\" fetchPriority=\"high\" />\n              <Image className={`${styles.portrait} ${styles.portraitLight}`} src={PORTRAIT_LIGHT} alt={home(\"home.website43Homealt8\")} width={1200} height={1800} sizes=\"(max-width: 899px) calc(100vw - 40px), 440px\" fetchPriority=\"high\" />\n "
      ]
    ]
  },
  "features/ci-planning/v5/V5CiPlanning.tsx": {
    "before": "b1b53c5eab166925dcb6886a1f87c041b7be6dd0c58cdea97eee7e6ca80ca96f",
    "after": "d7fa43b8a9d355e21a8939fe24cf7e675222527e4b1a3acc5c8003450b95b3a3",
    "edits": [
      [
        "tyle={{ marginTop: 0 }}>{t.node('ci.landing.description13')}</p>\n            <a className={shell.textLink} href=\"https://www.toryod.co/projects/35d2877e-e97a-45ee-a6df-aefa5e09e2b3-ccpun-s-ci-planning\" target=\"_blank\" rel=\"noopener\" aria-label={t('ci.landing.ariaLabel')}>\n              {t.node('ci.landing.alt')}\n            </a>\n          </div>\n        </div>\n      </section>\n    </V5Page>",
        "tyle={{ marginTop: 0 }}>{t.node('ci.landing.description13')}</p>\n            <a href=\"https://www.toryod.co/projects/35d2877e-e97a-45ee-a6df-aefa5e09e2b3-ccpun-s-ci-planning\" target=\"_blank\" rel=\"noopener\" aria-label={t('ci.landing.ariaLabel')}>\n              {/* eslint-disable-next-line @next/next/no-img-element -- TorYod badge is a vendor-hosted SVG that must remain external. */}\n              <img src=\"https://www.toryod.co/badge/35d2877e-e97a-45ee-a6df-aefa5e09e2b3\" alt={t('ci.landing.alt')} width=\"240\" height=\"54\" loading=\"lazy\" decoding=\"async\" />\n            </a>\n          </div>\n        </div>\n      </section>\n    </V5Page>"
      ]
    ]
  },
  "features/home/v5/V5Home.module.css": {
    "before": "6bd76ed4714b066d6f78e7a2c27c70141218d1f50c541cec153f8fbce336f809",
    "after": "11ab0b45bd42edc6f42acf83ca51bcd7f5ec53d2cb263fb6752a0747bb432f56",
    "edits": [
      [
        "eft: 1px solid var(--v5-border-soft); }\n  .painCard:first-child { padding-left: 28px; border-left: 0; }\n}\n.painIcon { display: block; width: 24px; height: 24px; mar",
        "eft: 1px solid var(--v5-border-soft); }\n  .painCard:first-child { padding-left: 0; border-left: 0; }\n}\n.painIcon { display: block; width: 24px; height: 24px; mar"
      ]
    ]
  },
  "features/home/v5/V5Home.tsx": {
    "before": "714b243154c0217b9e2f2d3b2a1dbd437ef3c11ad4bc2b97a3794e4928081070",
    "after": "b52dc5574b8ef6a5f1f73d653ff3d5d15b8f8720d4e2636d83b22db48da3f9bf",
    "edits": [
      [
        "   <div className={styles.portrait}>\n            <Image src=\"/assets/website-v5/home-hero-white-outline-8e7f5dc2.png\" alt={text(\"home.website43Homealt\")} fill preload loading=\"eager\" fetchPriority=\"high\" sizes=\"(max-width: 767px) calc(100vw - 40px), (max-width: 1023px) calc(100vw - 64px), (max-width: 1199px) calc(50vw - 56px), (max-width: 1439px) calc(50vw - 104px), 616px\" />\n            <div className={styles.portraitBadge} data-home-profile-badge><strong>{displayName}</strong><span>{role}</span></div>\n          </div>\n        </div>\n      </section>\n\n      <div className={styles.countdownFrame}><V5HealthHappyCountdown placement=\"home\" /></div>\n\n      <section className={`${shell.section} ${styles.homeSection} ${styles.painsSection}`} aria-labelledby=\"home-pains\">\n        <div className={shell.inner}>\n          <V5SectionHeading id=\"home-pains\" title={text.node(\"home.website43Hometitle\")} description={text.node(\"home.website43Homedescription\")} />\n          <div className={styles.cards3}>\n            {pains.map(([icon, title, body]) => (\n              <article className={styles.painCard} key={title}>\n                <span className={styles.painIcon}><Image src={icon} alt=\"\" width={24} height={24} /></span>\n                <h3>{title}</h3><p>{body}</p>\n              </article>\n            ))}\n          </div>\n        </div>\n      </section>\n\n      <div className={styles.story}>\n      <section className={`${shell.section} ${styles.homeSection} ${styles.voicesSection}`} aria-labelledby=\"home-voices\">\n        <div className={shell.inner}>\n          <V5SectionHeading id=\"home-voices\" title={text.node(\"home.website43Hometitle2\")} />\n          <div className={styles.quotes} role=\"region\" aria-labelledby=\"home-voices\" tabIndex={0}>\n            <figure className={styles.quote}><blockquote>{text.node(\"home.blockquote\")}</blockquote><figcaption>{text.node(\"home.cite\")}</figcaption></figure>\n            <figure className={styles.quote}><blockquote>{text.node(\"home.blockquote2\")}</blockquote><figcaption>{text.node(\"home.cite2\")}</figcaption></figure>\n          </div>\n        </div>\n      </section>\n\n      <section id=\"about-ccpun\" className={`${shell.sectionAlt} ${styles.homeSection} ${styles.aboutSection}`} aria-labelledby=\"home-about\">\n        <div className={`${shell.inner} ${styles.about}`}>\n          <div className={styles.aboutPortraitFrame}>\n            {/* One portrait per theme; the hidden one is display:none and, being lazy, is never fetched. */}\n            <Image className={`${styles.aboutPortrait} ${styles.aboutPortraitDark}`} src=\"/assets/website-v5/home-about-dark-white-outline-70db2c14.png\" alt={text(\"home.website43Homealt8\")} width={1248} height={1872} sizes=\"(max-width: 639px) 72px, 400px\" loading=\"lazy\" />\n            <Image className={`${styles.aboutPortrait} ${styles.aboutPortraitLight}`} src=\"/assets/website-v5/home-about-light-white-outline-6d5daba9.png\" alt={text(\"home.website43Homealt8\")} width={1248} height={1872} sizes=\"(max-width: 639px) 72px, 400px\" loading=\"lazy\" />\n          </div>\n    ",
        "   <div className={styles.portrait}>\n            <Image src=\"/assets/website-v5/pun-cutout-31beef3a.png\" alt={text(\"home.website43Homealt\")} fill preload loading=\"eager\" fetchPriority=\"high\" sizes=\"(max-width: 767px) calc(100vw - 40px), (max-width: 1023px) calc(100vw - 64px), (max-width: 1199px) calc(50vw - 56px), (max-width: 1439px) calc(50vw - 104px), 616px\" />\n            <div className={styles.portraitBadge} data-home-profile-badge><strong>{displayName}</strong><span>{role}</span></div>\n          </div>\n        </div>\n      </section>\n\n      <div className={styles.countdownFrame}><V5HealthHappyCountdown placement=\"home\" /></div>\n\n      <section className={`${shell.section} ${styles.homeSection} ${styles.painsSection}`} aria-labelledby=\"home-pains\">\n        <div className={shell.inner}>\n          <V5SectionHeading id=\"home-pains\" title={text.node(\"home.website43Hometitle\")} description={text.node(\"home.website43Homedescription\")} />\n          <div className={styles.cards3}>\n            {pains.map(([icon, title, body]) => (\n              <article className={styles.painCard} key={title}>\n                <span className={styles.painIcon}><Image src={icon} alt=\"\" width={24} height={24} /></span>\n                <h3>{title}</h3><p>{body}</p>\n              </article>\n            ))}\n          </div>\n        </div>\n      </section>\n\n      <div className={styles.story}>\n      <section className={`${shell.section} ${styles.homeSection} ${styles.voicesSection}`} aria-labelledby=\"home-voices\">\n        <div className={shell.inner}>\n          <V5SectionHeading id=\"home-voices\" title={text.node(\"home.website43Hometitle2\")} />\n          <div className={styles.quotes} role=\"region\" aria-labelledby=\"home-voices\" tabIndex={0}>\n            <figure className={styles.quote}><blockquote>{text.node(\"home.blockquote\")}</blockquote><figcaption>{text.node(\"home.cite\")}</figcaption></figure>\n            <figure className={styles.quote}><blockquote>{text.node(\"home.blockquote2\")}</blockquote><figcaption>{text.node(\"home.cite2\")}</figcaption></figure>\n          </div>\n        </div>\n      </section>\n\n      <section id=\"about-ccpun\" className={`${shell.sectionAlt} ${styles.homeSection} ${styles.aboutSection}`} aria-labelledby=\"home-about\">\n        <div className={`${shell.inner} ${styles.about}`}>\n          <div className={styles.aboutPortraitFrame}>\n            {/* One portrait per theme; the hidden one is display:none and, being lazy, is never fetched. */}\n            <Image className={`${styles.aboutPortrait} ${styles.aboutPortraitDark}`} src=\"/assets/ccpun-portrait-v5-dark.webp\" alt={text(\"home.website43Homealt8\")} width={1200} height={1800} sizes=\"(max-width: 639px) 72px, 400px\" loading=\"lazy\" />\n            <Image className={`${styles.aboutPortrait} ${styles.aboutPortraitLight}`} src=\"/assets/ccpun-portrait-v5-light.webp\" alt={text(\"home.website43Homealt8\")} width={1200} height={1800} sizes=\"(max-width: 639px) 72px, 400px\" loading=\"lazy\" />\n          </div>\n    "
      ]
    ]
  },
  "features/investment-allocation/InvestmentAllocation.module.css": {
    "before": "d2f2349dddbab2678c4d4f1dfaa07329b9f44d4a083a2e8853fce6b8220ea732",
    "after": "058609a59f14d6ae007ce87dea2367342ebcca41e171dabd82103f895a3000a7",
    "edits": [
      [
        "tegoryCard { box-sizing: border-box; width: 100%; min-width: 0; height: 100%; }\n\n/* Native six-choice cards start at the same top inset; selection keeps its reserved border. */\n:global([data-v5-header] ~ main) .categoryCard { display: flex; flex-direction: column; justify-content: flex-start; align-items: stretch; }\n@media (max-width: 699px) {\n  :global([data-v5-header] ~ main) .stepHeader { flex-direction: column; align-items: stretch; }\n  :global([data-v5-header] ~ main) .stepPill { align-self: flex-start; }\n}\n",
        "tegoryCard { box-sizing: border-box; width: 100%; min-width: 0; height: 100%; }\n"
      ]
    ]
  },
  "apps/admin/next.config.ts": {
    "before": "4e8a5020135b0644a68e9ef9431f35a90e8b022b7e2551a58ce7d2bb661b276e",
    "after": "c020ef2af24e9d7d5b0d98ec5b797c562e768d9f840331f3d413e4e41e8a3456",
    "edits": [
      [
        "  images: {\n    // Private Admin images load with the browser session; the optimizer does not forward its headers.\n    unoptimized: true,\n",
        "  images: {\n"
      ]
    ]
  }
});
export function ownerReviewVisualSourcePredecessor(file, source) {
  const pin = Object.hasOwn(visualSourcePins, file) ? visualSourcePins[file] : null;
  if (!pin || typeof source !== 'string' || sha(source) !== pin.after) return source;
  for (const [current, previous] of pin.edits) {
    assert.equal(source.split(current).length, 2, 'One complete approved visual fragment');
    source = source.replace(current, previous);
  }
  assert.equal(sha(source), pin.before, 'Every predecessor source byte restored');
  return source;
}
const visualHtmlPins = Object.freeze({
  "about": {
    "before": "bf49fe546ec16c5567c36bb7a458de5e3b40c160b54a3c83601d49b471393f62",
    "after": "98b215debb134c4c573c49eb7da105ec1ded52a2a951a01dfbcd985bd6b4203d",
    "edits": [
      [
        "<link rel=\"preload\" as=\"image\" href=\"/assets/website-v5/about-dark-white-outline-821c292b.png\" imageSizes=\"(max-width: 899px) calc(100vw - 40px), 440px\" fetchPriority=\"high\"/><link rel=\"preload\" as=\"image\" href=\"/assets/website-v5/about-light-white-outline-d013c999.png\" imageSizes=\"(max-width: 899px) calc(100vw - 40px), 440px\" fetchPriority=\"high\"/><div data-shared-shell=\"true\"><script type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@graph\":[{\"@type\":\"ProfilePage\",\"@id\":\"https://ccpun.com/about/#profilepage\",\"url\":\"https://ccpun.com/about/\",\"name\":\"รู้จักที่ปรึกษาทางการเงิน CCPun | ชนาธิป ชิตประเสริฐ (ปั้น)\",\"description\":\"ชนาธิป ชิตประเสริฐ (ปั้น) เป็นที่ปรึกษาทางการเงินและผู้วางแผนการลงทุน ช่วยลูกค้าดูเป้าหมาย ระยะเวลา ความเสี่ยง และสถานการณ์ปัจจุบัน ก่อนพิจารณาทางเลือกด้านการลงทุนหรือประกันตามขอบเขตบริการ\",\"inLanguage\":\"th\",\"isPartOf\":{\"@id\":\"https://ccpun.com/#website\"},\"breadcrumb\":{\"@id\":\"https://ccpun.com/about/#breadcrumb\"},\"mainEntity\":{\"@id\":\"https://ccpun.com/#person\"},\"about\":{\"@id\":\"https://ccpun.com/#person\"}},{\"@type\":\"Person\",\"@id\":\"https://ccpun.com/#person\",\"name\":\"ชนาธิป ชิตประเสริฐ\",\"image\":\"https://ccpun.com/assets/website-v5/about-dark-white-outline-821c292b.png\"},{\"@type\":\"BreadcrumbList\",\"@id\":\"https://ccpun.com/about/#breadcrumb\",\"itemListElement\":[{\"@type\":\"ListItem\",\"position\":1,\"name\":\"หน้าแรก\",\"item\":\"https://ccpun.com/\"},{\"@type\":\"ListItem\",\"position\":2,\"name\":\"รู้จักปั้น\",\"item\":\"https://ccpun.com/about/\"}]}]}</script><section class=\"hero\" aria-labelledby=\"about-title\"><div class=\"inner\"><nav class=\"breadcrumbs\" aria-label=\"เมนูหลัก\"><ol><li><a href=\"/\">หน้าแรก</a></li><li><span aria-current=\"page\">รู้จักปั้น</span></li></ol></nav><div class=\"heroGrid\"><div><h1 id=\"about-title\" class=\"h1\">รู้จักที่ปรึกษาทางการเงิน CCPun</h1><p class=\"identity\"><strong>ชนาธิป ชิตประเสริฐ</strong><span>ที่ปรึกษาทางการเงินและผู้วางแผนการลงทุน</span></p><ul class=\"credentials\" role=\"list\"><li><button type=\"button\" class=\"card\" aria-pressed=\"false\"><span class=\"inner\"><span class=\"face front\"><span class=\"term\">AFPT™</span><span class=\"number\">Associate Financial Planner (Thailand)</span><span class=\"hint\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 12a9 9 0 0 1 15.5-6.2L21 8\"></path><path d=\"M21 3v5h-5\"></path><path d=\"M21 12a9 9 0 0 1-15.5 6.2L3 16\"></path><path d=\"M3 21v-5h5\"></path></svg>ดูรายละเอียด</span></span><span class=\"face back\"><span class=\"line\"><span class=\"label\">ออกโดย</span><span class=\"backValue\"><span class=\"keep\">สมาคมนักวางแผนการเงินไทย</span> (TFPA)</span></span><span class=\"line\"><span class=\"label\">เลขที่ใบรับรอง</span><span class=\"backValue\">AFPT260195</span></span><span class=\"line\"><span class=\"label\">ใช้ได้ถึง</span><span class=\"backValue\">31 ธ.ค. 2571</span></span></span></span></button><noscript><style>.card:is(:hover,:focus-visible) .inner{transform:rotateY(180deg)}.card:is(:hover,:focus-visible) .back{opacity:1;transition-delay:0s}.card:is(:hover,:focus-visible) .front{opacity:0;transition-delay:var(--v5-motion-slow)}</style></noscript></li><li><span class=\"face\"><span class=\"term\">ตัวแทนประกันชีวิต</span><span class=\"number\">6801064783</span></span></li><li><span class=\"face\"><span class=\"term\">ผู้วางแผนการลงทุน</span><span class=\"number\">106654</span></span></li><li><span class=\"face\"><span class=\"term\">นายหน้าประกันวินาศภัย</span><span class=\"number\">6904009841</span></span></li></ul></div><div class=\"portraitFrame\"><img class=\"portrait portraitDark\" src=\"/assets/website-v5/about-dark-white-outline-821c292b.png\" alt=\"CCPun\" width=\"1248\" height=\"1872\" sizes=\"(max-width: 899px) calc(100vw - 40px), 440px\" fetchPriority=\"high\"/><img class=\"portrait portraitLight\" src=\"/assets/website-v5/about-light-white-outline-d013c999.png\" alt=\"CCPun\" width=\"1248\" height=\"1872\" sizes=\"(max-width: 899px) calc(100vw - 40px), 440px\" fetchPriority=\"high\"/></d",
        "<link rel=\"preload\" as=\"image\" href=\"/assets/ccpun-portrait-v5-about-dark.webp\" imageSizes=\"(max-width: 899px) calc(100vw - 40px), 440px\" fetchPriority=\"high\"/><link rel=\"preload\" as=\"image\" href=\"/assets/ccpun-portrait-v5-about-light.webp\" imageSizes=\"(max-width: 899px) calc(100vw - 40px), 440px\" fetchPriority=\"high\"/><div data-shared-shell=\"true\"><script type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@graph\":[{\"@type\":\"ProfilePage\",\"@id\":\"https://ccpun.com/about/#profilepage\",\"url\":\"https://ccpun.com/about/\",\"name\":\"รู้จักที่ปรึกษาทางการเงิน CCPun | ชนาธิป ชิตประเสริฐ (ปั้น)\",\"description\":\"ชนาธิป ชิตประเสริฐ (ปั้น) เป็นที่ปรึกษาทางการเงินและผู้วางแผนการลงทุน ช่วยลูกค้าดูเป้าหมาย ระยะเวลา ความเสี่ยง และสถานการณ์ปัจจุบัน ก่อนพิจารณาทางเลือกด้านการลงทุนหรือประกันตามขอบเขตบริการ\",\"inLanguage\":\"th\",\"isPartOf\":{\"@id\":\"https://ccpun.com/#website\"},\"breadcrumb\":{\"@id\":\"https://ccpun.com/about/#breadcrumb\"},\"mainEntity\":{\"@id\":\"https://ccpun.com/#person\"},\"about\":{\"@id\":\"https://ccpun.com/#person\"}},{\"@type\":\"Person\",\"@id\":\"https://ccpun.com/#person\",\"name\":\"ชนาธิป ชิตประเสริฐ\",\"image\":\"https://ccpun.com/assets/ccpun-portrait-v5-about-dark.webp\"},{\"@type\":\"BreadcrumbList\",\"@id\":\"https://ccpun.com/about/#breadcrumb\",\"itemListElement\":[{\"@type\":\"ListItem\",\"position\":1,\"name\":\"หน้าแรก\",\"item\":\"https://ccpun.com/\"},{\"@type\":\"ListItem\",\"position\":2,\"name\":\"รู้จักปั้น\",\"item\":\"https://ccpun.com/about/\"}]}]}</script><section class=\"hero\" aria-labelledby=\"about-title\"><div class=\"inner\"><nav class=\"breadcrumbs\" aria-label=\"เมนูหลัก\"><ol><li><a href=\"/\">หน้าแรก</a></li><li><span aria-current=\"page\">รู้จักปั้น</span></li></ol></nav><div class=\"heroGrid\"><div><h1 id=\"about-title\" class=\"h1\">รู้จักที่ปรึกษาทางการเงิน CCPun</h1><p class=\"identity\"><strong>ชนาธิป ชิตประเสริฐ</strong><span>ที่ปรึกษาทางการเงินและผู้วางแผนการลงทุน</span></p><ul class=\"credentials\" role=\"list\"><li><button type=\"button\" class=\"card\" aria-pressed=\"false\"><span class=\"inner\"><span class=\"face front\"><span class=\"term\">AFPT™</span><span class=\"number\">Associate Financial Planner (Thailand)</span><span class=\"hint\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 12a9 9 0 0 1 15.5-6.2L21 8\"></path><path d=\"M21 3v5h-5\"></path><path d=\"M21 12a9 9 0 0 1-15.5 6.2L3 16\"></path><path d=\"M3 21v-5h5\"></path></svg>ดูรายละเอียด</span></span><span class=\"face back\"><span class=\"line\"><span class=\"label\">ออกโดย</span><span class=\"backValue\"><span class=\"keep\">สมาคมนักวางแผนการเงินไทย</span> (TFPA)</span></span><span class=\"line\"><span class=\"label\">เลขที่ใบรับรอง</span><span class=\"backValue\">AFPT260195</span></span><span class=\"line\"><span class=\"label\">ใช้ได้ถึง</span><span class=\"backValue\">31 ธ.ค. 2571</span></span></span></span></button><noscript><style>.card:is(:hover,:focus-visible) .inner{transform:rotateY(180deg)}.card:is(:hover,:focus-visible) .back{opacity:1;transition-delay:0s}.card:is(:hover,:focus-visible) .front{opacity:0;transition-delay:var(--v5-motion-slow)}</style></noscript></li><li><span class=\"face\"><span class=\"term\">ตัวแทนประกันชีวิต</span><span class=\"number\">6801064783</span></span></li><li><span class=\"face\"><span class=\"term\">ผู้วางแผนการลงทุน</span><span class=\"number\">106654</span></span></li><li><span class=\"face\"><span class=\"term\">นายหน้าประกันวินาศภัย</span><span class=\"number\">6904009841</span></span></li></ul></div><div class=\"portraitFrame\"><img class=\"portrait portraitDark\" src=\"/assets/ccpun-portrait-v5-about-dark.webp\" alt=\"CCPun\" width=\"1200\" height=\"1800\" sizes=\"(max-width: 899px) calc(100vw - 40px), 440px\" fetchPriority=\"high\"/><img class=\"portrait portraitLight\" src=\"/assets/ccpun-portrait-v5-about-light.webp\" alt=\"CCPun\" width=\"1200\" height=\"1800\" sizes=\"(max-width: 899px) calc(100vw - 40px), 440px\" fetchPriority=\"high\"/></d"
      ]
    ]
  },
  "3": {
    "before": "1395e1e06ca9e9eba33a39e26854bf3add131e80cd14f1f7673d49192800e842",
    "after": "8e231e256904346d23ab65bed84551fc7b491c75a2d1fd674b14b988a1a6c04d",
    "edits": [
      [
        "=\"note\" style=\"margin-top:0\">อ่านเบื้องหลังการพัฒนา CI Planning บน TorYod</p><a class=\"textLink\" href=\"https://www.toryod.co/projects/35d2877e-e97a-45ee-a6df-aefa5e09e2b3-ccpun-s-ci-planning\" target=\"_blank\" rel=\"noopener\" aria-label=\"ดูโปรเจกต์ CCPun&#x27;s CI Planning บน TorYod (เปิดในแท็บใหม่)\">Featured on TorYod</a></div></div></section></main><footer class=\"footer\"><div class=\"inner\"><span",
        "=\"note\" style=\"margin-top:0\">อ่านเบื้องหลังการพัฒนา CI Planning บน TorYod</p><a href=\"https://www.toryod.co/projects/35d2877e-e97a-45ee-a6df-aefa5e09e2b3-ccpun-s-ci-planning\" target=\"_blank\" rel=\"noopener\" aria-label=\"ดูโปรเจกต์ CCPun&#x27;s CI Planning บน TorYod (เปิดในแท็บใหม่)\"><img src=\"https://www.toryod.co/badge/35d2877e-e97a-45ee-a6df-aefa5e09e2b3\" alt=\"Featured on TorYod\" width=\"240\" height=\"54\" loading=\"lazy\" decoding=\"async\"/></a></div></div></section></main><footer class=\"footer\"><div class=\"inner\"><span"
      ]
    ]
  }
});
export function visualHtmlPredecessor(html, key) {
  const name = key === 'about:false:false' || key === 'about:false:true' ? 'about' : key;
  const pin = Object.hasOwn(visualHtmlPins, name) ? visualHtmlPins[name] : null;
  if (!pin || sha(html) !== pin.after) return html;
  for (const [current, previous] of pin.edits) {
    assert.equal(html.split(current).length, 2, 'One complete approved portrait render fragment');
    html = html.replace(current, previous);
  }
  assert.equal(sha(html), pin.before, 'Every predecessor render byte restored');
  return html;
}

// The existing scanner now identifies the approved CI attribution as a visible link.
export const visualLocationPins = Object.freeze({"before": "0faebca850664af8aa5feb64eb988c7d78293524b04a129ce8d08c72f8b80631", "after": "2d7659685eb421af962c608b8c39f4aae69d19012ebf9ffd176473ab4a2c248e"});
export function visualLocationsPredecessor(source) {
  if (typeof source !== 'string' || sha(source) !== visualLocationPins.after) return source;
  const locations = JSON.parse(source);
  const entry = locations.ci.entries['ci.landing.alt'];
  assert.equal(entry.kind, 'ลิงก์');
  assert.equal(entry.visible, true);
  entry.kind = 'คำอธิบายรูป';
  entry.visible = false;
  const prior = JSON.stringify(locations) + '\n';
  assert.equal(sha(prior), visualLocationPins.before, 'All prior map bytes and other scopes preserved');
  return prior;
}
