import { describe, expect, it } from "vitest";
import { mergeDictionaryConfig } from "../../src/review/config.js";
import {
  renderAgentsMd,
  renderBatchPrompt,
  renderDictionary,
  renderKickoffPrompt,
  renderReplacements
} from "../../src/review/prompts.js";
import type { RawDictionaryConfig, ReplacementRule, ReviewBatch } from "../../src/review/types.js";

describe("mergeDictionaryConfig replacements", () => {
  it("normalizes a rule with defaults", () => {
    const config = mergeDictionaryConfig(undefined, {
      replacements: [{ find: "expert", replace: "experienced" }]
    } as RawDictionaryConfig);

    expect(config.replacements).toEqual([
      {
        find: "expert",
        replace: "experienced",
        when: undefined,
        match: "whole-word",
        case: "insensitive",
        preserveCase: true,
        severity: "medium",
        reason: undefined
      }
    ]);
  });

  it("carries condition, matching, severity, and reason through", () => {
    const config = mergeDictionaryConfig(undefined, {
      replacements: [
        {
          find: "expert",
          replace: "experienced",
          when: "only when qualifying lawyer or advice",
          match: "substring",
          case: "sensitive",
          preserve_case: false,
          severity: "high",
          reason: "House style"
        }
      ]
    } as RawDictionaryConfig);

    expect(config.replacements[0]).toMatchObject({
      when: "only when qualifying lawyer or advice",
      match: "substring",
      case: "sensitive",
      preserveCase: false,
      severity: "high",
      reason: "House style"
    });
  });

  it("drops rules with no find term and defaults unknown enum values", () => {
    const config = mergeDictionaryConfig(undefined, {
      replacements: [
        { replace: "experienced" },
        { find: "  ", replace: "x" },
        { find: "expert", match: "fuzzy", case: "loose", severity: "critical" }
      ]
    } as unknown as RawDictionaryConfig);

    expect(config.replacements).toHaveLength(1);
    expect(config.replacements[0]).toMatchObject({
      find: "expert",
      match: "whole-word",
      case: "insensitive",
      severity: "medium"
    });
  });

  it("allows an empty replacement (deletion)", () => {
    const config = mergeDictionaryConfig(undefined, {
      replacements: [{ find: "expert" }]
    } as RawDictionaryConfig);

    expect(config.replacements[0].replace).toBe("");
  });

  it("defaults to no replacements when unset", () => {
    const config = mergeDictionaryConfig(undefined, {});
    expect(config.replacements).toEqual([]);
  });
});

describe("renderReplacements", () => {
  it("renders each rule with its condition and reason", () => {
    const rules: ReplacementRule[] = [
      {
        find: "expert",
        replace: "experienced",
        when: "only when qualifying lawyer or advice",
        match: "whole-word",
        case: "insensitive",
        preserveCase: true,
        severity: "medium",
        reason: "House style"
      }
    ];

    const output = renderReplacements(rules);
    expect(output).toContain('Replace "expert" with "experienced" (medium severity).');
    expect(output).toContain("match whole words only, case-insensitive; preserve the original capitalisation");
    expect(output).toContain("Apply only when: only when qualifying lawyer or advice");
    expect(output).toContain("Reason to record on findings: House style");
  });

  it("renders a placeholder when there are no rules", () => {
    expect(renderReplacements([])).toBe("_None._");
  });
});

