# Review Workflow

`site-proofread prepare-review` prepares a Codex-ready review workspace from a `site-proofread extract` output pack. It does not call an AI model, crawl websites, open a browser, or edit website content.

## Normal Client Workflow

1. Run `site-proofread extract` for the client.
2. Confirm the extracted pack exists at:

   ```text
   ./proofreading/extracts/<client-name>
   ```

3. From this repo, prepare the review workspace:

   ```bash
   npm run prepare-review -- <client-name>
   ```

   If the CLI has been linked with `npm link`, you can use:

   ```bash
   site-proofread prepare-review <client-name>
   ```

4. Open the `site-proofread` project root as the Codex workspace. The generated review workspace path is:

   ```text
   ./proofreading/reviews/<client-slug>/<run-id>
   ```

5. Tell Codex with the generated kick-off prompt. For the default archive path, it will look like:

   ```text
   Use the review instructions in `proofreading/reviews/<client-slug>/<run-id>/AGENTS.md`.

   Proofread the prepared site package in `proofreading/reviews/<client-slug>/<run-id>/site-pack`.

   Review mode: Full proofreading review.

   Create the page reports in `proofreading/reviews/<client-slug>/<run-id>/reports/pages`, then create `proofreading/reviews/<client-slug>/<run-id>/reports/final-report.md`.

   Do not crawl the live website.
   Do not rewrite for style.
   Only report likely launch-quality copy issues.
   ```

   The command prints the full prompt in the terminal and also saves it in `codex-kickoff-prompt.md` inside the generated review workspace.

6. Codex should use each batch prompt in `batches/` to complete the matching page reports in `reports/pages/`, then create:

   ```text
   reports/final-report.md
   ```

7. Review the final report. High severity findings appear first in `Immediate attention`, and all findings are ordered High, Medium, then Low.

## Review Modes

The default mode is a full proofreading review:

```bash
site-proofread prepare-review <client-name> --mode full
```

For a short pre-launch check, use basic mode:

```bash
site-proofread prepare-review <client-name> --mode basic
```

Basic mode is designed for quick launch QA. It asks Codex to flag glaring spelling mistakes, basic grammar errors, obvious punctuation errors, broken or truncated visible sentences, placeholder text, staging/test copy, and other issues that would look clearly wrong immediately before launch. It avoids deeper style, tone, minor phrasing, broad consistency, SEO metadata, and image alt text unless the issue is obvious and launch-critical.

## Excluding Pages From Review

Templated boilerplate that is identical across client sites — privacy policy, terms and conditions, and similar — usually does not need proofreading on every run. Add an `excluded_pages` list to your config file to skip it:

```yaml
# site-proofread.config.yml (in the directory you run prepare-review from)
excluded_pages:
  - privacy-policy        # substring match against URL/file/slug
  - /terms-conditions/    # exact path
  - "*/legal/*"           # glob
```

The tool reads `site-proofread.config.yml` (or `.yaml`) from the current directory by default, so one shared file covers every client; pass `--config <file>` to use a different one, or set `excluded_pages` in the `manifest.json` `config.proofreading` block. Values from the manifest and the config file are merged.

Excluded pages are still copied into `site-pack/` for reference, but get no batch prompt and no page report. They are listed under `Excluded From Review` in `manual-review-notes.md` and an `Excluded from review` section in the final report, so an exclusion is always visible rather than silent.

Because `site-pack/pages/` can therefore include pages that are out of scope, the batch prompts and `merge-prompt.md` — not the `site-pack/pages/` listing — define which pages the review agent should report on.

## Encoding Safeguards

`prepare-review` reads text pack files as UTF-8 and preserves valid smart punctuation, curly quotes, and en dashes through the copied `site-pack/` files and generated prompts.

Some terminals may display valid UTF-8 smart punctuation as mojibake. The generated review instructions tell Codex to verify actual UTF-8 file contents before reporting any mojibake as a proofreading issue.

The severity badges (🔴 🟠 🟡) in the templates are also valid UTF-8 emoji that can render as boxes or mojibake in some terminals; the instructions tell agents to copy them verbatim and not treat them as corruption. To verify content, read files directly (or with a non-interactive Node script using explicit `utf8`) rather than judging by terminal output. Do not start an interactive REPL (the in-app Node REPL or PowerShell) to inspect content; these are routinely blocked in sandboxes, so use a direct file read or a non-interactive Node command instead.

Generated review instructions also tell Codex to write page reports and final reports as UTF-8, preserve smart punctuation copied from source text, and scan finished reports for suspicious `?` characters that may have replaced quotes, apostrophes, or dashes.

On Windows, avoid PowerShell for report generation when copied source text contains smart punctuation. Windows PowerShell can read script files with the wrong encoding, treat smart quotes as string delimiters, or lose `$` variables through nested command quoting. Prefer `apply_patch` for small report edits, or a temporary Node.js `.mjs` script that reads and writes files with explicit `utf8` encoding for bulk report generation.

