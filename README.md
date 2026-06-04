# Site Proofread

Local TypeScript CLI for internal pre-launch website copy QA. It runs in two stages from one tool:

1. **`extract`** — render sitemap-listed staging pages with Playwright and write a structured Markdown content pack (copy, headings, buttons, links, forms, image alt text, accordion/tab content) plus full-page screenshots.
2. **`prepare-review`** — turn that pack into a self-contained, deterministic proofreading review workspace (batch prompts, per-page report placeholders, severity-first templates) that you drive with your own AI agent (Claude Code, Codex, etc.).

The tool is **model-agnostic**: it never calls an AI model, crawls arbitrary links, authenticates, submits forms, or edits website content. It produces deterministic artifacts; a human or an AI agent does the actual proofreading.

> This repo is the consolidation of the former `site-copy-audit` (extraction) and `proofread-agent` (review prep) repos into one tool with a shared build, test, and CLI. See [Command mapping](#command-mapping) below.

## Install

```bash
npm install
npm run build
```

Playwright installs browser support through its package. If Chromium is missing, run:

```bash
npx playwright install chromium
```

Optionally link the `site-proofread` command globally:

```bash
npm link
```

## Command mapping

| Unified command | Former command | Purpose |
| --- | --- | --- |
| `site-proofread init` | `site-copy-audit init` | Create a minimal extraction config |
| `site-proofread extract` | `site-copy-audit run` | Extract a content pack from staging |
| `site-proofread prepare-review` | `proofread-agent prepare` | Build a review workspace from a pack |

Without `npm link`, use the npm scripts (`npm run init`, `npm run extract -- ...`, `npm run prepare-review -- ...`) or `node dist/cli.js <command>`.

## Workflow

```text
init  ->  extract  ->  prepare-review  ->  drive your own agent over the workspace
```

1. **Create a config.** Interactive prompts, or pass flags:

   ```bash
   site-proofread init --out ./configs/client-name.yml \
     --site https://staging.example.com \
     --sitemap https://staging.example.com/page-sitemap.xml
   ```

   `init` with no flags in a TTY prompts for the site URL, name, sitemaps, output directory, language, and allowed terms, then writes a minimal config (defaults fill in at run time).

2. **Extract the content pack:**

   ```bash
   site-proofread extract --config ./configs/client-name.yml
   ```

   Or with direct arguments:

   ```bash
   site-proofread extract \
     --site https://staging.example.com \
     --sitemap https://staging.example.com/page-sitemap.xml \
     --out ./proofreading-output/client-name
   ```

   On Windows PowerShell, use backtick (`` ` ``) line continuations instead of `\`.

3. **Prepare a review workspace** from the pack (resolved under `./proofreading-output/<client>` by default):

   ```bash
   site-proofread prepare-review client-name
   ```

   Use `--mode basic` for a quick launch sanity check, or `--input <dir>` for a pack outside the default location.

4. **Run the review** by pointing your AI agent at the generated workspace using the printed kick-off prompt (also saved as `codex-kickoff-prompt.md`). The agent fills in the page reports and final report; the tool itself does not.

## Output

`extract` writes, under `output.directory`:

- `manifest.md` / `manifest.json` — pages, skipped URLs, failures, extraction warnings (human + machine readable).
- `proofreading-input.md` — page index linking each page file.
- `pages/NNN-slug.md` — structured Markdown per page.
- `screenshots/NNN-slug.png` — full-page screenshots when enabled.
- `README.md` / `agent-proofreading-prompt.md` — pack notes and a standalone proofreading prompt.

`prepare-review` writes a workspace under `./proofreading-reviews/<client>/<run-id>/` containing `site-pack/` (a copy of the pack), `batches/` (review prompts), `reports/pages/` (per-page placeholders), severity-first templates, and a `merge-prompt.md`. See [docs/review-workflow.md](docs/review-workflow.md).

## Safety boundaries

- Sitemap URLs are the source of truth — no link crawling, robots.txt, or arbitrary sitemap discovery.
- No authentication, form submission, or destructive clicks; only conservative reveal interactions for hidden accordion/tab content.
- No AI calls and no website edits at any stage. Review output is deterministic scaffolding.

## Docs

- [docs/extract-architecture.md](docs/extract-architecture.md) — extraction data flow, screenshot lifecycle, safety model.
- [docs/extract-config-reference.md](docs/extract-config-reference.md) — config shape, defaults, selectors, multiple runs.
- [docs/review-workflow.md](docs/review-workflow.md) — review workspace workflow and generated contents.
- [AGENTS.md](AGENTS.md) — project rules and source map for developers and agents.

## Development

```bash
npm run build
npm test
```

The test suite includes a Playwright-backed Unicode extraction regression; in restricted environments, browser launch may need elevated permission.

## Status and follow-ups

This is the **consolidation** commit: one repo, one CLI, one build/test, with each lane's behaviour preserved. Deliberately deferred to follow-up commits:

- Collapsing duplicated logic (mojibake detection, `slugify`, the pack/manifest types) into a shared core.
- Renaming the generated review workspace's internal references from `proofread-agent prepare` to `site-proofread prepare-review`, and renaming the auto-discovered `proofread-agent.config.yml`.
- Extraction-quality fixes (main-content scoping, staging auth, quieter warnings) and an optional model-backed `review` step.
