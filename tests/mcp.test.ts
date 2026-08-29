import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/index.js";

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
