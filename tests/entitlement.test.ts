import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { POST as billingPost } from "../api/billing.js";
import { POST as validatePost } from "../api/license/validate.js";
import { createRecoveryToken } from "../src/recovery-token.js";
import { authorizeAudit, createFileStateStore, createInstallationProof } from "../src/entitlement.js";

test("local state directories are isolated and purpose-bound proofs differ", async () => {
  const firstDir = await mkdtemp(join(tmpdir(), "closeout-state-a-"));
  const secondDir = await mkdtemp(join(tmpdir(), "closeout-state-b-"));
  const first = createFileStateStore({ M2AI_STATE_DIR: firstDir } as NodeJS.ProcessEnv);
  const second = createFileStateStore({ M2AI_STATE_DIR: secondDir } as NodeJS.ProcessEnv);
  const firstClaim = await first.claimTrial();
  assert.equal(firstClaim.status, "claimed");
  if (firstClaim.status !== "claimed") return;
  await firstClaim.claim.release();
  assert.equal(await second.load(), undefined);
  const license = createInstallationProof(firstClaim.claim.state, "test", "license_validate", new Date("2026-08-29T00:00:00.000Z"));
  const portal = createInstallationProof(firstClaim.claim.state, "test", "billing_portal", new Date("2026-08-29T00:00:00.000Z"));
  assert.equal(license.purpose, "license_validate");
  assert.equal(portal.purpose, "billing_portal");
  assert.notEqual(license.signature, portal.signature);
});

test("checkout uses dedicated closeout prices, promotion codes, and namespace metadata", async () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  try {
    Object.assign(process.env, {
      APP_MODE: "test", SITE_URL: "https://closeoutcheck.example", STRIPE_SECRET_KEY: "sk_test_closeout",
      STRIPE_MONTHLY_PRICE_ID: "price_closeout_monthly", STRIPE_ANNUAL_PRICE_ID: "price_closeout_annual", LICENSE_SIGNING_SECRET: "closeout-signing-secret"
    });
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ url: "https://checkout.stripe.com/cs_test_closeout" }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const response = await billingPost(new Request("https://closeoutcheck.example/api/billing", {
      method: "POST", body: JSON.stringify({ action: "checkout", mode: "test", plan: "monthly", activationId: "abcdefghijklmnop1234", publicKey: "closeout-public-key" }), headers: { "content-type": "application/json" }
    }));
    assert.equal(response.status, 200);
    assert.match(requestBody, /price_closeout_monthly/);
    assert.match(requestBody, /allow_promotion_codes=true/);
    assert.equal(new URLSearchParams(requestBody).get("consent_collection[terms_of_service]"), "required");
    assert.match(requestBody, /closeout_activation_id/);
    assert.doesNotMatch(requestBody, /cora_|change.order|recoveryaudit/);
  } finally {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  }
});

test("live checkout rejects absent or mismatched mode before contacting Stripe", async () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  try {
    Object.assign(process.env, {
      APP_MODE: "live", SITE_URL: "https://closeoutcheck.example", STRIPE_SECRET_KEY: "rk_live_closeout",
      STRIPE_MONTHLY_PRICE_ID: "price_closeout_monthly", STRIPE_ANNUAL_PRICE_ID: "price_closeout_annual", LICENSE_SIGNING_SECRET: "closeout-signing-secret"
    });
    let calls = 0;
    globalThis.fetch = (async (_input, init) => {
      calls++;
      assert.equal(new URLSearchParams(String(init?.body)).get("subscription_data[metadata][closeout_mode]"), "live");
      return new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cs_live_fixture" }));
    }) as typeof fetch;
    for (const mode of [undefined, "test", "invalid", "live"]) {
      const response = await billingPost(new Request("https://closeoutcheck.example/api/billing", {
        method: "POST", body: JSON.stringify({ action: "checkout", mode, plan: "annual", activationId: "abcdefghijklmnop1234", publicKey: "closeout-public-key" })
      }));
      assert.equal(response.status, mode === "live" ? 200 : 400);
    }
    assert.equal(calls, 1);
  } finally {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  }
});

