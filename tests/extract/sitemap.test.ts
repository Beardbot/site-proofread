import { describe, expect, it } from "vitest";
import { parseSitemapXml } from "../../src/extract/sitemap.js";

describe("parseSitemapXml", () => {
  it("extracts URLs from a urlset", () => {
    const xml = `<?xml version="1.0"?>
      <urlset>
        <url><loc>https://example.com/</loc></url>
        <url><loc>https://example.com/about/</loc></url>
      </urlset>`;

    expect(parseSitemapXml(xml)).toEqual({
      urls: ["https://example.com/", "https://example.com/about/"],
      childSitemaps: []
    });
  });

  it("extracts child sitemaps from a sitemap index", () => {
    const xml = `<?xml version="1.0"?>
      <sitemapindex>
        <sitemap><loc>https://example.com/page-sitemap.xml</loc></sitemap>
        <sitemap><loc>https://example.com/post-sitemap.xml</loc></sitemap>
      </sitemapindex>`;

    expect(parseSitemapXml(xml)).toEqual({
      urls: [],
      childSitemaps: [
        "https://example.com/page-sitemap.xml",
        "https://example.com/post-sitemap.xml"
      ]
    });
  });
});
