import assert from "node:assert/strict";
import test from "node:test";

import {
  isRetryableSanityReadError,
  retryTransientSanityRead,
} from "../../lib/content/sanity-resilience";

test("Sanity sidecar retry only accepts transient transport/server failures", () => {
  for (const statusCode of [408, 425, 429, 500, 502, 503, 504]) {
    assert.equal(isRetryableSanityReadError({ statusCode }), true, String(statusCode));
  }
  for (const statusCode of [400, 401, 403, 404, 409, 422]) {
    assert.equal(isRetryableSanityReadError({ statusCode }), false, String(statusCode));
  }
  assert.equal(isRetryableSanityReadError({ code: "ECONNRESET" }), true);
  assert.equal(isRetryableSanityReadError({ name: "ServerError" }), true);
  assert.equal(isRetryableSanityReadError(new TypeError("fetch failed")), true);
  assert.equal(isRetryableSanityReadError(new TypeError("Invalid URL")), false);
  assert.equal(isRetryableSanityReadError({ name: "ZodError" }), false);
});

test("Sanity sidecar retry is bounded to one retry by default", async () => {
  let attempts = 0;
  const result = await retryTransientSanityRead(async () => {
    attempts += 1;
    if (attempts === 1) throw { statusCode: 503 };
    return "ok";
  }, { delayMs: 0 });

  assert.equal(result, "ok");
  assert.equal(attempts, 2);
});

test("Sanity sidecar retry never retries auth, validation or wrong-lane failures", async () => {
  for (const error of [
    { statusCode: 401 },
    { statusCode: 403 },
    { name: "ZodError" },
    new Error("Sanity content fetch is not configured"),
  ]) {
    let attempts = 0;
    await assert.rejects(
      retryTransientSanityRead(async () => {
        attempts += 1;
        throw error;
      }, { delayMs: 0 }),
    );
    assert.equal(attempts, 1);
  }
});