describe("targeted mode prompts", () => {
  const dictionary = mergeDictionaryConfig(undefined, {
    replacements: [
      {
        find: "expert",
        replace: "experienced",
        when: "only when qualifying lawyer or advice"
      }
    ]
  } as RawDictionaryConfig);

  it("labels AGENTS.md as a targeted pass and lists the rule", () => {
    const agents = renderAgentsMd(dictionary, "targeted");
    expect(agents).toContain("Directed replacement pass");
    expect(agents).toContain("apply ONLY these replacements and report nothing else");
    expect(agents).toContain('Replace "expert" with "experienced"');
  });

  it("keeps meta titles/descriptions and alt text in scope for the replacement", () => {
    const agents = renderAgentsMd(dictionary, "targeted");
    // The targeted pass suppresses other kinds of issue, but the term must still
    // be replaced wherever it appears, including meta and alt text surfaces.
    expect(agents).toContain("meta titles and descriptions, and image alt text");
    expect(agents).toContain("a qualifying term in a meta description or alt text is still in scope");
    expect(agents).not.toMatch(/capitalisation, metadata, alt text/);
  });

  it("keeps the general review goal for full mode but still lists rules", () => {
    const agents = renderAgentsMd(dictionary, "full");
    expect(agents).toContain("Apply these replacements in addition to the rest of the review.");
    expect(agents).toContain('Replace "expert" with "experienced"');
  });

  it("includes the directed replacements in batch prompts via the dictionary", () => {
    const batch: ReviewBatch = {
      index: 1,
      name: "batch-001",
      promptFile: "batches/batch-001-prompt.md",
      pages: [
        {
          title: "Home",
          url: "https://example.com/",
          file: "pages/001-home.md",
          sourcePath: "pages/001-home.md",
          workspacePath: "site-pack/pages/001-home.md",
          reportFile: "reports/pages/home-report.md",
          content: "Our expert lawyers provide expert advice.",
          warnings: [],
          estimatedChars: 40
        }
      ],
      estimatedChars: 40
    };

    const prompt = renderBatchPrompt(batch, 1, dictionary, "_None._", "targeted");
    expect(prompt).toContain("Directed replacement pass");
    expect(prompt).toContain('Replace "expert" with "experienced"');
    expect(renderDictionary(dictionary)).toContain("Directed replacements:");
  });
});

describe("plain-language goal", () => {
  const goal = "Change 'expert' to 'experienced' only when qualifying 'lawyer' or 'advice'.";

  it("normalizes and CLI-overrides the goal", () => {
    const fromConfig = mergeDictionaryConfig(undefined, { goal: "  from config  " } as RawDictionaryConfig);
    expect(fromConfig.goal).toBe("from config");

    const unset = mergeDictionaryConfig(undefined, {});
    expect(unset.goal).toBeUndefined();
  });

  it("AGENTS.md tells the agent to compile, save, and confirm the scope in targeted mode", () => {
    const dictionary = mergeDictionaryConfig(undefined, { goal } as RawDictionaryConfig);
    const agents = renderAgentsMd(dictionary, "targeted");

    expect(agents).toContain("Change goal (plain language):");
    expect(agents).toContain(goal);
    expect(agents).toContain("compile this goal into an explicit, corpus-grounded scope");
    expect(agents).toContain("reports/scope-plan.md");
    expect(agents).toContain("wait for confirmation");
  });

  it("treats configured rules as a starting set when a goal is also present", () => {
    const dictionary = mergeDictionaryConfig(undefined, {
      goal,
      replacements: [{ find: "expert", replace: "experienced" }]
    } as RawDictionaryConfig);
    const agents = renderAgentsMd(dictionary, "targeted");

    expect(agents).toContain("A starting rule set derived from the goal is provided below");
    expect(agents).toContain('Replace "expert" with "experienced"');
  });

  it("puts the compile-and-confirm step in the targeted kickoff prompt", () => {
    const prompt = renderKickoffPrompt("proofreading/reviews/x/2026-07-08", "targeted", goal);
    expect(prompt).toContain(`Targeted goal: ${goal}`);
    expect(prompt).toContain("reports/scope-plan.md");
    expect(prompt).toContain("confirm it with me before starting the review");
  });

  it("omits the compile step from the kickoff prompt in non-targeted modes", () => {
    const prompt = renderKickoffPrompt("proofreading/reviews/x/2026-07-08", "full", goal);
    expect(prompt).not.toContain("scope-plan.md");
    expect(prompt).not.toContain("Targeted goal:");
  });
});
