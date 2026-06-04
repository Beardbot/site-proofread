// Canonical slug generation shared by both lanes. Strips diacritics via NFKD so
// accented names normalise to ASCII (e.g. "Café" -> "cafe"). Callers pass
// their own fallback for when the input is empty or slugifies to nothing.

// Combining Diacritical Marks block (U+0300–U+036F), built from code points so
// this source file stays ASCII-only and the range cannot be mangled by editor
// or shell encoding.
const COMBINING_DIACRITICS = new RegExp(
  `[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`,
  "g"
);

export function slugify(value: string | undefined, fallback = ""): string {
  if (!value) return fallback;
  const slug = value
    .normalize("NFKD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}
