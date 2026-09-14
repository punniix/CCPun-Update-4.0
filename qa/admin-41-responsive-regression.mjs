const CDP_HTTP = process.env.CDP_HTTP ?? "http://127.0.0.1:9222";
const preview = process.env.ADMIN_PREVIEW_URL;
const reviewExpectation = process.env.ADMIN_REVIEW_EXPECTATION;
const viewports = [
  { name: "mobile-390", width: 390, height: 844, mobile: true },
  { name: "mobile-430", width: 430, height: 932, mobile: true },
  { name: "tablet-portrait", width: 768, height: 1024, mobile: false },
  { name: "tablet-landscape", width: 1024, height: 768, mobile: false },
];
const routes = [
  ["dashboard", "/dashboard/", "เริ่มที่นี่"],
  ["reviews", "/dashboard/inbox/", "ข้อเสนอที่รอตรวจ"],
  ["seo", "/seo/", "SEO Control Center"],
  ["research", "/content/research/", "Research Intelligence"],
  ["growth", "/analytics/search/", "ภาพรวมการเติบโต"],
];

if (!preview) throw new Error("ADMIN_PREVIEW_URL is required");
if (!["empty", "actionable"].includes(reviewExpectation)) {
  throw new Error("ADMIN_REVIEW_EXPECTATION must be empty or actionable");
}
const baseUrl = new URL(preview);
if (baseUrl.protocol !== "https:" || !baseUrl.hostname.endsWith(".vercel.app")) {
  throw new Error("ADMIN_PREVIEW_URL must be an HTTPS Vercel Preview");
}
if (["ccpun-admin.vercel.app", "ccpun-admin-prod.vercel.app"].includes(baseUrl.hostname)) {
  throw new Error("Production Admin is not a responsive QA target");
}

class CDPClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        return message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result ?? {});
      }
      for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {});
    });
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method, timeoutMs = 20_000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timeout waiting for ${method}`)), timeoutMs);
      const listener = (params) => {
        clearTimeout(timeout);
        this.listeners.set(method, (this.listeners.get(method) ?? []).filter((item) => item !== listener));
        resolve(params);
      };
      this.listeners.set(method, [...(this.listeners.get(method) ?? []), listener]);
    });
  }

  close() { this.socket?.close(); }
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result?.value;
}

async function navigate(client, url) {
  const loaded = client.once("Page.loadEventFired").catch(() => undefined);
  await client.send("Page.navigate", { url });
  await loaded;
  await evaluate(client, "document.fonts?.ready?.then(() => true) ?? true");
}

const targetResponse = await fetch(`${CDP_HTTP}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
if (!targetResponse.ok) throw new Error(`Authenticated CDP browser is unavailable (${targetResponse.status})`);
const target = await targetResponse.json();
const client = new CDPClient(target.webSocketDebuggerUrl);
const results = [];

try {
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");

  for (const viewport of viewports) {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      screenWidth: viewport.width,
      screenHeight: viewport.height,
      deviceScaleFactor: 1,
      mobile: viewport.mobile,
    });
    await client.send("Emulation.setTouchEmulationEnabled", { enabled: viewport.mobile, maxTouchPoints: viewport.mobile ? 5 : 1 });

    for (const [name, pathname, heading] of routes) {
      await navigate(client, new URL(pathname, baseUrl).toString());
      const page = await evaluate(client, `(() => {
        const visible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
        };
        const tables = [...document.querySelectorAll("table")];
        const badTables = tables.filter((table) => {
          const region = table.closest('[role="region"]');
          return !region || !["auto", "scroll"].includes(getComputedStyle(region).overflowX);
        }).length;
        return {
          pathname: location.pathname,
          heading: document.querySelector("h1")?.textContent?.replace(/\\s+/g, " ").trim() ?? "",
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          shortButtons: [...document.querySelectorAll("main button")].filter(visible).filter((button) => button.getBoundingClientRect().height < 44).map((button) => button.textContent?.trim()),
          badTables,
          body: document.body.innerText,
        };
      })()`);

      if (page.pathname.startsWith("/login") || page.body.includes("เข้าสู่ระบบด้วย Google")) {
        throw new Error("Authenticated Preview session is required; no auth bypass is available");
      }
      if (!page.heading.includes(heading)) throw new Error(`${viewport.name}/${name}: heading mismatch (${page.heading})`);
      if (page.horizontalOverflow) throw new Error(`${viewport.name}/${name}: viewport has horizontal overflow`);
      if (page.shortButtons.length) throw new Error(`${viewport.name}/${name}: touch targets below 44px (${page.shortButtons.join(", ")})`);
      if (page.badTables) throw new Error(`${viewport.name}/${name}: data table lacks a horizontal scroll region`);

      if (name === "reviews") {
        const empty = page.body.includes("ยังไม่มีข้อเสนอที่รอตรวจ");
        const actionable = page.body.includes("ก่อนเปลี่ยน")
          && page.body.includes("ข้อเสนอหลังเปลี่ยน")
          && ["อนุมัติข้อเสนอ", "แก้ข้อเสนอ", "ไม่อนุมัติ", "ใช้กับฉบับร่าง"].some((label) => page.body.includes(label));
        if (reviewExpectation === "empty" && !empty) throw new Error(`${viewport.name}/reviews: expected the reviewed empty fixture state`);
        if (reviewExpectation === "actionable" && !actionable) throw new Error(`${viewport.name}/reviews: actionable review fixture is required`);
      }
      results.push({ viewport: viewport.name, route: name, status: "passed" });
    }
  }

  const session = await evaluate(client, `fetch("/api/admin/session/", { cache: "no-store" }).then(async (response) => ({ ok: response.ok, status: response.status, authenticated: Boolean((await response.json().catch(() => null))?.role) }))`);
  if (!session.ok || !session.authenticated) throw new Error(`Admin session read-back failed (${session.status})`);
  console.log(JSON.stringify({ baseUrl: baseUrl.origin, reviewExpectation, results }, null, 2));
} finally {
  client.close();
  await fetch(`${CDP_HTTP}/json/close/${target.id}`, { method: "PUT" }).catch(() => undefined);
}
