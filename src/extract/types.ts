export type WaitUntil = "load" | "domcontentloaded" | "networkidle" | "commit";
export type ScreenshotAnimations = "disabled" | "allow";

export interface RawConfig {
  site?: {
    name?: string;
    staging_url?: string;
  };
  sitemaps?: string[];
  scope?: {
    mode?: "sitemap-only";
    allowed_hosts?: string[];
    block_admin_paths?: boolean;
  };
  browser?: {
    headless?: boolean;
    viewport?: {
      width?: number;
      height?: number;
    };
    timeout_ms?: number;
    wait_until?: WaitUntil;
  };
  extract?: {
    include_meta?: boolean;
    include_image_alt_text?: boolean;
    include_forms?: boolean;
    include_links?: boolean;
    include_buttons?: boolean;
    include_hidden_accordion_content?: boolean;
    exclude_selectors?: string[];
  };
  dictionary?: {
    language?: string;
    allowed_terms?: string[];
    notes?: string[];
  };
  proofreading?: {
    language?: string;
    allowed_terms?: string[];
    notes?: string[];
  };
  screenshots?: {
    enabled?: boolean;
    full_page?: boolean;
    pre_scroll?: boolean;
    scroll_pause_ms?: number;
    settle_ms?: number;
    animations?: ScreenshotAnimations;
  };
  output?: {
    directory?: string;
    markdown_only?: boolean;
  };
}

export interface AuditConfig {
  site: {
    name: string;
    staging_url: string;
  };
  sitemaps: string[];
  scope: {
    mode: "sitemap-only";
    allowed_hosts: string[];
    block_admin_paths: boolean;
  };
  browser: {
    headless: boolean;
    viewport: {
      width: number;
      height: number;
    };
    timeout_ms: number;
    wait_until: WaitUntil;
  };
  extract: {
    include_meta: boolean;
    include_image_alt_text: boolean;
    include_forms: boolean;
    include_links: boolean;
    include_buttons: boolean;
    include_hidden_accordion_content: boolean;
    exclude_selectors: string[];
  };
  proofreading: {
    language: string;
    allowed_terms: string[];
    notes: string[];
  };
  screenshots: {
    enabled: boolean;
    full_page: boolean;
    pre_scroll: boolean;
    scroll_pause_ms: number;
    settle_ms: number;
    animations: ScreenshotAnimations;
  };
  output: {
    directory: string;
    markdown_only: boolean;
  };
}

export interface CliRunOptions {
  config?: string;
  site?: string;
  sitemap?: string[];
  out?: string;
}

export interface CliInitOptions {
  out: string;
  site?: string;
  sitemap?: string[];
  name?: string;
  language?: string;
  term?: string[];
  note?: string[];
  outputDirectory?: string;
  interactive?: boolean;
}

export interface SitemapResult {
  urls: string[];
  sitemapUrlsUsed: string[];
  warnings: string[];
}

export interface SkippedUrl {
  url: string;
  reason: string;
}

export interface FilteredUrls {
  allowed: string[];
  skipped: SkippedUrl[];
}

export interface Heading {
  level: number;
  text: string;
}

export interface FormExtract {
  labels: string[];
  placeholders: string[];
  submitButtons: string[];
}

export interface ImageAltExtract {
  label: string;
  alt: string;
}

export interface HiddenContentExtract {
  title: string;
  content: string;
}

export interface PageExtract {
  title: string;
  url: string;
  finalUrl: string;
  status: number | null;
  screenshot?: string;
  meta: {
    title: string;
    description: string;
  };
  headings: Heading[];
  mainCopy: string;
  buttons: string[];
  links: string[];
  forms: FormExtract[];
  imageAltText: ImageAltExtract[];
  hiddenContent: HiddenContentExtract[];
  warnings: string[];
}

export interface PageOutput {
  url: string;
  finalUrl: string;
  title: string;
  file: string;
  screenshot?: string;
  status: number | null;
  warnings: string[];
}

export interface FailedPage {
  url: string;
  error: string;
}

export interface ManifestData {
  config: AuditConfig;
  extractionDate: Date;
  sitemapUrlsUsed: string[];
  urlsFound: number;
  pages: PageOutput[];
  skipped: SkippedUrl[];
  failed: FailedPage[];
  sitemapWarnings: string[];
}
