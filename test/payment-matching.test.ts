/**
 * Unit tests for the T-6 payment-matching rule table.
 */

import { describe, expect, it } from "bun:test";
import { evaluatePaymentMatch } from "@/lib/payments/match-payment";
import { parseUsdcDecimalToUnits } from "@/lib/payments/usdc";

function buildInput(
  overrides: Partial<Parameters<typeof evaluatePaymentMatch>[0]> = {},
) {
  return {
    candidate: {
      checkoutStatus: "pending",
      confirmationsRequired: 3,
      currentConfirmations: 3,
      expectedAmountUnits: parseUsdcDecimalToUnits("49.99"),
      expectedTokenContractNormalized:
        "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      expiresAt: new Date("2026-07-08T12:00:00.000Z"),
      recipientAddressNormalized: "0x2222222222222222222222222222222222222222",
    },
    chainEvent: {
      amountUnits: parseUsdcDecimalToUnits("49.99"),
      blockTimestamp: new Date("2026-07-08T11:55:00.000Z"),
      chain: "base",
      toAddress: "0x2222222222222222222222222222222222222222",
      tokenContract: "0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913",
    },
    chainSlug: "base",
    graceWindowSeconds: 600,
    slightOverpayToleranceUnits: parseUsdcDecimalToUnits("0.01"),
    transactionAlreadyConsumed: false,
    ...overrides,
  };
}

describe("payment matching rules", () => {
  it("accepts an exact payment once the confirmation threshold is met", () => {
    expect(evaluatePaymentMatch(buildInput())).toMatchObject({
      amountPolicy: "exact",
      outcome: "accepted_paid",
    });
  });

  it("keeps an exact payment pending before the confirmation threshold", () => {
    expect(
      evaluatePaymentMatch(
        buildInput({
          candidate: {
            ...buildInput().candidate,
            currentConfirmations: 1,
          },
        }),
      ),
    ).toMatchObject({
      amountPolicy: "exact",
      outcome: "accepted_pending",
    });
  });

  it("classifies underpaid transfers", () => {
    expect(
      evaluatePaymentMatch(
        buildInput({
          chainEvent: {
            ...buildInput().chainEvent,
            amountUnits: parseUsdcDecimalToUnits("49.98"),
          },
        }),
      ),
    ).toMatchObject({
      amountPolicy: "underpaid",
      outcome: "underpaid",
    });
  });

  it("accepts slight overpayments inside the configured tolerance", () => {
    expect(
      evaluatePaymentMatch(
        buildInput({
          chainEvent: {
            ...buildInput().chainEvent,
            amountUnits: parseUsdcDecimalToUnits("50.00"),
          },
        }),
      ),
    ).toMatchObject({
      amountPolicy: "slight_overpay",
      outcome: "accepted_paid",
    });
  });

  it("classifies large overpayments for review", () => {
    expect(
      evaluatePaymentMatch(
        buildInput({
          chainEvent: {
            ...buildInput().chainEvent,
            amountUnits: parseUsdcDecimalToUnits("50.50"),
          },
        }),
      ),
    ).toMatchObject({
      amountPolicy: "large_overpay",
      outcome: "large_overpay",
    });
  });

  it("rejects wrong-token transfers", () => {
    expect(
      evaluatePaymentMatch(
        buildInput({
          chainEvent: {
            ...buildInput().chainEvent,
            tokenContract: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          },
        }),
      ),
    ).toMatchObject({
      outcome: "wrong_token",
    });
  });

  it("rejects wrong-chain transfers", () => {
    expect(
      evaluatePaymentMatch(
        buildInput({
          chainEvent: {
            ...buildInput().chainEvent,
            chain: "ethereum",
          },
        }),
      ),
    ).toMatchObject({
      outcome: "wrong_chain",
    });
  });

  it("classifies payments arriving after the expiry grace window as late", () => {
    expect(
      evaluatePaymentMatch(
        buildInput({
          chainEvent: {
            ...buildInput().chainEvent,
            blockTimestamp: new Date("2026-07-08T12:15:01.000Z"),
          },
        }),
      ),
    ).toMatchObject({
      outcome: "late",
    });
  });
});
