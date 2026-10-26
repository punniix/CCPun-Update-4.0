import { createHash } from 'node:crypto';

// Owner Admin decisions (ปั้น, 2026-10-26, marked-up PDF section 5): the home menu item is
// "วันนี้" (5.2); LINE customers, customer notices and the LINE chat button settings form one
// "ลูกค้า & LINE" group (5.3); phones get a four-button bottom tab bar instead of the drawer
// (5.4); the light theme applies to every Admin page through a header toggle (5.5).
//
// Same mechanism as qa/admin-ops-20261025-proof.mjs: an exact before -> after admission per
// protected source. `before` is the reviewed successor currently admitted by that proof, so a
// file passes only when it is byte-identical to the reviewed result below; its digest then maps
// back through every older admission to the original frozen predecessor. Any other byte still
// fails every frozen proof. No SEO URL, Sanity schema name/value, analytics, consent, RBAC or
// lane guard changes.
const sha = value => createHash('sha256').update(value).digest('hex');

export const adminOwnerDecisions20261026Sources = Object.freeze({
  // BEGIN reviewed owner-decision sources
  "apps/admin/app/(control-plane)/layout.tsx": { before: "dce37f737833142e5f77019c0a4faf118ba7c7b260e07c4282a8e5725ab18c82", after: "87387368d6ab031ef8424cc0561798212bd563ef82d30f7f47ee588e37b18a18" },
  "features/admin/components/AdminNavigation.tsx": { before: "a85c9d5157c2c40872cc4439334f055de3016f264c93281443f009e5c8874c53", after: "6a63dd091e86d370bea71d3ce7e354b424d3dc84340604f4ed5653101a32fa1a" },
  "features/admin/components/AdminProtectedChrome.tsx": { before: "ec5052f0f5fb7e910189a8d21858b4372859fc67704b7f0b41ae69dd09b521e9", after: "9ee293f7b3293580429bf590b6aeab1589e480c63dac7b771a06bda80297c735" },
  "features/admin/components/admin-navigation-model.ts": { before: "f7ee2accc15e5fa37c4fdf5686084adc717b6ee0de17aa92bb5bc2e960c2b466", after: "e28f32acb92f7539bbd184bf823447277b1b44079a1c933f19dd5cc2ad5574b3" },
  // END reviewed owner-decision sources
});

// Owner decision 8.2 (2026-10-26): the financial planning room (cherry-picked from PR #491,
// claude/feat/fa-room-20261025) gets an owner-only "ห้องวางแผน FA" menu group. `before` is the
// owner-decision successor admitted above, so the layout chains back through that entry.
export const adminFaRoomMenu20261026Sources = Object.freeze({
  // BEGIN reviewed FA room menu sources
  "apps/admin/app/(control-plane)/layout.tsx": { before: "87387368d6ab031ef8424cc0561798212bd563ef82d30f7f47ee588e37b18a18", after: "d23ed766c6b675224b15995772048da6c69c9910894b51917afb85902ab6ac63" },
  // END reviewed FA room menu sources
});

// Maps the digest of an exact owner-decision successor to the reviewed successor it replaced;
// any other digest is returned unchanged (so an unreviewed edit still fails).
export function adminOwnerDecisions20261026PredecessorDigest(file, digest) {
  const menu = Object.hasOwn(adminFaRoomMenu20261026Sources, file) ? adminFaRoomMenu20261026Sources[file] : null;
  const menuReviewed = menu && digest === menu.after ? menu.before : digest;
  const entry = Object.hasOwn(adminOwnerDecisions20261026Sources, file) ? adminOwnerDecisions20261026Sources[file] : null;
  return entry && menuReviewed === entry.after ? entry.before : menuReviewed;
}

export function adminOwnerDecisions20261026SourceDigest(source) {
  return sha(source);
}

// Exact rendered-DOM inverse for the frozen DOM-parity fixtures (protected Chrome with each
// role/capability/lane). It rebuilds the predecessor markup for these approved display changes
// and nothing else; each rule names one concrete string and every other byte is still compared.
const q = '&quot;';
const child = (href, label, permission) => `{${q}href${q}:${q}${href}${q},${q}label${q}:${q}${label}${q}${permission ? `,${q}permission${q}:${q}${permission}${q}` : ''}}`;
const REVIEWS = child('/dashboard/reviews/', 'งานรอตรวจ');
const INBOX = child('/dashboard/inbox/', 'ลูกค้า LINE');
const CAMPAIGNS = child('/dashboard/campaigns/', 'ข้อความแจ้งลูกค้า');
const LINE_CHAT = child('/settings/line-chat/', 'ปุ่มแชท LINE');
const group = (href, label, permission, children) => `{${q}href${q}:${q}${href}${q},${q}label${q}:${q}${label}${q},${q}permission${q}:${q}${permission}${q},${q}children${q}:[${children.join(',')}]}`;

const PLANNING = group('/dashboard/planning/', 'ห้องวางแผน FA', 'planning:read', [child('/dashboard/planning/', 'ครอบครัวลูกค้า'), child('/dashboard/planning/retention/', 'ข้อมูลที่ครบกำหนดตรวจ')]);

const rules = [
  // 8.2 (owner, full capability only: planning:read is owner-only): the FA room menu group.
  [',' + PLANNING, ''],
  // 5.3 + 5.2 (owner, full capability): วันนี้ keeps งานรอตรวจ; ลูกค้า LINE and ข้อความแจ้งลูกค้า move
  // into "ลูกค้า & LINE" next to the new ปุ่มแชท LINE entry. Predecessor: one ภาพรวม group.
  [group('/dashboard/', 'วันนี้', 'dashboard:read', [REVIEWS]) + ',' + group('/dashboard/inbox/', 'ลูกค้า &amp; LINE', 'advisor:read', [INBOX, CAMPAIGNS, LINE_CHAT]),
    group('/dashboard/', 'ภาพรวม', 'dashboard:read', [INBOX, CAMPAIGNS, REVIEWS])],
  // 5.2 for every other role/capability (no advisor:read, so no ลูกค้า & LINE group).
  [`{${q}href${q}:${q}/dashboard/${q},${q}label${q}:${q}วันนี้${q},`, `{${q}href${q}:${q}/dashboard/${q},${q}label${q}:${q}ภาพรวม${q},`],
  // 5.5: the shell marker the light theme is scoped to, and the header theme toggle.
  ['<div class="min-h-screen overflow-x-hidden bg-navy-900 text-white admin-theme-scope">', '<div class="min-h-screen overflow-x-hidden bg-navy-900 text-white">'],
  ['<button data-fixture-component="AdminThemeToggle" data-fixture-props="{}"></button>', ''],
];

export function adminOwnerDecisions20261026DomPredecessor(html) {
  if (typeof html !== 'string') return html;
  let result = html;
  for (const [candidate, original] of rules) result = result.split(candidate).join(original);
  return result;
}
