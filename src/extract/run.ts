import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type Page, type Response } from "playwright";
import { pageFileStem } from "./filenames.js";
import { fetchSitemapUrls } from "./sitemap.js";
import { filterUrlsForScope } from "./scope.js";
import { extractPageContent } from "./extractor.js";
import {
  renderAgentPrompt,
  renderManifestJson,
  renderManifestMarkdown,
  renderOutputReadme,
  renderPageMarkdown,
  renderProofreadingInput
} from "./markdown.js";
import { generatePageWarnings } from "./warnings.js";
import type { AuditConfig, FailedPage, PageOutput } from "./types.js";

export interface RunAuditOptions {
  onProgress?: (progress: RunProgress) => void;
}

export interface RunProgress {
  phase: string;
  current?: number;
  total?: number;
  url?: string;
}

export async function runAudit(config: AuditConfig, options: RunAuditOptions = {}): Promise<void> {
  const progress = options.onProgress ?? (() => undefined);
  progress({ phase: "Fetching sitemap URLs" });
  const sitemapResult = await fetchSitemapUrls(config.sitemaps);
  progress({ phase: `Found ${sitemapResult.urls.length} sitemap URL(s). Filtering scope` });
  const filtered = filterUrlsForScope(sitemapResult.urls, config);
  const outputDir = path.resolve(config.output.directory);
  const pagesDir = path.join(outputDir, "pages");
  const screenshotsDir = path.join(outputDir, "screenshots");
  const pages: PageOutput[] = [];
  const failed: FailedPage[] = [];

  progress({
    phase: `Preparing output directory (${filtered.allowed.length} page(s), ${filtered.skipped.length} skipped)`
  });
  await mkdir(pagesDir, { recursive: true });
  if (config.screenshots.enabled) {
    await mkdir(screenshotsDir, { recursive: true });
  }

  let browser: Browser | undefined;
  try {
    progress({ phase: "Launching browser" });
    browser = await chromium.launch({ headless: config.browser.headless });

    for (let index = 0; index < filtered.allowed.length; index += 1) {
      const url = filtered.allowed[index];
      const stem = pageFileStem(url, index);
      const pageFile = `pages/${stem}.md`;
      const screenshotFile = config.screenshots.enabled ? `screenshots/${stem}.png` : undefined;
      const page = await browser.newPage({ viewport: config.browser.viewport });

      try {
        progress({
          phase: "Extracting",
          current: index + 1,
          total: filtered.allowed.length,
          url
        });
        const visit = await visitPage(page, url, config);
        const screenshotWarnings: string[] = [];
        if (config.screenshots.enabled && screenshotFile) {
          progress({
            phase: "Preparing screenshot",
            current: index + 1,
            total: filtered.allowed.length,
            url
          });
          screenshotWarnings.push(...(await preparePageForScreenshot(page, config)));
          await page.screenshot({
            path: path.join(outputDir, screenshotFile),
            fullPage: config.screenshots.full_page,
            animations: config.screenshots.animations
          });
        }

        const extract = await extractPageContent(
          page,
          config,
          url,
          visit.response?.status() ?? null,
          screenshotFile ? `../${screenshotFile.replace(/\\/g, "/")}` : undefined,
          [...visit.warnings, ...screenshotWarnings]
        );
        extract.warnings = generatePageWarnings(extract);

        await writeFile(path.join(outputDir, pageFile), renderPageMarkdown(extract), "utf8");
        pages.push({
          url,
          finalUrl: extract.finalUrl,
          title: extract.title,
          file: pageFile,
          screenshot: screenshotFile,
          status: extract.status,
          warnings: extract.warnings
        });
      } catch (error) {
        progress({
          phase: "Failed",
          current: index + 1,
          total: filtered.allowed.length,
          url
        });
        failed.push({ url, error: error instanceof Error ? error.message : String(error) });
      } finally {
        await page.close();
      }
    }
  } finally {
    progress({ phase: "Closing browser" });
    await browser?.close();
  }

  progress({ phase: "Writing manifest and prompt files" });
  const manifestData = {
    config,
    extractionDate: new Date(),
    sitemapUrlsUsed: sitemapResult.sitemapUrlsUsed,
    urlsFound: sitemapResult.urls.length,
    pages,
    skipped: filtered.skipped,
    failed,
    sitemapWarnings: sitemapResult.warnings
  };

  await writeFile(path.join(outputDir, "README.md"), renderOutputReadme(config), "utf8");
  await writeFile(path.join(outputDir, "manifest.md"), renderManifestMarkdown(manifestData), "utf8");
  await writeFile(path.join(outputDir, "manifest.json"), renderManifestJson(manifestData), "utf8");
  await writeFile(path.join(outputDir, "proofreading-input.md"), renderProofreadingInput(manifestData), "utf8");
  await writeFile(path.join(outputDir, "agent-proofreading-prompt.md"), renderAgentPrompt(config), "utf8");
  progress({ phase: `Complete. Extracted ${pages.length} page(s), skipped ${filtered.skipped.length}, failed ${failed.length}` });
}

