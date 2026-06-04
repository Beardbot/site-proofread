import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse, stringify } from "yaml";
import { slugify } from "../shared/slug.js";
import type {
  AuditConfig,
  CliInitOptions,
  CliRunOptions,
  RawConfig,
  ScreenshotAnimations,
  WaitUntil
} from "./types.js";

export const DEFAULT_EXCLUDE_SELECTORS = [
  "#wpadminbar",
  ".grecaptcha-badge",
  ".cky-consent-container",
  ".cookie-notice",
  "script",
  "style",
  "noscript"
];

export const EXAMPLE_CONFIG: RawConfig = createExampleInitialConfig();

export interface InitialConfigInput {
  site: string;
  sitemaps: string[];
  name?: string;
  language?: string;
  allowedTerms?: string[];
  notes?: string[];
  outputDirectory?: string;
}

export async function loadConfigFromFile(filePath: string): Promise<RawConfig> {
  const content = await readFile(filePath, "utf8");
  const parsed = parse(content) as RawConfig | null;
  return parsed ?? {};
}

export async function createExampleConfig(outputPath: string): Promise<void> {
  const target = path.resolve(outputPath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, stringify(createExampleInitialConfig()), "utf8");
}

export async function createInitialConfigFile(
  outputPath: string,
  input: InitialConfigInput
): Promise<void> {
  const target = path.resolve(outputPath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, stringify(createInitialConfig(input)), "utf8");
}

export function createInitialConfig(input: InitialConfigInput): RawConfig {
  const siteName = normalizeOptionalString(input.name) ?? deriveSiteName(input.site);
  const outputDirectory =
    normalizeOptionalString(input.outputDirectory) ??
    `./proofreading/extracts/${slugify(siteName, "site-copy-audit")}`;
  const allowedTerms = normalizeStringArray(input.allowedTerms).length
    ? normalizeStringArray(input.allowedTerms)
    : [siteName];
  const notes = normalizeStringArray(input.notes);

  const config: RawConfig = {
    site: {
      name: siteName,
      staging_url: input.site
    },
    sitemaps: normalizeStringArray(input.sitemaps),
    proofreading: {
      language: normalizeOptionalString(input.language) ?? "Australian English",
      allowed_terms: allowedTerms
    },
    output: {
      directory: outputDirectory
    }
  };

  if (notes.length) {
    config.proofreading = {
      ...config.proofreading,
      notes
    };
  }

  return config;
}

export function createInitialConfigInput(options: CliInitOptions): InitialConfigInput {
  const site = options.site?.trim() ?? "";
  const siteName = normalizeOptionalString(options.name) ?? deriveSiteName(site);

  return {
    site,
    sitemaps: normalizeStringArray(options.sitemap),
    name: siteName,
    language: options.language,
    allowedTerms: normalizeStringArray(options.term).length
      ? normalizeStringArray(options.term)
      : [siteName],
    notes: normalizeStringArray(options.note),
    outputDirectory: options.outputDirectory
  };
}

export async function resolveConfig(options: CliRunOptions): Promise<AuditConfig> {
  const fileConfig = options.config ? await loadConfigFromFile(options.config) : {};
  return mergeConfig(fileConfig, options);
}