When a generation script builds report Markdown inside a JavaScript template literal, the Markdown's own backticks and dollar-brace sequences will end or interpolate the literal; escape them, or sidestep the issue by assembling the report from an array of lines joined with newlines or by reading the Markdown from a data file. Write the severity badges from their Unicode code points (U+1F534, U+1F7E0, U+1F7E1) rather than pasting the emoji to keep the script source ASCII-safe.

The tool scans input pack text files for likely mojibake signatures such as `â€™`, `â€“`, `Ã`, `Â`, and `�`. Confirmed signatures are surfaced as extraction/manual-review warnings in `manual-review-notes.md` and page warning context.

## Default Path Inference

When you pass a client name, the CLI resolves input from:

```text
./proofreading/extracts/<client-name>
```

The output archive path is inferred as:

```text
./proofreading/reviews/<client-slug>/<run-id>
```

`<client-slug>` is inferred from `manifest.json.site.name`, then falls back to the input folder name.

`<run-id>` is inferred from `manifest.json.extractionDate`, then falls back to today's date.

Running `prepare-review` overwrites the selected output workspace so stale prompts and reports do not linger between runs.

## Custom Paths

Use `--input` when the pack is not under the normal `./proofreading/extracts` folder:

```bash
npm run prepare-review -- --input D:/path/to/custom-pack
```

Change the normal input/output roots:

```bash
site-proofread prepare-review client-name --input-root path/to/extracts --out-root path/to/reviews
```

Set a custom run folder:

```bash
site-proofread prepare-review client-name --run-id 2026-06-03-round-2
```

Override the final workspace path completely:

```bash
site-proofread prepare-review --input ./pack --out ./review-workspace
```

Use either a client name or `--input`, not both.

## Install And Linking

Inside this repo, after dependencies are installed and the project is built, no global link is required:

```bash
npm install
npm run build
npm run prepare-review -- client-name
```

You only need `npm install` again after a fresh clone, missing `node_modules/`, or dependency changes.

Re-run `npm run build` after pulling changes that touch `src/`: the linked command runs the compiled output in the gitignored `dist/`, so without a rebuild it keeps running stale code (for example, prompting with an old default path).

Use `npm link` only if you want the bare command available from other terminal locations:

```bash
npm link
site-proofread prepare-review client-name
```

## Generated Workspace

The default generated workspace path is:

```text
proofreading/reviews/<client-slug>/<run-id>/
```

Inside that folder:

```text
AGENTS.md
README.md
codex-kickoff-prompt.md
review-prompt.md
report-template.md
page-report-template.md
manual-review-notes.md
merge-prompt.md
site-pack/
  README.md
  manifest.md
  manifest.json
  proofreading-input.md
  agent-proofreading-prompt.md (when present)
  pages/
  screenshots/ (when present)
batches/
  batch-001-prompt.md
  batch-002-prompt.md
reports/
  pages/
    001-home-report.md
    002-privacy-policy-report.md
  final-report.md
```

The number of batch prompt files depends on the size of the extracted pack. Small packs still get one batch prompt. Each extracted page gets one page report placeholder under `reports/pages/`, and each page report includes the extracted page URL as a Markdown link for the person fixing content.

`site-pack/agent-proofreading-prompt.md` and `site-pack/screenshots/` are copied when they exist in the input pack.

`site-pack/` is a self-contained copy of the extracted content pack. `batches/` contains the prompts Codex should review. `reports/pages/` contains matching placeholder page reports, and `reports/final-report.md` is the merged report. Each placeholder starts with a `_Pending._` marker and is meant to be completed (its body replaced), not treated as an existing draft to verify.

The generated report templates are severity-first for launch triage. Page reports and the final report open with a summary table and an `Immediate attention` section for High severity findings, then list findings from High to Low. Each finding uses a severity-badged heading (🔴 High, 🟠 Medium, 🟡 Low) with a short title, blockquoted `Current:` and `Suggested:` text, and an italic one-line reason. `---` dividers separate every finding and section so the boundaries between pages, issues, and severity levels are easy to scan.

The templates include an output encoding check so completed reports preserve UTF-8 punctuation and do not silently replace quotes, apostrophes, en dashes, or em dashes with `?` characters.

When a generated workspace has many page reports, a scripted merge can be useful. Use Node.js with explicit UTF-8 reads/writes for this. Avoid `powershell -File` for scripts that contain copied source text, curly quotes, en dashes, or emoji; if PowerShell is unavoidable, keep the script ASCII-only and explicitly control file encoding.

## Agent Completion Checklist

The generated `AGENTS.md` includes a "Before You Finish" checklist the review agent should run before reporting completion. It captures the discovery work that otherwise has to be re-derived each run:

- Treat the existing `reports/pages/*.md` and `reports/final-report.md` files as `_Pending._` placeholders to complete, not drafts to verify.
- Replace every `_Pending._` marker and remove template tokens such as `[short finding title]`, `[exact current text]`, and `[suggested correction]`.
- Use the batch prompts and `merge-prompt.md` as the authoritative scope; `site-pack/pages/` can include excluded pages (for example a privacy policy) with no report.
- Keep `Current:` excerpts exact — no ellipses or shortened quotes.
- Confirm no `?` characters replaced smart punctuation, and the 🔴 🟠 🟡 severity badges are intact.
