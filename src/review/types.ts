export interface PrepareOptions {
  client?: string;
  input?: string;
  inputRoot?: string;
  out?: string;
  outRoot?: string;
  runId?: string;
  config?: string;
  maxBatchChars?: number;
  mode?: ReviewMode;
}

export interface PrepareResult {
  inputDir: string;
  workspaceDir: string;
  workspaceReference: string;
  clientSlug: string;
  runId: string;
  mode: ReviewMode;
  configPath?: string;
  batchCount: number;
  pageReportCount: number;
  excludedPageCount: number;
  reportsDir: string;
  kickoffPromptPath: string;
  kickoffPrompt: string;
}

export type ReviewMode = "full" | "basic";

export interface PageOutput {
  url: string;
  finalUrl?: string;
  title: string;
  file: string;
  screenshot?: string;
  status?: number | null;
  warnings?: string[];
}

export interface SkippedUrl {
  url: string;
  reason: string;
}

export interface FailedPage {
  url: string;
  error: string;
}

export interface SiteCopyManifest {
  site?: {
    name?: string;
    staging_url?: string;
  };
  extractionDate?: string;
  sitemapUrlsUsed?: string[];
  counts?: {
    urlsFound?: number;
    pagesExtracted?: number;
    pagesSkipped?: number;
    pagesFailed?: number;
  };
  pages?: PageOutput[];
  skipped?: SkippedUrl[];
  failed?: FailedPage[];
  sitemapWarnings?: string[];
  extractionWarningsSummary?: Record<string, number>;
  config?: {
    proofreading?: ManifestProofreadingConfig;
    dictionary?: ManifestProofreadingConfig;
  };
}

export interface ManifestProofreadingConfig {
  language?: string;
  allowed_terms?: string[];
  excluded_pages?: string[];
  notes?: string[];
}

export interface RawDictionaryConfig {
  language?: string;
  allowed_terms?: string[] | DictionaryTermGroups;
  excluded_pages?: string[];
  ignored_findings?: IgnoredFinding[];
  preferred_terms?: PreferredTerm[];
  notes?: string[];
}

export interface DictionaryTermGroups {
  client_names?: string[];
  staff_names?: string[];
  brand_terms?: string[];
  product_names?: string[];
  industry_terms?: string[];
  intentional_spellings?: string[];
  terms?: string[];
}

export interface IgnoredFinding {
  text: string;
  reason?: string;
}

export interface PreferredTerm {
  use: string;
  avoid?: string[];
}

export interface DictionaryConfig {
  language: string;
  allowedTerms: DictionaryTermGroups;
  excludedPages: string[];
  ignoredFindings: IgnoredFinding[];
  preferredTerms: PreferredTerm[];
  notes: string[];
}

export interface ReviewPage {
  title: string;
  url: string;
  file: string;
  sourcePath: string;
  workspacePath: string;
  reportFile: string;
  content: string;
  warnings: string[];
  screenshot?: string;
  estimatedChars: number;
}

export interface ReviewBatch {
  index: number;
  name: string;
  promptFile: string;
  pages: ReviewPage[];
  estimatedChars: number;
}

export interface ExcludedPage {
  page: ReviewPage;
  pattern: string;
}

export interface PackData {
  inputDir: string;
  manifest: SiteCopyManifest;
  pages: ReviewPage[];
  skipped: SkippedUrl[];
  failed: FailedPage[];
  sitemapWarnings: string[];
  manualReviewWarnings: string[];
  extractionWarningsSummary: Record<string, number>;
}
