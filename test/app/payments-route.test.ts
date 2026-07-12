/**
 * Regression coverage for dashboard payments query validation.
 */

import { describe, expect, it } from "bun:test";

describe("GET /api/payments", () => {
  it("returns a structured 400 for a non-numeric page", async () => {
    const { GET } = await import("@/app/api/payments/route");
    const response = await GET(
      new Request("http://localhost/api/payments?page=abc"),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("VALIDATION_FAILED");
    expect(payload.error.details).toEqual([
      {
        field: "page",
        issue: expect.any(String),
      },
    ]);
  });
});
