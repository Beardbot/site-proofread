// The pack contract lives in src/shared/pack.ts so both lanes agree on it. The
// review lane consumes packs tolerantly, so its PageOutput is the canonical
// (all-optional) PackPageOutput rather than the stricter extract producer type.
import type {
  FailedPage,
  ManifestProofreadingConfig,
  PackPageOutput,
  SiteCopyManifest,
  SkippedUrl
} from "../shared/pack.js";

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
  /** Extra replacement rules supplied on the CLI (e.g. via --replace), merged on top of the config file. */
  replacements?: RawReplacementRule[];
  /** Plain-language change goal supplied on the CLI (--goal); overrides any goal in the config file. */
  goal?: string;
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

export type ReviewMode = "full" | "basic" | "targeted";

export type { FailedPage, ManifestProofreadingConfig, SiteCopyManifest, SkippedUrl };
export type PageOutput = PackPageOutput;

export interface RawDictionaryConfig {
  language?: string;
  allowed_terms?: string[] | DictionaryTermGroups;
  excluded_pages?: string[];
  ignored_findings?: IgnoredFinding[];
  preferred_terms?: PreferredTerm[];
  replacements?: RawReplacementRule[];
  /** Plain-language description of a targeted change; the review agent compiles it into an explicit, confirmed scope. */
  goal?: string;
  notes?: string[];
}

/**
 * A single directed word/phrase replacement supplied by the review config. Broad
 * enough for any narrow copy change (branding, adjectives, names): `find` ->
 * `replace`, optionally gated by a freeform `when` condition the agent judges
 * (e.g. only when it qualifies certain nouns). Drives `targeted` review mode,
 * where the agent applies only these rules and reports nothing else.
 */
export interface RawReplacementRule {
  find?: string;
  replace?: string;
  when?: string;
  match?: string;
  case?: string;
  preserve_case?: boolean;
  severity?: string;
  reason?: string;
}

export type ReplacementMatch = "whole-word" | "substring";
export type ReplacementCase = "insensitive" | "sensitive";
export type ReplacementSeverity = "high" | "medium" | "low";

export interface ReplacementRule {
  find: string;
  replace: string;
  when?: string;
  match: ReplacementMatch;
  case: ReplacementCase;
  preserveCase: boolean;
  severity: ReplacementSeverity;
  reason?: string;
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
  replacements: ReplacementRule[];
  goal?: string;
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
