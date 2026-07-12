/**
 * Unit tests for role-based authorization of sensitive merchant mutations.
 */

import { describe, expect, it } from "bun:test";
import {
  ForbiddenRoleError,
  type MerchantContext,
  requireRole,
} from "@/lib/dashboard/server";
import type { MerchantRole } from "@/lib/dashboard/types";

function createContext(role: MerchantRole): MerchantContext {
  return {
    email: "member@example.com",
    merchant: {
      description: null,
      logoUrl: null,
      merchantId: "merchant_123",
      publicSlug: "merchant",
      role,
      status: "active",
      storeName: "Merchant",
      supportEmail: null,
      unreadNotifications: 0,
      userAvatarColor: null,
      userFullName: "Merchant User",
      verificationStatus: "verified",
    },
    role,
    userId: "user_123",
  };
}

describe("sensitive merchant role authorization", () => {
  it("allows owner and admin roles", () => {
    expect(() =>
      requireRole(createContext("owner"), ["owner", "admin"]),
    ).not.toThrow();
    expect(() =>
      requireRole(createContext("admin"), ["owner", "admin"]),
    ).not.toThrow();
  });

  it("rejects member and viewer roles with FORBIDDEN_ROLE", () => {
    for (const role of ["member", "viewer"] as const) {
      expect(() =>
        requireRole(createContext(role), ["owner", "admin"]),
      ).toThrow("Only merchant owners and admins can perform this action.");

      try {
        requireRole(createContext(role), ["owner", "admin"]);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenRoleError);
        expect((error as ForbiddenRoleError).code).toBe("FORBIDDEN_ROLE");
      }
    }
  });
});
