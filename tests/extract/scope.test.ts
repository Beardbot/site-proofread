import { describe, expect, it } from "vitest";
import { mergeConfig } from "../../src/extract/config.js";
import { filterUrlsForScope } from "../../src/extract/scope.js";

describe("filterUrlsForScope", () => {
  const config = mergeConfig({
    site: { staging_url: "https://staging.example.com", name: "Example" },
    sitemaps: ["https://staging.example.com/sitemap.xml"],
    scope: { allowed_hosts: ["staging.example.com"], block_admin_paths: true }
  });

  it("allows configured hosts and skips external hosts", () => {
    const result = filterUrlsForScope(
      ["https://staging.example.com/about/", "https://other.example.com/about/"],
      config
    );

    expect(result.allowed).toEqual(["https://staging.example.com/about/"]);
    expect(result.skipped).toEqual([
      { url: "https://other.example.com/about/", reason: "Host not allowed: other.example.com" }
    ]);
  });

  it("skips admin and login paths", () => {
    const result = filterUrlsForScope(
      ["https://staging.example.com/wp-admin/", "https://staging.example.com/login/"],
      config
    );

    expect(result.allowed).toEqual([]);
    expect(result.skipped.map((item) => item.reason)).toEqual([
      "Blocked admin/login path: /wp-admin",
      "Blocked admin/login path: /login"
    ]);
  });
});
