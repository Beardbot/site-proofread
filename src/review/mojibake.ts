export const MOJIBAKE_WARNING_PREFIX = "Likely mojibake detected in extracted content";

const MOJIBAKE_SIGNATURES = [
  "\u00e2\u20ac\u2122",
  "\u00e2\u20ac\u201c",
  "\u00c3",
  "\u00c2",
  "\ufffd"
] as const;

export function findMojibakeSignatures(content: string): string[] {
  return MOJIBAKE_SIGNATURES.filter((signature) => content.includes(signature));
}

export function renderMojibakeWarning(signatures: string[]): string {
  const uniqueSignatures = [...new Set(signatures)];
  return `${MOJIBAKE_WARNING_PREFIX}: ${uniqueSignatures.join(", ")}. Verify the UTF-8 file contents before treating this as a proofreading issue.`;
}
