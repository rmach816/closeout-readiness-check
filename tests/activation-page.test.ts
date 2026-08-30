import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

const script = await readFile(join(process.cwd(), "public", "activation.js"), "utf8");
const activationId = "a".repeat(24);
const publicKey = "b".repeat(59);
const validQuery = `?activation_id=${activationId}&public_key=${publicKey}`;

function harness(query: string, fetcher: (...args: unknown[]) => Promise<unknown>) {
  const handlers: Record<string, () => Promise<void>> = {};
  const buttons = ["monthly", "annual"].map((plan) => ({
    dataset: { checkoutPlan: plan }, disabled: false,
    addEventListener: (_event: string, handler: () => Promise<void>) => { handlers[plan] = handler; }
  }));
  const panel = { hidden: true };
  const plans = { hidden: true, querySelectorAll: () => buttons };
  const status = { textContent: "", dataset: { kind: "" } };
  const elements: Record<string, unknown> = { "computer-activation": panel, "activation-plans": plans, "activation-status": status };
  let redirected: string | undefined;
  runInNewContext(script, {
    URL, URLSearchParams, AbortController, setTimeout, clearTimeout,
    window: { location: { search: query, assign: (url: string) => { redirected = url; } } },
    document: { getElementById: (id: string) => elements[id] }, fetch: fetcher
  });
  return { panel, plans, status, buttons, handlers, redirected: () => redirected };
}

test("ordinary visits hide checkout; incomplete activation links cannot purchase", () => {
  let calls = 0;
  const fetcher = async () => { calls++; return {}; };
  const ordinary = harness("", fetcher);
  assert.equal(ordinary.panel.hidden, true);
  for (const query of ["?activation_id=bad", "?checkout=canceled", "?activation_id=" + activationId]) {
    const page = harness(query, fetcher);
    assert.equal(page.panel.hidden, false);
    assert.equal(page.plans.hidden, true);
    assert.match(page.status.textContent, /original activation link/);
    assert.deepEqual(Object.keys(page.handlers), []);
  }
  assert.equal(calls, 0);
});

test("both plans send the purchasing computer identifiers and redirect only to Stripe", async () => {
  for (const plan of ["monthly", "annual"]) {
    let sent: unknown;
    const page = harness(validQuery, async (url, options) => {
      assert.equal(url, "/api/checkout");
      sent = JSON.parse((options as { body: string }).body);
      return { ok: true, json: async () => ({ url: "https://checkout.stripe.com/c/pay/cs_test_fixture" }) };
    });
    assert.equal(page.plans.hidden, false);
    await page.handlers[plan]!();
    assert.deepEqual(sent, { action: "checkout", plan, activationId, publicKey });
    assert.equal(page.redirected(), "https://checkout.stripe.com/c/pay/cs_test_fixture");
  }
});

test("network failures and untrusted redirects show a retryable error without navigation", async () => {
  for (const fetcher of [
    async () => { throw new Error("network failure"); },
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => ({ url: "https://example.com/checkout" }) })
  ]) {
    const page = harness(validQuery, fetcher);
    await page.handlers.monthly!();
    assert.equal(page.redirected(), undefined);
    assert.equal(page.status.dataset.kind, "error");
    assert.match(page.status.textContent, /try again/);
    assert.ok(page.buttons.every(button => !button.disabled));
  }
});

test("a pending checkout prevents duplicate plan submissions", async () => {
  let release!: (value: unknown) => void;
  let calls = 0;
  const page = harness(validQuery, async () => { calls++; return new Promise(resolve => { release = resolve; }); });
  const first = page.handlers.monthly!();
  await page.handlers.annual!();
  assert.equal(calls, 1);
  assert.ok(page.buttons.every(button => button.disabled));
  release({ ok: false });
  await first;
});

test("the public page wires activation and billing returns to a real guide section", async () => {
  const html = await readFile(join(process.cwd(), "public/index.html"), "utf8");
  const guide = await readFile(join(process.cwd(), "public/guide/index.html"), "utf8");
  const config = JSON.parse(await readFile(join(process.cwd(), "vercel.json"), "utf8"));
  assert.match(html, /src="\/activation\.js" defer/);
  assert.ok(html.includes('href="/site.css?v=activation-1"'), "activation styling must bypass pre-checkout browser caches");
  const css = await readFile(join(process.cwd(), "public/site.css"), "utf8");
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
  for (const id of ["computer-activation", "activation-plans", "activation-status"]) assert.ok(html.includes(`id="${id}"`));
  assert.ok(guide.includes('id="billing"'));
  assert.ok(guide.includes("manage_closeout_subscription"));
  assert.ok(config.redirects.some((item: { source: string; destination: string }) => item.source === "/manage" && item.destination === "/guide#billing"));
});
