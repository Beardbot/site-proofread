import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import type {
  DictionaryConfig,
  DictionaryTermGroups,
  ManifestProofreadingConfig,
  RawDictionaryConfig
} from "./types.js";

/**
 * Config file names auto-discovered in the directory `prepare` is run from
 * when no explicit `--config` is passed. Lets one shared file (e.g. with
 * `excluded_pages`) apply to every client without repeating the flag.
 */
export const DEFAULT_CONFIG_FILENAMES = [
  "proofread.config.yml",
  "proofread.config.yaml"
];

const EMPTY_GROUPS: Required<DictionaryTermGroups> = {
  client_names: [],
  staff_names: [],
  brand_terms: [],
  product_names: [],
  industry_terms: [],
  intentional_spellings: [],
  terms: []
};

export async function loadDictionaryConfig(
  manifestProofreading?: ManifestProofreadingConfig,
  configPath?: string
): Promise<DictionaryConfig> {
  const rawConfig = configPath ? await loadRawDictionaryConfig(configPath) : {};
  return mergeDictionaryConfig(manifestProofreading, rawConfig);
}

async function loadRawDictionaryConfig(configPath: string): Promise<RawDictionaryConfig> {
  const content = await readFile(configPath, "utf8");
  const parsed = parse(content) as RawDictionaryConfig | null;
  return parsed ?? {};
}

/**
 * Resolves which config file to load. An explicit `--config` path always wins.
 * Otherwise the default config file names are looked up in `searchDir` (the
 * directory `prepare` is run from). Returns `undefined` when no config exists,
 * in which case only manifest-embedded config is used.
 */
export async function resolveConfigPath(
  explicitConfigPath: string | undefined,
  searchDir: string
): Promise<string | undefined> {
  if (explicitConfigPath) {
    return explicitConfigPath;
  }

  for (const filename of DEFAULT_CONFIG_FILENAMES) {
    const candidate = path.join(searchDir, filename);
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function mergeDictionaryConfig(
  manifestProofreading?: ManifestProofreadingConfig,
  raw: RawDictionaryConfig = {}
): DictionaryConfig {
  const manifestTerms = normalizeAllowedTerms(manifestProofreading?.allowed_terms);
  const rawTerms = normalizeAllowedTerms(raw.allowed_terms);

  return {
    language: raw.language ?? manifestProofreading?.language ?? "Australian English",
    allowedTerms: mergeTermGroups(manifestTerms, rawTerms),
    excludedPages: uniqueStrings([
      ...normalizeStringArray(manifestProofreading?.excluded_pages),
      ...normalizeStringArray(raw.excluded_pages)
    ]),
    ignoredFindings: normalizeIgnoredFindings(raw.ignored_findings),
    preferredTerms: normalizePreferredTerms(raw.preferred_terms),
    notes: [
      ...normalizeStringArray(manifestProofreading?.notes),
      ...normalizeStringArray(raw.notes)
    ]
  };
}

export function flattenAllowedTerms(groups: DictionaryTermGroups): string[] {
  return uniqueStrings([
    ...normalizeStringArray(groups.client_names),
    ...normalizeStringArray(groups.staff_names),
    ...normalizeStringArray(groups.brand_terms),
    ...normalizeStringArray(groups.product_names),
    ...normalizeStringArray(groups.industry_terms),
    ...normalizeStringArray(groups.intentional_spellings),
    ...normalizeStringArray(groups.terms)
  ]);
}

function mergeTermGroups(
  first: DictionaryTermGroups,
  second: DictionaryTermGroups
): DictionaryTermGroups {
  return {
    client_names: uniqueStrings([...(first.client_names ?? []), ...(second.client_names ?? [])]),
    staff_names: uniqueStrings([...(first.staff_names ?? []), ...(second.staff_names ?? [])]),
    brand_terms: uniqueStrings([...(first.brand_terms ?? []), ...(second.brand_terms ?? [])]),
    product_names: uniqueStrings([...(first.product_names ?? []), ...(second.product_names ?? [])]),
    industry_terms: uniqueStrings([...(first.industry_terms ?? []), ...(second.industry_terms ?? [])]),
    intentional_spellings: uniqueStrings([
      ...(first.intentional_spellings ?? []),
      ...(second.intentional_spellings ?? [])
    ]),
    terms: uniqueStrings([...(first.terms ?? []), ...(second.terms ?? [])])
  };
}

function normalizeAllowedTerms(value: unknown): DictionaryTermGroups {
  if (Array.isArray(value)) {
    return { ...EMPTY_GROUPS, terms: normalizeStringArray(value) };
  }

  if (value && typeof value === "object") {
    const groups = value as DictionaryTermGroups;
    return {
      client_names: normalizeStringArray(groups.client_names),
      staff_names: normalizeStringArray(groups.staff_names),
      brand_terms: normalizeStringArray(groups.brand_terms),
      product_names: normalizeStringArray(groups.product_names),
      industry_terms: normalizeStringArray(groups.industry_terms),
      intentional_spellings: normalizeStringArray(groups.intentional_spellings),
      terms: normalizeStringArray(groups.terms)
    };
  }

  return { ...EMPTY_GROUPS };
}

function normalizeIgnoredFindings(value: unknown): { text: string; reason?: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const finding = item as { text?: unknown; reason?: unknown };
    if (typeof finding.text !== "string" || !finding.text.trim()) return [];
    return [
      {
        text: finding.text.trim(),
        reason: typeof finding.reason === "string" && finding.reason.trim()
          ? finding.reason.trim()
          : undefined
      }
    ];
  });
}

function normalizePreferredTerms(value: unknown): { use: string; avoid?: string[] }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const term = item as { use?: unknown; avoid?: unknown };
    if (typeof term.use !== "string" || !term.use.trim()) return [];
    const avoid = normalizeStringArray(term.avoid);
    return [
      {
        use: term.use.trim(),
        avoid: avoid.length ? avoid : undefined
      }
    ];
  });
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(value.filter((item): item is string => typeof item === "string"));
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}
