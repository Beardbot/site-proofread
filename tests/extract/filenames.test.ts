import { describe, expect, it } from "vitest";
import { pageFileStem } from "../../src/extract/filenames.js";

describe("pageFileStem", () => {
  it("uses home for the root URL", () => {
    expect(pageFileStem("https://example.com/", 0)).toBe("001-home");
  });

  it("uses readable path slugs", () => {
    expect(pageFileStem("https://example.com/services/web-design/", 11)).toBe(
      "012-services-web-design"
    );
  });
});
