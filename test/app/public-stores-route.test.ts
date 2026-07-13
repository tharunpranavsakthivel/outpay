/**
 * Regression coverage for public store-directory query validation.
 */

import { describe, expect, it } from "bun:test";

describe("GET /api/public/stores", () => {
  it("rejects an invalid result limit before querying the database", async () => {
    const { GET } = await import("@/app/api/public/stores/route");
    const response = await GET(
      new Request("http://localhost/api/public/stores?limit=0"),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("VALIDATION_FAILED");
    expect(payload.error.details).toEqual([
      {
        field: "limit",
        issue: expect.any(String),
      },
    ]);
  });
});
