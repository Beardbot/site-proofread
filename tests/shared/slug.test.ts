import { describe, expect, it } from "vitest";
import { slugify } from "../../src/shared/slug.js";

// Accented inputs built from code points so the test does not depend on the
// encoding of this file. "Cafe" + combining acute, "Adelaide" with accents.
const CAFE = `Caf${String.fromCharCode(0x00e9)} Care`;
const ADELAIDE = `Ad${String.fromCharCode(0x00e9)}la${String.fromCharCode(0x00ef)}de Clinic`;

describe("shared slugify", () => {
  it("lowercases, hyphenates, and strips diacritics via NFKD", () => {
    expect(slugify(CAFE)).toBe("cafe-care");
    expect(slugify(ADELAIDE)).toBe("adelaide-clinic");
    expect(slugify("Test Site")).toBe("test-site");
  });

  it("returns the caller-provided fallback for empty or non-sluggable input", () => {
    expect(slugify("", "proofread")).toBe("proofread");
    expect(slugify(undefined, "proofread")).toBe("proofread");
    expect(slugify("!!!", "proofread")).toBe("proofread");
  });

  it("defaults to an empty fallback when none is provided", () => {
    expect(slugify("")).toBe("");
    expect(slugify(undefined)).toBe("");
    expect(slugify("---")).toBe("");
  });
});
