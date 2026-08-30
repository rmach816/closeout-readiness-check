import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../api/download.js";

const release = (version: string) => ({
  tag_name: `v${version}`, draft: false, prerelease: false,
  assets: [{ name: `closeout-readiness-check-${version}.mcpb`, state: "uploaded", size: 100,
    browser_download_url: `https://github.com/rmach816/closeout-readiness-check/releases/download/v${version}/closeout-readiness-check-${version}.mcpb` }]
});

test("each click resolves the newly published release without caching an older version", async () => {
  const originalFetch = globalThis.fetch;
  let version = "0.1.3";
  let calls = 0;
  try {
    globalThis.fetch = (async (input, options) => {
      calls++;
      assert.equal(String(input), "https://api.github.com/repos/rmach816/closeout-readiness-check/releases/latest");
      assert.equal(new Headers(options?.headers).get("cache-control"), "no-cache");
      assert.ok(options?.signal);
      return Response.json(release(version));
    }) as typeof fetch;
    for (const current of ["0.1.3", "0.1.4", "1.0.0"]) {
      version = current;
      const response = await GET(new Request("https://closeoutcheck.m2ai.tech/download"));
      assert.equal(response.status, 307);
      assert.ok(response.headers.get("location")?.endsWith(`/closeout-readiness-check-${current}.mcpb`));
      assert.match(response.headers.get("cache-control")!, /no-store/);
      assert.equal(response.headers.get("vercel-cdn-cache-control"), "no-store");
    }
    assert.equal(calls, 3);
  } finally { globalThis.fetch = originalFetch; }
});

test("missing, untrusted, prerelease, or unavailable latest packages never fall back to an old download", async () => {
  const originalFetch = globalThis.fetch;
  try {
    const external = release("0.1.3");
    external.assets[0]!.browser_download_url = "https://example.com/package.mcpb";
    const incomplete = release("0.1.3");
    incomplete.assets[0]!.state = "new";
    const scenarios = [
      () => Response.json({ ...release("0.1.3"), draft: true }),
      () => Response.json({ ...release("0.1.3"), prerelease: true }),
      () => Response.json({ ...release("0.1.3"), assets: [] }),
      () => Response.json(external), () => Response.json(incomplete), () => Response.json(null),
      () => new Response("bad JSON"), () => new Response(null, { status: 429 }),
      () => new Response(null, { status: 503 }), () => { throw new Error("timeout"); }
    ];
    for (const scenario of scenarios) {
      globalThis.fetch = (async () => scenario()) as typeof fetch;
      const response = await GET(new Request("https://closeoutcheck.m2ai.tech/download"));
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("location"), null);
      assert.match(response.headers.get("cache-control")!, /no-store/);
      assert.match(await response.text(), /richard@m2ai\.tech/);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test("HEAD resolves the same download and unsupported methods do not query GitHub", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = (async () => { calls++; return Response.json(release("0.1.3")); }) as typeof fetch;
    assert.equal((await GET(new Request("https://closeoutcheck.m2ai.tech/download", { method: "HEAD" }))).status, 307);
    assert.equal((await GET(new Request("https://closeoutcheck.m2ai.tech/download", { method: "POST" }))).status, 405);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});
