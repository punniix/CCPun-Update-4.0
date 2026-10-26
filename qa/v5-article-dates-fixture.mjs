// Offline C14 test transport. Load after the owner's deny-network preload.
// No real transport is saved or called, including for unmatched URLs.
import { Writable, Readable } from "node:stream";
import { EventEmitter } from "node:events";
import { syncBuiltinESMExports } from "node:module";
import http from "node:http";
import https from "node:https";
const deny = () => {
  throw new Error("C14_FIXTURE_OUTBOUND_DENIED");
};
const article = {
  _id: "c14-local-fixture",
  slug: "c14-local-fixture",
  title: "C14 Local Article Date Fixture",
  excerpt: "Local synthetic rendering fixture.",
  category: "การเงินส่วนบุคคล",
  categorySlug: "personal-finance",
  authorName: "CCPun",
  publishedAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-03T00:00:00Z",
  seo: {
    title: "C14 Local Article Date Fixture",
    description: "Local synthetic rendering fixture.",
    noindex: true,
  },
  featuredImage: {
    src: "/assets/blog-hub-hero-ccpun-v1.webp",
    alt: "Local fixture artwork",
    width: 1774,
    height: 887,
  },
  body: [
    {
      _type: "block",
      style: "normal",
      children: [
        {
          _type: "span",
          text: "Local synthetic article for CSS delivery verification.",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "h2",
      children: [{ _type: "span", text: "CSS fixture heading", marks: [] }],
      markDefs: [],
    },
    {
      _type: "callout",
      title: "Local fixture",
      text: "This content is local test data.",
    },
  ],
  faq: [],
  sources: [],
};
function assertAllowed(url, method) {
  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    !["ccb9lnw5.api.sanity.io", "ccb9lnw5.apicdn.sanity.io"].includes(
      url.hostname,
    ) ||
    !/^\/v\d{4}-\d{2}-\d{2}\/data\/query\/uat$/.test(url.pathname) ||
    !["GET", "POST"].includes(method)
  )
    deny();
  const perspective = url.searchParams.get("perspective");
  if (perspective && perspective !== "published") deny();
}
function fixture(url, body = "") {
  const payload = body ? JSON.parse(body) : {};
  const query = url.searchParams.get("query") || payload.query;
  if (typeof query !== "string" || !query.trim()) deny();
  const q = query.replace(/\s+/g, " ").trim();
  let result;
  if (
    q.includes('"categories":') &&
    q.includes('"routeOwnerSlugs":') &&
    q.includes('"referencedCategoryIds":')
  ) {
    result = {
      categories: [],
      routeOwnerSlugs: ["c14-local-fixture"],
      canonicalOwnerUrls: [],
      referencedCategoryIds: [],
    };
  } else if (
    q.includes('_type == "article"') &&
    q.includes("slug.current == $slug")
  ) {
    const slug = url.searchParams.has("$slug")
      ? JSON.parse(url.searchParams.get("$slug"))
      : payload.params?.slug;
    result = slug === article.slug ? article : null;
  } else if (
    q.includes('_type == "article"') &&
    q.includes("defined(slug.current)") &&
    q.includes("order(coalesce(publishedAt, _updatedAt) desc)")
  ) {
    result = [article];
  } else if (
    q.includes('_type == "author"') &&
    q.includes("ccpun-author-ccpun-profile")
  ) {
    result = null;
  } else if (
    q.includes('_type == "blogSettings"') &&
    q.includes("blog-settings")
  ) {
    result = null;
  } else {
    throw new Error("C14_FIXTURE_UNRECOGNIZED_QUERY");
  }
  return JSON.stringify({ result, query, ms: 0 });
}
function request(input, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = undefined;
  }
  let opts;
  let url;
  if (typeof input === "string" || input instanceof URL) {
    url = new URL(input);
    opts = { ...options };
    // Explicit URL overrides must not permit a different destination.
    if (opts.hostname || opts.host || opts.port || opts.path || opts.protocol)
      deny();
  } else {
    opts = { ...input, ...options };
    url = new URL(
      `${opts.protocol || "https:"}//${opts.hostname || opts.host}${opts.port ? ":" + opts.port : ""}${opts.path || opts.pathname || "/"}`,
    );
  }
  const method = String(opts.method || "GET").toUpperCase();
  assertAllowed(url, method);
  const headers = Object.fromEntries(
    Object.entries(opts.headers || {}).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ]),
  );
  headers.host ||= url.host;
  let body = "";
  const req = new Writable({
    write(chunk, encoding, done) {
      body += chunk.toString();
      done();
    },
    final(done) {
      let serialized;
      try {
        serialized = fixture(url, body);
      } catch (error) {
        done(error);
        return;
      }
      done();
      process.nextTick(() => {
        if (req.destroyed || req.aborted) return;
        const response = Readable.from([Buffer.from(serialized)]);
        response.statusCode = 200;
        response.statusMessage = "OK";
        response.headers = {
          "content-type": "application/json",
          "content-length": String(Buffer.byteLength(serialized)),
        };
        response.rawHeaders = Object.entries(response.headers).flat();
        response.httpVersion = "1.1";
        response.httpVersionMajor = 1;
        response.httpVersionMinor = 1;
        response.complete = false;
        response.req = req;
        response.socket = req.socket;
        response.once("end", () => {
          response.complete = true;
        });
        req.emit("response", response);
      });
    },
    autoDestroy: false,
  });
  req.getHeader = (name) => headers[String(name).toLowerCase()];
  req.setHeader = (name, value) => {
    headers[String(name).toLowerCase()] = value;
    return req;
  };
  req.removeHeader = (name) => {
    delete headers[String(name).toLowerCase()];
  };
  req.getHeaders = () => ({ ...headers });
  req.hasHeader = (name) => Object.hasOwn(headers, String(name).toLowerCase());
  req.flushHeaders = req.setNoDelay = req.setSocketKeepAlive = () => req;
  req.setTimeout = () => req;
  req.abort = () => {
    req.aborted = true;
    req.emit("abort");
    req.destroy();
  };
  const socket = new EventEmitter();
  socket.connecting = false;
  socket.remoteAddress = "offline-fixture";
  socket.setTimeout = socket.setNoDelay = socket.setKeepAlive = () => socket;
  socket.destroy = (error) => {
    if (error) socket.emit("error", error);
    return socket;
  };
  req.socket = req.connection = socket;
  if (callback) req.once("response", callback);
  process.nextTick(() => {
    if (!req.destroyed) req.emit("socket", socket);
  });
  return req;
}
for (const transport of [http, https]) {
  transport.request = request;
  transport.get = (...args) => {
    const req = request(...args);
    req.end();
    return req;
  };
}
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  const method = String(init.method || input.method || "GET").toUpperCase();
  assertAllowed(url, method);
  const body =
    init.body ??
    (typeof input.clone === "function" && method === "POST"
      ? await input.clone().text()
      : "");
  return new Response(fixture(url, body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
syncBuiltinESMExports();
