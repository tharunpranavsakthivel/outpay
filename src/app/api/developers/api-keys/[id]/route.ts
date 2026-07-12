import { jsonError } from "@/lib/dashboard/http";
import {
  ForbiddenRoleError,
  getCurrentMerchantIdForRateLimit,
  revokeApiKey,
} from "@/lib/dashboard/server";
import { withRequestLogging } from "@/lib/logging/logger";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";
import { parseJsonBody, parseRouteParams } from "@/lib/validation/http";
import {
  apiKeyActionBodySchema,
  idParamsSchema,
} from "@/lib/validation/routes";

/**
 * Developers API key mutation route for merchant-scoped lifecycle actions.
 */
async function updateApiKey(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const parsedParams = parseRouteParams(await context.params, idParamsSchema);

    if (!parsedParams.success) {
      return parsedParams.response;
    }

    const parsedBody = await parseJsonBody(request, apiKeyActionBodySchema);

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const merchantId = await getCurrentMerchantIdForRateLimit();
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        scopeType: "merchant",
        scopeValue: merchantId,
      }),
      policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
      routeId: "/api/developers/api-keys/[id] PATCH",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        rateLimit.retryAfterSeconds,
      );
    }

    const { id } = parsedParams.data;

    return Response.json(
      {
        apiKey: await revokeApiKey({
          apiKeyId: id,
        }),
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof ForbiddenRoleError) {
      return jsonError(403, error.code, error.message, undefined, error);
    }

    const message =
      error instanceof Error ? error.message : "Unable to update the API key.";
    const status = message.includes("not found") ? 404 : 422;

    return jsonError(
      status,
      "API_KEY_UPDATE_FAILED",
      message,
      undefined,
      error,
    );
  }
}

export const PATCH = withRequestLogging(
  "/api/developers/api-keys/[id] PATCH",
  updateApiKey,
);
