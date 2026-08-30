#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

import { auditFolder } from "./audit.js";
import { authorizeAudit, createFileStateStore, fetchRecoveryKey, openBillingPortal, type EntitlementResult, type StateStore } from "./entitlement.js";
import type { ReadinessResult } from "./types.js";

function formatResult(result: ReadinessResult): string {
  const lines = [
    `# Closeout Readiness Check — ${result.project}`,
    "",
    `Scanned ${result.scannedSources} supported files.`,
    "",
    `## Summary`, "", result.summary,
    ""
  ];
  lines.push("## Baseline items", "");
  for (const item of result.items) {
      lines.push(`### ${item.label} — ${item.status.replace(/_/g, " ")}`);
      lines.push(`- ${item.reason}`);
      for (const cite of item.citations) {
        const locator = cite.locator ? `, ${cite.locator}` : "";
        lines.push(`- Evidence: ${cite.path}${locator} — “${cite.snippet}”`);
      }
      lines.push("");
  }
  if (result.skippedSources.length > 0 || result.truncatedSources.length > 0) {
    lines.push("## Scan limitations", "");
    for (const skipped of result.skippedSources) lines.push(`- Skipped ${skipped.path}: ${skipped.reason}`);
    for (const path of result.truncatedSources) lines.push(`- Truncated extracted text from ${path}`);
    lines.push("");
  }
  lines.push("## Required boundary", "", result.humanReviewRequired, "");
  for (const limitation of result.limitations) lines.push(`- ${limitation}`);
  return lines.join("\n");
}

export interface CreateServerOptions {
  stateStore?: StateStore;
  environment?: NodeJS.ProcessEnv;
  fetcher?: typeof fetch;
  now?: Date;
  auditFolder?: typeof auditFolder;
}

function argumentValue(arguments_: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  const value = arguments_.find((argument) => argument.startsWith(prefix))?.slice(prefix.length).trim();
  return value && !value.includes("${") ? value : undefined;
}

function configuredValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && !normalized.includes("${") ? normalized : undefined;
}

export function resolveRuntimeEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  arguments_: string[] = process.argv.slice(2)
): NodeJS.ProcessEnv {
  return {
    ...environment,
    PROJECT_ROOT: configuredValue(environment.PROJECT_ROOT) ?? argumentValue(arguments_, "--project-root"),
    LICENSE_SERVICE_URL: configuredValue(environment.LICENSE_SERVICE_URL) ?? argumentValue(arguments_, "--license-service-url"),
    APP_MODE: configuredValue(environment.APP_MODE) ?? argumentValue(arguments_, "--app-mode")
  };
}

function activationUrl(state: { activationId: string; publicKey: string }, environment: NodeJS.ProcessEnv): string | undefined {
  const base = environment.LICENSE_SERVICE_URL?.trim();
  if (!base) return undefined;
  try {
    const url = new URL("/", base);
    url.searchParams.set("activation_id", state.activationId);
    url.searchParams.set("public_key", state.publicKey);
    return url.toString();
  } catch {
    return undefined;
  }
}

