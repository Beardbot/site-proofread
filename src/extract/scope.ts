import type { AuditConfig, FilteredUrls } from "./types.js";

export const BLOCKED_PATH_FRAGMENTS = [
  "/wp-admin",
  "/wp-login.php",
  "/admin",
  "/login",
  "/dashboard"
];

export function filterUrlsForScope(urls: string[], config: AuditConfig): FilteredUrls {
  const allowed: string[] = [];
  const skipped = [];
  const seen = new Set<string>();
  const allowedHosts = new Set(config.scope.allowed_hosts.map((host) => host.toLowerCase()));

  for (const rawUrl of urls) {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      skipped.push({ url: rawUrl, reason: "Invalid URL." });
      continue;
    }

    const normalized = parsed.href;
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    if (!allowedHosts.has(parsed.host.toLowerCase())) {
      skipped.push({ url: normalized, reason: `Host not allowed: ${parsed.host}` });
      continue;
    }

    const path = parsed.pathname.toLowerCase();
    const blockedFragment = config.scope.block_admin_paths
      ? BLOCKED_PATH_FRAGMENTS.find((fragment) => path.includes(fragment))
      : undefined;
    if (blockedFragment) {
      skipped.push({ url: normalized, reason: `Blocked admin/login path: ${blockedFragment}` });
      continue;
    }

    allowed.push(normalized);
  }

  return { allowed, skipped };
}
