import { describe, expect, it } from "vitest";
import { formatProgressLine } from "../../src/extract/progress.js";

describe("formatProgressLine", () => {
  it("renders phase-only updates before totals are known", () => {
    expect(formatProgressLine({ phase: "Fetching sitemap URLs" })).toBe("Fetching sitemap URLs");
  });

  it("renders page progress with a percent and summarized URL", () => {
    expect(
      formatProgressLine({
        phase: "Extracting",
        current: 18,
        total: 38,
        url: "https://staging.example.com/services/womens-health/"
      })
    ).toBe("[#########-----------] 18/38 pages  47%  Extracting: /services/womens-health/");
  });
});
