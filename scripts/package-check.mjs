import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

const archivePath = new URL("../closeout-readiness-check.mcpb", import.meta.url);
const archive = await readFile(archivePath);
const endSignature = 0x06054b50;
let end = -1;
for (let offset = archive.length - 22; offset >= Math.max(0, archive.length - 65_557); offset -= 1) {
  if (archive.readUInt32LE(offset) === endSignature) {
    end = offset;
    break;
  }
}
if (end < 0) throw new Error("MCPB archive has no ZIP end record");

const entries = new Map();
const entryCount = archive.readUInt16LE(end + 10);
let offset = archive.readUInt32LE(end + 16);
for (let index = 0; index < entryCount; index += 1) {
  if (archive.readUInt32LE(offset) !== 0x02014b50) throw new Error("MCPB archive has an invalid ZIP central directory");
  const method = archive.readUInt16LE(offset + 10);
  const compressedSize = archive.readUInt32LE(offset + 20);
  const nameLength = archive.readUInt16LE(offset + 28);
  const extraLength = archive.readUInt16LE(offset + 30);
  const commentLength = archive.readUInt16LE(offset + 32);
  const localOffset = archive.readUInt32LE(offset + 42);
  const name = archive.subarray(offset + 46, offset + 46 + nameLength).toString("utf8").replaceAll("\\", "/");
  entries.set(name, { method, compressedSize, localOffset });
  offset += 46 + nameLength + extraLength + commentLength;
}

for (const required of ["manifest.json", "README.md", "SECURITY.md", "LICENSE", "docs/reviewer-guide.md"]) {
  if (!entries.has(required)) throw new Error(`MCPB is missing required package material: ${required}`);
}
for (const requiredRuntime of [
  "node_modules/@modelcontextprotocol/sdk/package.json",
  "node_modules/exceljs/package.json",
  "node_modules/mammoth/package.json",
  "node_modules/pdf-parse/package.json",
  "node_modules/zod/package.json"
]) {
  if (!entries.has(requiredRuntime)) throw new Error(`MCPB is missing required runtime dependency: ${requiredRuntime}`);
}
const forbiddenPrefixes = ["public/", "output/", ".playwright-cli/"];
const forbiddenEntry = [...entries.keys()].find((entry) => forbiddenPrefixes.some((prefix) => entry.startsWith(prefix)));
if (forbiddenEntry) throw new Error(`MCPB must not include local website or QA artifact: ${forbiddenEntry}`);

const readEntry = (name) => {
  const entry = entries.get(name);
  if (!entry) throw new Error(`MCPB is missing ${name}`);
  const local = entry.localOffset;
  if (archive.readUInt32LE(local) !== 0x04034b50) throw new Error(`MCPB has an invalid local entry for ${name}`);
  const nameLength = archive.readUInt16LE(local + 26);
  const extraLength = archive.readUInt16LE(local + 28);
  const data = archive.subarray(local + 30 + nameLength + extraLength, local + 30 + nameLength + extraLength + entry.compressedSize);
  return entry.method === 0 ? data : entry.method === 8 ? inflateRawSync(data) : (() => { throw new Error(`Unsupported ZIP compression for ${name}`); })();
};

if (!readEntry("README.md").toString("utf8").includes("## Privacy Policy")) throw new Error("Bundled README is missing the Privacy Policy section");
const manifest = JSON.parse(readEntry("manifest.json").toString("utf8"));
if (manifest.author.email !== "richard@m2ai.tech") throw new Error("Bundled author must use the business email");
for (const name of ["README.md", "SECURITY.md", "docs/reviewer-guide.md"]) {
  if (/[A-Z0-9._%+-]+@(?:outlook|hotmail|gmail)\.com/i.test(readEntry(name).toString("utf8"))) throw new Error(`Personal email is forbidden in bundled ${name}`);
}
console.log(`Package check passed: ${entries.size} entries; local compliance materials present; hosted public/ excluded.`);
