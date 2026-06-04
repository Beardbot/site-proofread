# Site Proofread

Local TypeScript CLI for internal pre-launch website copy QA. It runs in two stages from one tool:

1. **`extract`** — render sitemap-listed staging pages with Playwright and write a structured Markdown content pack (copy, headings, buttons, links, forms, image alt text, accordion/tab content) plus full-page screenshots.
2. **`prepare`** — turn that pack into a self-contained, deterministic proofreading review workspace (batch prompts, per-page report placeholders, severity-first templates) that you drive with your own AI agent (Claude Code, Codex, etc.).

The tool is **model-agnostic**: it never calls an AI model, crawls arbitrary links, authenticates, submits forms, or edits website content. It produces deterministic artifacts; a human or an AI agent does the actual proofreading.

## Getting started

The quickest path from zero to a finished review. Run every command from the project folder (the one containing this README). If you're new to the command line, follow the steps in order — each one is safe to copy and paste.

**Prerequisites**

- **Node.js 20 or newer** — check your version with `node --version`. If it's missing or older, install the LTS build from <https://nodejs.org>.
- **A terminal** — PowerShell on Windows, or Terminal on macOS/Linux.
- **An AI coding agent** for the final step (for example [Codex](https://developers.openai.com/codex/cli/) or [Claude Code](https://www.claude.com/product/claude-code)). This tool *prepares* the review; your agent *performs* it.

**1. Install and build (one time)**

```bash
npm install
npm run build
npm link
npx playwright install chromium
```

`npm install` downloads dependencies, `npm run build` compiles the tool, `npm link` makes the `proofread` command available in your terminal, and the last line installs the headless browser used to read pages.

> If `npm link` reports a permissions error, or `proofread` isn't found afterwards, you can run any command below as `node dist/cli.js <command>` instead (for example `node dist/cli.js init`), or use the npm scripts (`npm run init`, `npm run extract -- ...`).

**Quick path:** after installing, `proofread run` walks through config creation, extraction, and review workspace preparation in one command.

**2. Create a config — `init`**

```bash
proofread init
```

Answer the prompts (staging site URL, site name, sitemap URL(s), and so on). It saves a config under `./proofreading/configs/` and prints the exact path. A sitemap URL usually ends in `sitemap.xml` — for example `https://staging.example.com/page-sitemap.xml`. Ask the site's developer if you're not sure where it is.

**3. Extract the content pack — `extract`** (use the config path that `init` printed)

```bash
proofread extract --config ./proofreading/configs/your-site.yml
```

A headless browser visits each page listed in the sitemap and writes its copy — plus full-page screenshots — to `./proofreading/extracts/your-site/`.

**4. Build the review workspace — `prepare`** (use the folder name `extract` created under `./proofreading/extracts/`)

```bash
proofread prepare your-site
```

This creates a self-contained workspace under `./proofreading/reviews/your-site/<date>/` and prints a kick-off prompt (also saved there as `codex-kickoff-prompt.md`). Add `--mode basic` for a fast pre-launch sanity check instead of a full review.

**5. Run the review with your agent**

Open your AI coding agent in this project and give it the printed kick-off prompt (or paste the contents of `codex-kickoff-prompt.md`). The agent reads the workspace's `AGENTS.md`, completes each page report, and writes the merged report at `reports/final-report.md`. Open that file to read the findings — highest severity first.

That's the whole loop. The sections below cover each command in more detail and the files you get.

## Commands

| Command | What it does |
| --- | --- |
| `proofread run` | Run config creation, extraction, and review workspace preparation in one invocation |
| `proofread init` | Create a minimal extraction config |
| `proofread extract` | Extract a content pack from a staging site |
| `proofread prepare` | Build a review workspace from a pack |

Without `npm link`, run these as `node dist/cli.js <command>`, or use the npm scripts (`npm run init`, `npm run extract -- ...`, `npm run prepare:review -- ...`).

## Workflow

```text
run  ->  drive your own agent over the workspace
```

Or use the primitive commands separately:

```text
init  ->  extract  ->  prepare  ->  drive your own agent over the workspace
```

**One-command pipeline:**

```bash
proofread run
```

`run` prompts for the same extraction config values as `init`, extracts the pack, then prepares the review workspace. Pass `--config ./proofreading/configs/client-name.yml` to reuse an existing extraction config and skip config creation. If the configured output directory already contains `manifest.json`, `run` reuses that pack; pass `--force` to re-extract before preparing the review.

The pipeline keeps the two config files distinct: `--config` is the per-client extraction config, while `--review-config` is the proofreading dictionary/config used by `prepare`. If `--review-config` is omitted, the review stage still auto-discovers `proofread.config.yml` in the project root and merges it with the pack manifest's proofreading block.

1. **Create a config.** Interactive prompts, or pass flags:

   ```bash
   proofread init --out ./proofreading/configs/client-name.yml \
     --site https://staging.example.com \
     --sitemap https://staging.example.com/page-sitemap.xml
   ```

   `init` with no flags in a TTY prompts for the site URL, name, sitemaps, output directory, language, allowed terms, and the config file path, then writes a minimal config (defaults fill in at run time). When you don't pass `--out` (or accept the prompt default), the config is written to `./proofreading/configs/<name>.yml`.

2. **Extract the content pack:**

   ```bash
   proofread extract --config ./proofreading/configs/client-name.yml
   ```

   Or with direct arguments:

   ```bash
   proofread extract \
     --site https://staging.example.com \
     --sitemap https://staging.example.com/page-sitemap.xml \
     --out ./proofreading/extracts/client-name
   ```

   On Windows PowerShell, use backtick (`` ` ``) line continuations instead of `\`.

3. **Prepare a review workspace** from the pack (resolved under `./proofreading/extracts/<client>` by default):

   ```bash
   proofread prepare client-name
   ```

   Flags go after the client name. Use `--mode basic` for a quick launch sanity check (the default is `full`), or `--input <dir>` for a pack outside the default location:

   ```bash
   proofread prepare client-name --mode basic
   proofread prepare --input ./proofreading/extracts/client-name --mode basic
   ```

   Pass either a client name or `--input`, not both.

4. **Run the review** by pointing your AI agent at the generated workspace using the printed kick-off prompt (also saved as `codex-kickoff-prompt.md`). The agent fills in the page reports and final report; the tool itself does not.

## Output

`extract` writes, under `output.directory`:

- `manifest.md` / `manifest.json` — pages, skipped URLs, failures, extraction warnings (human + machine readable).
- `proofreading-input.md` — page index linking each page file.
- `pages/NNN-slug.md` — structured Markdown per page.
- `screenshots/NNN-slug.png` — full-page screenshots when enabled.
- `README.md` / `agent-proofreading-prompt.md` — pack notes and a standalone proofreading prompt.

`prepare` writes a workspace under `./proofreading/reviews/<client>/<run-id>/` containing `site-pack/` (a copy of the pack), `batches/` (review prompts), `reports/pages/` (per-page placeholders), severity-first templates, and a `merge-prompt.md`. See [docs/review-workflow.md](docs/review-workflow.md).

## Screenshots and sticky elements

`extract` captures full-page screenshots. Sticky or fixed elements — sticky headers, cookie bars, chat widgets — can otherwise repeat down the stitched full-page image. List their CSS selectors under `extract.exclude_selectors` in your config to hide them in the screenshots:

```yaml
extract:
  exclude_selectors:
    - 'header[data-elementor-type="header"] .elementor-sticky'
    - '.cookie-banner'
```

Note that the same selectors also remove those elements from the **extracted copy**, so don't exclude something whose text you still want proofread. See [docs/extract-config-reference.md](docs/extract-config-reference.md) for the defaults and more examples.

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

`proofread` (whether linked via `npm link` or run as `node dist/cli.js`) executes the compiled output in `dist/`, which is gitignored. After pulling changes that touch `src/`, run `npm run build` so the command reflects the latest source — otherwise it keeps running stale code (for example, prompting with an old default path). To skip the rebuild during development, run against the TypeScript source directly with `npm run dev -- <command>` (for example `npm run dev -- init`).

The test suite includes a Playwright-backed Unicode extraction regression; in restricted environments, browser launch may need elevated permission.

## Limitations

- The tool reads only sitemap-listed pages and never logs in, so staging sites behind a login or HTTP authentication can't be reached yet (see [Safety boundaries](#safety-boundaries)).
- Extraction warnings (short pages, missing titles, possible encoding issues) are quality hints to help you spot gaps — they are not proofreading findings, and can be a little noisy.
- A built-in, model-backed `review` step is planned; for now your own AI agent performs the review.
