/**
 * Unit tests for the developers API-key PATCH route.
 */

import { describe, expect, it } from "bun:test";

describe("PATCH /api/developers/api-keys/[id]", () => {
  it("validates the revoke action before calling the server mutation", async () => {
    const { PATCH } = await import("@/app/api/developers/api-keys/[id]/route");

    const response = await PATCH(
      new Request("http://localhost/api/developers/api-keys/key_123", {
        body: JSON.stringify({ action: "rotate" }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      }),
      { params: Promise.resolve({ id: "key_123" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        code: "VALIDATION_FAILED",
        details: [
          {
            field: "action",
          },
        ],
      },
    });
  });
});
