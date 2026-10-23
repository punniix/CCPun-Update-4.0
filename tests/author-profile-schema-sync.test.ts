import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { getPublicAuthorName } from "../lib/content/author-identity";
import { buildCcpunSchemaGraph } from "../lib/seo/structured-data/site-schema";
import type { ArticleAuthorProfile } from "../lib/content/types";

function personFor(author?: ArticleAuthorProfile | null) {
  const graph = buildCcpunSchemaGraph(author)["@graph"];
  const people = graph.filter((entry) => entry["@type"] === "Person");
  assert.equal(people.length, 1, "exactly one Person entity per page");
  assert.equal(people[0]["@id"], "https://ccpun.com/#person");
  const publisher = graph.find((entry) => entry["@id"] === "https://ccpun.com/#organization");
  assert.equal(publisher?.["name"], "CCPun Financial Advisor");
  return people[0] as {
    name: string;
    jobTitle: string;
    description: string;
    sameAs: string[];
    hasCredential: Array<{ name: string; identifier: string }>;
  };
}

test("public name never exposes internal CCPun author label", () => {
  assert.equal(getPublicAuthorName({ name: "CCPun" }), "ชนาธิป ชิตประเสริฐ");
  assert.equal(getPublicAuthorName({ name: "CCPun", profileName: "  ชนาธิป ชิตประเสริฐ  " }), "ชนาธิป ชิตประเสริฐ");
  assert.equal(getPublicAuthorName({ name: "CCPun", profileName: " " }), "ชนาธิป ชิตประเสริฐ");
});

test("Person fallback preserves known identity and legacy three licenses", () => {
  const person = personFor({ name: "CCPun" });
  assert.equal(person.name, "ชนาธิป ชิตประเสริฐ");
  assert.equal(person.hasCredential.length, 3);
  assert.equal(person.jobTitle, "ที่ปรึกษาทางการเงินและผู้วางแผนการลงทุน");
  assert.ok(person.sameAs?.length);
});

test("managed author profile flows to one Person including AFPT and licenses", () => {
  const author: ArticleAuthorProfile = {
    name: "CCPun",
    profileName: "ชนาธิป ชิตประเสริฐ",
    profileRole: "ผู้วางแผนการลงทุน",
    profileBio: "วางแผนจากสถานการณ์จริง",
    sameAs: ["https://www.facebook.com/ccpun", "https://www.facebook.com/ccpun"],
    professionalLicenses: [
      { name: "ใบอนุญาตตัวแทนประกันชีวิต", identifier: "TEST-001", issuer: "คปภ." },
    ],
    professionalQualifications: [
      { shortName: "AFPT™", name: "คุณวุฒิวิชาชีพที่ปรึกษาการเงิน AFPT™", identifier: "AFPT260195", issuer: "สมาคมนักวางแผนการเงินไทย" },
    ],
  };
  const person = personFor(author);
  assert.equal(person.name, author.profileName);
  assert.equal(person.jobTitle, author.profileRole);
  assert.equal(person.description, author.profileBio);
  assert.deepEqual(person.sameAs, ["https://www.facebook.com/ccpun"]);
  assert.equal(person.hasCredential.length, 2, "managed license replaces hardcoded fallbacks");
  assert.deepEqual(person.hasCredential.map((credential) => credential.identifier), ["TEST-001", "AFPT260195"]);
});

test("homepage does not emit a second Person schema fragment", () => {
  const homepage = readFileSync("apps/web/app/page.tsx", "utf8");
  const layout = readFileSync("apps/web/app/layout.tsx", "utf8");
  assert.ok(!homepage.includes("professionalQualificationSchema"));
  assert.ok(layout.includes("buildCcpunSchemaGraph(author)"));
  assert.ok(layout.includes("getPrimaryAuthorProfile"));
  assert.ok(layout.includes("generateMetadata"));
  assert.ok(!layout.includes("JSON.stringify(ccpunSchemaGraph)"));
});

test("primary author does not depend on mutable Sanity name", () => {
  const source = readFileSync("lib/content/sanity.ts", "utf8");
  assert.ok(source.includes("ccpun-author-ccpun-profile"));
  assert.ok(source.includes("ccpun-prod-mirror-author-ccpun"));
  assert.ok(!source.includes('name == "CCPun"'));
});

