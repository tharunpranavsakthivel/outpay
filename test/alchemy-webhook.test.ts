/**
 * Unit tests for the Alchemy webhook verification and normalization helpers
 * backing T-3 provider webhook intake.
 */

import { createHmac } from "node:crypto";
import { describe, expect, it } from "bun:test";

process.env.ALCHEMY_BASE_RPC_URL =
  process.env.ALCHEMY_BASE_RPC_URL ||
  "https://base-mainnet.g.alchemy.com/v2/test-api-key";
process.env.ALCHEMY_WEBHOOK_SIGNING_KEY =
  process.env.ALCHEMY_WEBHOOK_SIGNING_KEY || "alchemy-test-signing-key";
process.env.ALCHEMY_NOTIFY_WEBHOOK_ID =
  process.env.ALCHEMY_NOTIFY_WEBHOOK_ID || "wh_test_123";

const {
  buildStoredAlchemyPayload,
  extractAlchemyProviderEventId,
  verifyWebhookSignature,
} = await import("@/lib/providers/alchemy");
const { normalizeAlchemyAddressActivityPayload } = await import(
  "@/lib/payments/normalize-event"
);

const RAW_BODY = JSON.stringify({
  event: {
    activity: [
      {
        blockHash: "0xblockhash",
        blockNum: "0xbc614e",
        fromAddress: "0x1111111111111111111111111111111111111111",
        hash: "0xtxhash",
        logIndex: "0x7",
        rawContract: {
          address: "0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913",
          decimal: "6",
          value: "1250000",
        },
        toAddress: "0x2222222222222222222222222222222222222222",
        uniqueId: "activity-123",
      },
    ],
  },
  id: "evt_123",
});

describe("Alchemy webhook helpers", () => {
  it("accepts a valid HMAC signature over the raw body", () => {
    const signature = createHmac(
      "sha256",
      process.env.ALCHEMY_WEBHOOK_SIGNING_KEY as string,
    )
      .update(RAW_BODY, "utf8")
      .digest("hex");

    expect(verifyWebhookSignature(RAW_BODY, signature)).toBe(true);
  });

  it("rejects a mismatched HMAC signature", () => {
    expect(verifyWebhookSignature(RAW_BODY, "0".repeat(64))).toBe(false);
  });

  it("extracts the provider event id from the parsed payload when present", () => {
    const payload = JSON.parse(RAW_BODY) as unknown;

    expect(extractAlchemyProviderEventId(payload, RAW_BODY)).toBe("evt_123");
  });

  it("falls back to a deterministic hash when the payload has no stable id", () => {
    const rawBody = JSON.stringify({ event: { activity: [] } });

    expect(extractAlchemyProviderEventId({}, rawBody)).toHaveLength(64);
    expect(extractAlchemyProviderEventId({}, rawBody)).toBe(
      extractAlchemyProviderEventId({}, rawBody),
    );
  });

  it("preserves the exact raw body in the stored forensic payload", () => {
    const storedPayload = buildStoredAlchemyPayload(
      RAW_BODY,
      JSON.parse(RAW_BODY),
    );

    expect(storedPayload.__outpayRawBody).toBe(RAW_BODY);
    expect(storedPayload.id).toBe("evt_123");
  });

  it("stores malformed deliveries with a parse error marker", () => {
    const storedPayload = buildStoredAlchemyPayload(
      "{bad json",
      null,
      "Unexpected token",
    );

    expect(storedPayload.__outpayRawBody).toBe("{bad json");
    expect(storedPayload.__outpayParseError).toBe("Unexpected token");
  });

  it("normalizes Alchemy activity payloads into the internal chain-event shape", () => {
    const payload = JSON.parse(RAW_BODY) as unknown;
    const [event] = normalizeAlchemyAddressActivityPayload(payload);

    expect(event).toEqual({
      amountUnits: 1250000n,
      blockHash: "0xblockhash",
      blockNumber: 12345678n,
      chain: "base",
      eventName: "Transfer",
      fromAddress: "0x1111111111111111111111111111111111111111",
      logIndex: 7,
      provider: "alchemy",
      toAddress: "0x2222222222222222222222222222222222222222",
      tokenContract: "0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913",
      txHash: "0xtxhash",
    });
  });
});
