import { access } from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";
import { resolveConfig } from "../extract/config.js";
import { runAudit, type RunProgress } from "../extract/run.js";
import { prepareReviewWorkspace } from "../review/run.js";
import type { PrepareResult, ReviewMode } from "../review/types.js";

export interface RunPipelineOptions {
  configPath: string;
  force?: boolean;
  reviewConfigPath?: string;
  mode?: ReviewMode;
  maxBatchChars?: number;
  onProgress?: (progress: RunProgress) => void;
  log?: (message: string) => void;
}

export async function runPipeline(options: RunPipelineOptions): Promise<PrepareResult> {
  const config = await resolveConfig({ config: options.configPath });
  const outputDir = config.output.directory;

  if ((await hasExistingPack(outputDir)) && !options.force) {
    options.log?.(
      `Existing extraction pack found at ${outputDir}; reusing it. Pass --force to re-extract.`
    );
  } else {
    await runAudit(config, { onProgress: options.onProgress });
  }

  return prepareReviewWorkspace({
    input: outputDir,
    config: options.reviewConfigPath,
    mode: options.mode,
    maxBatchChars: options.maxBatchChars
  });
}

async function hasExistingPack(outputDir: string): Promise<boolean> {
  try {
    await access(path.join(outputDir, "manifest.json"), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
