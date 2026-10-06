#!/usr/bin/env node
import { DEPLOYMENT_CONTRACT } from "../lib/runtime/deployment-lanes.mjs";

const contract = DEPLOYMENT_CONTRACT;
const failures = [];
const lanes = Object.entries(contract.lanes ?? {});

if (contract.version !== 2) failures.push("deployment contract version must be 2");
if (lanes.length !== 4) failures.push("expected exactly 4 deployment lanes, got " + lanes.length);

const domains = new Set();
for (const [id, lane] of lanes) {
  if (domains.has(lane.domain)) failures.push(id + ": duplicate domain " + lane.domain);
  domains.add(lane.domain);
  if (lane.nodeMajor !== 24) failures.push(id + ": Node major must remain 24");
  if (!lane.sanityProjectId || !lane.sanityDataset) failures.push(id + ": Sanity lane is required");
  if (lane.role === "web" && lane.workspace !== "@ccpun/web") failures.push(id + ": Web workspace drift");
  if (lane.role === "admin" && lane.workspace !== "@ccpun/admin") failures.push(id + ": Admin workspace drift");
}

const webProd = contract.lanes["web-production"];
const webUat = contract.lanes["web-uat"];
const adminProd = contract.lanes["admin-production"];
const adminUat = contract.lanes["admin-uat"];

if (webProd.domain !== "ccpun.com" || webProd.provider !== "hostinger" || !webProd.indexable) failures.push("Web Production contract drift");
if (webProd.outputDirectory !== "apps/web/.next" || webProd.rootDirectory !== "./" || webProd.buildCommand !== "npm run build") failures.push("Web Production Hostinger build contract drift");
if (webProd.sanityProjectId !== "kyfxgjnq" || webProd.sanityDataset !== "production" || webProd.productionAnalytics !== "1" || webProd.uatMode !== "0") failures.push("Web Production data/analytics contract drift");

if (webUat.domain !== "test.ccpun.com" || webUat.provider !== "hostinger" || webUat.indexable) failures.push("Web UAT contract drift");
if (webUat.outputDirectory !== "apps/web/.next" || webUat.sanityProjectId !== "ccb9lnw5" || webUat.sanityDataset !== "uat" || webUat.productionAnalytics !== "0" || webUat.uatMode !== "1") failures.push("Web UAT isolation contract drift");

for (const [id, lane] of [["admin-production", adminProd], ["admin-uat", adminUat]]) {
  if (lane.provider !== "hostinger") failures.push(id + ": current provider must be Hostinger");
  if (lane.indexable) failures.push(id + ": Admin must never be indexable");
  if ("vercelProjectId" in lane) failures.push(id + ": stale Vercel project identity must not be part of the current lane contract");
}
if (adminProd.domain !== "admin.ccpun.com" || adminProd.sanityProjectId !== "kyfxgjnq" || adminProd.sanityDataset !== "production") failures.push("Admin Production contract drift");
if (adminUat.domain !== "admin-test.ccpun.com" || adminUat.sanityProjectId !== "ccb9lnw5" || adminUat.sanityDataset !== "uat") failures.push("Admin UAT contract drift");

if (failures.length) {
  console.error(JSON.stringify({status:"blocked", failures}, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({status:"locked", version:contract.version, lanes:Object.keys(contract.lanes)}, null, 2));
