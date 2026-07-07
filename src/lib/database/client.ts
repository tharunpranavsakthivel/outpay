/**
 * Creates PostgreSQL clients for Outpay and falls back across the supported
 * environment variable sources when the primary connection target is not
 * reachable from the current runtime.
 */

import postgres, { type Sql } from "postgres";

import {
  type DatabaseUrlSource,
  formatDatabaseError,
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

/**
 * Opens a PostgreSQL connection using the first reachable configured target.
 *
 * Returns:
 * - `ConnectedDatabaseClient` with a ready-to-use `postgres` client and a
 *   `release` callback for cleanup.
 *
 * Throws:
 * - `DatabaseConnectionError` when no configured target can be reached.
 */
export async function connectToDatabase(): Promise<ConnectedDatabaseClient> {
  const candidates = resolveDatabaseConnectionCandidates();
  const failures: string[] = [];

  for (const candidate of candidates) {
    let sql: Sql<Record<string, unknown>> | null = null;

    try {
      sql = createPostgresClient(candidate.url);
      await sql`select 1`;
      const connectedSql = sql;

      return {
        release: async () => {
          await connectedSql.end({ timeout: 5 });
        },
        source: candidate.source,
        sql: connectedSql,
      };
    } catch (error) {
      failures.push(`${candidate.source}: ${formatDatabaseError(error)}`);
      await sql?.end({ timeout: 0 }).catch(() => undefined);
    }
  }

  throw new DatabaseConnectionError(
    `Unable to connect to PostgreSQL using the configured environment sources. ${failures.join(" | ")}`,
  );
}

function createPostgresClient(
  connectionString: string,
): Sql<Record<string, unknown>> {
  const baseOptions = {
    connect_timeout: 10,
    idle_timeout: 5,
    max: 1,
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
