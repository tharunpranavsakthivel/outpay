/**
 * Regression coverage for process-wide postgres.js pool reuse and shutdown.
 * The driver is mocked so the test can exercise concurrent callers without a
 * live PostgreSQL dependency.
 */

import { afterAll, describe, expect, it, mock } from "bun:test";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalPoolMax = process.env.OUTPAY_DATABASE_POOL_MAX;
const poolOptions: Array<{ max: number }> = [];
const endCalls: unknown[] = [];
const sqlEnd = mock(async (options: unknown) => {
  endCalls.push(options);
});
const sql = Object.assign(async () => [], { end: sqlEnd });
const postgresFactory = mock(
  (_connectionString: string, options: { max: number }) => {
    poolOptions.push(options);
    return sql;
  },
);

mock.module("postgres", () => ({ default: postgresFactory }));

process.env.DATABASE_URL = "postgresql://user:password@localhost:5432/outpay";
process.env.OUTPAY_DATABASE_POOL_MAX = "4";

const { closeDatabasePool, connectToDatabase } = await import(
  "@/lib/database/client"
);

afterAll(async () => {
  await closeDatabasePool();

  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }

  if (originalPoolMax === undefined) {
    delete process.env.OUTPAY_DATABASE_POOL_MAX;
  } else {
    process.env.OUTPAY_DATABASE_POOL_MAX = originalPoolMax;
  }
});

describe("shared database pool", () => {
  it("reuses one bounded pool across concurrent callers", async () => {
    const clients = await Promise.all(
      Array.from({ length: 32 }, () => connectToDatabase()),
    );

    expect(postgresFactory).toHaveBeenCalledTimes(1);
    expect(poolOptions[0]?.max).toBe(4);
    expect(new Set(clients.map((client) => client.sql)).size).toBe(1);

    await Promise.all(clients.map((client) => client.release()));
    expect(sqlEnd).not.toHaveBeenCalled();
  });

  it("closes only through the explicit process-shutdown API", async () => {
    await closeDatabasePool();

    expect(sqlEnd).toHaveBeenCalledTimes(1);
  });
});
