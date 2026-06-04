import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prepareReviewWorkspace } from "../../src/review/run.js";

describe("prepareReviewWorkspace", () => {
  it("rejects missing required pack files", async () => {
    const dir = await makeTempDir();
    await expect(prepareReviewWorkspace({ input: dir })).rejects.toThrow("missing manifest.json");
  });

  it("creates a Codex-ready review workspace", async () => {
    const input = await createPack(2);
    const result = await prepareReviewWorkspace({ input, maxBatchChars: 10000 });

    expect(result.batchCount).toBe(1);
    expect(result.pageReportCount).toBe(2);
    expect(result.mode).toBe("full");
    expect(result.clientSlug).toBe("test-site");
    expect(result.runId).toBe("2026-06-03");
    expect(result.workspaceDir).toContain(path.join("proofreading-reviews", "test-site", "2026-06-03"));
    await expectFile(result.workspaceDir, "AGENTS.md", "Do not crawl the live website.");
    await expectFile(result.workspaceDir, "AGENTS.md", "Do not use Playwright, browser automation, or web browsing.");
    await expectFile(result.workspaceDir, "AGENTS.md", "Do not edit website source files.");
    await expectFile(result.workspaceDir, "AGENTS.md", "Do not rewrite copy for style or preference.");
    await expectFile(result.workspaceDir, "AGENTS.md", "Write report Markdown files as UTF-8.");
    await expectFile(result.workspaceDir, "AGENTS.md", "question marks that replaced source smart punctuation");
    await expectFile(result.workspaceDir, "AGENTS.md", "avoid PowerShell for report generation");
    await expectFile(result.workspaceDir, "AGENTS.md", "scaffolds to complete by replacing the placeholder body");
    await expectFile(result.workspaceDir, "AGENTS.md", "define the authoritative review scope");
    await expectFile(result.workspaceDir, "AGENTS.md", "## Before You Finish");
    await expectFile(result.workspaceDir, "AGENTS.md", "do not use ellipses or shorten the excerpt");
    await expectFile(result.workspaceDir, "AGENTS.md", "display as boxes or mojibake");
    expect(result.workspaceReference).toBe("proofreading-reviews/test-site/2026-06-03");
    expect(result.kickoffPrompt).toContain("proofreading-reviews/test-site/2026-06-03/AGENTS.md");
    await expectFile(result.workspaceDir, "README.md", "Open the `proofread-agent` project root as the Codex workspace.");
    await expectFile(result.workspaceDir, "README.md", "reports/pages/");
    await expectFile(result.workspaceDir, "README.md", "proofread-agent prepare <client-name>");
    await expectFile(result.workspaceDir, "README.md", "codex-kickoff-prompt.md");
    await expectFile(result.workspaceDir, "codex-kickoff-prompt.md", "proofreading-reviews/test-site/2026-06-03/AGENTS.md");
    await expectFile(result.workspaceDir, "codex-kickoff-prompt.md", "proofreading-reviews/test-site/2026-06-03/site-pack");
    await expectFile(result.workspaceDir, "codex-kickoff-prompt.md", "reports/pages");
    await expectFile(result.workspaceDir, "codex-kickoff-prompt.md", "Complete the pending page-report placeholders");
    await expectFile(result.workspaceDir, "batches/batch-001-prompt.md", "Do not treat URL slugs as proofreading content.");
    await expectFile(result.workspaceDir, "batches/batch-001-prompt.md", "reports/pages/001-home-report.md");
    await expectFile(result.workspaceDir, "batches/batch-001-prompt.md", "Order findings by severity: High first, then Medium, then Low.");
    await expectFile(result.workspaceDir, "batches/batch-001-prompt.md", "blockquoted Current and Suggested text");
    await expectFile(result.workspaceDir, "batches/batch-001-prompt.md", "Do not use a shell or terminal workflow that replaces non-ASCII punctuation");
    await expectFile(result.workspaceDir, "batches/batch-001-prompt.md", "temporary Node.js `.mjs` script");
    await expectFile(result.workspaceDir, "batches/batch-001-prompt.md", "display as boxes or mojibake");
    await expectFile(result.workspaceDir, "page-report-template.md", "**Open page:**");
    await expectFile(result.workspaceDir, "page-report-template.md", "## 🔴 Immediate attention");
    await expectFile(result.workspaceDir, "page-report-template.md", "### 🔴 High severity");
    await expectFile(result.workspaceDir, "page-report-template.md", "### 🟠 Medium severity");
    await expectFile(result.workspaceDir, "page-report-template.md", "> **Current:**");
    await expectFile(result.workspaceDir, "page-report-template.md", "> **Suggested:**");
    await expectFile(result.workspaceDir, "page-report-template.md", "| Metric | Count |");
    await expectFile(result.workspaceDir, "page-report-template.md", "## Output encoding check");
    await expectFile(result.workspaceDir, "report-template.md", "## Findings by severity");
    await expectFile(result.workspaceDir, "report-template.md", "## 🔴 Immediate attention");
    await expectFile(result.workspaceDir, "report-template.md", "### 🔴 High severity");
    await expectFile(result.workspaceDir, "report-template.md", "**Page:** [Page title](url)");
    await expectFile(result.workspaceDir, "report-template.md", "| Metric | Count |");
    await expectFile(result.workspaceDir, "report-template.md", "## Output encoding check");
    await expectFile(result.workspaceDir, "merge-prompt.md", "Put every High severity finding in the `Immediate attention` section");
    await expectFile(result.workspaceDir, "merge-prompt.md", "Preserve UTF-8 smart punctuation from page reports");
    await expectFile(result.workspaceDir, "reports/pages/001-home-report.md", "**Open page:** [https://example.com/page-1/](https://example.com/page-1/)");
    await expectFile(result.workspaceDir, "reports/final-report.md", "Pending.");
    await expectFile(result.workspaceDir, "site-pack/manifest.json", "Test Site");
    await expectFile(result.workspaceDir, "site-pack/pages/001-home.md", "Homepage copy");
    await expectFile(result.workspaceDir, "site-pack/screenshots/001-home.png", "fake image");
  });

  it("creates multiple batch prompts and matching reports for large packs", async () => {
    const input = await createPack(3, "x".repeat(600));
    const result = await prepareReviewWorkspace({ input, maxBatchChars: 700 });

    expect(result.batchCount).toBe(3);
    await expectFile(result.workspaceDir, "batches/batch-001-prompt.md", "batch 1 of 3");
    await expectFile(result.workspaceDir, "batches/batch-002-prompt.md", "batch 2 of 3");
    await expectFile(result.workspaceDir, "batches/batch-003-prompt.md", "batch 3 of 3");
    await expectFile(result.workspaceDir, "reports/pages/003-home-report.md", "Pending.");
    await expectFile(result.workspaceDir, "merge-prompt.md", "reports/pages/003-home-report.md");
  });

  it("creates basic launch sanity check prompts when requested", async () => {
    const input = await createPack(1);
    const result = await prepareReviewWorkspace({ input, mode: "basic" });

    expect(result.mode).toBe("basic");
    await expectFile(result.workspaceDir, "AGENTS.md", "Review mode: Basic launch sanity check");
    await expectFile(result.workspaceDir, "AGENTS.md", "Only flag glaring spelling mistakes");
    await expectFile(result.workspaceDir, "review-prompt.md", "Do not spend time on deeper style");
    await expectFile(result.workspaceDir, "codex-kickoff-prompt.md", "Review mode: Basic launch sanity check.");
  });

  it("preserves smart punctuation and en dashes through prepare", async () => {
    const smartCopy = "Women\u2019s Health \u2013 patient-centred care";
    const mojibakeApostrophe = "Women\u00e2\u20ac\u2122s Health";
    const input = await createPack(1, smartCopy);
    const result = await prepareReviewWorkspace({ input });

    await expectFile(result.workspaceDir, "site-pack/pages/001-home.md", smartCopy);
    await expectFile(result.workspaceDir, "batches/batch-001-prompt.md", smartCopy);
    await expectFile(result.workspaceDir, "AGENTS.md", "Do not report mojibake based only on terminal output.");
    await expectFile(result.workspaceDir, "AGENTS.md", mojibakeApostrophe);
    await expectFileNot(result.workspaceDir, "manual-review-notes.md", "Likely mojibake detected");
  });

  it("adds manual-review warnings for actual mojibake signatures in input pack files", async () => {
    const mojibakeCopy = "Women\u00e2\u20ac\u2122s Health \u00e2\u20ac\u201c patient-centred care";
    const input = await createPack(1, mojibakeCopy);
    await writeFile(path.join(input, "manifest.md"), `# Manifest\n\n${mojibakeCopy}\n`, "utf8");

    const result = await prepareReviewWorkspace({ input });

    await expectFile(result.workspaceDir, "manual-review-notes.md", "manifest.md: Likely mojibake detected");
    await expectFile(result.workspaceDir, "manual-review-notes.md", "site-pack/pages/001-home.md - Meta description is empty.; Likely mojibake detected");
    await expectFile(result.workspaceDir, "batches/batch-001-prompt.md", "Likely mojibake detected");
    await expectFile(result.workspaceDir, "site-pack/pages/001-home.md", mojibakeCopy);
  });

  it("excludes configured pages from review but keeps them in the pack", async () => {
    const input = await createPack(2);
    const configPath = path.join(input, "proofreading.config.yaml");
    await writeFile(configPath, "excluded_pages:\n  - page-2\n", "utf8");

    const result = await prepareReviewWorkspace({ input, config: configPath, maxBatchChars: 10000 });

    expect(result.pageReportCount).toBe(1);
    expect(result.excludedPageCount).toBe(1);

    // Excluded page is still copied into the pack for reference.
    await expectFile(result.workspaceDir, "site-pack/pages/002-home.md", "Page 2");

    // No page report is generated for the excluded page.
    await expect(
      readFile(path.join(result.workspaceDir, "reports/pages/002-home-report.md"), "utf8")
    ).rejects.toThrow();
    await expectFile(result.workspaceDir, "reports/pages/001-home-report.md", "Pending.");

    // Excluded page is surfaced for transparency, not silently dropped.
    await expectFile(result.workspaceDir, "manual-review-notes.md", "## Excluded From Review");
    await expectFile(result.workspaceDir, "manual-review-notes.md", "matched `page-2`");
    await expectFile(result.workspaceDir, "merge-prompt.md", "Excluded from review");
    await expectFile(result.workspaceDir, "merge-prompt.md", "reports/pages/001-home-report.md");
    await expectFileNot(result.workspaceDir, "merge-prompt.md", "reports/pages/002-home-report.md");
  });

  it("auto-discovers a default config file in the working directory", async () => {
    const projectRoot = await makeTempDir();
    const input = await createPack(2);
    await writeFile(
      path.join(projectRoot, "proofread-agent.config.yml"),
      "excluded_pages:\n  - page-2\n",
      "utf8"
    );

    const previousCwd = process.cwd();
    try {
      process.chdir(projectRoot);
      const result = await prepareReviewWorkspace({ input, out: path.join(projectRoot, "out") });

      expect(result.configPath).toBe(path.join(projectRoot, "proofread-agent.config.yml"));
      expect(result.excludedPageCount).toBe(1);
      expect(result.pageReportCount).toBe(1);
    } finally {
      process.chdir(previousCwd);
    }
  });

  it("keeps all pages when no exclusions are configured", async () => {
    const input = await createPack(2);
    const result = await prepareReviewWorkspace({ input, maxBatchChars: 10000 });

    expect(result.excludedPageCount).toBe(0);
    expect(result.pageReportCount).toBe(2);
    await expectFile(result.workspaceDir, "manual-review-notes.md", "## Excluded From Review");
    await expectFileNot(result.workspaceDir, "merge-prompt.md", "## Excluded From Review");
  });

  it("includes warnings as manual-review context and dictionary terms in prompts", async () => {
    const input = await createPack(1);
    const result = await prepareReviewWorkspace({ input });

    await expectFile(result.workspaceDir, "manual-review-notes.md", "Meta description is empty.");
    await expectFile(result.workspaceDir, "manual-review-notes.md", "Skipped Pages");
    await expectFile(result.workspaceDir, "review-prompt.md", "Allowed terms:");
    await expectFile(result.workspaceDir, "review-prompt.md", "Client Name");
  });

  it("resets the generated workspace and rejects using the pack as output", async () => {
    const input = await createPack(1);
    const result = await prepareReviewWorkspace({ input });
    await writeFile(path.join(result.workspaceDir, "stale.md"), "stale", "utf8");

    await prepareReviewWorkspace({ input });
    await expect(readFile(path.join(result.workspaceDir, "stale.md"), "utf8")).rejects.toThrow();
    await expect(prepareReviewWorkspace({ input, out: input })).rejects.toThrow(
      "Output workspace cannot be the same directory as the input pack."
    );
  });

  it("resolves client names from the default input-root style and archives under out-root", async () => {
    const root = await makeTempDir();
    const inputRoot = path.join(root, "site-copy-audit-output");
    const outRoot = path.join(root, "proofreading-reviews");
    await createPackAt(path.join(inputRoot, "murray-bridge-medical-centre"), 1, "Copy");

    const result = await prepareReviewWorkspace({
      client: "murray-bridge-medical-centre",
      inputRoot,
      outRoot
    });

    expect(result.inputDir).toBe(path.resolve(inputRoot, "murray-bridge-medical-centre"));
    expect(result.workspaceDir).toBe(path.resolve(outRoot, "test-site", "2026-06-03"));
    await expectFile(result.workspaceDir, "site-pack/manifest.json", "Test Site");
  });

  it("rejects ambiguous client and input combinations", async () => {
    const input = await createPack(1);
    await expect(prepareReviewWorkspace({ client: "client-name", input })).rejects.toThrow(
      "Use either a client name or --input, not both."
    );
  });
});