test("native RSC shares one cold primary-author read per request without sharing the next request", () => {
  const script = String.raw`
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import React from 'react';
    import { renderToReadableStream } from 'next/dist/compiled/react-server-dom-webpack/server.node.js';
    import { loadFixtureModule } from './qa/phase1-fixture-loader.mjs';
    const file = 'lib/content/sanity.ts';
    const source = readFileSync(file, 'utf8');
    let predecessor = source;
    for (const [current, old] of [
      ['import { cache } from "react";\n', ''],
      ['export const getPrimaryAuthorProfile = cache(unstable_cache(', 'export const getPrimaryAuthorProfile = unstable_cache('],
      ['{ revalidate: 300, tags: ["ccpun-primary-author"] },\n));', '{ revalidate: 300, tags: ["ccpun-primary-author"] },\n);'],
    ]) {
      assert.equal(predecessor.split(current).length, 2);
      predecessor = predecessor.replace(current, old);
    }
    async function observe(candidate, expected) {
      let backendReads = 0;
      const mocks = new Map([
        ['next-sanity', { createClient: () => ({}), groq: String.raw }],
        // A cold persistence boundary: no replacement cache implementation.
        ['next/cache', { unstable_cache: (read, keys, options) => {
          assert.deepEqual(keys, ['ccpun-primary-author-profile-v2', 'unconfigured', 'unconfigured']);
          assert.deepEqual(options, { revalidate: 300, tags: ['ccpun-primary-author'] });
          return read;
        } }],
        ['@/lib/sanity-live', { sanityFetch: async request => {
          backendReads++;
          assert.equal(request.perspective, 'published');
          assert.equal(request.stega, false);
          await Promise.resolve();
          return { data: null };
        } }],
        ['@/lib/content/sanity-credentials', { getSanityReadToken: () => '' }],
        ['@/lib/content/sanity-lane', { isContentSanityLaneAllowed: () => false }],
        ['@/lib/deployment-environment', { IS_DRAFT_PREVIEW_ALLOWED: false }],
      ]);
      const { getPrimaryAuthorProfile } = loadFixtureModule(file, { sources: new Map([[file, candidate]]), mocks });
      async function Request() {
        const values = await Promise.all([getPrimaryAuthorProfile(), getPrimaryAuthorProfile(), getPrimaryAuthorProfile()]);
        assert.deepEqual(values, [null, null, null], 'unavailable-profile fallback is unchanged');
        return 'complete';
      }
      for (let request = 1; request <= 2; request++) {
        await new Response(renderToReadableStream(React.createElement(Request), {})).text();
        assert.equal(backendReads, expected * request, 'only the current RSC request shares the cold reader');
      }
      return backendReads;
    }
    assert.equal(await observe(predecessor, 3), 6);
    assert.equal(await observe(source, 1), 2);
    console.log('native RSC cold reads: predecessor 3/request; candidate 1/request; next request reads afresh');
  `;
  const output = execFileSync(process.execPath, ["--conditions=react-server", "--input-type=module", "-"], { input: script, encoding: "utf8" });
  assert.match(output, /predecessor 3\/request; candidate 1\/request; next request reads afresh/);
});

test("uncached author preview enforces the existing lane and token guards before any draft read", () => {
  const script = String.raw`
    import assert from 'node:assert/strict';
    import { loadFixtureModule } from './qa/phase1-fixture-loader.mjs';
    function runtime({ allowed = true, configured = true, token = true } = {}) {
      const requests = [];
      const mocks = new Map([
        ['next-sanity', { createClient: () => ({ withConfig: () => ({}) }), groq: String.raw }],
        ['next/cache', { unstable_cache: read => read }],
        ['@/lib/sanity-live', { sanityFetch: async request => {
          requests.push(request);
          return { data: { name: 'CCPun', profileName: 'Draft author ' + requests.length, profileRole: 'Draft role', professionalQualifications: [{ shortName: 'CFP', name: 'Draft qualification', identifier: 'FIXTURE', issuer: 'Fixture issuer' }] } };
        } }],
        ['@/lib/content/sanity-credentials', { getSanityReadToken: () => token ? 'synthetic-fixture-only' : '' }],
        ['@/lib/content/sanity-lane', { isContentSanityLaneAllowed: () => configured }],
        ['@/lib/deployment-environment', { IS_DRAFT_PREVIEW_ALLOWED: allowed }],
      ]);
      const module = loadFixtureModule('lib/content/sanity.ts', { mocks, globals: { process: { env: { NEXT_PUBLIC_SANITY_PROJECT_ID: 'fixture', NEXT_PUBLIC_SANITY_DATASET: 'production' } } } });
      return { module, requests };
    }
    const { module, requests } = runtime();
    const first = await module.getPrimaryAuthorPreviewProfile();
    const second = await module.getPrimaryAuthorPreviewProfile();
    assert.equal(first.profileName, 'Draft author 1');
    assert.equal(second.profileName, 'Draft author 2', 'draft preview is never held in the published cache');
    assert.equal(second.profileRole, 'Draft role');
    assert.equal(second.professionalQualifications[0].shortName, 'CFP');
    assert.equal(requests.length, 2);
    for (const request of requests) { assert.equal(request.perspective, 'drafts'); assert.equal(request.stega, false); }
    for (const settings of [{ allowed: false }, { configured: false }, { token: false }]) {
      const denied = runtime(settings);
      await assert.rejects(denied.module.getPrimaryAuthorPreviewProfile());
      assert.equal(denied.requests.length, 0, 'denied preview cannot start a draft query');
    }
    console.log('uncached author preview: draft edits visible; lane, deployment and token denials before reads');
  `;
  const output = execFileSync(process.execPath, ["--conditions=react-server", "--input-type=module", "-"], { input: script, encoding: "utf8" });
  assert.match(output, /draft edits visible; lane, deployment and token denials before reads/);
});
