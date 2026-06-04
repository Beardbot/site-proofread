import { describe, expect, it } from "vitest";
import {
  containsMojibake,
  findMojibakeSignatures,
  MOJIBAKE_SIGNATURES,
  renderMojibakeWarning
} from "../../src/shared/mojibake.js";

// Mojibake byte runs built from explicit code points so the test does not depend
// on the encoding of this file.
const APOSTROPHE = String.fromCodePoint(0x00e2, 0x20ac, 0x2122); // was U+2019
const LEFT_DOUBLE_QUOTE = String.fromCodePoint(0x00e2, 0x20ac, 0x0153); // was U+201C
const BARE_LEAD_IN = String.fromCodePoint(0x00e2, 0x20ac);
const CLEAN_APOSTROPHE = String.fromCodePoint(0x2019);

describe("shared mojibake detection", () => {
  it("flags common mojibake runs and ignores clean smart punctuation", () => {
    expect(containsMojibake(`Patients don${APOSTROPHE}t wait`)).toBe(true);
    expect(containsMojibake(`Clean smart apostrophe: don${CLEAN_APOSTROPHE}t`)).toBe(false);
  });

  it("covers the broadened review signatures (left double quote and bare lead-in)", () => {
    // The union now matches the extract lane, so review detection picks these up
    // where the old shorter review list did not.
    expect(MOJIBAKE_SIGNATURES).toContain(LEFT_DOUBLE_QUOTE);
    expect(MOJIBAKE_SIGNATURES).toContain(BARE_LEAD_IN);
    expect(findMojibakeSignatures(`Smart ${LEFT_DOUBLE_QUOTE}quote`)).toContain(LEFT_DOUBLE_QUOTE);
  });

  it("renders a deduplicated UTF-8 verification warning", () => {
    expect(renderMojibakeWarning([APOSTROPHE, APOSTROPHE])).toBe(
      `Likely mojibake detected in extracted content: ${APOSTROPHE}. Verify the UTF-8 file contents before treating this as a proofreading issue.`
    );
  });
});
