import type { RunProgress } from "./run.js";

export function formatProgressLine(progress: RunProgress): string {
  if (typeof progress.current === "number" && typeof progress.total === "number" && progress.total > 0) {
    const percent = Math.min(100, Math.max(0, Math.round((progress.current / progress.total) * 100)));
    const bar = progressBar(percent);
    const page = `${progress.current}/${progress.total} pages`;
    const suffix = progress.url ? `  ${progress.phase}: ${summarizeUrl(progress.url)}` : `  ${progress.phase}`;
    return `${bar} ${page} ${String(percent).padStart(3, " ")}%${suffix}`;
  }

  return progress.phase;
}

function progressBar(percent: number): string {
  const width = 20;
  const filled = Math.round((percent / 100) * width);
  return `[${"#".repeat(filled)}${"-".repeat(width - filled)}]`;
}

function summarizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname || "/";
  } catch {
    return url;
  }
}
