/**
 * Creates PostgreSQL clients for Outpay and falls back across the supported
 * environment variable sources when the primary connection target is not
 * reachable from the current runtime.
 */

import postgres, { type Sql } from "postgres";

import { reportDatabaseConnectionFailure } from "@/lib/observability/alerts";
import {
  type DatabaseUrlSource,
  formatDatabaseError,
  getDatabasePoolMax,
  resolveDatabaseConnectionCandidates,
} from "./config";

export interface ConnectedDatabaseClient {
  release: () => Promise<void>;
  source: DatabaseUrlSource;
  sql: Sql<Record<string, unknown>>;
}

export class DatabaseConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConnectionError";
  }
}

let sharedDatabaseClient: ConnectedDatabaseClient | null = null;
let sharedDatabaseClientPromise: Promise<ConnectedDatabaseClient> | null = null;

/**
 * Returns the process-wide PostgreSQL pool using the first reachable
 * configured target.
 *
 * Returns:
 * - `ConnectedDatabaseClient` with a ready-to-use `postgres` pool and a
 *   request-compatible no-op `release` callback.
 *
 * Throws:
 * - `DatabaseConnectionError` when no configured target can be reached.
 */
export async function connectToDatabase(): Promise<ConnectedDatabaseClient> {
  if (sharedDatabaseClient) {
    return sharedDatabaseClient;
  }

  const initialization =
    sharedDatabaseClientPromise ?? initializeDatabaseClient();
  sharedDatabaseClientPromise = initialization;

  try {
    sharedDatabaseClient = await initialization;
    return sharedDatabaseClient;
  } finally {
    if (sharedDatabaseClientPromise === initialization) {
      sharedDatabaseClientPromise = null;
    }
  }
}

/**
 * Closes the shared pool during one-shot command or process shutdown.
 *
 * Returns:
 * - A promise that resolves after the pool has released its PostgreSQL
 *   connections, or after an in-flight initialization has failed.
 *
 * Throws:
 * - The underlying postgres.js shutdown error when an established pool cannot
 *   close within its bounded timeout.
 */
export async function closeDatabasePool(): Promise<void> {
  const initialization = sharedDatabaseClientPromise;
  const establishedClient = sharedDatabaseClient;

  sharedDatabaseClient = null;
  sharedDatabaseClientPromise = null;

  const client =
    establishedClient ??
    (initialization ? await initialization.catch(() => null) : null);

  if (client) {
    await client.sql.end({ timeout: 5 });
  }
}

/**
 * Creates and verifies the process-wide app pool using the first reachable
 * configured target.
 *
 * Returns:
 * - A shared `ConnectedDatabaseClient` whose postgres.js pool remains alive
 *   for the lifetime of the server process.
 *
 * Throws:
 * - `DatabaseConnectionError` when no configured target can be reached.
 */
async function initializeDatabaseClient(): Promise<ConnectedDatabaseClient> {
  const candidates = resolveDatabaseConnectionCandidates();
  const poolMax = getDatabasePoolMax();
  const failures: string[] = [];

  for (const candidate of candidates) {
    let sql: Sql<Record<string, unknown>> | null = null;

    try {
      sql = createPostgresClient(candidate.url, poolMax);
      await sql`select 1`;
      const connectedSql = sql;

      return {
        // Query ownership and backpressure are managed by postgres.js. A
        // request-level release must not close the process-wide pool.
        release: async () => undefined,
        source: candidate.source,
        sql: connectedSql,
      };
    } catch (error) {
      failures.push(`${candidate.source}: ${formatDatabaseError(error)}`);
      await sql?.end({ timeout: 0 }).catch(() => undefined);
    }
  }

  const connectionError = new DatabaseConnectionError(
    `Unable to connect to PostgreSQL using the configured environment sources. ${failures.join(" | ")}`,
  );
  reportDatabaseConnectionFailure(connectionError);
  throw connectionError;
}

function createPostgresClient(
  connectionString: string,
  poolMax: number,
): Sql<Record<string, unknown>> {
  const baseOptions = {
    connect_timeout: 10,
    // Keep idle connections available for the next request or worker job;
    // process shutdown is the only lifecycle boundary that should call end.
    idle_timeout: 0,
    // postgres.js queues queries when all pool connections are busy, providing
    // bounded backpressure instead of opening unbounded connections.
    max: poolMax,
  } as const;

  try {
    return postgres(connectionString, baseOptions);
  } catch {
    const normalized = normalizeConnectionString(connectionString);

    return postgres({
      ...baseOptions,
      ...normalized,
    });
  }
}

function normalizeConnectionString(connectionString: string): {
  database: string;
  host: string;
  password: string;
  port: number;
  ssl?: "allow" | "prefer" | "require" | "verify-full";
  username: string;
} {
  const schemeSeparatorIndex = connectionString.indexOf("://");

  if (schemeSeparatorIndex === -1) {
    throw new Error("Database URL is missing a protocol separator.");
  }

  const remainder = connectionString.slice(schemeSeparatorIndex + 3);
  const atIndex = remainder.lastIndexOf("@");

  if (atIndex === -1) {
    throw new Error("Database URL is missing user credentials.");
  }

  const slashIndex = remainder.indexOf("/", atIndex);

  if (slashIndex === -1) {
    throw new Error("Database URL is missing a database path.");
  }

  const authority = remainder.slice(0, slashIndex);
  const pathAndQuery = remainder.slice(slashIndex + 1);

  const userInfo = authority.slice(0, atIndex);
  const hostInfo = authority.slice(atIndex + 1);
  const userSeparatorIndex = userInfo.indexOf(":");

  if (userSeparatorIndex === -1) {
    throw new Error("Database URL is missing a password separator.");
  }

  const hostSeparatorIndex = hostInfo.lastIndexOf(":");

  if (hostSeparatorIndex === -1) {
    throw new Error("Database URL is missing a port separator.");
  }

  const username = userInfo.slice(0, userSeparatorIndex);
  const password = userInfo.slice(userSeparatorIndex + 1);
  const host = hostInfo.slice(0, hostSeparatorIndex);
  const portValue = hostInfo.slice(hostSeparatorIndex + 1);
  const port = Number.parseInt(portValue, 10);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("Database URL contains an invalid port.");
  }

  const querySeparatorIndex = pathAndQuery.indexOf("?");
  const database =
    querySeparatorIndex === -1
      ? pathAndQuery
      : pathAndQuery.slice(0, querySeparatorIndex);
  const queryString =
    querySeparatorIndex === -1
      ? ""
      : pathAndQuery.slice(querySeparatorIndex + 1);
  const searchParameters = new URLSearchParams(queryString);
  const sslmode = searchParameters.get("sslmode");

  return {
    database,
    host,
    password,
    port,
    ssl:
      sslmode === "allow" ||
      sslmode === "prefer" ||
      sslmode === "require" ||
      sslmode === "verify-full"
        ? sslmode
        : undefined,
    username,
  };
}
