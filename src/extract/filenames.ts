export function pageFileStem(url: string, index: number): string {
  const parsed = new URL(url);
  const slug = slugFromUrl(parsed);
  return `${String(index + 1).padStart(3, "0")}-${slug}`;
}

function slugFromUrl(url: URL): string {
  const path = url.pathname.replace(/\/+$/, "");
  if (!path || path === "/") return "home";

  const parts = path
    .split("/")
    .filter(Boolean)
    .map((part) => part.replace(/\.[a-z0-9]+$/i, ""));

  const joined = parts.join("-");
  const cleaned = joined
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return cleaned || "page";
}
