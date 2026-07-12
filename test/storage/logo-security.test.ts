/**
 * Regression tests for logo upload and public asset access policy.
 */

import { describe, expect, it, mock } from "bun:test";
import {
  getStoreLogoObject,
  type StoreLogoObjectDependencies,
} from "@/lib/dashboard/server";
import {
  ALLOWED_LOGO_CONTENT_TYPES,
  isAllowedLogoContentType,
} from "@/lib/storage/logo-policy";

describe("logo security policy", () => {
  it("rejects SVG uploads while allowing supported raster images", () => {
    const maliciousSvg = new File(
      ["<svg><script>alert(1)</script></svg>"],
      "logo.svg",
      { type: "image/svg+xml" },
    );

    expect(isAllowedLogoContentType(maliciousSvg.type)).toBe(false);
    expect(ALLOWED_LOGO_CONTENT_TYPES.has("image/svg+xml")).toBe(false);
    expect(isAllowedLogoContentType("image/png")).toBe(true);
  });

  it("does not fetch an orphaned asset when it is not the current merchant logo", async () => {
    const getObject = mock(async () => ({
      buffer: new Uint8Array([1, 2, 3]),
      contentType: "image/png",
    }));
    const sql = mock(async () => []);

    const dependencies = {
      connectToDatabase: async () => ({
        release: async () => undefined,
        sql,
      }),
      getObject,
    } as unknown as StoreLogoObjectDependencies;

    const result = await getStoreLogoObject(
      "11111111-1111-4111-8111-111111111111",
      dependencies,
    );

    expect(result).toBeNull();
    expect(getObject).not.toHaveBeenCalled();
    expect(sql).toHaveBeenCalledTimes(1);
    expect(String(sql.mock.calls[0]?.[0])).toContain("join merchants");
    expect(String(sql.mock.calls[0]?.[0])).toContain("m.status = 'active'");
    expect(String(sql.mock.calls[0]?.[0])).toContain("fa.mime_type in");
  });
});