export function createServer(projectRoot: string, options: CreateServerOptions = {}): McpServer {
  const server = new McpServer({
    name: "closeout-readiness-check",
    version: "0.1.1-beta.1"
  });

  server.registerTool(
    "check_closeout_folder",
    {
      title: "Check closeout folder",
      description: "Read one configured electrical closeout folder and return a deterministic, cited baseline-readiness report for human review. Project content stays local; the managed build makes a bounded entitlement check before inventory. This is not a certification or contract-completeness decision.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async () => {
      let entitlement: EntitlementResult | undefined;
      try {
        const environment = options.environment ?? process.env;
        const store = options.stateStore ?? createFileStateStore(environment);
        entitlement = await authorizeAudit({ store, environment, fetcher: options.fetcher, now: options.now });
        if (!entitlement.allowed) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: entitlement.message ?? "An active subscription is required before the folder can be read." }]
          };
        }
        const result = await (options.auditFolder ?? auditFolder)(projectRoot);
        if (entitlement.trialClaim) {
          await entitlement.trialClaim.complete();
        }
        const link = entitlement.source === "trial" && entitlement.state ? activationUrl(entitlement.state, environment) : undefined;
        const text = link
          ? `${formatResult(result)}\n\n## Continue after your free check\n\nTo activate this computer, choose a plan at ${link}. Return here and rerun the check after Checkout.\n`
          : formatResult(result);
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: result as unknown as Record<string, unknown>
        };
      } catch (error) {
        // A failed or incomplete check must not consume the local free check.
        await entitlement?.trialClaim?.release();
        const message = error instanceof Error ? error.message : "Unexpected check failure";
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Check could not run: ${message}` }]
        };
      }
    }
  );
  server.registerTool(
    "manage_closeout_subscription",
    {
      title: "Manage Closeout Readiness Check subscription",
      description: "Open Stripe's billing portal for the purchasing computer using a fresh installation signature. This action does not read the configured project folder.",
      inputSchema: {},
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async () => {
      const result = await openBillingPortal({
        store: options.stateStore,
        environment: options.environment,
        fetcher: options.fetcher,
        now: options.now
      });
      if (!result.url) {
        return { isError: true, content: [{ type: "text" as const, text: result.message ?? "Billing access could not be verified." }] };
      }
      return {
        content: [{ type: "text" as const, text: `Open the secure Stripe billing portal: ${result.url}` }],
        structuredContent: { url: result.url }
      };
    }
  );
  server.registerTool(
    "show_recovery_key",
    {
      title: "Show the recovery key for this subscription",
      description: "Retrieve this subscription's recovery key using a fresh installation signature from the purchasing computer, for backup or activating another computer. Requires an active subscription and does not read the configured project folder.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async () => {
      const result = await fetchRecoveryKey({
        store: options.stateStore,
        environment: options.environment,
        fetcher: options.fetcher,
        now: options.now
      });
      if (!result.recoveryKey) {
        return { isError: true, content: [{ type: "text" as const, text: result.message ?? "The recovery key could not be retrieved." }] };
      }
      return {
        content: [{ type: "text" as const, text: `Recovery key (store it somewhere secure): ${result.recoveryKey}` }],
        structuredContent: { recoveryKey: result.recoveryKey }
      };
    }
  );
  return server;
}

async function main(): Promise<void> {
  const environment = resolveRuntimeEnvironment();
  const projectRoot = environment.PROJECT_ROOT;
  if (!projectRoot) {
    console.error("PROJECT_ROOT is required. Select a project folder in the extension settings.");
    process.exitCode = 1;
    return;
  }
  const server = createServer(projectRoot, { environment });
  await server.connect(new StdioServerTransport());
  console.error("Closeout Readiness Check MCP server is running over stdio.");
}

// Claude Desktop on Windows may launch the entry point through a host wrapper
// or an alternate spelling of the same path (8.3 short name, different drive
// case), so a path comparison alone cannot decide whether this module is the
// entry point. The manifest's --project-root argument is the launch signature:
// it is always present when a host starts the server and never present when
// tests import this module.
function isMainModule(argv1: string | undefined): boolean {
  if (!argv1) return false;
  try {
    const canonicalArgv = pathToFileURL(realpathSync.native(argv1)).href;
    const canonicalModule = pathToFileURL(realpathSync.native(fileURLToPath(import.meta.url))).href;
    return canonicalArgv.toLowerCase() === canonicalModule.toLowerCase();
  } catch {
    return pathToFileURL(argv1).href === import.meta.url;
  }
}

function isDirectLaunch(): boolean {
  return process.argv.slice(1).some((argument) => argument.startsWith("--project-root=")) || isMainModule(process.argv[1]);
}

if (isDirectLaunch()) {
  console.error(`[closeout-readiness-check] entry launched; argv=${JSON.stringify(process.argv)}`);
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
} else {
  console.error(`[closeout-readiness-check] loaded as library (no --project-root argument and path mismatch); argv=${JSON.stringify(process.argv)}`);
}
