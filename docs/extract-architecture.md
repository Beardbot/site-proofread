# Architecture

This CLI turns sitemap-listed staging pages into a Markdown proofreading pack. The architecture is intentionally linear and conservative.

## Data Flow

1. `src/cli.ts` parses `init` or `extract` commands.
2. For `init`, `src/cli.ts` either prompts for project values or accepts flags, then `src/extract/config.ts` writes a minimal YAML config.
3. For `extract`, `src/extract/config.ts` loads YAML, applies defaults, merges CLI overrides, and validates required fields.
4. `src/extract/sitemap.ts` fetches configured sitemaps, parses URL entries, and expands directly referenced sitemap indexes one level.
5. `src/extract/scope.ts` filters URLs by allowed host and blocked admin/login path fragments.
6. `src/extract/run.ts` launches Playwright Chromium and visits each allowed URL.
7. `src/extract/extractor.ts` extracts proofreadable DOM content and pragmatic hidden accordion/tab content.
8. `src/extract/warnings.ts` adds page-level extraction QA warnings.
9. `src/extract/markdown.ts` writes page Markdown, manifest Markdown/JSON, proofreading input index, output README, and proofreading-agent prompt.

During `extract`, `src/extract/run.ts` emits structured progress events. `src/cli.ts` renders early events as phase text, then uses `src/extract/progress.ts` to render page-count progress once `current` and `total` are known.

## Safety Boundaries

The tool is sitemap-only. It must not discover new pages from page links, navigation, footers, robots.txt, or arbitrary sitemap discovery.

Scope enforcement happens before page visits:

- Allowed hosts come from `scope.allowed_hosts` or the staging URL host.
- Admin/login/dashboard-style paths are skipped when `scope.block_admin_paths` is true.
- Skipped URLs are reported in `manifest.md`.

Browser interactions must stay non-destructive:

- Never submit forms.
- Never authenticate.
- Never click arbitrary links.
- Never click controls inside forms.
- Only use conservative reveal interactions for hidden content patterns.

## Browser And Screenshot Lifecycle

For each page:

1. Create a fresh Playwright page with the configured viewport.
2. Navigate with configured timeout and `wait_until`.
3. If the configured wait mode times out, retry with `domcontentloaded` unless `domcontentloaded` was already requested.
4. If screenshots are enabled, inject hide styles for `extract.exclude_selectors`.
5. Pre-scroll the page when `screenshots.pre_scroll` is true.
6. Pause after each scroll step using `screenshots.scroll_pause_ms`.
7. Scroll back to the top and wait `screenshots.settle_ms`.
8. Capture the screenshot with configured `full_page` and `animations`.
9. Extract content and write Markdown.

Screenshot pre-scroll exists because Playwright full-page screenshots do not reliably trigger scroll-reveal animations or lazy-loaded elements by themselves.

## Text Decoding And Entities

HTML page text is decoded by the browser through Playwright. The extractor reads DOM `textContent` and attributes after the browser has applied normal HTML charset handling and decoded HTML entities. The extractor does not manually decode entities, which avoids double-decoding.

Fixtures cover smart apostrophes, curly quotes, en dashes, non-breaking spaces, accented characters, and common HTML entities. Extracted text should remain valid UTF-8 in page Markdown, `manifest.md`, and `manifest.json`.

`src/extract/warnings.ts` checks extracted text for common mojibake signatures such as `â€™`, `â€œ`, `â€`, `â€“`, `Ã`, `Â`, and `�`. If one is found, the page receives an extraction warning instead of silently passing the issue through.

## Hidden Content Lifecycle

Hidden content support is pragmatic, not exhaustive.

The extractor handles:

- DOM content connected to `aria-controls`.
- Common `role="tab"` controls.
- Buttons with `aria-expanded`.
- Elementor-style accordion, toggle, and tab title classes.

Before clicking reveal controls, the extractor installs event guards to prevent form submission and link navigation. It skips controls inside forms and anchors with `href`.

If controls cannot be revealed safely or too many controls are found, the page receives an extraction warning.

## Output Lifecycle

Output is written under `output.directory`.

Generated files:

- `README.md`
- `manifest.md`
- `manifest.json`
- `proofreading-input.md`
- `agent-proofreading-prompt.md`
- `pages/*.md`
- `screenshots/*.png` when screenshots are enabled

Page filenames are stable and generated from sitemap order plus URL slug, for example `001-home.md`.

If the same output directory is reused, matching generated files may be overwritten. Unrelated old files are not deleted, so separate output directories are preferred for historical runs.
