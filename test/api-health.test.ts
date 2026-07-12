/**
 * Unit tests for the unauthenticated service health endpoint.
 */

import { describe, expect, it } from "bun:test";
import { createHealthHandler } from "@/lib/health/check";

const healthRequest = new Request("https://outpay.test/api/health");

describe("GET /api/health", () => {
  it("returns 200 when the database probe succeeds", async () => {
    const response = await createHealthHandler(async () => undefined)(
      healthRequest,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      dependencies: {
        database: { status: "up" },
      },
      status: "ok",
    });
  });

  it("returns 503 without leaking a bad connection-string error", async () => {
    const response = await createHealthHandler(async () => {
      throw new Error(
        "getaddrinfo ENOTFOUND bad-postgres-host connection string contains secret",
      );
    })(healthRequest);

    expect(response.status).toBe(503);
    const responseBody = await response.clone().text();
    expect(await response.json()).toEqual({
      dependencies: {
        database: { status: "down" },
      },
      status: "unhealthy",
    });

    expect(responseBody).not.toContain("bad-postgres-host");
    expect(responseBody).not.toContain("secret");
  });
});
