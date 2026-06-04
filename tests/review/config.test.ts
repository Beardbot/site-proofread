import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { flattenAllowedTerms, mergeDictionaryConfig, resolveConfigPath } from "../../src/review/config.js";

describe("dictionary config", () => {
  it("defaults to Australian English", () => {
    const config = mergeDictionaryConfig();
    expect(config.language).toBe("Australian English");
  });

  it("merges manifest and local allowed terms", () => {
    const config = mergeDictionaryConfig(
      { language: "Australian English", allowed_terms: ["Manifest Term"] },
      {
        allowed_terms: {
          client_names: ["Client Name"],
          industry_terms: ["mixed billing"]
        }
      }
    );

    expect(flattenAllowedTerms(config.allowedTerms)).toEqual([
      "Client Name",
      "mixed billing",
      "Manifest Term"
    ]);
  });
});

describe("resolveConfigPath", () => {
  it("returns an explicit config path unchanged", async () => {
    expect(await resolveConfigPath("./my-config.yml", "/anywhere")).toBe("./my-config.yml");
  });

  it("auto-discovers a default config file in the search directory", async () => {
    const dir = await makeTempDir();
    const file = path.join(dir, "site-proofread.config.yml");
    await writeFile(file, "excluded_pages: []\n", "utf8");

    expect(await resolveConfigPath(undefined, dir)).toBe(file);
  });

  it("returns undefined when no default config exists", async () => {
    const dir = await makeTempDir();
    expect(await resolveConfigPath(undefined, dir)).toBeUndefined();
  });
});

async function makeTempDir(): Promise<string> {
  const dir = path.join(os.tmpdir(), `site-proofread-config-${Date.now()}-${Math.random()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}
