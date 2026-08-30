import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/index.js";
import { createFileStateStore } from "../src/entitlement.js";

test("exposes the closeout tools with read-only annotations", async () => {
  const root = await mkdtemp(join(tmpdir(), "closeout-mcp-"));
  await writeFile(join(root, "README.txt"), "Electrical closeout folder");
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer(root, { environment: { APP_MODE: "test" } as NodeJS.ProcessEnv, stateStore: {
    load: async () => undefined, save: async () => undefined,
    claimTrial: async () => ({ status: "completed" as const })
  } });
  const client = new Client({ name: "closeout-test", version: "0.1.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const listed = await client.listTools();
  assert.deepEqual(listed.tools.map((tool) => tool.name), ["check_closeout_folder", "manage_closeout_subscription", "show_recovery_key"]);
  assert.equal(listed.tools[0]?.annotations?.readOnlyHint, true);
  await client.close();
  await server.close();
});

test("a used free check returns a current-mode activation link without scanning again", async () => {
  const directory = await mkdtemp(join(tmpdir(), "closeout-upgrade-link-"));
  const environment = { M2AI_STATE_DIR: directory, APP_MODE: "live", LICENSE_SERVICE_URL: "https://closeoutcheck.example" } as NodeJS.ProcessEnv;
  const store = createFileStateStore(environment);
  const claim = await store.claimTrial();
  assert.equal(claim.status, "claimed");
  if (claim.status !== "claimed") return;
  await claim.claim.complete();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer(directory, { environment, stateStore: store,
    fetcher: (async () => new Response("", { status: 403 })) as typeof fetch,
    auditFolder: async () => { throw new Error("must not scan after denied entitlement"); }
  });
  const client = new Client({ name: "closeout-upgrade-proof", version: "1.0.0" });
  try {
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const result = await client.callTool({ name: "check_closeout_folder", arguments: {} });
    assert.equal(result.isError, true);
    const text = (result.content as Array<{ type: string; text: string }>).find(item => item.type === "text")?.text ?? "";
    assert.match(text, /active subscription is required/);
    assert.match(text, /mode=live/);
    assert.ok(text.includes(claim.claim.state.activationId));
    assert.doesNotMatch(text, /must not scan/);
    assert.equal((await store.load())?.trialCompleted, true);
  } finally { await client.close(); await server.close(); }
});
