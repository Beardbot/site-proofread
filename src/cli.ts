#!/usr/bin/env node
import { Command } from "commander";
import { createInterface, type Interface } from "node:readline/promises";
import {
  createExampleConfig,
  createInitialConfigFile,
  createInitialConfigInput,
  deriveSiteName,
  resolveConfig
} from "./extract/config.js";
import { runAudit, type RunProgress } from "./extract/run.js";
import { formatProgressLine } from "./extract/progress.js";
import type { CliInitOptions } from "./extract/types.js";
import { prepareReviewWorkspace } from "./review/run.js";
import type { ReviewMode } from "./review/types.js";
import { slugify } from "./shared/slug.js";

const program = new Command();

program
  .name("site-proofread")
  .description("Extract proofreadable website copy from staging sitemaps and prepare review workspaces.")
  .version("0.1.0");

program
  .command("init")
  .description("Create a minimal extraction config file.")
  .option("-o, --out <path>", "Config file path to create. Defaults to ./proofreading/configs/<name>.yml.")
  .option("--site <url>", "Staging site base URL.")
  .option("--sitemap <url>", "Sitemap URL. Repeat for multiple sitemaps.", collect, [])
  .option("--name <name>", "Site/client display name.")
  .option("--language <language>", "Proofreading handoff language.", "Australian English")
  .option("--term <term>", "Allowed proofreading term. Repeat for multiple terms.", collect, [])
  .option("--note <note>", "Proofreading handoff note. Repeat for multiple notes.", collect, [])
  .option("--output-directory <path>", "Generated proofreading pack directory.")
  .option("--no-interactive", "Do not prompt for missing config values.")
  .action(async (options: CliInitOptions) => {
    if (shouldWriteExampleConfig(options)) {
      const outPath = options.out ?? defaultConfigPath("Client Name");
      await createExampleConfig(outPath);
      console.log(`Created starter config: ${outPath}`);
      return;
    }

    if (shouldPrompt(options)) {
      const { outPath, ...input } = await promptInitialConfig(options);
      validateInitialConfigInput(input);
      await createInitialConfigFile(outPath, input);
      console.log(`Created config: ${outPath}`);
      return;
    }

    const input = createInitialConfigInput(options);
    validateInitialConfigInput(input);
    const outPath = options.out ?? defaultConfigPath(input.name);
    await createInitialConfigFile(outPath, input);
    console.log(`Created config: ${outPath}`);
  });

program
  .command("extract")
  .description("Extract proofreadable copy from a config file or direct CLI arguments.")
  .option("-c, --config <path>", "Path to YAML config file.")
  .option("--site <url>", "Staging site base URL.")
  .option("--sitemap <url>", "Sitemap URL. Repeat for multiple sitemaps.", collect, [])
  .option("--out <path>", "Output directory.")
  .action(async (options: { config?: string; site?: string; sitemap: string[]; out?: string }) => {
    const config = await resolveConfig(options);
    const status = createTerminalStatus();
    try {
      await runAudit(config, { onProgress: status.update });
      status.done(`Copy extraction complete: ${config.output.directory}`);
    } catch (error) {
      status.done("Copy extraction failed.");
      throw error;
    }
  });

