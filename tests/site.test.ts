import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const publicRoot = join(process.cwd(), "public");
const pages = ["index.html", "guide/index.html", "about/index.html", "contact/index.html", "support/index.html", "terms/index.html", "privacy/index.html"];

test("public pages are product-specific and contain essential search metadata", async () => {
  for (const page of pages) {
    const html = await readFile(join(publicRoot, page), "utf8");
    assert.match(html, /<title>[^<]+<\/title>/, `${page} needs a title`);
    assert.match(html, /<meta\s+name="description"/, `${page} needs a description`);
    assert.match(html, /rel="canonical" href="https:\/\/closeoutcheck\.m2ai\.tech\//, `${page} needs the product canonical`);
    assert.match(html, /property="og:image" content="https:\/\/closeoutcheck\.m2ai\.tech\/icon\.png"/, `${page} needs social imagery`);
    assert.doesNotMatch(html, /Change Order Recovery Audit|recoveryaudit\.m2ai\.tech|PayerScore/i);
  }
});

test("search controls and sitemap use only the intended product domain", async () => {
  const sitemap = await readFile(join(publicRoot, "sitemap.xml"), "utf8");
  const robots = await readFile(join(publicRoot, "robots.txt"), "utf8");
  assert.match(sitemap, /closeoutcheck\.m2ai\.tech\/about/);
  assert.doesNotMatch(`${sitemap}\n${robots}`, /recoveryaudit|payerscore/i);
});

test("public disclosures distinguish local scans from findings returned to Claude", async () => {
  for (const page of pages) {
    const html = await readFile(join(publicRoot, page), "utf8");
    assert.match(html, /excerpts/i, `${page} must disclose excerpts`);
    assert.match(html, /Claude/);
    assert.doesNotMatch(html, /Project content (?:stays|does not leave)|Project filenames and extracted content stay|Pre-production legal draft|licensed-attorney review/);
  }
  for (const page of ["terms/index.html", "privacy/index.html"]) {
    const html = await readFile(join(publicRoot, page), "utf8");
    assert.match(html, /Early release/);
    assert.match(html, /Paid subscriptions are billed in USD through Stripe/);
    assert.doesNotMatch(html, /no real subscription charges|Checkout currently uses Stripe test mode/);
  }
  const terms = await readFile(join(publicRoot, "terms/index.html"), "utf8");
  assert.match(terms, /\$99 per month or \$990 per year/);
  assert.match(terms, /first annual purchase and each annual renewal/);
  assert.match(terms, /seven calendar days/);
  assert.match(terms, /Fort Bend County, Texas/);
  const privacy = await readFile(join(publicRoot, "privacy/index.html"), "utf8");
  assert.match(privacy, /free-check allowance and installation key are maintained locally/);
  assert.match(privacy, /public key/);
  assert.match(privacy, /business support mailbox at richard@m2ai\.tech is hosted by Zoho/);
  assert.doesNotMatch(privacy, /Outlook|hosted by Microsoft/);
});

test("all public and packaged business contacts use only the company email", async () => {
  const manifest = JSON.parse(await readFile(join(process.cwd(), "manifest.json"), "utf8"));
  assert.equal(manifest.author.email, "richard@m2ai.tech");
  const publicFiles = (await readdir(publicRoot, { recursive: true })).filter(file => /\.(html|js|xml|txt)$/.test(file));
  const contactFiles = ["about/index.html", "contact/index.html", "manage/index.html", "support/index.html", "privacy/index.html", "terms/index.html"];
  for (const file of publicFiles) {
    const content = await readFile(join(publicRoot, file), "utf8");
    assert.doesNotMatch(content, /[A-Z0-9._%+-]+@(?:outlook|hotmail|gmail)\.com/i, file);
    for (const match of content.matchAll(/mailto:([^"?<>\s]+)/g)) assert.equal(match[1], "richard@m2ai.tech", file);
  }
  for (const file of contactFiles) assert.ok((await readFile(join(publicRoot, file), "utf8")).includes("mailto:richard@m2ai.tech"), file);
  for (const file of ["SECURITY.md", "README.md", "docs/reviewer-guide.md"]) {
    const content = await readFile(join(process.cwd(), file), "utf8");
    assert.doesNotMatch(content, /[A-Z0-9._%+-]+@(?:outlook|hotmail|gmail)\.com/i, file);
  }
  assert.ok((await readFile(join(process.cwd(), "SECURITY.md"), "utf8")).includes("mailto:richard@m2ai.tech"));
});

test("published package and website agree on live billing and version", async () => {
  const manifest = JSON.parse(await readFile(join(process.cwd(), "manifest.json"), "utf8"));
  const pkg = JSON.parse(await readFile(join(process.cwd(), "package.json"), "utf8"));
  const html = await readFile(join(publicRoot, "index.html"), "utf8");
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.server.mcp_config.env.APP_MODE, "live");
  assert.ok(manifest.server.mcp_config.args.includes("--app-mode=live"));
  assert.ok(html.includes(`/v${pkg.version}/closeout-readiness-check-${pkg.version}.mcpb`));
  assert.ok(html.includes('data-billing-mode="live"'));
  assert.doesNotMatch(html, /Test monthly|Test annual|test-card|no real payment|sandbox|no real charges/i);
});
