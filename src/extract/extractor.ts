import type { Page } from "playwright";
import type { AuditConfig, PageExtract } from "./types.js";

interface DomExtract {
  title: string;
  meta: {
    title: string;
    description: string;
  };
  headings: { level: number; text: string }[];
  mainCopy: string;
  buttons: string[];
  links: string[];
  forms: {
    labels: string[];
    placeholders: string[];
    submitButtons: string[];
  }[];
  imageAltText: {
    label: string;
    alt: string;
  }[];
  hiddenContent: {
    title: string;
    content: string;
  }[];
  warnings: string[];
}

export async function extractPageContent(
  page: Page,
  config: AuditConfig,
  originalUrl: string,
  status: number | null,
  screenshot?: string,
  initialWarnings: string[] = []
): Promise<PageExtract> {
  let hiddenWarnings: string[] = [];
  if (config.extract.include_hidden_accordion_content) {
    hiddenWarnings = await revealCommonHiddenContent(page);
  }

  const data = await page.evaluate(
    ({ extract }) => {
      const warnings: string[] = [];

      for (const selector of extract.exclude_selectors) {
        for (const element of Array.from(document.querySelectorAll(selector))) {
          element.remove();
        }
      }

      const visible = (element: Element): boolean => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          style.opacity !== "0" &&
          rect.width > 0 &&
          rect.height > 0
        );
      };

      const clean = (value: string | null | undefined): string =>
        (value ?? "").replace(/\s+/g, " ").trim();

      const unique = (values: string[]): string[] => {
        const seen = new Set<string>();
        const result: string[] = [];
        for (const value of values.map(clean).filter(Boolean)) {
          const key = value.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            result.push(value);
          }
        }
        return result;
      };

      const root =
        document.querySelector("main") ??
        document.querySelector("[role='main']") ??
        document.querySelector(".site-main") ??
        document.querySelector("#main") ??
        document.querySelector("#content") ??
        document.querySelector(".content-area") ??
        document.querySelector("article") ??
        document.body;

      if (root === document.body) {
        warnings.push("No main content landmark found; extracted visible copy from body fallback.");
      }

      const textBlocks = Array.from(
        root.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,td,th,label,legend,summary")
      )
        .filter((element) => visible(element))
        .filter((element) => !element.closest("nav, header, footer, script, style, noscript"))
        .map((element) => clean(element.textContent))
        .filter(Boolean);

      const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))
        .filter((element) => visible(element))
        .map((element) => ({
          level: Number(element.tagName.slice(1)),
          text: clean(element.textContent)
        }))
        .filter((heading) => heading.text.length > 0);

      const buttons = extract.include_buttons
        ? unique(
            Array.from(
              document.querySelectorAll("button,a[role='button'],input[type='button'],input[type='submit']")
            )
              .filter((element) => visible(element))
              .map((element) => {
                if (element instanceof HTMLInputElement) return element.value;
                return element.textContent;
              })
            )
        : [];

      const links = extract.include_links
        ? unique(
            Array.from(document.querySelectorAll("a[href]"))
              .filter((element) => visible(element))
              .map((element) => clean(element.textContent))
              .filter((text) => text.length > 1)
              .filter((text) => !/^https?:\/\//i.test(text))
              .filter((text) => !/^\/[\w-]/.test(text))
          )
        : [];

      const forms = extract.include_forms
        ? Array.from(document.querySelectorAll("form")).map((form) => ({
            labels: unique(Array.from(form.querySelectorAll("label,legend")).map((element) => clean(element.textContent))),
            placeholders: unique(
              Array.from(form.querySelectorAll("input[placeholder],textarea[placeholder]"))
                .map((element) => element.getAttribute("placeholder") ?? "")
            ),
            submitButtons: unique(
              Array.from(form.querySelectorAll("button,input[type='submit']"))
                .map((element) => element instanceof HTMLInputElement ? element.value : clean(element.textContent))
            )
          }))
        : [];

      const imageAltText = extract.include_image_alt_text
        ? Array.from(document.querySelectorAll("img")).map((image, index) => {
            const label =
              clean(image.getAttribute("aria-label")) ||
              clean(image.getAttribute("title")) ||
              clean(image.closest("figure")?.querySelector("figcaption")?.textContent) ||
              clean(image.getAttribute("class")) ||
              `Image ${index + 1}`;
            return {
              label,
              alt: image.getAttribute("alt") ?? ""
            };
          })
        : [];

      const hiddenContent: { title: string; content: string }[] = [];
      if (extract.include_hidden_accordion_content) {
        const controls = Array.from(
          document.querySelectorAll(
            "[aria-controls], [role='tab'], .elementor-tab-title, .elementor-accordion-title, .elementor-toggle-title"
          )
        );

        for (const control of controls) {
          const title = clean(control.textContent) || clean(control.getAttribute("aria-label"));
          let content = "";
          const controlledId = control.getAttribute("aria-controls");
          if (controlledId) {
            content = clean(document.getElementById(controlledId)?.textContent);
          }
          if (!content) {
            const next = control.nextElementSibling;
            content = clean(next?.textContent);
          }
          if (title && content && title !== content) {
            hiddenContent.push({ title, content });
          }
        }

        const unrevealedCount = Array.from(document.querySelectorAll("[aria-expanded='false']")).length;
        if (unrevealedCount > 0) {
          warnings.push("Hidden content may not have been fully extracted.");
        }
      }

      const metaDescription = document.querySelector("meta[name='description']")?.getAttribute("content") ?? "";

      return {
        title: clean(document.querySelector("h1")?.textContent) || clean(document.title) || "Untitled page",
        meta: {
          title: extract.include_meta ? clean(document.title) : "",
          description: extract.include_meta ? clean(metaDescription) : ""
        },
        headings,
        mainCopy: unique(textBlocks).join("\n\n"),
        buttons,
        links,
        forms,
        imageAltText,
        hiddenContent: uniqueHiddenContent(hiddenContent),
        warnings
      };

      function uniqueHiddenContent(items: { title: string; content: string }[]) {
        const seen = new Set<string>();
        const result: { title: string; content: string }[] = [];
        for (const item of items) {
          const key = `${item.title.toLowerCase()}|${item.content.toLowerCase()}`;
          if (!seen.has(key)) {
            seen.add(key);
            result.push(item);
          }
        }
        return result;
      }
    },
    { extract: config.extract }
  ) as DomExtract;

  return {
    title: data.title,
    url: originalUrl,
    finalUrl: page.url(),
    status,
    screenshot,
    meta: data.meta,
    headings: data.headings,
    mainCopy: data.mainCopy,
    buttons: data.buttons,
    links: data.links,
    forms: data.forms,
    imageAltText: data.imageAltText,
    hiddenContent: data.hiddenContent,
    warnings: [...initialWarnings, ...hiddenWarnings, ...data.warnings]
  };
}