async function preparePageForScreenshot(page: Page, config: AuditConfig): Promise<string[]> {
  const warnings: string[] = [];

  warnings.push(...(await applyScreenshotExcludeSelectors(page, config.extract.exclude_selectors)));

  if (config.screenshots.pre_scroll) {
    try {
      const maxScrolls = await page.evaluate(() => {
        const viewportHeight = Math.max(window.innerHeight, 1);
        const fullHeight = Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight
        );
        return Math.min(Math.ceil(fullHeight / viewportHeight), 80);
      });

      await page.evaluate(() => window.scrollTo(0, 0));
      for (let index = 0; index < maxScrolls; index += 1) {
        await page.evaluate(() => {
          window.scrollBy(0, Math.max(window.innerHeight * 0.85, 1));
        });
        if (config.screenshots.scroll_pause_ms > 0) {
          await page.waitForTimeout(config.screenshots.scroll_pause_ms);
        }
      }
      await page.evaluate(() => window.scrollTo(0, 0));
    } catch {
      warnings.push("Screenshot pre-scroll failed; scroll-triggered elements may be missing.");
    }
  }

  if (config.screenshots.settle_ms > 0) {
    await page.waitForTimeout(config.screenshots.settle_ms);
  }

  return warnings;
}

async function applyScreenshotExcludeSelectors(page: Page, selectors: string[]): Promise<string[]> {
  const warnings: string[] = [];
  const safeSelectors = selectors.map((selector) => selector.trim()).filter(Boolean);
  if (!safeSelectors.length) return warnings;

  try {
    await page.addStyleTag({
      content: safeSelectors
        .map((selector) => `${selector} { display: none !important; visibility: hidden !important; opacity: 0 !important; }`)
        .join("\n")
    });
  } catch {
    warnings.push("Could not apply screenshot exclude selector styles.");
  }

  const invalidSelectors = await page.evaluate((selectorList) => {
    const invalid: string[] = [];
    for (const selector of selectorList) {
      try {
        document.querySelectorAll(selector);
      } catch {
        invalid.push(selector);
      }
    }
    return invalid;
  }, safeSelectors);

  for (const selector of invalidSelectors) {
    warnings.push(`Invalid exclude selector skipped for screenshots: ${selector}`);
  }

  return warnings;
}

async function visitPage(
  page: Page,
  url: string,
  config: AuditConfig
): Promise<{ response: Response | null; warnings: string[] }> {
  try {
    const response = await page.goto(url, {
      waitUntil: config.browser.wait_until,
      timeout: config.browser.timeout_ms
    });
    return { response, warnings: [] };
  } catch (error) {
    if (config.browser.wait_until === "domcontentloaded") {
      throw error;
    }

    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: Math.min(config.browser.timeout_ms, 10000)
    });
    return {
      response,
      warnings: [`Timed out waiting for ${config.browser.wait_until}; retried with domcontentloaded.`]
    };
  }
}
