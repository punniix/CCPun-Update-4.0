// Offline integration transport. Public UAT snapshot only; C10 historical transport stays unchanged. Load after the owner's deny-network preload.
// No real transport is saved or called, including for unmatched URLs.
import { Writable, Readable } from "node:stream";
import { EventEmitter } from "node:events";
import { syncBuiltinESMExports } from "node:module";
import http from "node:http";
import https from "node:https";
const deny = () => {
  throw new Error("C10_FIXTURE_OUTBOUND_DENIED");
};
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const snapshotBytes = readFileSync(new URL('./v5-integration-uat03-snapshot.json', import.meta.url), 'utf8');
if (createHash('sha256').update(snapshotBytes).digest('hex') !== 'ebbbd2e3bd3c01d37ec077c1ddfc60ffd5ba9c54c690f27693821be368a95ffa') throw new Error('UAT_SNAPSHOT_BYTES_CHANGED');
const snapshot = JSON.parse(snapshotBytes);
const extraBytes = readFileSync(new URL('./v5-uat-collision-articles-snapshot.json', import.meta.url), 'utf8');
if (createHash('sha256').update(extraBytes).digest('hex') !== '33f3bc7169a1fb2e000436c71b5edb9a65999068fba758f7ba1d8950458ad1ff') throw new Error('FULL_UAT_SNAPSHOT_CHANGED');
const extra = JSON.parse(extraBytes);
snapshot.copies.push(...extra.copies);


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
    result = snapshot.categories;
  } else if (
    q.includes('_type == "article"') &&
    q.includes("slug.current == $slug")
  ) {
    const slug = url.searchParams.has("$slug")
      ? JSON.parse(url.searchParams.get("$slug"))
      : payload.params?.slug;
    result = extra.articles.find(article => article.slug === slug) || null;
  } else if (
    q.includes('_type == "article"') &&
    q.includes("defined(slug.current)") &&
    q.includes("order(coalesce(publishedAt, _updatedAt) desc)")
  ) {
    result = snapshot.articles;
  } else if (
    q.includes('_type == "author"') &&
    q.includes("ccpun-author-ccpun-profile")
  ) {
    result = snapshot.author;
  } else if (
    q.includes('_type == "blogSettings"') &&
    q.includes("blog-settings")
  ) {
    result = snapshot.blogFeatured;
  } else if (q.includes('_type == "publicPageCopy"') && q.includes('_id == $id')) {
    const id = url.searchParams.has('$id') ? JSON.parse(url.searchParams.get('$id')) : payload.params?.id;
    result = snapshot.copies.find(doc => doc._id === id) || null;
  } else if (q.includes('_type == "lineChatConfig"') || q.includes('_type == "pageSeo"')) {
    result = null; // Shipped reviewed defaults; no synthetic configuration or SEO override.
  } else {
    throw new Error("INTEGRATION_FIXTURE_UNRECOGNIZED_QUERY");
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
