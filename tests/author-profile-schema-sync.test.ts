import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
