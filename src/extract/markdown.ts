import type { AuditConfig, ManifestData, PageExtract } from "./types.js";

export function renderPageMarkdown(page: PageExtract): string {
  const lines: string[] = [
    `# ${page.title || page.meta.title || "Untitled page"}`,
    "",
    `URL: ${page.url}`,
    `Status: ${page.status ?? "Unknown"}`
  ];

  if (page.screenshot) {
    lines.push(`Screenshot: ${page.screenshot}`);
  }

  lines.push(
    "",
    "## Meta",
    "",
    `Title: ${page.meta.title || ""}`,
    `Description: ${page.meta.description || ""}`,
    "",
    "## Headings",
    ""
  );

  lines.push(...renderList(page.headings.map((heading) => `H${heading.level}: ${heading.text}`)));

  lines.push("", "## Main visible page copy", "", page.mainCopy || "_No visible main copy extracted._");

  lines.push("", "## Buttons and CTAs", "");
  lines.push(...renderList(page.buttons));

  lines.push(
    "",
    "## Links",
    "",
    "Only include meaningful visible link text. Do not treat URLs/slugs as proofreading content.",
    ""
  );
  lines.push(...renderList(page.links));

  lines.push("", "## Forms", "");
  if (page.forms.length) {
    page.forms.forEach((form, index) => {
      lines.push(`### Form ${index + 1}`, "", "Labels:");
      lines.push(...renderList(form.labels));
      lines.push("", "Placeholders:");
      lines.push(...renderList(form.placeholders));
      lines.push("", "Submit button:");
      lines.push(...renderList(form.submitButtons), "");
    });
  } else {
    lines.push("_No forms extracted._");
  }

  lines.push("", "## Image alt text", "");
  lines.push(
    ...renderList(page.imageAltText.map((image) => `${image.label}: "${image.alt.replace(/"/g, '\\"')}"`))
  );

  lines.push("", "## Hidden accordion/tab content", "");
  if (page.hiddenContent.length) {
    page.hiddenContent.forEach((item, index) => {
      lines.push(
        `### Accordion or tab group ${index + 1}`,
        "",
        `Question/title: ${item.title}`,
        `Content: ${item.content}`,
        ""
      );
    });
  } else {
    lines.push("_No hidden accordion or tab content extracted._");
  }

  lines.push("", "## Extraction warnings", "");
  lines.push(...renderList(page.warnings));

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

export function renderManifestMarkdown(data: ManifestData): string {
  const warningCounts = new Map<string, number>();
  for (const page of data.pages) {
    for (const warning of page.warnings) {
      warningCounts.set(warning, (warningCounts.get(warning) ?? 0) + 1);
    }
  }

  const lines = [
    "# Site copy audit manifest",
    "",
    `Site name: ${data.config.site.name}`,
    `Staging URL: ${data.config.site.staging_url}`,
    `Extraction date/time: ${data.extractionDate.toISOString()}`,
    "",
    "## Sitemap URLs used",
    "",
    ...renderList(data.sitemapUrlsUsed),
    "",
    "## Counts",
    "",
    `- URLs found: ${data.urlsFound}`,
    `- Pages extracted: ${data.pages.length}`,
    `- Pages skipped: ${data.skipped.length}`,
    `- Failed pages: ${data.failed.length}`,
    "",
    "## Extracted page files",
    "",
    ...renderList(data.pages.map((page) => `${page.file} - ${page.title || "Untitled page"} - ${page.url}`)),
    "",
    "## Skipped URLs",
    "",
    ...renderList(data.skipped.map((item) => `${item.url} - ${item.reason}`)),
    "",
    "## Failed URLs",
    "",
    ...renderList(data.failed.map((item) => `${item.url} - ${item.error}`)),
    "",
    "## Sitemap warnings",
    "",
    ...renderList(data.sitemapWarnings),
    "",
    "## Extraction warnings summary",
    "",
    ...renderList([...warningCounts.entries()].map(([warning, count]) => `${warning} (${count})`))
  ];

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

export function renderManifestJson(data: ManifestData): string {
  const warningCounts = new Map<string, number>();
  for (const page of data.pages) {
    for (const warning of page.warnings) {
      warningCounts.set(warning, (warningCounts.get(warning) ?? 0) + 1);
    }
  }

  return `${JSON.stringify(
    {
      site: data.config.site,
      extractionDate: data.extractionDate.toISOString(),
      sitemapUrlsUsed: data.sitemapUrlsUsed,
      counts: {
        urlsFound: data.urlsFound,
        pagesExtracted: data.pages.length,
        pagesSkipped: data.skipped.length,
        pagesFailed: data.failed.length
      },
      pages: data.pages,
      skipped: data.skipped,
      failed: data.failed,
      sitemapWarnings: data.sitemapWarnings,
      extractionWarningsSummary: Object.fromEntries(warningCounts)
    },
    null,
    2
  )}\n`;
}

export function renderProofreadingInput(data: ManifestData): string {
  const lines = [
    "# Proofreading input",
    "",
    `Site name: ${data.config.site.name}`,
    `Staging URL: ${data.config.site.staging_url}`,
    `Extraction date/time: ${data.extractionDate.toISOString()}`,
    "",
    "Use this file as the page index for the extracted proofreading pack. Review every Markdown file listed below and use `manifest.md` or `manifest.json` for skipped, failed, or warning details.",
    "",
    "## Page files",
    "",
    ...renderList(data.pages.map((page) => `[${page.title || page.url}](${page.file}) - ${page.url}`)),
    "",
    "## Supporting files",
    "",
    "- [Manifest](manifest.md)",
    "- [Machine-readable manifest](manifest.json)",
    "- [Agent proofreading prompt](agent-proofreading-prompt.md)"
  ];

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

export function renderOutputReadme(config: AuditConfig): string {
  const terms = config.proofreading.allowed_terms.length
    ? config.proofreading.allowed_terms.join(", ")
    : "None provided";
  const notes = config.proofreading.notes.length ? config.proofreading.notes.join(" ") : "None provided.";

  return `# ${config.site.name} copy audit output

This folder contains extracted website copy for an internal pre-launch proofreading sanity check.

## Contents

- \`manifest.md\`: source of truth for pages included, skipped URLs, failed URLs, and extraction warnings.
- \`manifest.json\`: machine-readable source of truth for automation or downstream tooling.
- \`proofreading-input.md\`: page index linking all extracted page Markdown files.
- \`agent-proofreading-prompt.md\`: prompt to use for a later AI proofreading pass.
- \`pages/\`: structured Markdown extracts for each sitemap-listed page.
- \`screenshots/\`: page screenshots captured during extraction when enabled.

## Proofreading handoff

Language: ${config.proofreading.language}

Allowed terms: ${terms}

Notes: ${notes}

## Use

Open \`agent-proofreading-prompt.md\`, then provide it with \`proofreading-input.md\`, \`manifest.md\`, and every Markdown file in \`pages/\` to the proofreading agent.

This extraction pack does not contain proofreading findings and does not edit the website.
`;
}

export function renderAgentPrompt(config: AuditConfig): string {
  return `# Proofreading task

You are proofreading an extracted website content pack.

Goal: basic pre-launch proofreading sanity check only.

This is an internal developer report. The content has already been written and approved by the client. Do not rewrite for style or preference. Only flag issues that are likely to look incorrect, unclear, inconsistent, duplicated, or unprofessional after launch.

Assume ${config.proofreading.language} by default.

Review every Markdown file in \`/pages\` and use \`manifest.md\` as the source of truth for the pages included.

Use the proofreading handoff allowed terms in the config/README where provided. Do not flag client names, staff names, brand terms, product names, or intentional spellings listed there.

Check for:

- spelling mistakes
- grammar errors
- awkward or unclear wording
- inconsistent terminology
- inconsistent capitalisation
- inconsistent button/CTA wording
- placeholder text
- duplicated/repeated content
- obvious readability or formatting issues affecting the copy
- meta title or meta description issues
- image alt text that is missing, obviously incorrect, duplicated, or unprofessional
- suspicious extraction gaps, such as empty pages or pages with only header/footer text

Do not suggest subjective copy improvements unless the current wording is genuinely unclear or incorrect.

Do not review or flag URL slugs.

For each finding, include:

- Page URL
- Page file
- Current text
- Suggested correction
- Reason
- Severity: Low / Medium / High

Use this structure:

# Proofreading report

## Summary

- Pages reviewed:
- Pages with findings:
- High severity findings:
- Medium severity findings:
- Low severity findings:
- Pages needing manual review:

## Findings by page

### [Page title]

URL:
File:

#### Finding 1

Current text:
Suggested correction:
Reason:
Severity:

## Global consistency issues

List repeated terminology, capitalisation, CTA, spelling, or naming inconsistencies across pages.

## Pages needing manual review

List pages where the extracted content appears incomplete, suspicious, or difficult to assess.

## Limitations

Mention any limitations based only on the extracted content pack.
`;
}

function renderList(items: string[]): string[] {
  return items.length ? items.map((item) => `- ${item}`) : ["_None._"];
}
