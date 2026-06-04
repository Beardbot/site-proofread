import { describe, expect, it } from "vitest";
import { mergeConfig } from "../../src/extract/config.js";
import { renderManifestJson, renderPageMarkdown, renderProofreadingInput } from "../../src/extract/markdown.js";
import type { ManifestData, PageExtract } from "../../src/extract/types.js";

describe("renderPageMarkdown", () => {
  it("renders the expected proofreading sections", () => {
    const page: PageExtract = {
      title: "Home",
      url: "https://example.com/",
      finalUrl: "https://example.com/",
      status: 200,
      screenshot: "../screenshots/001-home.png",
      meta: {
        title: "Example",
        description: "Example description"
      },
      headings: [{ level: 1, text: "Welcome" }],
      mainCopy: "Main page copy.",
      buttons: ["Get in touch"],
      links: ["Contact"],
      forms: [{ labels: ["Name"], placeholders: ["Enter your name"], submitButtons: ["Submit"] }],
      imageAltText: [{ label: "Logo", alt: "Example logo" }],
      hiddenContent: [{ title: "Question", content: "Answer" }],
      warnings: ["Meta description is empty."]
    };

    const markdown = renderPageMarkdown(page);

    expect(markdown).toContain("# Home");
    expect(markdown).toContain("## Main visible page copy");
    expect(markdown).toContain("## Buttons and CTAs");
    expect(markdown).toContain("## Image alt text");
    expect(markdown).toContain("- Logo: \"Example logo\"");
  });

  it("renders a machine-readable manifest JSON", () => {
    const manifest = sampleManifest();
    const json = JSON.parse(renderManifestJson(manifest)) as {
      counts: { pagesExtracted: number };
      extractionWarningsSummary: Record<string, number>;
    };

    expect(json.counts.pagesExtracted).toBe(1);
    expect(json.extractionWarningsSummary["Meta description is empty."]).toBe(1);
  });

  it("renders proofreading input links for page files", () => {
    const markdown = renderProofreadingInput(sampleManifest());

    expect(markdown).toContain("# Proofreading input");
    expect(markdown).toContain("[Home](pages/001-home.md) - https://example.com/");
    expect(markdown).toContain("[Machine-readable manifest](manifest.json)");
    expect(markdown).toContain("[Agent proofreading prompt](agent-proofreading-prompt.md)");
  });
});

function sampleManifest(): ManifestData {
  return {
    config: mergeConfig({
      site: { name: "Example", staging_url: "https://example.com" },
      sitemaps: ["https://example.com/sitemap.xml"]
    }),
    extractionDate: new Date("2026-06-03T00:00:00.000Z"),
    sitemapUrlsUsed: ["https://example.com/sitemap.xml"],
    urlsFound: 1,
    pages: [
      {
        url: "https://example.com/",
        finalUrl: "https://example.com/",
        title: "Home",
        file: "pages/001-home.md",
        screenshot: "screenshots/001-home.png",
        status: 200,
        warnings: ["Meta description is empty."]
      }
    ],
    skipped: [],
    failed: [],
    sitemapWarnings: []
  };
}