test("sandbox and legacy cached access cannot authorize a live-mode outage", async () => {
  const directory = await mkdtemp(join(tmpdir(), "closeout-mode-cache-"));
  const environment = { M2AI_STATE_DIR: directory, APP_MODE: "test", LICENSE_SERVICE_URL: "https://closeoutcheck.example" } as NodeJS.ProcessEnv;
  const store = createFileStateStore(environment);
  const trial = await store.claimTrial();
  assert.equal(trial.status, "claimed");
  if (trial.status !== "claimed") return;
  await trial.claim.complete();
  const now = new Date("2026-08-30T00:00:00Z");
  const active = (async () => new Response(JSON.stringify({ allowed: true, state: "active", paidThrough: "2026-09-30T00:00:00Z", checkedAt: now.toISOString() }))) as typeof fetch;
  const outage = (async () => { throw new Error("network unavailable"); }) as typeof fetch;
  assert.equal((await authorizeAudit({ store, environment, fetcher: active, now })).allowed, true);
  assert.equal((await authorizeAudit({ store, environment, fetcher: outage, now })).source, "outage-cache");
  environment.APP_MODE = "live";
  assert.equal((await authorizeAudit({ store, environment, fetcher: outage, now })).allowed, false);
  const legacy = await store.load();
  assert.ok(legacy?.paidProof);
  delete legacy.paidProof.mode;
  await store.save(legacy);
  assert.equal((await authorizeAudit({ store, environment, fetcher: outage, now })).allowed, false);
  assert.equal((await authorizeAudit({ store, environment, fetcher: active, now })).allowed, true);
  assert.equal((await authorizeAudit({ store, environment, fetcher: outage, now })).source, "outage-cache");
  assert.equal((await store.load())?.trialCompleted, true);
});

test("license recovery is mode-bound and Stripe outages retain only verified paid grace", async () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  try {
    const secret = "fixture-only-signing-secret";
    Object.assign(process.env, { APP_MODE: "live", SITE_URL: "https://closeoutcheck.example", STRIPE_SECRET_KEY: "rk_live_fixture", STRIPE_MONTHLY_PRICE_ID: "price_month", STRIPE_ANNUAL_PRICE_ID: "price_year", LICENSE_SIGNING_SECRET: secret });
    const recoveryKey = createRecoveryToken({ version: 1, customerId: "cus_fixture", subscriptionId: "sub_fixture", issuedAt: new Date().toISOString() }, secret);
    let upstreamStatus = 200;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response(JSON.stringify({ id: "sub_fixture", customer: "cus_fixture", status: "active", current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30, metadata: { closeout_mode: "live" }, items: { data: [{ price: { id: "price_month" } }] } }), { status: upstreamStatus });
    }) as typeof fetch;
    for (const mode of [undefined, "test", "invalid"]) {
      assert.equal((await validatePost(new Request("https://closeoutcheck.example/api/license/validate", { method: "POST", body: JSON.stringify({ recoveryKey, mode }) }))).status, 403);
    }
    assert.equal(calls, 0);
    const directory = await mkdtemp(join(tmpdir(), "closeout-api-outage-"));
    const environment = { APP_MODE: "live", LICENSE_SERVICE_URL: "https://closeoutcheck.example", LICENSE_KEY: recoveryKey, M2AI_STATE_DIR: directory } as NodeJS.ProcessEnv;
    const store = createFileStateStore(environment);
    const trial = await store.claimTrial();
    assert.equal(trial.status, "claimed");
    if (trial.status !== "claimed") return;
    await trial.claim.complete();
    const routeFetcher = ((input, init) => validatePost(new Request(input, init))) as typeof fetch;
    assert.equal((await authorizeAudit({ store, environment, fetcher: routeFetcher })).allowed, true);
    for (const status of [429, 500, 503]) {
      upstreamStatus = status;
      assert.equal((await authorizeAudit({ store, environment, fetcher: routeFetcher })).source, "outage-cache");
      assert.ok((await store.load())?.paidProof);
    }
    upstreamStatus = 404;
    assert.equal((await authorizeAudit({ store, environment, fetcher: routeFetcher })).allowed, false);
    assert.equal((await store.load())?.paidProof, undefined);
  } finally {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  }
});