program
  .command("prepare-review")
  .argument("[client]", "client folder name under ./proofreading/extracts")
  .description("Create a self-contained proofreading review workspace from an extraction pack.")
  .option("--input <dir>", "explicit extraction output directory")
  .option("--input-root <dir>", "root directory for client folder lookup", "./proofreading/extracts")
  .option("--out-root <dir>", "root directory for archived review workspaces", "./proofreading/reviews")
  .option("--run-id <id>", "run folder name under the client archive")
  .option("--out <dir>", "full output review workspace directory override")
  .option("--config <file>", "proofreading config YAML (defaults to proofread-agent.config.yml in the current directory)")
  .option("--mode <mode>", "review depth: full or basic", parseReviewMode, "full")
  .option("--max-batch-chars <number>", "maximum estimated characters per batch", parsePositiveInteger)
  .action(async (client: string | undefined, options: {
    input?: string;
    inputRoot?: string;
    out?: string;
    outRoot?: string;
    runId?: string;
    config?: string;
    mode?: ReviewMode;
    maxBatchChars?: number;
  }) => {
    try {
      const result = await prepareReviewWorkspace({ ...options, client });
      console.log(`Proofreading review workspace created: ${result.workspaceDir}`);
      console.log(`Client: ${result.clientSlug}`);
      console.log(`Run: ${result.runId}`);
      console.log(`Config: ${result.configPath ?? "none (manifest config only)"}`);
      console.log(`Mode: ${result.mode}`);
      console.log(`Batch prompts to follow: ${result.batchCount}`);
      console.log(`Page reports to complete: ${result.pageReportCount}`);
      console.log(`Pages excluded from review: ${result.excludedPageCount}`);
      console.log(`Reports directory: ${result.reportsDir}`);
      console.log("");
      console.log("Kick-off prompt:");
      console.log(result.kickoffPrompt.trim());
      console.log("");
      console.log(`Saved kick-off prompt: ${result.kickoffPromptPath}`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

function collect(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}

function shouldPrompt(options: CliInitOptions): boolean {
  return options.interactive !== false && Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function shouldWriteExampleConfig(options: CliInitOptions): boolean {
  return (
    !shouldPrompt(options) &&
    !options.site &&
    !options.name &&
    !options.outputDirectory &&
    !options.sitemap?.length &&
    !options.term?.length &&
    !options.note?.length
  );
}

async function promptInitialConfig(options: CliInitOptions) {
  const prompts = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const site = await promptUrl(prompts, "Staging site URL", options.site);
    const derivedName = deriveSiteName(site);
    const name = await promptWithDefault(prompts, "Site/client name", options.name ?? derivedName);
    const sitemaps = options.sitemap?.length
      ? options.sitemap
      : await promptUrlList(prompts, "Sitemap URL(s), comma-separated");
    const outputDirectory = await promptWithDefault(
      prompts,
      "Proofreading output directory",
      options.outputDirectory ?? `./proofreading/extracts/${slugify(name, "site-copy-audit")}`
    );
    const language = await promptWithDefault(
      prompts,
      "Proofreading language",
      options.language ?? "Australian English"
    );
    const allowedTerms = options.term?.length
      ? options.term
      : await promptList(prompts, "Allowed terms, comma-separated", [name]);
    const notes = options.note?.length
      ? options.note
      : await promptList(prompts, "Optional proofreading notes, comma-separated", []);
    const outPath = await promptWithDefault(
      prompts,
      "Config file path",
      options.out ?? defaultConfigPath(name)
    );

    return {
      site,
      sitemaps,
      name,
      language,
      allowedTerms,
      notes,
      outputDirectory,
      outPath
    };
  } finally {
    prompts.close();
  }
}

function defaultConfigPath(name: string | undefined): string {
  return `./proofreading/configs/${slugify(name ?? "")}.yml`;
}

async function promptUrl(prompts: Interface, label: string, value?: string): Promise<string> {
  const fallback = value?.trim();
  while (true) {
    const answer = await promptWithDefault(prompts, label, fallback);
    if (isValidUrl(answer)) return answer;
    console.log("Enter a valid absolute URL, for example https://staging.example.com.");
  }
}

async function promptUrlList(prompts: Interface, label: string): Promise<string[]> {
  while (true) {
    const values = await promptList(prompts, label, []);
    if (values.length && values.every(isValidUrl)) return values;
    console.log("Enter one or more valid absolute URLs, separated by commas.");
  }
}

async function promptWithDefault(
  prompts: Interface,
  label: string,
  fallback?: string
): Promise<string> {
  const suffix = fallback ? ` (${fallback})` : "";
  const answer = (await prompts.question(`${label}${suffix}: `)).trim();
  return answer || fallback || "";
}

async function promptList(
  prompts: Interface,
  label: string,
  fallback: string[]
): Promise<string[]> {
  const fallbackText = fallback.join(", ");
  const answer = await promptWithDefault(prompts, label, fallbackText);
  return parseCommaList(answer);
}

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateInitialConfigInput(input: ReturnType<typeof createInitialConfigInput>): void {
  if (!isValidUrl(input.site)) {
    throw new Error("Missing or invalid site URL. Provide --site or run init interactively.");
  }
  if (!input.sitemaps.length || !input.sitemaps.every(isValidUrl)) {
    throw new Error(
      "Missing or invalid sitemap URL. Provide one or more --sitemap options or run init interactively."
    );
  }
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function createTerminalStatus(): {
  update: (progress: RunProgress) => void;
  done: (message: string) => void;
} {
  const isInteractive = Boolean(process.stderr.isTTY);
  const clearLine = () => {
    if (isInteractive) {
      process.stderr.write("\r\x1b[K");
    }
  };

  return {
    update(progress: RunProgress) {
      const line = formatProgressLine(progress);
      if (isInteractive) {
        process.stderr.write(`\r\x1b[K${truncateForTerminal(line)}`);
      } else {
        console.error(line);
      }
    },
    done(message: string) {
      clearLine();
      console.log(message);
    }
  };
}

function truncateForTerminal(message: string): string {
  const width = process.stderr.columns || 100;
  const maxLength = Math.max(width - 1, 20);
  return message.length > maxLength ? `${message.slice(0, maxLength - 1)}...` : message;
}

function parsePositiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive number, got: ${value}`);
  }
  return Math.floor(parsed);
}

function parseReviewMode(value: string): ReviewMode {
  if (value === "full" || value === "basic") {
    return value;
  }

  throw new Error(`Expected review mode "full" or "basic", got: ${value}`);
}
