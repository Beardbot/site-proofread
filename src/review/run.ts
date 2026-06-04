import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { createBatches, DEFAULT_MAX_BATCH_CHARS } from "./batching.js";
import { loadDictionaryConfig, resolveConfigPath } from "./config.js";
import { partitionExcludedPages } from "./exclusions.js";
import { copyPackToWorkspace, loadPack, writeTextFile } from "./pack.js";
import {
  renderAgentsMd,
  renderBatchPrompt,
  renderKickoffPrompt,
  renderManualReviewNotes,
  renderMergePrompt,
  renderPendingFinalReport,
  renderPendingPageReport,
  renderPageReportTemplate,
  renderReportTemplate,
  renderReviewPrompt,
  renderWorkspaceReadme
} from "./prompts.js";
import type { ManifestProofreadingConfig, PrepareOptions, PrepareResult, ReviewMode } from "./types.js";

// Unified repo: extract writes packs under ./proofreading-output, so prepare-review
// reads from the same tree by default (was ../site-copy-audit/proofreading-output
// when the two tools lived in separate sibling repos).
export const DEFAULT_INPUT_ROOT = "./proofreading-output";
export const DEFAULT_OUT_ROOT = "./proofreading-reviews";

export async function prepareReviewWorkspace(options: PrepareOptions): Promise<PrepareResult> {
  const inputDir = resolveInputDir(options);
  const maxBatchChars = options.maxBatchChars ?? DEFAULT_MAX_BATCH_CHARS;
  const mode = options.mode ?? "full";

  const pack = await loadPack(inputDir);
  const configPath = await resolveConfigPath(options.config, process.cwd());
  const dictionary = await loadDictionaryConfig(getManifestProofreading(pack.manifest), configPath);
  const { included: reviewPages, excluded: excludedPages } = partitionExcludedPages(
    pack.pages,
    dictionary.excludedPages
  );
  const batches = createBatches(reviewPages, maxBatchChars);
  const clientSlug = inferClientSlug(pack.manifest.site?.name, inputDir, options.client);
  const runId = options.runId ?? inferRunId(pack.manifest.extractionDate);
  const workspaceDir = resolveWorkspaceDir(options, clientSlug, runId);
  const workspaceReference = formatWorkspaceReference(workspaceDir);
  const kickoffPrompt = renderKickoffPrompt(workspaceReference, mode);

  if (workspaceDir === inputDir) {
    throw new Error("Output workspace cannot be the same directory as the input pack.");
  }

  await rm(workspaceDir, { recursive: true, force: true });
  await mkdir(workspaceDir, { recursive: true });
  await mkdir(path.join(workspaceDir, "batches"), { recursive: true });
  await mkdir(path.join(workspaceDir, "reports"), { recursive: true });
  await mkdir(path.join(workspaceDir, "reports", "pages"), { recursive: true });
  await copyPackToWorkspace(inputDir, path.join(workspaceDir, "site-pack"));

  const manualReviewNotes = renderManualReviewNotes(pack, reviewPages, excludedPages);

  await writeTextFile(path.join(workspaceDir, "AGENTS.md"), renderAgentsMd(dictionary, mode));
  await writeTextFile(path.join(workspaceDir, "README.md"), renderWorkspaceReadme(workspaceReference, mode));
  await writeTextFile(path.join(workspaceDir, "codex-kickoff-prompt.md"), kickoffPrompt);
  await writeTextFile(path.join(workspaceDir, "review-prompt.md"), renderReviewPrompt(pack, dictionary, batches, mode));
  await writeTextFile(path.join(workspaceDir, "page-report-template.md"), renderPageReportTemplate());
  await writeTextFile(path.join(workspaceDir, "report-template.md"), renderReportTemplate());
  await writeTextFile(path.join(workspaceDir, "manual-review-notes.md"), manualReviewNotes);
  await writeTextFile(path.join(workspaceDir, "merge-prompt.md"), renderMergePrompt(pack, reviewPages, excludedPages));

  for (const batch of batches) {
    const batchManualContext = renderBatchManualContext(batch);
    await writeTextFile(
      path.join(workspaceDir, batch.promptFile),
      renderBatchPrompt(batch, batches.length, dictionary, batchManualContext, mode)
    );
  }

  for (const page of reviewPages) {
    await writeTextFile(path.join(workspaceDir, page.reportFile), renderPendingPageReport(page));
  }

  await writeTextFile(path.join(workspaceDir, "reports", "final-report.md"), renderPendingFinalReport());

  return {
    inputDir,
    workspaceDir,
    workspaceReference,
    clientSlug,
    runId,
    mode,
    configPath,
    batchCount: batches.length,
    pageReportCount: reviewPages.length,
    excludedPageCount: excludedPages.length,
    reportsDir: path.join(workspaceDir, "reports"),
    kickoffPromptPath: path.join(workspaceDir, "codex-kickoff-prompt.md"),
    kickoffPrompt
  };
}

function resolveInputDir(options: PrepareOptions): string {
  if (options.input && options.client) {
    throw new Error("Use either a client name or --input, not both.");
  }

  if (options.input) {
    return path.resolve(options.input);
  }

  if (!options.client) {
    throw new Error("Missing client name or --input path.");
  }

  return path.resolve(options.inputRoot ?? DEFAULT_INPUT_ROOT, options.client);
}

function resolveWorkspaceDir(options: PrepareOptions, clientSlug: string, runId: string): string {
  if (options.out) {
    return path.resolve(options.out);
  }

  return path.resolve(options.outRoot ?? DEFAULT_OUT_ROOT, clientSlug, runId);
}

function inferClientSlug(siteName: string | undefined, inputDir: string, clientName: string | undefined): string {
  return slugify(siteName) || slugify(clientName) || slugify(path.basename(inputDir)) || "site";
}

function inferRunId(extractionDate: string | undefined): string {
  const datePrefix = extractionDate?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return datePrefix ?? new Date().toISOString().slice(0, 10);
}

function slugify(value: string | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatWorkspaceReference(workspaceDir: string): string {
  const relativePath = path.relative(process.cwd(), workspaceDir);
  const isInsideCwd = relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
  const reference = isInsideCwd ? relativePath : workspaceDir;
  return reference.replace(/\\/g, "/");
}

function getManifestProofreading(manifest: {
  config?: {
    proofreading?: ManifestProofreadingConfig;
    dictionary?: ManifestProofreadingConfig;
  };
}): ManifestProofreadingConfig | undefined {
  return manifest.config?.proofreading ?? manifest.config?.dictionary;
}

function renderBatchManualContext(batch: { pages: { workspacePath: string; warnings: string[] }[] }): string {
  const warnings = batch.pages
    .filter((page) => page.warnings.length)
    .map((page) => `- ${page.workspacePath}: ${page.warnings.join("; ")}`);
  return warnings.length ? warnings.join("\n") : "_No page-level extraction warnings for this batch._";
}
