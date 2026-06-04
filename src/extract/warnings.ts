import { containsMojibake } from "../shared/mojibake.js";
import type { PageExtract } from "./types.js";

export function generatePageWarnings(page: PageExtract): string[] {
  const warnings = new Set(page.warnings);

  if (!page.headings.some((heading) => heading.level === 1)) {
    warnings.add("Page has no H1.");
  }
  if (!page.meta.title.trim()) {
    warnings.add("Page title is empty.");
  }
  if (!page.meta.description.trim()) {
    warnings.add("Meta description is empty.");
  }
  if (page.mainCopy.trim().length < 120) {
    warnings.add("Extracted main content is very short.");
  }
  if (page.status !== null && page.status !== 200) {
    warnings.add(`Page returned non-200 status: ${page.status}.`);
  }
  if (page.finalUrl !== page.url) {
    warnings.add(`Page redirected unexpectedly to ${page.finalUrl}.`);
  }

  const emptyAltCount = page.imageAltText.filter((image) => image.alt.trim() === "").length;
  if (emptyAltCount > 0) {
    warnings.add(`${emptyAltCount} images have empty alt text.`);
  }

  if (looksLikeGlobalOnly(page.mainCopy, page.headings.map((heading) => heading.text))) {
    warnings.add("Page appears to contain only header/footer/global text.");
  }

  if (containsMojibake(extractedTextValues(page).join("\n"))) {
    warnings.add("Likely mojibake detected in extracted content.");
  }

  return [...warnings];
}

function extractedTextValues(page: PageExtract): string[] {
  return [
    page.title,
    page.url,
    page.finalUrl,
    page.meta.title,
    page.meta.description,
    ...page.headings.map((heading) => heading.text),
    page.mainCopy,
    ...page.buttons,
    ...page.links,
    ...page.forms.flatMap((form) => [
      ...form.labels,
      ...form.placeholders,
      ...form.submitButtons
    ]),
    ...page.imageAltText.flatMap((image) => [image.label, image.alt]),
    ...page.hiddenContent.flatMap((item) => [item.title, item.content])
  ];
}

function looksLikeGlobalOnly(mainCopy: string, headings: string[]): boolean {
  const text = mainCopy.toLowerCase();
  if (mainCopy.trim().length > 300) return false;
  const globalTerms = ["menu", "privacy policy", "copyright", "all rights reserved", "follow us"];
  const globalHits = globalTerms.filter((term) => text.includes(term)).length;
  return headings.length === 0 && globalHits >= 2;
}
