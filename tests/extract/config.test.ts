import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parse } from "yaml";
import {
  createExampleConfig,
  createInitialConfig,
  createInitialConfigFile,
  mergeConfig
} from "../../src/extract/config.js";

describe("mergeConfig", () => {
  it("merges YAML-like config with direct CLI overrides", () => {
    const config = mergeConfig(
      {
        site: { name: "Client", staging_url: "https://old.example.com" },
        sitemaps: ["https://old.example.com/sitemap.xml"],
        output: { directory: "./old" }
      },
      {
        site: "https://staging.example.com",
        sitemap: ["https://staging.example.com/page-sitemap.xml"],
        out: "./out"
      }
    );

    expect(config.site.name).toBe("Client");
    expect(config.site.staging_url).toBe("https://staging.example.com");
    expect(config.sitemaps).toEqual(["https://staging.example.com/page-sitemap.xml"]);
    expect(config.output.directory).toBe("./out");
    expect(config.proofreading.language).toBe("Australian English");
    expect(config.screenshots.pre_scroll).toBe(true);
    expect(config.screenshots.scroll_pause_ms).toBe(250);
    expect(config.screenshots.settle_ms).toBe(500);
    expect(config.screenshots.animations).toBe("disabled");
  });

  it("supports screenshot preparation overrides", () => {
    const config = mergeConfig({
      site: { name: "Client", staging_url: "https://staging.example.com" },
      sitemaps: ["https://staging.example.com/sitemap.xml"],
      screenshots: {
        pre_scroll: false,
        scroll_pause_ms: 100,
        settle_ms: 0,
        animations: "allow"
      }
    });

    expect(config.screenshots.pre_scroll).toBe(false);
    expect(config.screenshots.scroll_pause_ms).toBe(100);
    expect(config.screenshots.settle_ms).toBe(0);
    expect(config.screenshots.animations).toBe("allow");
  });

  it("supports legacy dictionary config as a proofreading fallback", () => {
    const config = mergeConfig({
      site: { name: "Client", staging_url: "https://staging.example.com" },
      sitemaps: ["https://staging.example.com/sitemap.xml"],
      dictionary: {
        language: "Australian English",
        allowed_terms: ["LegacyTerm"],
        notes: ["Legacy note"]
      }
    });

    expect(config.proofreading.allowed_terms).toEqual(["LegacyTerm"]);
    expect(config.proofreading.notes).toEqual(["Legacy note"]);
  });

  it("creates parent directories for generated config files", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "site-copy-audit-"));
    const configPath = path.join(dir, "configs", "client.yml");

    try {
      await createExampleConfig(configPath);

      const content = await readFile(configPath, "utf8");
      expect(content).toContain("staging_url");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("builds a minimal initial config with derived onboarding defaults", () => {
    const config = createInitialConfig({
      site: "https://staging.example.com",
      sitemaps: ["https://staging.example.com/page-sitemap.xml"],
      name: "Example Health"
    });

    expect(config).toEqual({
      site: {
        name: "Example Health",
        staging_url: "https://staging.example.com"
      },
      sitemaps: ["https://staging.example.com/page-sitemap.xml"],
      proofreading: {
        language: "Australian English",
        allowed_terms: ["Example Health"]
      },
      output: {
        directory: "./proofreading-output/example-health"
      }
    });
  });

  it("writes minimal init YAML and relies on runtime defaults after merge", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "site-copy-audit-"));
    const configPath = path.join(dir, "configs", "client.yml");

    try {
      await createInitialConfigFile(configPath, {
        site: "https://staging.example.com",
        sitemaps: ["https://staging.example.com/page-sitemap.xml"],
        name: "Example Health",
        allowedTerms: ["Example Health", "HealthTerm"],
        notes: ["Keep service names as supplied."],
        outputDirectory: "./proofreading-output/example-health"
      });

      const content = await readFile(configPath, "utf8");
      const raw = parse(content);
      expect(raw.scope).toBeUndefined();
      expect(raw.browser).toBeUndefined();
      expect(raw.extract).toBeUndefined();
      expect(raw.screenshots).toBeUndefined();

      const merged = mergeConfig(raw);
      expect(merged.scope.allowed_hosts).toEqual(["staging.example.com"]);
      expect(merged.browser.headless).toBe(true);
      expect(merged.extract.include_meta).toBe(true);
      expect(merged.screenshots.enabled).toBe(true);
      expect(merged.output.markdown_only).toBe(true);
      expect(merged.proofreading.allowed_terms).toEqual(["Example Health", "HealthTerm"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
