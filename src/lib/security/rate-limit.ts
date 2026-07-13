/**
 * Shared sliding-window rate limiting for Outpay route handlers.
 *
 * The limiter prefers Redis when `REDIS_URL` is configured so multiple app
 * instances share counters. Until the dedicated Redis rollout is complete, it
 * falls back to an in-memory store so the most exposed public routes still
 * have best-effort protection on a single instance.
 */

import { randomUUID } from "node:crypto";
import { publicApiError } from "@/lib/api/public";
import { jsonError } from "@/lib/dashboard/http";
import { logger } from "@/lib/logging/logger";
import { getSharedRedisConnection } from "@/lib/queues/redis";

export interface RateLimitPolicy {
  errorCode: string;
  errorMessage: string;
  failureMode: "closed" | "open";
  id: string;
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  storeFailure: boolean;
}

export interface RateLimitStorage {
  consume: (
    key: string,
    policy: RateLimitPolicy,
  ) => Promise<{
    allowed: boolean;
    retryAfterSeconds: number;
  }>;
}

const DEFAULT_API_RATE_LIMIT_PER_MINUTE = 120;
const DEFAULT_CHECKOUT_STATUS_RATE_LIMIT_PER_MINUTE = 60;
const REDIS_RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call("ZREMRANGEBYSCORE", key, 0, now - window)
local count = redis.call("ZCARD", key)

if count >= limit then
  local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
  local retryAfterMs = window

  if oldest[2] then
    retryAfterMs = window - (now - tonumber(oldest[2]))
  end

  if retryAfterMs < 0 then
    retryAfterMs = 0
  end

  redis.call("PEXPIRE", key, window)
  return {0, retryAfterMs}
end

