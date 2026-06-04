// Canonical on-disk pack contract shared by the producer (extract) and the
// consumer (review). The page entry, skipped, and failed shapes are identical
// across both lanes.
//
// The manifest type here is deliberately tolerant: every field is optional so
// the review lane can still load older or partial packs it did not produce. The
// extract lane refines PackPageOutput into a stricter producer type (see
// src/extract/types.ts) that always populates the optional fields.

export interface PackPageOutput {
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

export interface ManifestProofreadingConfig {
  language?: string;
  allowed_terms?: string[];
  excluded_pages?: string[];
  notes?: string[];
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
  pages?: PackPageOutput[];
  skipped?: SkippedUrl[];
  failed?: FailedPage[];
  sitemapWarnings?: string[];
  extractionWarningsSummary?: Record<string, number>;
  config?: {
    proofreading?: ManifestProofreadingConfig;
    dictionary?: ManifestProofreadingConfig;
  };
}
