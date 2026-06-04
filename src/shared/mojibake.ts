// Canonical mojibake detection shared by both lanes (extract QA warnings and
// review pack scanning). Signatures are written as Unicode escapes so the file
// stays byte-correct regardless of editor/shell encoding on Windows.
//
// These are the patterns that appear when UTF-8 punctuation is mis-decoded as
// Windows-1252 (e.g. a smart apostrophe rendered as the three-character run
// U+00E2 U+20AC U+2122).

export const MOJIBAKE_WARNING_PREFIX = "Likely mojibake detected in extracted content";

export const MOJIBAKE_SIGNATURES = [
  "â€™", // right single quote / apostrophe (U+2019)
  "â€œ", // left double quote (U+201C)
  "â€", // bare lead-in shared by 3-byte UTF-8 punctuation
  "â€“", // en dash (U+2013, via CP1252 0x93 -> U+201C)
  "Ã", // A-tilde lead byte for 2-byte UTF-8 sequences
  "Â", // A-circumflex lead byte for 2-byte UTF-8 sequences
  "�" // Unicode replacement character
] as const;

export function containsMojibake(value: string): boolean {
  return MOJIBAKE_SIGNATURES.some((signature) => value.includes(signature));
}

export function findMojibakeSignatures(content: string): string[] {
  return MOJIBAKE_SIGNATURES.filter((signature) => content.includes(signature));
}

export function renderMojibakeWarning(signatures: string[]): string {
  const uniqueSignatures = [...new Set(signatures)];
  return `${MOJIBAKE_WARNING_PREFIX}: ${uniqueSignatures.join(", ")}. Verify the UTF-8 file contents before treating this as a proofreading issue.`;
}
