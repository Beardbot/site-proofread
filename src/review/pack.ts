import { access, cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { findMojibakeSignatures, renderMojibakeWarning } from "./mojibake.js";
import type {
  PackData,
  PageOutput,
  ReviewPage,
  SiteCopyManifest
} from "./types.js";

const REQUIRED_FILES = ["manifest.json", "manifest.md", "proofreading-input.md"];

export async function loadPack(inputDir: string): Promise<PackData> {
  const resolvedInput = path.resolve(inputDir);
  await validatePack(resolvedInput);

  const manifestContent = await readFile(path.join(resolvedInput, "manifest.json"), "utf8");
  const manifest = JSON.parse(
    manifestContent
  ) as SiteCopyManifest;

  if (!Array.isArray(manifest.pages)) {
    throw new Error("Invalid input pack: manifest.json must contain a pages array.");
  }

  const pages = await Promise.all(
    manifest.pages.map((page) => loadPage(resolvedInput, page))
  );

  return {
    inputDir: resolvedInput,
    manifest,
    pages,
    skipped: Array.isArray(manifest.skipped) ? manifest.skipped : [],
    failed: Array.isArray(manifest.failed) ? manifest.failed : [],
    sitemapWarnings: Array.isArray(manifest.sitemapWarnings) ? manifest.sitemapWarnings : [],
    manualReviewWarnings: await collectPackManualReviewWarnings(resolvedInput, manifestContent),
    extractionWarningsSummary: manifest.extractionWarningsSummary ?? {}
  };
}

export async function copyPackToWorkspace(inputDir: string, sitePackDir: string): Promise<void> {
  await mkdir(sitePackDir, { recursive: true });

  for (const file of ["README.md", "manifest.md", "manifest.json", "proofreading-input.md", "agent-proofreading-prompt.md"]) {
    const source = path.join(inputDir, file);
    if (await exists(source)) {
      await cp(source, path.join(sitePackDir, file));
    }
  }

  await cp(path.join(inputDir, "pages"), path.join(sitePackDir, "pages"), {
    recursive: true
  });

  const screenshotsDir = path.join(inputDir, "screenshots");
  if (await exists(screenshotsDir)) {
    await cp(screenshotsDir, path.join(sitePackDir, "screenshots"), {
      recursive: true
    });
  }
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

async function validatePack(inputDir: string): Promise<void> {
  for (const file of REQUIRED_FILES) {
    await requireFile(path.join(inputDir, file), file);
  }

  const pagesDir = path.join(inputDir, "pages");
  if (!(await exists(pagesDir))) {
    throw new Error("Invalid input pack: missing pages/ directory.");
  }
  const pagesStats = await stat(pagesDir);
  if (!pagesStats.isDirectory()) {
    throw new Error("Invalid input pack: pages exists but is not a directory.");
  }
}

async function loadPage(inputDir: string, page: PageOutput): Promise<ReviewPage> {
  if (!page.file) {
    throw new Error(`Invalid input pack: page ${page.url || page.title || "unknown"} is missing file.`);
  }

  const pagePath = path.join(inputDir, page.file);
  await requireFile(pagePath, page.file);
  const content = await readFile(pagePath, "utf8");
  const mojibakeSignatures = findMojibakeSignatures(
    [
      page.title,
      page.url,
      page.finalUrl,
      page.file,
      page.screenshot,
      content
    ].filter((value): value is string => Boolean(value)).join("\n")
  );
  const warnings = Array.isArray(page.warnings) ? [...page.warnings] : [];

  if (mojibakeSignatures.length) {
    warnings.push(renderMojibakeWarning(mojibakeSignatures));
  }

  return {
    title: page.title || page.url || page.file,
    url: page.url,
    file: page.file,
    sourcePath: pagePath,
    workspacePath: path.posix.join("site-pack", normalizePosixPath(page.file)),
    reportFile: path.posix.join("reports/pages", `${path.posix.parse(normalizePosixPath(page.file)).name}-report.md`),
    content,
    warnings,
    screenshot: page.screenshot,
    estimatedChars: content.length
  };
}

async function requireFile(filePath: string, label: string): Promise<void> {
  if (!(await exists(filePath))) {
    throw new Error(`Invalid input pack: missing ${label}.`);
  }
  const stats = await stat(filePath);
  if (!stats.isFile()) {
    throw new Error(`Invalid input pack: ${label} exists but is not a file.`);
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizePosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

async function collectPackManualReviewWarnings(inputDir: string, manifestContent: string): Promise<string[]> {
  const filesToScan = [
    ["manifest.json", manifestContent] as const,
    ...(await readOptionalTextFiles(inputDir, [
      "README.md",
      "manifest.md",
      "proofreading-input.md",
      "agent-proofreading-prompt.md"
    ]))
  ];
  const warnings = filesToScan.flatMap(([file, content]) => {
    const signatures = findMojibakeSignatures(content);
    return signatures.length ? [`${file}: ${renderMojibakeWarning(signatures)}`] : [];
  });

  return warnings;
}

async function readOptionalTextFiles(inputDir: string, files: string[]): Promise<readonly [string, string][]> {
  const results: [string, string][] = [];

  for (const file of files) {
    const filePath = path.join(inputDir, file);
    if (await exists(filePath)) {
      results.push([file, await readFile(filePath, "utf8")]);
    }
  }

  return results;
}
