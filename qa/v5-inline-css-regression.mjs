// Actual compiled localhost comparison; the caller starts the fenced server.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { gzipSync, brotliCompressSync, constants } from "node:zlib";
import { createHash } from "node:crypto";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const variant = process.argv[2];
assert.ok(["baseline", "candidate"].includes(variant));
const origin = "http://127.0.0.1:3020";
const out = new URL(
  `./artifacts/c10-inline-css-20261026/${variant}/`,
  import.meta.url,
);
await mkdir(out, { recursive: true });
const paths = [
  "/",
  "/ci-planning/",
  "/tools/financial-health-check/",
  "/tools/aia-fund-allocation/",
  "/blog/",
  "/blog/personal-finance/c10-local-fixture/",
];
// Only the existing live countdown clock varies between captures. Its label/order stays exact.
const stableText = (s) =>
  s.replace(
    /\d+\nวัน\n\d+\nชั่วโมง\n\d+\nนาที\n\d+\nวินาที/g,
    "[existing countdown clock]",
  );
const sha = (s) => createHash("sha256").update(s).digest("hex");
const sizes = [];
for (const path of paths) {
  const r = await fetch(origin + path);
  assert.equal(r.status, 200, path);
  const html = await r.text();
  if (path.includes("c10-local"))
    assert.ok(html.includes("C10 Local CSS Fixture"));
  const document = new JSDOM(html).window.document;
  const row = {
    path,
    status: r.status,
    raw: Buffer.byteLength(html),
    gzip: gzipSync(html, { level: 9 }).length,
    brotli: brotliCompressSync(html, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
    }).length,
    stylesheetLinks: document.querySelectorAll('link[rel="stylesheet"]').length,
    styleTags: document.querySelectorAll("style").length,
    styleBytes: [...document.querySelectorAll("style")].reduce(
      (n, e) => n + Buffer.byteLength(e.textContent),
      0,
    ),
    csp: r.headers.get("content-security-policy"),
  };
  sizes.push(row);
  await writeFile(new URL(`${sizes.length}.html`, out), html);
}
await writeFile(new URL("sizes.json", out), JSON.stringify(sizes, null, 2));
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: [
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-sync",
    "--no-first-run",
  ],
});
const shots = [];
try {
  for (const [device, viewport] of Object.entries({
    mobile: { width: 390, height: 844 },
    desktop: { width: 1440, height: 1000 },
  })) {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport,
        colorScheme: theme,
        reducedMotion: "reduce",
      });
      await context.route("**/*", (route) =>
        new URL(route.request().url()).origin === origin
          ? route.continue()
          : route.abort(),
      );
      await context.addInitScript((t) => {
        localStorage.setItem("ccpun-theme", t);
        window.__c10Frames = [];
        const sample = () => {
          const root = document.documentElement;
          const main = document.querySelector("main");
          if (main && window.__c10Frames.length < 90) {
            const h = document.querySelector("h1");
            window.__c10Frames.push({
              theme: root.dataset.theme,
              bodyBackground: getComputedStyle(document.body).backgroundColor,
              h1Size: h ? getComputedStyle(h).fontSize : null,
              styles: document.styleSheets.length,
            });
          }
          if (window.__c10Frames.length < 90) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }, theme);
      for (const [i, path] of paths.entries()) {
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(String(e)));
        const response = await page.goto(origin + path, {
          waitUntil: "domcontentloaded",
        });
        assert.equal(response.status(), 200);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(400);
        await page.waitForFunction(
          (t) => document.documentElement.dataset.theme === t,
          theme,
        );
        const actual = await page.getAttribute("html", "data-theme");
        assert.equal(actual, theme);
        const measure = await page.evaluate(() => {
          const h = document.querySelector("h1");
          const main = document.querySelector("main");
          return {
            theme: document.documentElement.dataset.theme,
            title: document.title,
            text: main?.innerText || "",
            h1: h?.innerText,
            h1Size: h ? getComputedStyle(h).fontSize : null,
            h1Font: h ? getComputedStyle(h).fontFamily : null,
            bodyBackground: getComputedStyle(document.body).backgroundColor,
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            styles: document.styleSheets.length,
            frames: window.__c10Frames,
            viewTransition: typeof document.startViewTransition,
            reducedMotion: matchMedia("(prefers-reduced-motion: reduce)")
              .matches,
            criticalFoundation: [...document.querySelectorAll("style")].some(
              (e) =>
                e.textContent.includes(
                  ".hero-dark-overlay{background:linear-gradient",
                ),
            ),
          };
        });
        assert.ok(measure.styles > 0);
        assert.ok(measure.text.length > 20);
        assert.equal(measure.reducedMotion, true);
        assert.equal(measure.criticalFoundation, true);
        assert.ok(
          measure.frames.every((f) => f.theme === theme && f.styles > 0),
          "styled animation frames retain requested theme",
        );
        assert.equal(errors.length, 0, "no browser errors");
        const shot = `${i + 1}-${device}-${theme}.png`;
        await page.screenshot({
          path: fileURLToPath(new URL(shot, out)),
          fullPage: true,
        });
        await page.reload({ waitUntil: "domcontentloaded" });
        assert.equal(
          await page.getAttribute("html", "data-theme"),
          theme,
          "reload preserves theme",
        );
        if (i === 0) {
          const link = page.locator('a[href="/blog/"]').first();
          if (await link.count()) {
            await link.evaluate((el) => el.click());
            await page.waitForURL("**/blog/");
            assert.equal(await page.getAttribute("html", "data-theme"), theme);
            assert.ok(await page.locator("main").innerText());
          }
        }
        shots.push({ path, device, theme, actual, shot, errors, measure });
        await page.close();
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}
await writeFile(new URL("browser.json", out), JSON.stringify(shots, null, 2));
assert.equal(shots.length, 24);
console.log(
  JSON.stringify({
    variant,
    pages: sizes.length,
    shots: shots.length,
    errors: shots.flatMap((s) => s.errors),
  }),
);
if (variant === "candidate") {
  const baseline = JSON.parse(
    await readFile(new URL("../baseline/browser.json", out)),
  );
  const comparison = shots.map((s, i) => ({
    path: s.path,
    device: s.device,
    theme: s.theme,
    textEqual:
      sha(stableText(s.measure.text)) ===
      sha(stableText(baseline[i].measure.text)),
    h1Equal: s.measure.h1 === baseline[i].measure.h1,
    fontSizeEqual: s.measure.h1Size === baseline[i].measure.h1Size,
    backgroundEqual:
      s.measure.bodyBackground === baseline[i].measure.bodyBackground,
  }));
  await writeFile(
    new URL("../comparison.json", out),
    JSON.stringify(comparison, null, 2),
  );
  assert.ok(
    comparison.every(
      (c) => c.textEqual && c.h1Equal && c.fontSizeEqual && c.backgroundEqual,
    ),
    "same fixture text and computed presentation",
  );
}
