/**
 * Regression coverage for the global admin allow-list boundary and its API
 * error mapping. Merchant membership alone must never satisfy this check.
 */

import { describe, expect, it } from "bun:test";
import { adminErrorResponse } from "@/lib/admin/http";
import {
  AdminAuthorizationError,
  isAdminAccessGranted,
} from "@/lib/admin/server";

describe("admin authorization boundary", () => {
  it("rejects an authenticated merchant profile without an active admin row", () => {
    expect(
      isAdminAccessGranted({
        adminRowFound: false,
        authenticated: true,
        profileFound: true,
      }),
    ).toBe(false);
  });

  it("requires both an authenticated profile and an active admin row", () => {
    expect(
      isAdminAccessGranted({
        adminRowFound: true,
        authenticated: false,
        profileFound: true,
      }),
    ).toBe(false);
    expect(
      isAdminAccessGranted({
        adminRowFound: true,
        authenticated: true,
        profileFound: false,
      }),
    ).toBe(false);
    expect(
      isAdminAccessGranted({
        adminRowFound: true,
        authenticated: true,
        profileFound: true,
      }),
    ).toBe(true);
  });

  it("maps a valid merchant session without admin access to HTTP 403", async () => {
    const response = adminErrorResponse(
      new AdminAuthorizationError(),
      "ADMIN_ACCESS_FAILED",
    );

    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("ADMIN_ACCESS_DENIED");
  });
});
