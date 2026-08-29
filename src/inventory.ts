import { lstat, opendir, readFile, realpath } from "node:fs/promises";
import { basename, extname, join, relative, resolve, sep } from "node:path";

import {
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  SUPPORTED_EXTENSIONS
} from "./limits.js";
import { extractSources } from "./extractors.js";
import type { ExtractedSource, SkippedSource } from "./types.js";

export interface InventoryResult {
  project: string;
  root: string;
  scannedFiles: number;
  sources: ExtractedSource[];
  skipped: SkippedSource[];
  limitReached: boolean;
  coverageIncomplete: boolean;
}
function toRelative(root: string, path: string): string {
  return relative(root, path).split(sep).join("/");
}

function withinRoot(root: string, candidate: string): boolean {
  const normalizedRoot = resolve(root);
  const normalizedCandidate = resolve(candidate);
  return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}${sep}`);
}

export async function inventoryProject(projectRoot: string): Promise<InventoryResult> {
  if (!projectRoot.trim()) throw new Error("PROJECT_ROOT is required");
  const root = await realpath(projectRoot);
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory()) throw new Error("Configured project root is not a directory");

  const sources: ExtractedSource[] = [];
  const skipped: SkippedSource[] = [];
  const queue = [root];
  let scannedFiles = 0;
  let totalBytes = 0;
  let limitReached = false;
  let coverageIncomplete = false;

  while (queue.length > 0 && !limitReached) {
    const directory = queue.shift();
    if (!directory) break;
    let handle: Awaited<ReturnType<typeof opendir>>;
    try {
      handle = await opendir(directory);
    } catch (error) {
      skipped.push({ path: toRelative(root, directory), reason: error instanceof Error ? `Unable to traverse directory: ${error.message}` : "Unable to traverse directory" });
      coverageIncomplete = true;
      continue;
    }
    for await (const entry of handle) {
      const absolutePath = join(directory, entry.name);
      const relativePath = toRelative(root, absolutePath);
      let stat;
      try {
        stat = await lstat(absolutePath);
      } catch (error) {
        skipped.push({ path: relativePath, reason: error instanceof Error ? `Unable to inspect entry: ${error.message}` : "Unable to inspect entry" });
        coverageIncomplete = true;
        continue;
      }

      if (stat.isSymbolicLink()) {
        skipped.push({ path: relativePath, reason: "Symbolic links are not followed" });
        continue;
      }
      if (stat.isDirectory()) {
        if (!entry.name.startsWith(".") && withinRoot(root, absolutePath)) queue.push(absolutePath);
        continue;
      }
      if (!stat.isFile()) continue;

      const extension = extname(entry.name).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(extension)) {
        skipped.push({ path: relativePath, reason: `Unsupported file type ${extension || "(none)"}` });
        continue;
      }
      if (scannedFiles >= MAX_FILES) {
        skipped.push({ path: relativePath, reason: `File limit of ${MAX_FILES} reached` });
        limitReached = true;
        coverageIncomplete = true;
        break;
      }
      if (stat.size > MAX_FILE_BYTES) {
        skipped.push({ path: relativePath, reason: "File exceeds 25 MB limit" });
        continue;
      }
      if (totalBytes + stat.size > MAX_TOTAL_BYTES) {
        skipped.push({ path: relativePath, reason: "Total input exceeds 100 MB limit" });
        limitReached = true;
        coverageIncomplete = true;
        break;
      }

      scannedFiles += 1;
      totalBytes += stat.size;
      try {
        const buffer = await readFile(absolutePath);
        const extracted = await extractSources({
          relativePath,
          buffer,
          modifiedAt: stat.mtime.toISOString()
        });
        sources.push(...extracted);
      } catch (error) {
        skipped.push({
          path: relativePath,
          reason: error instanceof Error ? error.message : "Unable to extract source"
        });
      }
    }
  }

  return {
    project: basename(root),
    root,
    scannedFiles,
    sources,
    skipped,
    limitReached,
    coverageIncomplete
  };
}
