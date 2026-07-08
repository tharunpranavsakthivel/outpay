/**
 * Redis configuration parsing and shared `ioredis` connection helpers for the
 * BullMQ queue layer.
 */

import IORedis from "ioredis";

export interface BullMqConnectionOptions {
  db?: number;
  host: string;
  maxRetriesPerRequest: null;
  password?: string;
  port: number;
  tls?: Record<string, never>;
  username?: string;
}

export class RedisConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RedisConfigurationError";
  }
}

let sharedRedisConnection: IORedis | null = null;

/**
 * Returns the configured Redis URL for queue-backed processing.
 *
 * Parameters:
 * - env: Process environment containing the Redis connection string.
 *
 * Returns:
 * - Absolute Redis connection URL.
 *
 * Throws:
 * - `RedisConfigurationError` when the connection string is missing or
 *   malformed.
 */
export function getRedisUrl(env: NodeJS.ProcessEnv = process.env): string {
  const redisUrl = env.REDIS_URL?.trim();

  if (!redisUrl) {
    throw new RedisConfigurationError(
      "REDIS_URL must be configured for durable queue-backed workers.",
    );
  }

  if (!URL.canParse(redisUrl)) {
    throw new RedisConfigurationError(
      "REDIS_URL must be a valid absolute redis:// or rediss:// URL.",
    );
  }

  const parsedUrl = new URL(redisUrl);

  if (!["redis:", "rediss:"].includes(parsedUrl.protocol)) {
    throw new RedisConfigurationError(
      "REDIS_URL must use the redis:// or rediss:// protocol.",
    );
  }

  if (!parsedUrl.hostname) {
    throw new RedisConfigurationError(
      "REDIS_URL must include a hostname for the Redis service.",
    );
  }

  if (
    parsedUrl.port &&
    (!Number.isInteger(Number.parseInt(parsedUrl.port, 10)) ||
      Number.parseInt(parsedUrl.port, 10) <= 0)
  ) {
    throw new RedisConfigurationError(
      "REDIS_URL must include a valid positive port when a port is provided.",
    );
  }

  return redisUrl;
}

/**
 * Converts the configured Redis URL into BullMQ-compatible connection options.
 *
 * Parameters:
 * - env: Process environment containing the Redis connection string.
 *
 * Returns:
 * - Plain Redis connection options safe to reuse across Queue and Worker
 *   instances.
 */
export function getBullMqConnectionOptions(
  env: NodeJS.ProcessEnv = process.env,
): BullMqConnectionOptions {
  const redisUrl = new URL(getRedisUrl(env));
  const databaseSegment = redisUrl.pathname.replace(/^\/+/u, "");

  return {
    db: databaseSegment
      ? Number.parseInt(databaseSegment, 10) || undefined
      : undefined,
    host: redisUrl.hostname,
    maxRetriesPerRequest: null,
    password: redisUrl.password || undefined,
    port: Number.parseInt(redisUrl.port || "6379", 10),
    tls: redisUrl.protocol === "rediss:" ? {} : undefined,
    username: redisUrl.username || undefined,
  };
}

/**
 * Creates or reuses the singleton Redis connection for BullMQ producers and
 * worker control channels.
 *
 * Returns:
 * - Shared `IORedis` connection.
 */
export function getSharedRedisConnection(
  env: NodeJS.ProcessEnv = process.env,
): IORedis {
  if (!sharedRedisConnection) {
    sharedRedisConnection = new IORedis(getRedisUrl(env), {
      maxRetriesPerRequest: null,
    });
  }

  return sharedRedisConnection;
}

/**
 * Closes the shared Redis connection so tests and short-lived workers can
 * release sockets cleanly.
 */
export async function closeSharedRedisConnection(): Promise<void> {
  if (!sharedRedisConnection) {
    return;
  }

  const connection = sharedRedisConnection;
  sharedRedisConnection = null;
  await connection.quit().catch(async () => {
    connection.disconnect();
  });
}
