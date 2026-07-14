/**
 * Better Auth catch-all route handler mounted at `/api/auth/*`.
 */

import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { createJsonAuthRequest } from "@/lib/auth/request";
import {
  applyServerLegalAcceptance,
  hasRequiredSignupLegalAcceptance,
  LEGAL_ACCEPTANCE_REQUIRED_MESSAGE,
} from "@/lib/legal/acceptance";
import { logger, withRequestLogging } from "@/lib/logging/logger";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createAuthRateLimitError,
  getClientIp,
  isSignupRateLimitEnabled,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

const authHandlers = toNextJsHandler(auth);
const SIGNUP_PATH_SUFFIX = "/sign-up/email";

type AuthPayload = Record<string, unknown>;

/**
 * Parses the signup request body without consuming the request passed to
 * Better Auth.
 *
 * Parameters:
 * - request: Incoming auth request whose clone is safe to consume.
 *
 * Returns:
 * - Parsed object payload, or `null` when the body cannot be parsed.
 */
async function readAuthPayload(request: Request): Promise<AuthPayload | null> {
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const payload: unknown = await request.clone().json();
      return isAuthPayload(payload) ? payload : null;
    }

    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await request.clone().formData();
      return Object.fromEntries(formData.entries());
    }
  } catch (error) {
    logger.error(
      { err: error },
      "Unable to parse signup legal acceptance payload",
    );
    return null;
  }

  return null;
}

/**
 * Confirms that decoded request data is an object suitable for auth fields.
 *
 * Parameters:
 * - payload: Unknown decoded request data.
 *
 * Returns:
 * - `true` for a non-null, non-array object.
 */
function isAuthPayload(payload: unknown): payload is AuthPayload {
  return (
    typeof payload === "object" && payload !== null && !Array.isArray(payload)
  );
}

/**
 * Resolves whether the current auth action should be rate limited before
 * Better Auth handles the request body and session side effects.
 *
 * Parameters:
 * - request: Incoming Better Auth route-handler request.
 *
 * Returns:
 * - `429` response when the route has exceeded its configured limit.
 * - `null` when no auth-specific limit applies or the request is allowed.
 */
async function maybeRateLimitAuthPost(request: Request) {
  const pathname = new URL(request.url).pathname;
  const clientIp = getClientIp(request);
  const isSignupPath = pathname.endsWith(SIGNUP_PATH_SUFFIX);

  // Keep the signup policy and storage implementation available for a future
  // re-enable, but avoid locking out legitimate testers while signup is being
  // stabilized. Other auth policies remain enforced below.
  if (isSignupPath && !isSignupRateLimitEnabled()) {
    return null;
  }

  const matchedPolicy = pathname.endsWith("/sign-in/email")
    ? RATE_LIMIT_POLICIES.authLogin
    : isSignupPath
      ? RATE_LIMIT_POLICIES.authSignup
      : pathname.endsWith("/request-password-reset")
        ? RATE_LIMIT_POLICIES.authPasswordReset
        : null;

  if (!matchedPolicy) {
    return null;
  }

  const rateLimit = await consumeRateLimit({
    key: buildRateLimitKey({
      policy: matchedPolicy,
      scopeType: "ip",
      scopeValue: clientIp,
    }),
    policy: matchedPolicy,
    routeId: pathname,
  });

  if (!rateLimit.allowed) {
    return createAuthRateLimitError(matchedPolicy, rateLimit.retryAfterSeconds);
  }

  return null;
}

export const DELETE = withRequestLogging(
  "/api/auth DELETE",
  authHandlers.DELETE,
);
export const GET = withRequestLogging("/api/auth GET", authHandlers.GET);
export const PATCH = withRequestLogging("/api/auth PATCH", authHandlers.PATCH);
export const PUT = withRequestLogging("/api/auth PUT", authHandlers.PUT);

async function handleAuthPost(request: Request) {
  const rateLimitedResponse = await maybeRateLimitAuthPost(request);

  if (rateLimitedResponse) {
    return rateLimitedResponse;
  }

  if (!new URL(request.url).pathname.endsWith(SIGNUP_PATH_SUFFIX)) {
    return authHandlers.POST(request);
  }

  const payload = await readAuthPayload(request);

  if (!payload || !hasRequiredSignupLegalAcceptance(payload)) {
    return Response.json(
      {
        error: {
          code: "LEGAL_ACCEPTANCE_REQUIRED",
          message: LEGAL_ACCEPTANCE_REQUIRED_MESSAGE,
        },
      },
      { status: 422 },
    );
  }

  return authHandlers.POST(
    createJsonAuthRequest(request, applyServerLegalAcceptance(payload)),
  );
}

export const POST = withRequestLogging("/api/auth POST", handleAuthPost);