async function createPack(pageCount: number, body = "Homepage copy"): Promise<string> {
  const dir = await makeTempDir();
  await createPackAt(dir, pageCount, body);
  return dir;
}

async function createPackAt(dir: string, pageCount: number, body = "Homepage copy"): Promise<void> {
  await mkdir(path.join(dir, "pages"), { recursive: true });
  await mkdir(path.join(dir, "screenshots"), { recursive: true });

  const pages = [];
  for (let index = 1; index <= pageCount; index += 1) {
    const number = String(index).padStart(3, "0");
    const file = `pages/${number}-home.md`;
    const title = `Page ${index}`;
    const content = `# ${title}\n\nURL: https://example.com/page-${index}/\n\n## Main visible page copy\n\n${body}\n`;
    await writeFile(path.join(dir, file), content, "utf8");
    pages.push({
      url: `https://example.com/page-${index}/`,
      title,
      file,
      screenshot: index === 1 ? "screenshots/001-home.png" : undefined,
      status: 200,
      warnings: index === 1 ? ["Meta description is empty."] : []
    });
  }

  await writeFile(path.join(dir, "screenshots", "001-home.png"), "fake image", "utf8");
  await writeFile(path.join(dir, "README.md"), "# Pack\n", "utf8");
  await writeFile(path.join(dir, "manifest.md"), "# Manifest\n", "utf8");
  await writeFile(path.join(dir, "proofreading-input.md"), "# Proofreading input\n", "utf8");
  await writeFile(
    path.join(dir, "manifest.json"),
    JSON.stringify(
      {
        site: { name: "Test Site", staging_url: "https://example.com" },
        extractionDate: "2026-06-03T00:00:00.000Z",
        pages,
        skipped: [{ url: "https://example.com/admin/", reason: "Blocked admin path" }],
        failed: [],
        sitemapWarnings: [],
        extractionWarningsSummary: { "Meta description is empty.": 1 },
        config: {
          proofreading: {
            language: "Australian English",
            allowed_terms: ["Client Name"],
            notes: ["Approved client terms."]
          }
        }
      },
      null,
      2
    ),
    "utf8"
  );
}

async function makeTempDir(): Promise<string> {
  const dir = path.join(os.tmpdir(), `proofread-agent-${Date.now()}-${Math.random()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function expectFile(root: string, relativePath: string, expected: string): Promise<void> {
  const content = await readFile(path.join(root, relativePath), "utf8");
  expect(content).toContain(expected);
}

async function expectFileNot(root: string, relativePath: string, expected: string): Promise<void> {
  const content = await readFile(path.join(root, relativePath), "utf8");
  expect(content).not.toContain(expected);
}
