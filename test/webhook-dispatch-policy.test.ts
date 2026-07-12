/**
 * Unit tests for the merchant and endpoint lifecycle gate used by the
 * outbound webhook dispatcher.
 */

import { describe, expect, it } from "bun:test";
import { isWebhookDispatchAllowed } from "@/lib/webhooks/dispatch-policy";

describe("webhook dispatch lifecycle policy", () => {
  it("allows delivery only for an active merchant and active endpoint", () => {
    expect(
      isWebhookDispatchAllowed({
        endpointStatus: "active",
        merchantStatus: "active",
      }),
    ).toBe(true);
  });

  it("skips delivery when store deactivation disables the endpoint", () => {
    expect(
      isWebhookDispatchAllowed({
        endpointStatus: "disabled",
        merchantStatus: "deactivated",
      }),
    ).toBe(false);
  });

  it("also blocks an active endpoint for a non-active merchant", () => {
    expect(
      isWebhookDispatchAllowed({
        endpointStatus: "active",
        merchantStatus: "under_review",
      }),
    ).toBe(false);
  });
});