redis.call("ZADD", key, now, member)
redis.call("PEXPIRE", key, window)
return {1, 0}
`;

let configuredRateLimitStore: RateLimitStorage | null = null;

/**
 * Parses the shared per-minute API rate-limit environment override.
 *
 * Parameters:
 * - env: Process environment containing optional rate-limit overrides.
 *
 * Returns:
 * - Positive per-minute request limit, or the repository default.
 */
export function getDefaultApiRateLimitPerMinute(
  env: NodeJS.ProcessEnv = process.env,
) {
  const parsedValue = Number.parseInt(env.API_RATE_LIMIT_PER_MINUTE ?? "", 10);

  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : DEFAULT_API_RATE_LIMIT_PER_MINUTE;
}

/**
 * Parses the hosted-checkout polling rate-limit environment override.
 *
 * Parameters:
 * - env: Process environment containing optional status-polling overrides.
 *
 * Returns:
 * - Positive per-minute polling limit, or the repository default.
 */
export function getCheckoutStatusRateLimitPerMinute(
  env: NodeJS.ProcessEnv = process.env,
) {
  const parsedValue = Number.parseInt(
    env.CHECKOUT_STATUS_RATE_LIMIT_PER_MINUTE ?? "",
    10,
  );

  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : DEFAULT_CHECKOUT_STATUS_RATE_LIMIT_PER_MINUTE;
}

/**
 * Central policy registry for architecture-defined and default route limits.
 */
export const RATE_LIMIT_POLICIES = {
  apiKeyCreate: {
    errorCode: "API_KEY_CREATE_RATE_LIMITED",
    errorMessage: "Too many API key creation requests.",
    failureMode: "open",
    id: "api-key-create",
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
  },
  authLogin: {
    errorCode: "LOGIN_RATE_LIMITED",
    // Login fails closed once Redis exists because credential stuffing is the
    // highest-risk public route in this checkout.
    errorMessage: "Too many login attempts.",
    failureMode: "closed",
    id: "auth-login",
    maxRequests: 10,
    windowMs: 60 * 1000,
  },
  authPasswordReset: {
    errorCode: "PASSWORD_RESET_RATE_LIMITED",
    errorMessage: "Too many password reset attempts.",
    failureMode: "open",
    id: "auth-password-reset",
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
  },
  authSignup: {
    errorCode: "SIGNUP_RATE_LIMITED",
    errorMessage: "Too many signup attempts.",
    failureMode: "open",
    id: "auth-signup",
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
  },
  checkoutCreate: {
    errorCode: "CHECKOUT_CREATE_RATE_LIMITED",
    errorMessage: "Too many checkout creation requests.",
    failureMode: "open",
    id: "checkout-create",
    maxRequests: 60,
    windowMs: 60 * 1000,
  },
  checkoutRead: {
    errorCode: "CHECKOUT_READ_RATE_LIMITED",
    errorMessage: "Too many checkout status requests.",
    failureMode: "open",
    id: "checkout-read",
    maxRequests: 300,
    windowMs: 60 * 1000,
  },
  contactSubmit: {
    errorCode: "CONTACT_RATE_LIMITED",
    errorMessage: "Too many contact requests.",
    failureMode: "open",
    id: "contact-submit",
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
  },
  defaultAuthenticatedRoute: {
    errorCode: "RATE_LIMITED",
    errorMessage: "Too many authenticated API requests.",
    failureMode: "open",
    id: "default-authenticated-route",
    maxRequests: getDefaultApiRateLimitPerMinute(),
    windowMs: 60 * 1000,
  },
  defaultPublicRoute: {
    errorCode: "PUBLIC_RATE_LIMITED",
    errorMessage: "Too many public API requests.",
    failureMode: "open",
    id: "default-public-route",
    maxRequests: getDefaultApiRateLimitPerMinute(),
    windowMs: 60 * 1000,
  },
  onboarding: {
    errorCode: "ONBOARDING_RATE_LIMITED",
    errorMessage: "Too many onboarding attempts.",
    failureMode: "open",
    id: "onboarding",
    maxRequests: 10,
    windowMs: 60 * 1000,
  },
  paymentsList: {
    errorCode: "PAYMENTS_LIST_RATE_LIMITED",
    errorMessage: "Too many payment list requests.",
    failureMode: "open",
    id: "payments-list",
    maxRequests: 120,
    windowMs: 60 * 1000,
  },
  publicCheckoutStatus: {
    errorCode: "CHECKOUT_STATUS_RATE_LIMITED",
    errorMessage: "Too many checkout status polling requests.",
    failureMode: "open",
    id: "public-checkout-status",
    maxRequests: getCheckoutStatusRateLimitPerMinute(),
    windowMs: 60 * 1000,
  },
  webhookTest: {
    errorCode: "WEBHOOK_TEST_RATE_LIMITED",
    errorMessage: "Too many webhook test requests.",
    failureMode: "open",
    id: "webhook-test",
    maxRequests: 10,
    windowMs: 60 * 1000,
  },
} satisfies Record<string, RateLimitPolicy>;

/**
 * In-memory rolling-window store used as the current best-effort fallback.
 */
export class InMemorySlidingWindowRateLimitStore implements RateLimitStorage {
  private readonly buckets = new Map<string, number[]>();

  private readonly now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.now = now;
  }

  /**
   * Consumes one request token from the in-memory rolling window.
   *
   * Parameters:
   * - key: Fully scoped rate-limit key for one caller and route policy.
   * - policy: Limit configuration controlling window size and capacity.
   *
   * Returns:
   * - Allow/deny decision plus retry-after seconds when denied.
   */
  async consume(key: string, policy: RateLimitPolicy) {
    const now = this.now();
    const cutoff = now - policy.windowMs;
    const timestamps = (this.buckets.get(key) ?? []).filter(
      (timestamp) => timestamp > cutoff,
    );

    if (timestamps.length >= policy.maxRequests) {
      const oldestTimestamp = timestamps[0] ?? now;
      const retryAfterMs = Math.max(
        policy.windowMs - (now - oldestTimestamp),
        0,
      );

      this.buckets.set(key, timestamps);

      return {
        allowed: false,
        retryAfterSeconds: Math.max(Math.ceil(retryAfterMs / 1000), 1),
      };
    }

    timestamps.push(now);
    this.buckets.set(key, timestamps);
    this.prune(now);

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  /**
   * Clears the in-memory store so tests can run in isolation.
   */
  reset() {
    this.buckets.clear();
  }

  /**
   * Drops expired buckets and caps unbounded growth in long-lived dev servers.
   *
   * Parameters:
   * - now: Timestamp used as the pruning reference.
   */
  private prune(now: number) {
    for (const [key, timestamps] of this.buckets) {
      const freshTimestamps = timestamps.filter(
        (timestamp) => now - timestamp <= 60 * 60 * 1000,
      );

      if (freshTimestamps.length === 0) {
        this.buckets.delete(key);
        continue;
      }

      this.buckets.set(key, freshTimestamps);
    }
  }
}

class RedisSlidingWindowRateLimitStore implements RateLimitStorage {
  /**
   * Consumes one request token from a Redis-backed rolling window.
   *
   * Parameters:
   * - key: Fully scoped rate-limit key for one caller and route policy.
   * - policy: Limit configuration controlling window size and capacity.
   *
   * Returns:
   * - Allow/deny decision plus retry-after seconds when denied.
   */
  async consume(key: string, policy: RateLimitPolicy) {
    const now = Date.now();
    const member = `${now}:${randomUUID()}`;
    const redis = getSharedRedisConnection();
    const result = (await redis.eval(
      REDIS_RATE_LIMIT_SCRIPT,
      1,
      key,
      now.toString(),
      policy.windowMs.toString(),
      policy.maxRequests.toString(),
      member,
    )) as [number, number];
    const [allowedFlag, retryAfterMs] = result;

    return {
      allowed: allowedFlag === 1,
      retryAfterSeconds:
        allowedFlag === 1 ? 0 : Math.max(Math.ceil(retryAfterMs / 1000), 1),
    };
  }
}

const inMemoryRateLimitStore = new InMemorySlidingWindowRateLimitStore();

/**
 * Resolves the current storage backend for rate limiting.
 *
 * Parameters:
 * - env: Process environment containing Redis configuration.
 *
 * Returns:
 * - Shared rate-limit storage implementation.
 */
export function getConfiguredRateLimitStore(
  env: NodeJS.ProcessEnv = process.env,
): RateLimitStorage {
  if (configuredRateLimitStore) {
    return configuredRateLimitStore;
  }

  configuredRateLimitStore = env.REDIS_URL?.trim()
    ? new RedisSlidingWindowRateLimitStore()
    : inMemoryRateLimitStore;

  return configuredRateLimitStore;
}

/**
 * Returns the best-effort fallback store so tests can assert window behavior.
 *
 * Returns:
 * - Shared in-memory rate-limit storage instance.
 */
export function getInMemoryRateLimitStore() {
  return inMemoryRateLimitStore;
}

/**
 * Extracts the most trustworthy client IP available from the request headers.
 *
 * Parameters:
 * - request: Incoming route-handler request.
 *
 * Returns:
 * - Normalized client IP string, or `unknown` when no proxy headers exist.
 */
export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstForwardedIp = forwardedFor?.split(",")[0]?.trim();

  return (
    firstForwardedIp ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/**
 * Builds a stable rate-limit key from a caller scope and optional resource id.
 *
 * Parameters:
 * - scopeType: High-level caller scope such as `merchant` or `ip`.
 * - scopeValue: Stable caller identifier inside that scope.
 * - policy: Policy whose bucket namespace should be used.
 * - resourceId: Optional sub-resource discriminator such as checkout id.
 *
 * Returns:
 * - Redis/memory-safe rate-limit key string.
 */
export function buildRateLimitKey(input: {
  policy: RateLimitPolicy;
  resourceId?: string | null;
  scopeType: "api_key" | "ip" | "merchant";
  scopeValue: string;
}) {
  const keyParts = [
    "rate-limit",
    input.policy.id,
    input.scopeType,
    sanitizeRateLimitKeyPart(input.scopeValue),
  ];

  if (input.resourceId) {
    keyParts.push(sanitizeRateLimitKeyPart(input.resourceId));
  }

  return keyParts.join(":");
}

/**
 * Applies one rate-limit decision and maps store failures to the route's
 * explicit fail-open or fail-closed policy.
 *
 * Parameters:
 * - key: Fully scoped rate-limit key for the caller and route.
 * - policy: Route-specific rate-limit policy.
 * - routeId: Human-readable route identifier used in structured logs.
 * - storage: Optional store override, primarily for tests.
 *
 * Returns:
 * - Final allow/deny decision with retry-after metadata.
 */
export async function consumeRateLimit(input: {
  key: string;
  policy: RateLimitPolicy;
  routeId: string;
  storage?: RateLimitStorage;
}) {
  const storage = input.storage ?? getConfiguredRateLimitStore();

  try {
    const decision = await storage.consume(input.key, input.policy);

    if (!decision.allowed) {
      logRateLimitEvent("warn", "Rate limit exceeded", {
        key: input.key,
        policyId: input.policy.id,
        retryAfterSeconds: decision.retryAfterSeconds,
        routeId: input.routeId,
      });
    }

    return {
      allowed: decision.allowed,
      retryAfterSeconds: decision.retryAfterSeconds,
      storeFailure: false,
    } satisfies RateLimitDecision;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown rate-limit store error";

    logRateLimitEvent("error", "Rate-limit storage failed", {
      error: message,
      key: input.key,
      policyId: input.policy.id,
      routeId: input.routeId,
      storeFailureMode: input.policy.failureMode,
    });

    if (input.policy.failureMode === "open") {
      return {
        allowed: true,
        retryAfterSeconds: 0,
        storeFailure: true,
      } satisfies RateLimitDecision;
    }

    return {
      allowed: false,
      retryAfterSeconds: Math.max(Math.ceil(input.policy.windowMs / 1000), 1),
      storeFailure: true,
    } satisfies RateLimitDecision;
  }
}

/**
 * Creates the standard retry headers expected on `429` responses.
 *
 * Parameters:
 * - retryAfterSeconds: Client backoff period in whole seconds.
 *
 * Returns:
 * - Header map suitable for `ResponseInit.headers`.
 */
export function createRateLimitHeaders(retryAfterSeconds: number) {
  return {
    "Retry-After": retryAfterSeconds.toString(),
    "X-Retry-After": retryAfterSeconds.toString(),
  };
}

/**
 * Formats a user-facing rate-limit message with a concrete retry duration.
 *
 * Parameters:
 * - policy: Route policy whose base message should be used.
 * - retryAfterSeconds: Client backoff period in whole seconds.
 *
 * Returns:
 * - Human-readable backoff guidance.
 */
export function formatRateLimitMessage(
  policy: RateLimitPolicy,
  retryAfterSeconds: number,
) {
  return `${policy.errorMessage} Try again in ${retryAfterSeconds}s.`;
}

/**
 * Builds a dashboard-style `429` response using the shared `jsonError` shape.
 *
 * Parameters:
 * - policy: Route policy whose code/message should be emitted.
 * - retryAfterSeconds: Client backoff period in whole seconds.
 *
 * Returns:
 * - JSON `429` response with retry headers.
 */
export function createJsonRateLimitError(
  policy: RateLimitPolicy,
  retryAfterSeconds: number,
) {
  return jsonError(
    429,
    policy.errorCode,
    formatRateLimitMessage(policy, retryAfterSeconds),
    createRateLimitHeaders(retryAfterSeconds),
  );
}

/**
 * Builds a public-API `429` response using the documented error envelope.
 *
 * Parameters:
 * - policy: Route policy whose code/message should be emitted.
 * - requestId: Correlation id already resolved for the request.
 * - retryAfterSeconds: Client backoff period in whole seconds.
 *
 * Returns:
 * - JSON `429` response with retry headers and request id.
 */
export function createPublicApiRateLimitError(input: {
  policy: RateLimitPolicy;
  requestId: string;
  retryAfterSeconds: number;
}) {
  return publicApiError(
    input.requestId,
    429,
    input.policy.errorCode,
    formatRateLimitMessage(input.policy, input.retryAfterSeconds),
    [],
    createRateLimitHeaders(input.retryAfterSeconds),
  );
}

/**
 * Builds a Better Auth compatible `429` JSON response for auth actions.
 *
 * Parameters:
 * - policy: Route policy whose code/message should be emitted.
 * - retryAfterSeconds: Client backoff period in whole seconds.
 *
 * Returns:
 * - JSON `429` response whose `message` field surfaces in the auth client.
 */
export function createAuthRateLimitError(
  policy: RateLimitPolicy,
  retryAfterSeconds: number,
) {
  return new Response(
    JSON.stringify({
      code: policy.errorCode,
      message: formatRateLimitMessage(policy, retryAfterSeconds),
    }),
    {
      headers: {
        "Content-Type": "application/json",
        ...createRateLimitHeaders(retryAfterSeconds),
      },
      status: 429,
    },
  );
}

/**
 * Emits structured logs for rate-limit decisions without leaking secrets.
 *
 * Parameters:
 * - level: Console severity used for the log line.
 * - message: Stable human-readable event label.
 * - metadata: Additional JSON-serializable event context.
 */
function logRateLimitEvent(
  level: "error" | "warn",
  message: string,
  metadata: Record<string, unknown>,
) {
  if (level === "error") {
    logger.error({ module: "security/rate-limit", ...metadata }, message);
    return;
  }

  logger.warn({ module: "security/rate-limit", ...metadata }, message);
}

/**
 * Normalizes dynamic key fragments before using them in Redis or memory maps.
 *
 * Parameters:
 * - value: Caller or resource identifier.
 *
 * Returns:
 * - Key-safe identifier with reserved separators removed.
 */
function sanitizeRateLimitKeyPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/giu, "_");
}
