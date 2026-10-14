import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("mobile group entry/Back/close focus only their newly mounted controls", () => {
  const { transpileModule, ModuleKind } = createRequire(import.meta.url)("typescript") as typeof import("typescript");
  const compiled = transpileModule(read("features/admin/components/AdminNavigation.tsx"), { compilerOptions: { module: ModuleKind.CommonJS, jsx: 4 } }).outputText;
  const slots: unknown[] = []; let index = 0;
  const effects: Array<() => void> = [];
  const frames: Array<() => void> = [];
  const loaded = { exports: {} as { default: (props: unknown) => unknown } };
  runInNewContext(compiled, { module: loaded, exports: loaded.exports,
    requestAnimationFrame: (fn: () => void) => frames.push(fn),
    require: (name: string) => {
      if (name === "next/link") return { default: "a" };
      if (name === "next/navigation") return { usePathname: () => "/social/" };
      if (name === "react/jsx-runtime") return { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) };
      if (name === "./admin-navigation-model") {
        const model = { exports: {} };
        const modelCode = transpileModule(read("features/admin/components/admin-navigation-model.ts"), { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
        runInNewContext(modelCode, { module: model, exports: model.exports });
        return model.exports;
      }
      assert.equal(name, "react");
      return { useMemo: (fn: () => unknown) => fn(), useEffect: (fn: () => void) => effects.push(fn),
        useRef: (value: unknown) => { const slot = index++; return slots[slot] ??= { current: value }; },
        useState: (value: unknown) => { const slot = index++; if (!(slot in slots)) slots[slot] = value;
          return [slots[slot], (next: unknown) => { slots[slot] = next; }]; } };
    } });
  type Element = { type: unknown; props: { children?: unknown; ref?: ((node: unknown) => void) | { current: unknown }; onClick?: () => void; onClose?: () => void; "aria-label"?: string; "aria-expanded"?: boolean; "aria-haspopup"?: string } };
  const attachRef = (element: Element, node: unknown) => {
    if (typeof element.props.ref === "function") element.props.ref(node);
    else if (element.props.ref) element.props.ref.current = node;
  };
  function elements(node: unknown): Element[] {
    if (Array.isArray(node)) return node.flatMap(elements);
    if (!node || typeof node !== "object" || !("props" in node)) return [];
    const element = node as Element;
    return [element, ...elements(element.props.children)];
  }
  const items = [{ id: "content", href: "/social/", label: "คอนเทนต์", children: [{ href: "/social/queue/", label: "คิว" }] },
    { id: "settings", href: "/social/accounts/", label: "ตั้งค่า", children: [{ href: "/seo/audit/", label: "ตรวจ" }] }];
  let focused = "";
  const render = () => { index = 0; effects.length = 0; return elements(loaded.exports.default({ items })); };
  let tree = render();
  const trigger = tree.find(element => element.props["aria-haspopup"] === "dialog")!;
  attachRef(trigger, { focus: () => { focused = "trigger"; } });
  const dialog = tree.find(element => element.type === "dialog")!;
  let closes = 0;
  attachRef(dialog, { close: () => { closes++; } });
  const groups = tree.filter(element => element.type === "button" && element.props["aria-expanded"] === false);
  assert.equal(groups.length, 2);
  groups.forEach((button, n) => attachRef(button, { focus: () => { focused = items[n].href; } }));
  groups[1].props.onClick!();
  groups.forEach(button => attachRef(button, null));
  tree = render();
  const back = tree.find(element => element.props["aria-label"] === "กลับไปเมนูหลัก");
  assert.ok(back);
  assert.equal(focused, "", "entry focus must wait for Back to mount");
  attachRef(back, { focus: () => { focused = "back"; } });
  effects.forEach(fn => fn());
  assert.equal(focused, "back", "opening a group must not leave focus on BODY");
  back.props.onClick!();
  attachRef(back, null);
  focused = "";
  tree = render();
  const remounted = tree.filter(element => element.type === "button" && element.props["aria-expanded"] === false);
  remounted.forEach((button, n) => attachRef(button, { focus: () => { focused = items[n].href; } }));
  assert.equal(focused, "", "focus must wait for the group buttons to remount");
  effects.forEach(fn => fn());
  assert.equal(focused, "/social/accounts/", "Back must restore the selected group, not the first group or dialog trigger");
  focused = "external";
  effects.forEach(fn => fn());
  assert.equal(focused, "external", "consumed Back focus must not be reused");
  for (const nativeClose of [false, true]) {
    remounted[0].props.onClick!();
    tree = render();
    const nextBack = tree.find(element => element.props["aria-label"] === "กลับไปเมนูหลัก")!;
    attachRef(nextBack, { focus: () => { focused = "back"; } });
    effects.forEach(fn => fn());
    assert.equal(focused, "back");
    if (!nativeClose) tree.find(element => element.type === "button" && element.props.children === "ปิด")!.props.onClick!();
    // Native Escape/dialog.close emits onClose; browser rendering is verified separately.
    tree.find(element => element.type === "dialog")!.props.onClose!();
    attachRef(nextBack, null);
    render();
    effects.forEach(fn => fn());
    frames.splice(0).forEach(fn => fn());
    assert.equal(focused, "trigger", "Close/Escape must restore the dialog trigger, not a stale group");
  }
  assert.equal(closes, 1);
});

test("Admin navigation groups the permitted leaves into five owner tasks", () => {
  const layout = read("apps/admin/app/(control-plane)/layout.tsx");
  const model = read("features/admin/components/admin-navigation-model.ts");
  const nav = read("features/admin/components/AdminNavigation.tsx");
  for (const label of ["วันนี้", "ลูกค้า", "คอนเทนต์", "ผลลัพธ์", "ตั้งค่า"]) {
    assert.ok(model.includes(`"${label}"`), `missing primary module ${label}`);
  }
  assert.match(layout, /buildAdminNavigation/);
  assert.match(model, /href: "\/social\/queue\/", label: "คิวส่งโพสต์"/);
  assert.match(nav, /<PrimaryModules items=\{items\} pathname=\{pathname\} \/>/);
  assert.match(nav, /activeItem\?\.children\?\.length \? <ContextNavigation/);
  assert.match(nav, /activeAdminNavigationItem\(items, pathname\)/);
  assert.match(nav, /activeAdminNavigationChild\(item, pathname\)/);
  assert.match(nav, /item.id === "content"/);
  assert.match(nav, /href="\/studio\/" target="_blank" rel="noopener noreferrer"/);
  assert.match(nav, /aria-label="กลับไปเมนูหลัก"/);
  assert.match(nav, /min-h-11 min-w-11/);
  assert.match(nav, /motion-reduce:transition-none/);
});

test("Calendar and Queue are operational Social surfaces rather than aliases", () => {
  const calendarPage = read("features/admin/social/calendar-page.tsx");
  const calendarClient = read("features/admin/social/SocialOperationalCalendar.tsx");
  const operationClient = read("features/admin/social/social-operation-client.ts");
  const queuePage = read("features/admin/social/operations-page.tsx");
  const queueClient = read("features/admin/social/SocialQueueClient.tsx");
  const postsPage = read("apps/admin/app/(control-plane)/social/posts/page.tsx");
  assert.match(calendarPage, /SocialOperationalCalendar/);
  assert.match(calendarClient, /Asia\/Bangkok/);
  assert.match(calendarClient, /rescheduleSocialPublication/);
  assert.match(operationClient, /\/api\/admin\/social\/publications\/reschedule\//);
  assert.match(calendarClient, /draggable/);
  assert.match(queuePage, /SocialQueueClient/);
  assert.match(queueClient, /ส่งตอนนี้/);
  assert.match(queueClient, /เปลี่ยนเวลา/);
  assert.doesNotMatch(postsPage, /operations-page/);
});

test("reschedule and cancel mutate only the latest publication job with CAS", () => {
  const service = read("lib/admin/social/operations-service.ts");
  const latestJobJoin = /JOIN LATERAL \(\s*SELECT \* FROM ccpun_social\.social_publication_job\s*WHERE publication_id=publication\.id ORDER BY created_at DESC,id DESC LIMIT 1(?: FOR UPDATE)?\s*\) AS job ON true/g;
  const matches = service.match(latestJobJoin) ?? [];
  assert.ok(matches.length >= 2, `expected latest-job selection for operational reads + shared mutation, got ${matches.length}`);
  assert.match(service, /LIMIT 1 FOR UPDATE/, "shared amendment statement row-locks latest job");
  assert.match(service, /locked_publication AS MATERIALIZED[\s\S]*?FOR UPDATE/, "publication fence precedes latest-job selection");
  assert.match(service, /job\.version=\$2/);
  assert.match(service, /version=version\+1/);
  assert.match(service, /FROM amended_job RETURNING 1/);
  assert.doesNotMatch(service, /ON CONFLICT|SELECT id AS audit_id/);
  assert.match(service, /mutatePublication\("reschedule"/);
  assert.match(service, /mutatePublication\("cancel"/);
  assert.match(service, /SOCIAL_OPERATION_CAS_CONFLICT/);
});

test("Social audit writes use INSERT-only privileges and preserve consumed CTE results", () => {
  for (const [file, count, consumed] of [
    ["execution-store.ts", 6, false],
    ["operations-service.ts", 1, true],
    ["publishing-store.ts", 2, false],
  ] as const) {
    const source = read(`lib/admin/social/${file}`);
    const inserts = source.match(consumed
      ? /INSERT INTO ccpun_social\.social_execution_audit[\s\S]*?FROM amended_job RETURNING 1/g
      : /INSERT INTO ccpun_social\.social_execution_audit[\s\S]*?ON CONFLICT(?: \([^)]+\))? DO NOTHING(?: RETURNING [^\n`]+)?/g) ?? [];
    assert.equal(inserts.length, count, `${file}: audit write coverage`);
    for (const sql of inserts) {
      assert.match(sql, /\(id,actor_type,actor_ref,action,object_type,object_id,request_ref,outcome\)/);
      assert.doesNotMatch(sql, /ON CONFLICT \(/);
      if (consumed) { assert.match(sql, /FROM amended_job RETURNING 1$/); assert.doesNotMatch(sql, /ON CONFLICT/); }
      else assert.doesNotMatch(sql, /RETURNING/);
    }
    if (consumed) assert.match(source, /FROM amended_job CROSS JOIN audit/);
  }
});

test("worker remains approval-gated, bounded and fail-closed for ambiguous provider state", () => {
  const worker = read("lib/admin/social/worker.ts");
  const execution = read("lib/admin/social/execution-store.ts");
  const publishing = read("lib/admin/social/publishing.ts");
  const workerRoute = read("apps/admin/app/api/admin/social/worker/route.ts");
  assert.match(worker, /MAX_JOBS_PER_RUN = 6/);
  assert.match(worker, /BASE_RETRY_DELAY_MS = 30_000/);
  assert.match(worker, /2 \*\* Math\.max/);
  assert.match(worker, /AUTO_EXECUTABLE_FORMATS = new Set\(\["text-post", "link-post"\]\)/);
  assert.match(publishing, /approvedByActorType: z\.literal\("human"\)/);
  assert.match(execution, /SOCIAL_EXECUTION_RECONCILIATION_REQUIRED/);
  assert.match(execution, /SOCIAL_EXECUTION_TRUSTED_MEDIA_REQUIRED/);
  assert.match(workerRoute, /CRON_SECRET/);
});

test("execution audit schema accepts worker execution records without widening the trust model", () => {
  const migration = read("db/migrations/20260828_website_42_social_foundation_v2.sql");
  const execution = read("lib/admin/social/execution-store.ts");
  assert.match(migration, /actor_type IN \('human', 'system'\)/);
  assert.match(execution, /actor_type,actor_ref,action,object_type,object_id,request_ref,outcome/);
  assert.match(execution, /'human'/);
});

test("Instagram audio configuration is revision-bound and preview URLs are not persisted", () => {
  const schema = read("cms/sanity/schema/documents/social-variant.ts");
  const audio = read("lib/admin/social/instagram-audio-config.ts");
  const route = read("apps/admin/app/api/admin/social/drafts/instagram-audio/route.ts");
  assert.match(schema, /instagramAudio/);
  assert.match(audio, /audioId/);
  assert.match(audio, /videoVolume/);
  assert.match(audio, /audioVolume/);
  assert.match(audio, /revalidateInstagramAudioConfiguration/);
  assert.match(audio, /ifRevisionId\(mutation\.expectedRevision\)/);
  assert.match(route, /instagramAudioConfigurationMutationSchema/);
  assert.match(route, /saveSocialInstagramAudioConfiguration/);
  assert.doesNotMatch(schema, /previewUrl|downloadUrl/);
});

test("media accessibility metadata stays in Sanity editorial state", () => {
  const schema = read("cms/sanity/schema/documents/social-variant.ts");
  const drafts = read("lib/admin/social/drafts.ts");
  const panel = read("features/admin/social/SocialMediaMetadataPanel.tsx");
  assert.match(schema, /altText/);
  assert.match(schema, /thumbnailTimestampMs/);
  assert.match(drafts, /altText/);
  assert.match(drafts, /thumbnailTimestampMs/);
  assert.match(panel, /expectedRevision/);
});
