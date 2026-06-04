import { describe, expect, it } from "vitest";
import { createBatches } from "../../src/review/batching.js";
import type { ReviewPage } from "../../src/review/types.js";

describe("createBatches", () => {
  it("creates one batch for small packs", () => {
    const batches = createBatches([page("One", 100), page("Two", 100)], 1000);
    expect(batches).toHaveLength(1);
    expect(batches[0].promptFile).toBe("batches/batch-001-prompt.md");
    expect(batches[0].pages.map((batchPage) => batchPage.reportFile)).toEqual([
      "reports/pages/one-report.md",
      "reports/pages/two-report.md"
    ]);
  });

  it("splits large packs deterministically", () => {
    const batches = createBatches([page("One", 600), page("Two", 600), page("Three", 600)], 1000);
    expect(batches).toHaveLength(3);
    expect(batches.map((batch) => batch.name)).toEqual(["batch-001", "batch-002", "batch-003"]);
  });
});

function page(title: string, estimatedChars: number): ReviewPage {
  return {
    title,
    url: `https://example.com/${title.toLowerCase()}`,
    file: `pages/${title.toLowerCase()}.md`,
    sourcePath: "",
    workspacePath: `site-pack/pages/${title.toLowerCase()}.md`,
    reportFile: `reports/pages/${title.toLowerCase()}-report.md`,
    content: title,
    warnings: [],
    estimatedChars
  };
}
