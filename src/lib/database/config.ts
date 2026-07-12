/**
 * Resolves PostgreSQL connection candidates from the environment contract
 * defined in `.env.example` without exposing secret values to logs or callers.
 */

export const DATABASE_URL_ENV_KEYS = [
  "DATABASE_URL",
  "DATABASE_PUBLIC_URL",
] as const;

export const DATABASE_PART_ENV_KEYS = [
  "PGHOST",
  "PGPORT",
  "PGDATABASE",
  "PGUSER",
  "PGPASSWORD",
] as const;

const DEFAULT_DATABASE_POOL_MAX = 10;
const DEFAULT_AUTH_POOL_MAX = 5;
const MAX_CONFIGURED_POOL_SIZE = 100;

export type DatabaseUrlSource =
  | (typeof DATABASE_URL_ENV_KEYS)[number]
  | "PG_COMPONENTS";

export interface DatabaseConnectionCandidate {
  source: DatabaseUrlSource;
  url: string;
}

export class DatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

/**
 * Builds the ordered list of connection candidates using only the variable
 * names declared in `.env.example`.
 *
 * Parameters:
 * - env: `NodeJS.ProcessEnv` containing the current process environment.
 *
 * Returns:
 * - `DatabaseConnectionCandidate[]` ordered by preferred local usage.
 *
 * Throws:
 * - `DatabaseConfigurationError` when no valid database configuration exists.
 */
export function resolveDatabaseConnectionCandidates(
  env: NodeJS.ProcessEnv = process.env,
): DatabaseConnectionCandidate[] {
  const candidates: DatabaseConnectionCandidate[] = [];

  for (const key of DATABASE_URL_ENV_KEYS) {
    const url = env[key]?.trim();

    if (url) {
      candidates.push({
        source: key,
        url,
      });
    }
  }

  const componentCandidate = buildUrlFromPgComponents(env);

  if (componentCandidate) {
    candidates.push(componentCandidate);
  }

  if (candidates.length === 0) {
    throw new DatabaseConfigurationError(
      "Database configuration is missing. Define DATABASE_URL, DATABASE_PUBLIC_URL, or the PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD variables from .env.example.",
    );
  }

  return dedupeCandidates(candidates);
}

/**
 * Returns the first configured database target for runtime usage.
 *
 * Parameters:
 * - env: `NodeJS.ProcessEnv` containing the current process environment.
 *
 * Returns:
 * - `DatabaseConnectionCandidate` for the preferred configured database target.
 */
export function getPrimaryDatabaseConnectionCandidate(
  env: NodeJS.ProcessEnv = process.env,
): DatabaseConnectionCandidate {
  return resolveDatabaseConnectionCandidates(env)[0];
}

/**
 * Resolves the maximum number of connections reserved by the app pool.
 *
 * Parameters:
 * - env: `NodeJS.ProcessEnv` containing the optional pool-size override.
 *
 * Returns:
 * - Positive app-pool connection limit, defaulting to 10.
 *
 * Throws:
 * - `DatabaseConfigurationError` when the override is not a bounded integer.
 */
export function getDatabasePoolMax(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return parsePoolMax(
    env.OUTPAY_DATABASE_POOL_MAX,
    DEFAULT_DATABASE_POOL_MAX,
    "OUTPAY_DATABASE_POOL_MAX",
  );
}

/**
 * Resolves the maximum number of connections reserved by Better Auth.
 *
 * Parameters:
 * - env: `NodeJS.ProcessEnv` containing the optional pool-size override.
 *
 * Returns:
 * - Positive Better Auth pool connection limit, defaulting to 5.
 *
 * Throws:
 * - `DatabaseConfigurationError` when the override is not a bounded integer.
 */
export function getAuthPoolMax(env: NodeJS.ProcessEnv = process.env): number {
  return parsePoolMax(
    env.OUTPAY_AUTH_POOL_MAX,
    DEFAULT_AUTH_POOL_MAX,
    "OUTPAY_AUTH_POOL_MAX",
  );
}

/**
 * Converts connection failures into a short, non-secret-bearing string.
 *
 * Parameters:
 * - error: Unknown thrown error from the database client.
 *
 * Returns:
 * - `string` suitable for CLI diagnostics.
 */
export function formatDatabaseError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/\s+/g, " ").trim();
  }

  return String(error);
}

function parsePoolMax(
  rawValue: string | undefined,
  defaultValue: number,
  environmentKey: string,
): number {
  const value = rawValue?.trim();

  if (!value) {
    return defaultValue;
  }

  const parsedValue = Number(value);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < 1 ||
    parsedValue > MAX_CONFIGURED_POOL_SIZE
  ) {
    throw new DatabaseConfigurationError(
      `${environmentKey} must be an integer between 1 and ${MAX_CONFIGURED_POOL_SIZE}.`,
    );
  }

  return parsedValue;
}

function buildUrlFromPgComponents(
  env: NodeJS.ProcessEnv,
): DatabaseConnectionCandidate | null {
  const host = env.PGHOST?.trim();
  const port = env.PGPORT?.trim();
  const database = env.PGDATABASE?.trim();
  const username = env.PGUSER?.trim();
  const password = env.PGPASSWORD?.trim();

  const hasAnyComponent = [host, port, database, username, password].some(
    Boolean,
  );

  if (!hasAnyComponent) {
    return null;
  }

  if (!host || !port || !database || !username || !password) {
    throw new DatabaseConfigurationError(
      "PG component configuration is incomplete. PGHOST, PGPORT, PGDATABASE, PGUSER, and PGPASSWORD must all be set together.",
    );
  }

  const url = new URL("postgresql://placeholder");
  url.hostname = host;
  url.port = port;
  url.pathname = `/${database}`;
  url.username = username;
  url.password = password;

  return {
    source: "PG_COMPONENTS",
    url: url.toString(),
  };
}

function dedupeCandidates(
  candidates: DatabaseConnectionCandidate[],
): DatabaseConnectionCandidate[] {
  const seenUrls = new Set<string>();

  return candidates.filter((candidate) => {
    if (seenUrls.has(candidate.url)) {
      return false;
    }

    seenUrls.add(candidate.url);
    return true;
  });
}
