/**
 * Unit tests for public API idempotency replay behavior.
 */

import { describe, expect, it, mock } from "bun:test";
import {
  executeIdempotentRequest,
  hashRequestBody,
  PublicApiError,
} from "@/lib/api/public";

describe("public API idempotency", () => {
  it("replays the original response for the same key and same request hash", async () => {
    const create = mock(async () => ({
      body: {
        id: "chk_123",
        status: "pending_payment",
      },
      checkoutSessionId: "checkout_session_123",
      statusCode: 201,
    }));
    let storedRecord: {
      body: { id: string; status: string };
      expiresAt: Date;
      requestHash: string;
      statusCode: number;
    } | null = null;
    const requestHash = hashRequestBody({
      amount: "49.99",
      currency: "USDC",
    });

    const firstResult = await executeIdempotentRequest({
      create,
      expiresAt: new Date("2026-07-09T00:00:00.000Z"),
      idempotencyKey: "order_123",
      requestHash,
      requestMethod: "POST",
      requestPath: "/api/v1/checkouts",
      store: {
        createRecord: async (input) => {
          storedRecord = {
            body: input.body,
            expiresAt: input.expiresAt,
            requestHash: input.requestHash,
            statusCode: input.statusCode,
          };
        },
        findRecord: async () => storedRecord,
      },
    });

    const secondResult = await executeIdempotentRequest({
      create,
      expiresAt: new Date("2026-07-09T00:00:00.000Z"),
      idempotencyKey: "order_123",
      requestHash,
      requestMethod: "POST",
      requestPath: "/api/v1/checkouts",
      store: {
        createRecord: async () => undefined,
        findRecord: async () => storedRecord,
      },
    });

    expect(firstResult.replayed).toBe(false);
    expect(secondResult.replayed).toBe(true);
    expect(firstResult.body).toEqual(secondResult.body);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("rejects reuse of the same key with a different request body hash", async () => {
    const run = executeIdempotentRequest({
      create: async () => ({
        body: {
          id: "chk_123",
        },
        statusCode: 201,
      }),
      expiresAt: new Date("2026-07-09T00:00:00.000Z"),
      idempotencyKey: "order_123",
      requestHash: hashRequestBody({
        amount: "99.99",
      }),
      requestMethod: "POST",
      requestPath: "/api/v1/checkouts",
      store: {
        createRecord: async () => undefined,
        findRecord: async () => ({
          body: {
            id: "chk_123",
          },
          expiresAt: new Date("2026-07-09T00:00:00.000Z"),
          requestHash: hashRequestBody({
            amount: "49.99",
          }),
          statusCode: 201,
        }),
      },
    });

    await expect(run).rejects.toBeInstanceOf(PublicApiError);
    await expect(run).rejects.toMatchObject({
      code: "IDEMPOTENCY_KEY_REUSED",
      status: 409,
    });
  });
});
