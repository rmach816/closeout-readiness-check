import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { POST as billingPost } from "../api/billing.js";
import { createFileStateStore, createInstallationProof } from "../src/entitlement.js";

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
    assert.match(requestBody, /closeout_activation_id/);
    assert.doesNotMatch(requestBody, /cora_|change.order|recoveryaudit/);
  } finally {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  }
});
