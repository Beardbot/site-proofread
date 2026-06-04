> **Note:** This document describes unchanged internals carried over during the repo merge. For the current unified command names (`site-proofread extract` / `site-proofread prepare-review`), see the top-level [README](../README.md). Some examples below still use the pre-merge `site-copy-audit run` / `proofread-agent prepare` command names and the generated review workspace still references them; those are tracked for a follow-up commit.

# Config Reference

Configs are YAML files passed to `run`:

```bash
npm run audit:run -- --config ./configs/client-name.yml
```

or, after `npm link`:

```bash
site-copy-audit run --config ./configs/client-name.yml
```

## Creating Configs

Use `init` in an interactive terminal to create a minimal config:

```bash
npm run config:init -- --out ./configs/client-name.yml
```

or, after `npm link`:

```bash
site-copy-audit init --out ./configs/client-name.yml
```

For non-interactive setup, provide the project values as flags:

```bash
site-copy-audit init \
  --out ./configs/client-name.yml \
  --site https://staging.example.com \
  --sitemap https://staging.example.com/page-sitemap.xml \
  --name "Client Name" \
  --term "Client Name" \
  --output-directory ./proofreading-output/client-name
```

`--sitemap`, `--term`, and `--note` can be repeated. `--out` is the config file path; when omitted it defaults to `./configs/<name>.yml` (the slugified site/client name). `--output-directory` is the generated proofreading pack directory stored in the config.

The generated config intentionally omits fields that have runtime defaults. A typical new config looks like:

```yaml
site:
  name: "Client Name"
  staging_url: "https://staging.example.com"

sitemaps:
  - "https://staging.example.com/page-sitemap.xml"

proofreading:
  language: "Australian English"
  allowed_terms:
    - "Client Name"

output:
  directory: "./proofreading-output/client-name"
```

## Full Shape

All supported fields are shown below. Most are optional because `run` applies defaults.

```yaml
site:
  name: "Client Name"
  staging_url: "https://staging.example.com"

sitemaps:
  - "https://staging.example.com/page-sitemap.xml"
  - "https://staging.example.com/services-sitemap.xml"

scope:
  mode: "sitemap-only"
  allowed_hosts:
    - "staging.example.com"
  block_admin_paths: true

browser:
  headless: true
  viewport:
    width: 1440
    height: 1600
  timeout_ms: 30000
  wait_until: "networkidle"

extract:
  include_meta: true
  include_image_alt_text: true
  include_forms: true
  include_links: true
  include_buttons: true
  include_hidden_accordion_content: true
  exclude_selectors:
    - "#wpadminbar"
    - ".grecaptcha-badge"
    - ".cky-consent-container"
    - ".cookie-notice"
    - 'header[data-elementor-type="header"] .elementor-sticky'
    - "script"
    - "style"
    - "noscript"

proofreading:
  language: "Australian English"
  allowed_terms:
    - "Client Name"
    - "BrandTerm"
  notes:
    - "Add staff names, product names, industry terms, and intentional spellings here."

screenshots:
  enabled: true
  full_page: true
  pre_scroll: true
  scroll_pause_ms: 250
  settle_ms: 500
  animations: "disabled"

output:
  directory: "./proofreading-output/client-name"
  markdown_only: true
```

## Required Fields

- `site.staging_url`
- `sitemaps`
- `output.directory` is optional but strongly recommended

If `scope.allowed_hosts` is omitted, it defaults to the host from `site.staging_url`.
If `site.name` is omitted, it defaults to the staging URL hostname.

## Defaults

- `scope.mode`: `sitemap-only`
- `scope.block_admin_paths`: `true`
- `browser.headless`: `true`
- `browser.viewport.width`: `1440`
- `browser.viewport.height`: `1600`
- `browser.timeout_ms`: `30000`
- `browser.wait_until`: `networkidle`
- all `extract.include_*` fields: `true`
- `proofreading.language`: `Australian English`
- `screenshots.enabled`: `true`
- `screenshots.full_page`: `true`
- `screenshots.pre_scroll`: `true`
- `screenshots.scroll_pause_ms`: `250`
- `screenshots.settle_ms`: `500`
- `screenshots.animations`: `disabled`
- `output.markdown_only`: `true`

## Proofreading Handoff

The `proofreading` section is not used during extraction. It is copied into generated handoff files so a later proofreading pass knows the default language, allowed terms, and notes.

Older configs using `dictionary` are still accepted as a fallback, but new configs should use `proofreading`.

## CSS Selectors

Quote selectors that contain YAML-sensitive characters, especially brackets, quotes, colons, or `>`.

Example:

```yaml
extract:
  exclude_selectors:
    - '[data-elementor-type="header"] > .elementor-sticky'
```

Selectors in `extract.exclude_selectors` are removed before Markdown extraction and hidden before screenshots. Use a descendant selector when the page builder creates multiple variants inside a known container. For both Elementor sticky header variants, prefer:

```yaml
extract:
  exclude_selectors:
    - 'header[data-elementor-type="header"] .elementor-sticky'
```

The direct-child selector `header[data-elementor-type="header"] > .elementor-sticky` is usually too narrow for Elementor, because sticky containers are often nested inside the header.

This Elementor sticky selector ships in the built-in `exclude_selectors` defaults, so it already applies unless you set your own `exclude_selectors` (which replaces the defaults entirely).

## Multiple Runs

Use one config per client or run:

```text
configs/client-name.yml
configs/client-name-round-2.yml
configs/another-client.yml
```

Use a distinct `output.directory` for clean historical runs:

```yaml
output:
  directory: "./proofreading-output/client-name/2026-06-03"
```

If the same output directory is reused, matching generated page and screenshot filenames can be overwritten. Old unrelated files are not deleted.

Each run writes these root output files:

- `README.md`
- `manifest.md`
- `manifest.json`
- `proofreading-input.md`
- `agent-proofreading-prompt.md`

## Screenshot Tuning

Use these fields when screenshots miss lazy-loaded or scroll-revealed content:

```yaml
screenshots:
  pre_scroll: true
  scroll_pause_ms: 500
  settle_ms: 1000
  animations: "disabled"
```

Set `pre_scroll: false` if the site behaves badly when automatically scrolled.

Set `animations: "allow"` if preserving animation state matters more than stabilising screenshots.

## Direct CLI Overrides

These options apply to `run`, not `init`.

Direct args can provide or override the site URL, sitemaps, and output directory:

```bash
npm run audit:run -- \
  --site https://staging.example.com \
  --sitemap https://staging.example.com/page-sitemap.xml \
  --out ./proofreading-output/client-name
```

Config values still supply the remaining defaults.
