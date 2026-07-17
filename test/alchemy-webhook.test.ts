/**
 * Unit tests for the Alchemy webhook verification and normalization helpers
 * backing T-3 provider webhook intake.
 */

import { describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";

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
const { normalizeAlchemyAddressActivityPayload, normalizeRpcTransferLogs } =
  await import("@/lib/payments/normalize-event");

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

  it("normalizes a real Alchemy ADDRESS_ACTIVITY delivery, where logIndex/blockHash/blockNumber live under activity.log rather than at the top level", () => {
    // Shape captured from an actual production webhook delivery. Alchemy
    // does not put logIndex/blockHash next to fromAddress/toAddress; they
    // are nested under `activity[].log`. A fixture that puts them at the top
    // level (as above) does not reproduce this and previously let a bug ship
    // where every real delivery normalized to zero events.
    const realBody = JSON.stringify({
      webhookId: "wh_wwhg2mlsqx419bbf",
      id: "whevt_qycvnjiteruqk0em",
      createdAt: "2026-07-17T09:12:54.066Z",
      type: "ADDRESS_ACTIVITY",
      event: {
        network: "BASE_MAINNET",
        activity: [
          {
            fromAddress: "0x81f813c7416ef47d9844ec1362abbce0eb035b53",
            toAddress: "0x58a44752cf3a0db7ff54dc16560b666cf438ada3",
            blockNum: "0x2e7ca99",
            hash: "0xee425b6aa87632289b6a2ac406404fe19b30515a9f3265981106242ab292479a",
            value: 1,
            asset: "USDC",
            category: "token",
            rawContract: {
              rawValue:
                "0x00000000000000000000000000000000000000000000000000000000000f4240",
              address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
              decimals: 6,
            },
            log: {
              address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
              topics: [
                "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
                "0x00000000000000000000000081f813c7416ef47d9844ec1362abbce0eb035b53",
                "0x00000000000000000000000058a44752cf3a0db7ff54dc16560b666cf438ada3",
              ],
              data: "0x00000000000000000000000000000000000000000000000000000000000f4240",
              blockHash:
                "0x33deaa2cea19143c844611a3d1a278e3ec87db0dbbea45e1f9be3924e83309c1",
              blockNumber: "0x2e7ca99",
              blockTimestamp: "0x6a59f215",
              transactionHash:
                "0xee425b6aa87632289b6a2ac406404fe19b30515a9f3265981106242ab292479a",
              transactionIndex: "0x9",
              logIndex: "0x10",
              removed: false,
            },
            blockTimestamp: "0x6a59f215",
          },
        ],
        source: "chainlake-kafka",
      },
    });

    const [event] = normalizeAlchemyAddressActivityPayload(
      JSON.parse(realBody),
    );

    expect(event).toEqual({
      amountUnits: BigInt(1000000),
      blockHash:
        "0x33deaa2cea19143c844611a3d1a278e3ec87db0dbbea45e1f9be3924e83309c1",
      blockNumber: BigInt(48745113),
      chain: "base",
      eventName: "Transfer",
      fromAddress: "0x81f813c7416ef47d9844ec1362abbce0eb035b53",
      logIndex: 16,
      provider: "alchemy",
      toAddress: "0x58a44752cf3a0db7ff54dc16560b666cf438ada3",
      tokenContract: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      txHash:
        "0xee425b6aa87632289b6a2ac406404fe19b30515a9f3265981106242ab292479a",
    });
  });

  it("drops a zero-value Alchemy activity instead of producing an unpersistable event", () => {
    const zeroValueBody = JSON.stringify({
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
              value: "0",
            },
            toAddress: "0x2222222222222222222222222222222222222222",
          },
        ],
      },
    });

    const events = normalizeAlchemyAddressActivityPayload(
      JSON.parse(zeroValueBody),
    );

    expect(events).toEqual([]);
  });

  it("drops a zero-value eth_getLogs transfer instead of producing an unpersistable event", () => {
    // `onchain_transactions.amount_token` has a `> 0` check constraint. A
    // zero-value Transfer is legal on-chain but can never satisfy a positive
    // checkout amount, so it must never reach the insert.
    const zeroValueLog = {
      address: "0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913",
      blockHash: "0xblockhash",
      blockNumber: "0xbc614e",
      data: "0x0000000000000000000000000000000000000000000000000000000000000000",
      logIndex: "0x7",
      removed: false,
      topics: [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        "0x0000000000000000000000001111111111111111111111111111111111111111",
        "0x0000000000000000000000002222222222222222222222222222222222222222",
      ],
      transactionHash: "0xtxhash",
    };

    const events = normalizeRpcTransferLogs([zeroValueLog], "alchemy");

    expect(events).toEqual([]);
  });
});
