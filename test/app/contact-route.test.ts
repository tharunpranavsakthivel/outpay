/**
 * Regression coverage for the public enterprise contact submission route.
 * Uses a SQL-tag mock so valid submissions verify the persistence contract
 * without requiring a live PostgreSQL instance.
 */

import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
  getInMemoryRateLimitStore,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

type FakeSql = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown>;

const insertCalls: Array<{
  query: string;
  values: unknown[];
}> = [];

const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
  const query = strings.join(" ");

  if (query.toLowerCase().includes("insert into enterprise_contact_requests")) {
    insertCalls.push({ query, values });
  }

  return [];
}) as FakeSql;

mock.module("@/lib/database/client", () => ({
  connectToDatabase: async () => ({
    release: async () => undefined,
    source: "DATABASE_URL",
    sql,
  }),
  DatabaseConnectionError: class DatabaseConnectionError extends Error {},
}));

const validBody = {
  company_name: "Acme Inc.",
  message: "We need help planning a USDC checkout rollout.",
  monthly_transaction_volume: "5,000",
  request_type: "implementation",
  website: "",
  work_email: "payments@acme.example",
};

function makeRequest(body: unknown, ip = "203.0.113.50") {
  return new Request("https://outpay.test/api/contact", {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    method: "POST",
  });
}

describe("POST /api/contact", () => {
  beforeEach(() => {
    insertCalls.length = 0;
    getInMemoryRateLimitStore().reset();
  });

  it("inserts a validated inquiry and returns 201", async () => {
    const { POST } = await import("@/app/api/contact/route");

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ submitted: true });
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]?.values).toEqual([
      validBody.request_type,
      validBody.work_email,
      validBody.company_name,
      validBody.monthly_transaction_volume,
      validBody.message,
    ]);
  });

  it("rejects invalid fields before inserting", async () => {
    const { POST } = await import("@/app/api/contact/route");

    const response = await POST(
      makeRequest(
        {
          ...validBody,
          message: "",
          request_type: "unknown",
          work_email: "not-an-email",
        },
        "203.0.113.51",
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("VALIDATION_FAILED");
    expect(payload.error.details).toEqual(
      expect.arrayContaining([
        { field: "message", issue: expect.any(String) },
        { field: "request_type", issue: expect.any(String) },
        { field: "work_email", issue: expect.any(String) },
      ]),
    );
    expect(insertCalls).toHaveLength(0);
  });

  it("rejects honeypot submissions without inserting", async () => {
    const { POST } = await import("@/app/api/contact/route");

    const response = await POST(
      makeRequest(
        { ...validBody, website: "https://spam.example" },
        "203.0.113.52",
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatchObject({ code: "SPAM_DETECTED" });
    expect(insertCalls).toHaveLength(0);
  });

  it("applies the contact-specific rate limit before inserting", async () => {
    const { POST } = await import("@/app/api/contact/route");

    for (
      let attempt = 0;
      attempt < RATE_LIMIT_POLICIES.contactSubmit.maxRequests;
      attempt += 1
    ) {
      expect((await POST(makeRequest(validBody, "203.0.113.53"))).status).toBe(
        201,
      );
    }

    const response = await POST(makeRequest(validBody, "203.0.113.53"));
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload.error.code).toBe("CONTACT_RATE_LIMITED");
    expect(response.headers.get("Retry-After")).toBe("3600");
    expect(insertCalls).toHaveLength(
      RATE_LIMIT_POLICIES.contactSubmit.maxRequests,
    );
  });
});
