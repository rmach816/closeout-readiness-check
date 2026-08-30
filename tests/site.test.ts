import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
    assert.match(html, /Technical beta/);
    assert.match(html, /no real subscription charges/);
  }
  const terms = await readFile(join(publicRoot, "terms/index.html"), "utf8");
  assert.match(terms, /\$99 per month or \$990 per year/);
  assert.match(terms, /first annual purchase and each annual renewal/);
  assert.match(terms, /seven calendar days/);
  assert.match(terms, /Fort Bend County, Texas/);
  const privacy = await readFile(join(publicRoot, "privacy/index.html"), "utf8");
  assert.match(privacy, /free-check allowance and installation key are maintained locally/);
  assert.match(privacy, /public key/);
  assert.match(privacy, /hosted by Microsoft/);
});
