import { jsonError } from "@/lib/dashboard/http";
import {
  createApiKey,
  getCurrentMerchantIdForRateLimit,
  getDevelopersPageData,
} from "@/lib/dashboard/server";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

/**
 * Developers API key collection route for listing and creating keys.
 */
export async function GET() {
  try {
    const merchantId = await getCurrentMerchantIdForRateLimit();
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        scopeType: "merchant",
        scopeValue: merchantId,
      }),
      policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
      routeId: "/api/developers/api-keys GET",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        rateLimit.retryAfterSeconds,
      );
    }

    const data = await getDevelopersPageData();
    return Response.json({
      apiKeys: data.apiKeys,
      merchant: data.merchant,
    });
  } catch (error) {
    return jsonError(
      400,
      "API_KEYS_LOAD_FAILED",
      error instanceof Error ? error.message : "Unable to load API keys.",
    );
  }
}

/**
 * Creates a new one-time-reveal API secret mapped to api_keys.
 */
export async function POST(request: Request) {
  try {
    const merchantId = await getCurrentMerchantIdForRateLimit();
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.apiKeyCreate,
        scopeType: "merchant",
        scopeValue: merchantId,
      }),
      policy: RATE_LIMIT_POLICIES.apiKeyCreate,
      routeId: "/api/developers/api-keys POST",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.apiKeyCreate,
        rateLimit.retryAfterSeconds,
      );
    }

    const body = (await request.json()) as {
      environment?: "test" | "live";
      name?: string;
    };

    if (body.environment !== "test" && body.environment !== "live") {
      return jsonError(
        400,
        "INVALID_API_KEY_ENVIRONMENT",
        "API key environment must be either test or live.",
      );
    }

    return Response.json(
      await createApiKey({
        environment: body.environment,
        name: body.name ?? "",
      }),
      {
        status: 201,
      },
    );
  } catch (error) {
    return jsonError(
      422,
      "API_KEY_CREATE_FAILED",
      error instanceof Error ? error.message : "Unable to create API key.",
    );
  }
}
