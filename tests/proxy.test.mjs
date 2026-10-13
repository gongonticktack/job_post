import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";

const proxyRequest = (payload) => new Request("https://app.example/api/proxy", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
});

test("Workers routes API methods and static assets", async () => {
  const env = { ASSETS: { fetch: async () => new Response("asset") } };
  assert.equal((await worker.fetch(new Request("https://app.example/"), env)).status, 200);
  const get = await worker.fetch(new Request("https://app.example/api/proxy"), env);
  assert.equal(get.status, 405);
  assert.equal(get.headers.get("Allow"), "POST, OPTIONS");
  assert.equal((await worker.fetch(new Request("https://app.example/api/proxy", { method: "OPTIONS" }), env)).status, 204);
  assert.equal((await worker.fetch(new Request("https://app.example/api/missing"), env)).status, 404);
});

test("proxy preserves EUC-JP bytes and rejects disallowed hosts", async () => {
  const originalFetch = globalThis.fetch;
  const bytes = Uint8Array.of(0xbf, 0xa6, 0xcc, 0xb3, 0xc6, 0xe2, 0xcd, 0xc6);
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(bytes, { headers: { "Content-Type": "text/html; charset=EUC-JP" } }); };
  try {
    const response = await worker.fetch(proxyRequest({ url: "https://nttdata-career.jposting.net/u/job.phtml?job_code=1282" }), {});
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "text/html; charset=EUC-JP");
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
    assert.equal((await worker.fetch(proxyRequest({ url: "https://example.com" }), {})).status, 403);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test("proxy forwards Fujitsu JSON POST", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://www.jobs.global.fujitsu.com/services/recruiting/v1/jobs");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.get("Content-Type"), "application/json");
    assert.equal(options.body, '{"locale":"ja_JP"}');
    return new Response('{"totalJobs":0}', { headers: { "Content-Type": "application/json" } });
  };
  try {
    const response = await worker.fetch(proxyRequest({ url: "https://www.jobs.global.fujitsu.com/services/recruiting/v1/jobs", method: "POST", headers: { "Content-Type": "application/json" }, body: '{"locale":"ja_JP"}' }), {});
    assert.deepEqual(await response.json(), { totalJobs: 0 });
  } finally { globalThis.fetch = originalFetch; }
});
