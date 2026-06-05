import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runPipeline } from "../../src/pipeline/run.js";
import { runAudit } from "../../src/extract/run.js";
import { prepareReviewWorkspace } from "../../src/review/run.js";

vi.mock("../../src/extract/run.js", () => ({
  runAudit: vi.fn()
}));

vi.mock("../../src/review/run.js", () => ({
  prepareReviewWorkspace: vi.fn()
}));

const runAuditMock = vi.mocked(runAudit);
const prepareReviewWorkspaceMock = vi.mocked(prepareReviewWorkspace);

describe("runPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runAuditMock.mockResolvedValue(undefined);
    prepareReviewWorkspaceMock.mockResolvedValue(createPrepareResult());
  });

  it("skips extraction when a pack manifest exists and --force is not passed", async () => {
    const { configPath, outputDir } = await createConfig();
    await writeFile(path.join(outputDir, "manifest.json"), "{}", "utf8");
    const logs: string[] = [];

    await runPipeline({ configPath, log: (message) => logs.push(message) });

    expect(runAuditMock).not.toHaveBeenCalled();
    expect(prepareReviewWorkspaceMock).toHaveBeenCalledWith({
      input: outputDir,
      config: undefined,
      mode: undefined,
      maxBatchChars: undefined
    });
    expect(logs.join("\n")).toContain("--force");
  });

  it("runs extraction with --force even when a pack manifest exists", async () => {
    const { configPath, outputDir } = await createConfig();
    await writeFile(path.join(outputDir, "manifest.json"), "{}", "utf8");

    await runPipeline({ configPath, force: true });

    expect(runAuditMock).toHaveBeenCalledOnce();
    expect(runAuditMock.mock.calls[0]?.[0].output.directory).toBe(outputDir);
    expect(prepareReviewWorkspaceMock).toHaveBeenCalledOnce();
  });

  it("runs extraction when no pack manifest exists", async () => {
    const { configPath, outputDir } = await createConfig();
    const onProgress = vi.fn();

    await runPipeline({
      configPath,
      reviewConfigPath: "./proofread.config.yml",
      mode: "basic",
      maxBatchChars: 5000,
      onProgress
    });

    expect(runAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ output: expect.objectContaining({ directory: outputDir }) }),
      { onProgress }
    );
    expect(prepareReviewWorkspaceMock).toHaveBeenCalledWith({
      input: outputDir,
      config: "./proofread.config.yml",
      mode: "basic",
      maxBatchChars: 5000
    });
  });

  it("aborts before review when extraction throws", async () => {
    const { configPath } = await createConfig();
    runAuditMock.mockRejectedValueOnce(new Error("browser failed"));

    await expect(runPipeline({ configPath })).rejects.toThrow("browser failed");

    expect(prepareReviewWorkspaceMock).not.toHaveBeenCalled();
  });

  it("proceeds to review when extraction completes with partial page failures recorded", async () => {
    const { configPath } = await createConfig();
    runAuditMock.mockResolvedValueOnce(undefined);

    await runPipeline({ configPath });

    expect(runAuditMock).toHaveBeenCalledOnce();
    expect(prepareReviewWorkspaceMock).toHaveBeenCalledOnce();
  });
});

async function createConfig(): Promise<{ configPath: string; outputDir: string }> {
  const root = await makeTempDir();
  const outputDir = path.join(root, "extract-pack");
  const configOutputDir = outputDir.replace(/\\/g, "/");
  const configPath = path.join(root, "config.yml");

  await mkdir(outputDir, { recursive: true });
  await writeFile(
    configPath,
    [
      "site:",
      "  name: Test Site",
      "  staging_url: https://example.com",
      "sitemaps:",
      "  - https://example.com/sitemap.xml",
      "output:",
      `  directory: ${JSON.stringify(configOutputDir)}`,
      ""
    ].join("\n"),
    "utf8"
  );

  return { configPath, outputDir: configOutputDir };
}

async function makeTempDir(): Promise<string> {
  const dir = path.join(os.tmpdir(), `proofread-pipeline-${Date.now()}-${Math.random()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

function createPrepareResult() {
  return {
    inputDir: "/tmp/input",
    workspaceDir: "/tmp/workspace",
    workspaceReference: "workspace",
    clientSlug: "test-site",
    runId: "2026-06-05",
    mode: "full" as const,
    configPath: undefined,
    batchCount: 1,
    pageReportCount: 1,
    excludedPageCount: 0,
    reportsDir: "/tmp/workspace/reports",
    kickoffPromptPath: "/tmp/workspace/codex-kickoff-prompt.md",
    kickoffPrompt: "Review this workspace."
  };
}
