import { describe, expect, it } from "vitest";
import { generatePageWarnings } from "../../src/extract/warnings.js";
import type { PageExtract } from "../../src/extract/types.js";

describe("generatePageWarnings", () => {
  it("adds warnings for common extraction issues", () => {
    const warnings = generatePageWarnings({
      title: "Untitled page",
      url: "https://example.com/",
      finalUrl: "https://example.com/redirected/",
      status: 404,
      meta: {
        title: "",
        description: ""
      },
      headings: [],
      mainCopy: "Short",
      buttons: [],
      links: [],
      forms: [],
      imageAltText: [{ label: "Image 1", alt: "" }],
      hiddenContent: [],
      warnings: []
    });

    expect(warnings).toContain("Page has no H1.");
    expect(warnings).toContain("Page title is empty.");
    expect(warnings).toContain("Meta description is empty.");
    expect(warnings).toContain("Extracted main content is very short.");
    expect(warnings).toContain("Page returned non-200 status: 404.");
    expect(warnings).toContain("Page redirected unexpectedly to https://example.com/redirected/.");
    expect(warnings).toContain("1 images have empty alt text.");
  });
});
