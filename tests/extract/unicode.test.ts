import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { describe, expect, it } from "vitest";
import { mergeConfig } from "../../src/extract/config.js";
import { extractPageContent } from "../../src/extract/extractor.js";
import {
  renderManifestJson,
  renderManifestMarkdown,
  renderPageMarkdown
} from "../../src/extract/markdown.js";
import { containsMojibake, generatePageWarnings, MOJIBAKE_SIGNATURES } from "../../src/extract/warnings.js";
import type { ManifestData } from "../../src/extract/types.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("unicode and entity handling", () => {
  it("preserves UTF-8 text and decoded entities across extraction and generated outputs", async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
      const html = await readFile(path.join(dirname, "fixtures", "unicode-page.html"), "utf8");
      await page.setContent(html, { waitUntil: "load" });

      const config = mergeConfig({
        site: { name: "Unicode Test", staging_url: "https://example.com" },
        sitemaps: ["https://example.com/sitemap.xml"],
        extract: { include_hidden_accordion_content: false }
      });
      const extract = await extractPageContent(page, config, page.url(), 200);
      extract.warnings = generatePageWarnings(extract);

      expect(extract.meta.title).toBe("Café & Care – “Welcome”");
      expect(extract.meta.description).toBe("L’équipe welcomes patients & families — no stress.");
      expect(extract.headings.map((heading) => heading.text)).toEqual([
        "Today’s care – made simple",
        "“Friendly” clinicians in Adélaïde"
      ]);
      expect(extract.mainCopy).toContain("Café patients don’t wait – they’re welcomed");
      expect(extract.mainCopy).toContain("10 am appointments");
      expect(extract.links).toContain("Book – médecin & nurse");
      expect(extract.buttons).toContain("Start “intake”");
      expect(extract.forms[0]?.labels).toContain("Patient’s name");
      expect(extract.forms[0]?.placeholders).toContain("Enter Renée’s name");
      expect(extract.forms[0]?.submitButtons).toContain("Submit – safely");
      expect(extract.imageAltText[0]).toEqual({
        label: "Hero image",
        alt: "Clinician’s café – résumé"
      });

      const manifest = sampleManifest(extract);
      const pageMarkdown = renderPageMarkdown(extract);
      expect(pageMarkdown).toContain("Café");
      expect(pageMarkdown).toContain("Today’s care");
      expect(pageMarkdown).toContain("Clinician’s café – résumé");

      const manifestMarkdown = renderManifestMarkdown(manifest);
      expect(manifestMarkdown).toContain("Today’s care – made simple");

      const manifestJson = renderManifestJson(manifest);
      expect(manifestJson).toContain("Today’s care – made simple");

      for (const output of [pageMarkdown, manifestMarkdown, manifestJson]) {
        expectNoMojibake(output);
      }
    } finally {
      await page.close();
      await browser.close();
    }
  });

  it("detects common mojibake signatures", () => {
    expect(containsMojibake("Patients donâ€™t wait")).toBe(true);
    expect(containsMojibake("Clean smart apostrophe: don’t")).toBe(false);
  });

  it("adds an extraction warning when extracted content contains likely mojibake", () => {
    const config = mergeConfig({
      site: { name: "Unicode Test", staging_url: "https://example.com" },
      sitemaps: ["https://example.com/sitemap.xml"]
    });
    const warnings = generatePageWarnings({
      title: "Mojibake",
      url: "https://example.com/",
      finalUrl: "https://example.com/",
      status: 200,
      meta: {
        title: "Mojibake",
        description: "Patients donâ€™t wait"
      },
      headings: [{ level: 1, text: "Mojibake" }],
      mainCopy: "Patients donâ€™t wait for care.",
      buttons: [],
      links: [],
      forms: [],
      imageAltText: [],
      hiddenContent: [],
      warnings: []
    });

    expect(config.proofreading.language).toBe("Australian English");
    expect(warnings).toContain("Likely mojibake detected in extracted content.");
  });
});

function sampleManifest(page: Awaited<ReturnType<typeof extractPageContent>>): ManifestData {
  const config = mergeConfig({
    site: { name: "Unicode Test", staging_url: "https://example.com" },
    sitemaps: ["https://example.com/sitemap.xml"]
  });

  return {
    config,
    extractionDate: new Date("2026-06-04T00:00:00.000Z"),
    sitemapUrlsUsed: ["https://example.com/sitemap.xml"],
    urlsFound: 1,
    pages: [
      {
        url: page.url,
        finalUrl: page.finalUrl,
        title: page.title,
        file: "pages/001-unicode.md",
        status: page.status,
        warnings: page.warnings
      }
    ],
    skipped: [],
    failed: [],
    sitemapWarnings: []
  };
}

function expectNoMojibake(value: string): void {
  for (const signature of MOJIBAKE_SIGNATURES) {
    expect(value).not.toContain(signature);
  }
}
