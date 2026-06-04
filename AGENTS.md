# Agent Guide

This repo is a local Node.js + TypeScript CLI for internal pre-launch website copy QA. It has two stages in one tool: **extract** (Playwright extraction into a Markdown content pack) and **prepare-review** (deterministic proofreading review workspace generation).

It is the consolidation of the former `site-copy-audit` and `proofread-agent` repos. Both lanes were merged behaviour-preserving; see "Deferred follow-ups" below for what was intentionally left for later commits.

## Mission And Non-Goals

The tool must:

- **Extract lane:** treat configured sitemap URLs as the source of truth; visit only sitemap-listed URLs plus one-level child sitemaps from an explicitly provided index; respect allowed hosts and blocked admin/login paths; render with Playwright and extract proofreadable copy into Markdown; capture screenshots by default; write `manifest.md`/`manifest.json`, `proofreading-input.md`, pack `README.md`, and `agent-proofreading-prompt.md`.
- **Review lane:** read an extraction pack, validate it, copy it into `site-pack/`, and generate `AGENTS.md`, batch prompts, per-page severity-first report placeholders, manual-review notes, and a merge prompt; support full and basic review modes and `excluded_pages`.

The tool must not:

- Crawl arbitrary links, nav, footer, robots.txt, or unconfigured sitemaps.
- Authenticate, access admin/dashboard areas, submit forms, or click destructive controls.
- Call AI APIs / run models, produce findings, or rewrite copy.
- Edit website content.

The model-free boundary is the default product boundary; do not add AI calls unless the product scope explicitly changes.

## Stack

- Node.js 20+, TypeScript ESM
- Commander (CLI), Playwright (extraction + screenshots), `yaml` (config), `fast-xml-parser` (sitemaps)
- Vitest (tests)

## Key Commands

```bash
npm install
npm run build
npm test
```

```bash
node dist/cli.js init
node dist/cli.js extract --config ./configs/client.yml
node dist/cli.js prepare-review client
```

## Source Map

- `src/cli.ts`: unified Commander CLI with `init`, `extract`, and `prepare-review` subcommands and the terminal progress UI.
- `src/extract/`: extraction lane (formerly `site-copy-audit/src`).
  - `config.ts`: config defaults, merge, validation, and `init` config generation.
  - `sitemap.ts`: sitemap fetch/parse and one-level index expansion.
  - `scope.ts`: URL allow-host and blocked-path filtering.
  - `run.ts`: extraction orchestration, browser lifecycle, screenshots, output writing.
  - `extractor.ts`: DOM extraction and pragmatic hidden-content handling.
  - `markdown.ts`: page Markdown, manifests, proofreading input, README, prompt renderers.
  - `warnings.ts`: extraction QA warnings (uses shared mojibake detection).
  - `filenames.ts` / `progress.ts` / `types.ts`: stable filenames, progress formatting, shared extract types.
- `src/review/`: review lane (formerly `proofread-agent/src`).
  - `run.ts`: review-workspace orchestration; `DEFAULT_INPUT_ROOT` now `./proofreading-output`.
  - `pack.ts`: pack loading/validation and copy (incl. mojibake scanning).
  - `batching.ts` / `exclusions.ts`: deterministic batching and page exclusion.
  - `prompts.ts`: review prompts, severity-first report templates, manual-review notes.
  - `config.ts`: dictionary config load/merge and default config discovery.
  - `types.ts`: review-lane types.
- `src/shared/`: cross-lane core shared by both lanes.
  - `mojibake.ts`: canonical mojibake signatures and detection/rendering helpers (union of both lanes' former lists).
  - `slug.ts`: canonical `slugify` (NFKD diacritic-stripping; caller-supplied fallback string).
- `tests/extract/`, `tests/review/`, and `tests/shared/`: focused unit tests per lane and for the shared core, plus a Playwright-backed Unicode regression under `tests/extract/`.

## Working Rules For Agents

- Preserve both safety models: the extract lane stays sitemap-only and non-destructive; the review lane stays model-free.
- Prefer small, scoped changes. Keep config and onboarding examples friendly to Windows PowerShell users.
- After every relevant change, do a documentation audit before finishing.
- Update `README.md` when CLI behaviour, command names, install steps, output behaviour, or onboarding change.
- Update `docs/extract-architecture.md` and `docs/extract-config-reference.md` when extraction, screenshots, config, or the extract output lifecycle change.
- Update `docs/review-workflow.md` when the review workflow, paths, or generated workspace contents change.
- Update this `AGENTS.md` when source files, project rules, safety boundaries, or agent workflows change.
- Keep extraction warnings as QA notes about extraction quality, not proofreading findings.
- Browser DOM text is the source of truth for HTML decoding; do not manually decode HTML entities a second time. Keep mojibake regression coverage when changing extraction, Markdown rendering, or manifest output.
- Do not treat `dist/`, `node_modules/`, `proofreading-output/`, or `proofreading-reviews/` as source.
- Do not edit generated output to fix source behaviour.

## Deferred Follow-Ups (not done in the consolidation commit)

These were intentionally left for later, behaviour-affecting commits so the merge stayed reviewable:

1. **Collapse duplicated logic into a shared core.** Mojibake detection (`extract/warnings.ts` has a longer signature list than `review/mojibake.ts`), `slugify`, and the pack/manifest types are duplicated across lanes and have drifted. Merging them changes behaviour, so each deserves its own commit.
2. **Rename generated review references.** `review/prompts.ts` still emits `proofread-agent prepare` and "Codex workspace" wording, and `review/config.ts` still auto-discovers `proofread-agent.config.yml`. Update these to `site-proofread prepare-review` / `site-proofread.config.yml` with matching test updates.
3. **Extraction-quality fixes** from the audit: scope all extraction (buttons/links/forms/images/headings) to the main content root, add staging HTTP auth with credential redaction, and quiet false-positive warnings (decorative `alt=""`, trailing-slash redirects, substring admin-path matches).
4. **Optional model-backed `review` step**, kept model-agnostic by default.
