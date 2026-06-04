import type { ExcludedPage, ReviewPage } from "./types.js";

/**
 * Splits review pages into the ones to proofread and the ones excluded by config.
 *
 * Each pattern is matched (case-insensitively) against the page URL, file path,
 * and workspace path. A pattern containing `*` is treated as an anchored glob;
 * any other pattern is a substring match, so `privacy-policy` covers every site
 * that reuses the same slug.
 */
export function partitionExcludedPages(
  pages: ReviewPage[],
  patterns: string[]
): { included: ReviewPage[]; excluded: ExcludedPage[] } {
  if (!patterns.length) {
    return { included: pages, excluded: [] };
  }

  const included: ReviewPage[] = [];
  const excluded: ExcludedPage[] = [];

  for (const page of pages) {
    const pattern = findMatchingPattern(page, patterns);
    if (pattern) {
      excluded.push({ page, pattern });
    } else {
      included.push(page);
    }
  }

  return { included, excluded };
}

function findMatchingPattern(page: ReviewPage, patterns: string[]): string | undefined {
  const candidates = [page.url, page.file, page.workspacePath]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());

  return patterns.find((pattern) => matchesPattern(pattern, candidates));
}

function matchesPattern(pattern: string, candidates: string[]): boolean {
  const normalized = pattern.trim().toLowerCase();
  if (!normalized) return false;

  if (normalized.includes("*")) {
    const regex = globToRegExp(normalized);
    return candidates.some((candidate) => regex.test(candidate));
  }

  return candidates.some((candidate) => candidate.includes(normalized));
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}
