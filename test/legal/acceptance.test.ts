/**
 * Unit tests for signup legal-acceptance validation and timestamp handling.
 */

import { describe, expect, it } from "bun:test";
import {
  applyServerLegalAcceptance,
  hasRequiredSignupLegalAcceptance,
  LEGAL_ACCEPTANCE_REQUIRED_MESSAGE,
} from "@/lib/legal/acceptance";

describe("signup legal acceptance", () => {
  it("rejects a signup when either acknowledgement is missing", () => {
    expect(
      hasRequiredSignupLegalAcceptance({
        privacyAccepted: true,
        termsAccepted: false,
      }),
    ).toBe(false);
    expect(
      hasRequiredSignupLegalAcceptance({
        termsAccepted: true,
      }),
    ).toBe(false);
    expect(LEGAL_ACCEPTANCE_REQUIRED_MESSAGE).toContain("Terms of Service");
  });

  it("accepts explicit JSON and form-encoded acknowledgement flags", () => {
    expect(
      hasRequiredSignupLegalAcceptance({
        privacyAccepted: true,
        termsAccepted: true,
      }),
    ).toBe(true);
    expect(
      hasRequiredSignupLegalAcceptance({
        privacyAccepted: "true",
        termsAccepted: "true",
      }),
    ).toBe(true);
  });

  it("replaces client timestamps with the server acceptance timestamp", () => {
    const acceptedAt = new Date("2026-07-12T10:00:00.000Z");
    const payload = applyServerLegalAcceptance(
      {
        privacyAccepted: true,
        privacyAcceptedAt: "1999-01-01T00:00:00.000Z",
        termsAccepted: true,
        termsAcceptedAt: "1999-01-01T00:00:00.000Z",
      },
      acceptedAt,
    );

    expect(payload.privacyAcceptedAt).toBe(acceptedAt.toISOString());
    expect(payload.termsAcceptedAt).toBe(acceptedAt.toISOString());
  });
});