async function revealCommonHiddenContent(page: Page): Promise<string[]> {
  const warnings: string[] = [];
  await page.evaluate(() => {
    window.addEventListener("submit", (event) => event.preventDefault(), true);
    document.addEventListener(
      "click",
      (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest("a[href]")) {
          event.preventDefault();
        }
      },
      true
    );
  });

  const selectors = [
    "button[aria-expanded='false']:not([type='submit'])",
    "[role='tab']",
    ".elementor-tab-title",
    ".elementor-accordion-title",
    ".elementor-toggle-title"
  ];
  const locator = page.locator(selectors.join(", "));
  const count = Math.min(await locator.count(), 30);

  if ((await locator.count()) > count) {
    warnings.push("Hidden content may not have been fully extracted; more than 30 reveal controls were found.");
  }

  for (let index = 0; index < count; index += 1) {
    const item = locator.nth(index);
    try {
      const safe = await item.evaluate((element) => {
        const tag = element.tagName.toLowerCase();
        if (element.closest("form")) return false;
        if (tag === "a" && element.hasAttribute("href")) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      });
      if (!safe) continue;
      await item.click({ timeout: 1000 });
      await page.waitForTimeout(150);
    } catch {
      warnings.push("Hidden content may not have been fully extracted.");
      break;
    }
  }

  return warnings;
}
