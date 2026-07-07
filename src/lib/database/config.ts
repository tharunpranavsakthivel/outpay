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
