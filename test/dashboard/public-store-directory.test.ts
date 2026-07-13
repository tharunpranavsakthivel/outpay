/**
 * Regression tests for the public store-directory eligibility contract.
 */

import { describe, expect, it } from "bun:test";
import { isPublicStoreEligible } from "@/lib/dashboard/server";

describe("public store directory eligibility", () => {
  it("includes active merchants that opted into the directory", () => {
    expect(
      isPublicStoreEligible({
        isDirectoryListed: true,
        status: "active",
      }),
    ).toBe(true);
  });

  it("excludes merchants that have not opted in", () => {
    expect(
      isPublicStoreEligible({
        isDirectoryListed: false,
        status: "active",
      }),
    ).toBe(false);
  });

  it("excludes deactivated merchants even when the flag remains enabled", () => {
    expect(
      isPublicStoreEligible({
        isDirectoryListed: true,
        status: "deactivated",
      }),
    ).toBe(false);
  });
});
