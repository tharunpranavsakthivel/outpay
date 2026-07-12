/**
 * PostgreSQL health probing and response shaping for the public service health
 * route. Diagnostic failures are logged server-side and never returned.
 */

import { connectToDatabase } from "@/lib/database/client";
import { logApiError } from "@/lib/logging/logger";

const DATABASE_HEALTH_CHECK_TIMEOUT_MS = 2_000;
const HEALTH_RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
};

export type DatabaseHealthProbe = () => Promise<void>;

class HealthCheckTimeoutError extends Error {
  constructor() {
    super("Database health check timed out.");
    this.name = "HealthCheckTimeoutError";
  }
}

/**
 * Checks PostgreSQL connectivity through the shared database client.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - A promise that resolves after the client's `select 1` probe succeeds.
 *
 * Throws:
 * - The underlying database error, or `HealthCheckTimeoutError` when the
 *   bounded health-check window expires.
 */
export async function checkDatabaseConnectivity(): Promise<void> {
  const connectionAttempt = connectToDatabase();
  let database: Awaited<ReturnType<typeof connectToDatabase>> | null = null;

  try {
    database = await withTimeout(
      connectionAttempt,
      DATABASE_HEALTH_CHECK_TIMEOUT_MS,
    );
    await database.release();
  } catch (error) {
    // A timed-out connection can still resolve later. Release it when that
    // happens so repeated monitor requests do not accumulate open clients.
    if (!database) {
      void connectionAttempt
        .then((lateDatabase) => lateDatabase.release())
        .catch(() => undefined);
    }

    throw error;
  }
}

/**
 * Creates the health route handler with an injectable database probe.
 *
 * Parameters:
 * - databaseProbe: Probe that resolves when PostgreSQL is healthy and rejects
 *   when it is unavailable. The default uses the real database client.
 *
 * Returns:
 * - A Next.js-compatible GET handler returning a coarse health payload.
 *
 * Throws:
 * - The handler converts probe failures into HTTP 503 responses and does not
 *   expose the caught error to the caller.
 */
export function createHealthHandler(
  databaseProbe: DatabaseHealthProbe = checkDatabaseConnectivity,
): (request: Request) => Promise<Response> {
  return async () => {
    try {
      await databaseProbe();

      return Response.json(
        {
          dependencies: {
            database: { status: "up" },
          },
          status: "ok",
        },
        { headers: HEALTH_RESPONSE_HEADERS },
      );
    } catch (error) {
      logApiError(error, {
        error_code: "HEALTH_DATABASE_UNAVAILABLE",
        status: 503,
      });

      return Response.json(
        {
          dependencies: {
            database: { status: "down" },
          },
          status: "unhealthy",
        },
        {
          headers: HEALTH_RESPONSE_HEADERS,
          status: 503,
        },
      );
    }
  };
}

/**
 * Resolves a promise or fails with a health-check timeout.
 *
 * Parameters:
 * - operation: Asynchronous operation to bound.
 * - timeoutMs: Maximum duration in milliseconds.
 *
 * Returns:
 * - The operation's resolved value before the timeout.
 *
 * Throws:
 * - `HealthCheckTimeoutError` when the operation does not settle in time.
 */
function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new HealthCheckTimeoutError());
    }, timeoutMs);

    operation.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}
