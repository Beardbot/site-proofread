import { gunzipSync } from "node:zlib";
import { XMLParser } from "fast-xml-parser";
import type { SitemapResult } from "./types.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true
});

export function parseSitemapXml(xml: string): { urls: string[]; childSitemaps: string[] } {
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const urlset = parsed.urlset as { url?: unknown } | undefined;
  const sitemapindex = parsed.sitemapindex as { sitemap?: unknown } | undefined;

  return {
    urls: extractLocs(urlset?.url),
    childSitemaps: extractLocs(sitemapindex?.sitemap)
  };
}

export async function fetchSitemapUrls(sitemapUrls: string[]): Promise<SitemapResult> {
  const urls: string[] = [];
  const used: string[] = [];
  const warnings: string[] = [];

  for (const sitemapUrl of sitemapUrls) {
    used.push(sitemapUrl);
    const primary = await fetchAndParseSitemap(sitemapUrl);
    warnings.push(...primary.warnings);

    if (primary.childSitemaps.length) {
      for (const childUrl of primary.childSitemaps) {
        used.push(childUrl);
        const child = await fetchAndParseSitemap(childUrl);
        warnings.push(...child.warnings);
        if (child.childSitemaps.length) {
          warnings.push(
            `Nested sitemap index skipped at ${childUrl}; MVP only expands sitemap indexes directly referenced by provided sitemaps.`
          );
        }
        urls.push(...child.urls);
      }
    } else {
      urls.push(...primary.urls);
    }
  }

  return {
    urls: uniquePreserveOrder(urls),
    sitemapUrlsUsed: uniquePreserveOrder(used),
    warnings
  };
}

async function fetchAndParseSitemap(url: string): Promise<{
  urls: string[];
  childSitemaps: string[];
  warnings: string[];
}> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap ${url}: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const isGzip =
    url.endsWith(".gz") ||
    response.headers.get("content-type")?.includes("gzip") ||
    response.headers.get("content-encoding") === "gzip";
  const xml = (isGzip ? gunzipSync(buffer) : buffer).toString("utf8");
  const parsed = parseSitemapXml(xml);
  const warnings: string[] = [];

  if (!parsed.urls.length && !parsed.childSitemaps.length) {
    warnings.push(`Sitemap contained no URLs: ${url}`);
  }

  return { ...parsed, warnings };
}

function extractLocs(value: unknown): string[] {
  const entries = Array.isArray(value) ? value : value ? [value] : [];
  return entries
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) return "";
      const loc = (entry as { loc?: unknown }).loc;
      return typeof loc === "string" ? loc.trim() : "";
    })
    .filter((loc) => loc.length > 0);
}

function uniquePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      unique.push(value);
    }
  }
  return unique;
}
