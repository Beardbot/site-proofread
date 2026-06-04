import type { ReviewBatch, ReviewPage } from "./types.js";

export const DEFAULT_MAX_BATCH_CHARS = 45000;

export function createBatches(
  pages: ReviewPage[],
  maxBatchChars = DEFAULT_MAX_BATCH_CHARS
): ReviewBatch[] {
  const safeMax = Math.max(1, Math.floor(maxBatchChars));
  const batches: ReviewPage[][] = [];
  let current: ReviewPage[] = [];
  let currentChars = 0;

  for (const page of pages) {
    const pageChars = Math.max(1, page.estimatedChars);
    if (current.length && currentChars + pageChars > safeMax) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }

    current.push(page);
    currentChars += pageChars;
  }

  if (current.length) {
    batches.push(current);
  }

  return batches.map((batchPages, index) => {
    const batchNumber = index + 1;
    const name = `batch-${String(batchNumber).padStart(3, "0")}`;
    return {
      index: batchNumber,
      name,
      promptFile: `batches/${name}-prompt.md`,
      pages: batchPages,
      estimatedChars: batchPages.reduce((sum, page) => sum + page.estimatedChars, 0)
    };
  });
}