export function mergeConfig(raw: RawConfig, options: CliRunOptions = {}): AuditConfig {
  const stagingUrl = options.site ?? raw.site?.staging_url ?? "";
  const siteName = raw.site?.name ?? deriveSiteName(stagingUrl);
  const sitemaps = normalizeStringArray(options.sitemap?.length ? options.sitemap : raw.sitemaps);
  const allowedHosts =
    raw.scope?.allowed_hosts?.length ? raw.scope.allowed_hosts : deriveAllowedHosts(stagingUrl);

  const config: AuditConfig = {
    site: {
      name: siteName,
      staging_url: stagingUrl
    },
    sitemaps,
    scope: {
      mode: "sitemap-only",
      allowed_hosts: allowedHosts,
      block_admin_paths: raw.scope?.block_admin_paths ?? true
    },
    browser: {
      headless: raw.browser?.headless ?? true,
      viewport: {
        width: raw.browser?.viewport?.width ?? 1440,
        height: raw.browser?.viewport?.height ?? 1600
      },
      timeout_ms: raw.browser?.timeout_ms ?? 30000,
      wait_until: normalizeWaitUntil(raw.browser?.wait_until)
    },
    extract: {
      include_meta: raw.extract?.include_meta ?? true,
      include_image_alt_text: raw.extract?.include_image_alt_text ?? true,
      include_forms: raw.extract?.include_forms ?? true,
      include_links: raw.extract?.include_links ?? true,
      include_buttons: raw.extract?.include_buttons ?? true,
      include_hidden_accordion_content:
        raw.extract?.include_hidden_accordion_content ?? true,
      exclude_selectors: raw.extract?.exclude_selectors ?? DEFAULT_EXCLUDE_SELECTORS
    },
    proofreading: {
      language: raw.proofreading?.language ?? raw.dictionary?.language ?? "Australian English",
      allowed_terms: raw.proofreading?.allowed_terms ?? raw.dictionary?.allowed_terms ?? [],
      notes: raw.proofreading?.notes ?? raw.dictionary?.notes ?? []
    },
    screenshots: {
      enabled: raw.screenshots?.enabled ?? true,
      full_page: raw.screenshots?.full_page ?? true,
      pre_scroll: raw.screenshots?.pre_scroll ?? true,
      scroll_pause_ms: normalizeNonNegativeNumber(raw.screenshots?.scroll_pause_ms, 250),
      settle_ms: normalizeNonNegativeNumber(raw.screenshots?.settle_ms, 500),
      animations: normalizeScreenshotAnimations(raw.screenshots?.animations)
    },
    output: {
      directory: options.out ?? raw.output?.directory ?? "./proofreading/extracts/site-copy-audit",
      markdown_only: raw.output?.markdown_only ?? true
    }
  };

  validateConfig(config);
  return config;
}

function normalizeWaitUntil(value: unknown): WaitUntil {
  if (value === "load" || value === "domcontentloaded" || value === "networkidle" || value === "commit") {
    return value;
  }
  return "networkidle";
}

function normalizeScreenshotAnimations(value: unknown): ScreenshotAnimations {
  if (value === "disabled" || value === "allow") {
    return value;
  }
  return "disabled";
}

function normalizeNonNegativeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : fallback;
}

function validateConfig(config: AuditConfig): void {
  if (!config.site.staging_url) {
    throw new Error("Missing site staging URL. Provide site.staging_url or --site.");
  }
  if (!config.sitemaps.length) {
    throw new Error("Missing sitemap URL. Provide sitemaps in config or one or more --sitemap options.");
  }
  for (const sitemap of config.sitemaps) {
    ensureValidUrl(sitemap, "sitemap");
  }
  ensureValidUrl(config.site.staging_url, "site.staging_url");
  if (!config.scope.allowed_hosts.length) {
    throw new Error("Missing allowed hosts. Configure scope.allowed_hosts or provide a valid staging URL.");
  }
}

function deriveAllowedHosts(stagingUrl: string): string[] {
  if (!stagingUrl) return [];
  try {
    return [new URL(stagingUrl).host];
  } catch {
    return [];
  }
}

export function deriveSiteName(stagingUrl: string): string {
  if (!stagingUrl) return "Site Copy Audit";
  try {
    return new URL(stagingUrl).hostname;
  } catch {
    return "Site Copy Audit";
  }
}

function ensureValidUrl(value: string, label: string): void {
  try {
    new URL(value);
  } catch {
    throw new Error(`Invalid ${label} URL: ${value}`);
  }
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function createExampleInitialConfig(): RawConfig {
  return createInitialConfig({
    site: "https://staging.example.com",
    sitemaps: ["https://staging.example.com/page-sitemap.xml"],
    name: "Client Name",
    allowedTerms: ["Client Name"],
    outputDirectory: "./proofreading/extracts/client-name"
  });
}
