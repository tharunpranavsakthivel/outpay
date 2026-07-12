import {
  executeIdempotentRequest,
  getPublicApiRequestId,
  hashRequestBody,
  PublicApiError,
  parseIdempotencyKey,
  publicApiError,
  publicApiJson,
  validateCreateCheckoutApiRequest,
} from "@/lib/api/public";
import { authenticateApiKeyRequest } from "@/lib/auth/api-key";
import { createCheckoutForMerchant } from "@/lib/dashboard/server";
import { connectToDatabase } from "@/lib/database/client";
import { setRequestMerchantId, withRequestLogging } from "@/lib/logging/logger";
import { emitMetric, METRIC_NAMES } from "@/lib/observability/metrics";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createPublicApiRateLimitError,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

interface CreateCheckoutResponseBody {
  amount: string;
  chain: string;
  currency: "USDC";
  expiresAt: string;
  id: string;
  paymentUrl: string;
  recipient: {
    address: string;
    tokenContract: string;
  };
  status: string;
}

/**
 * Public v1 checkout-creation endpoint authenticated by merchant API keys.
 */
async function createApiCheckout(request: Request) {
  const requestId = getPublicApiRequestId(request);

  try {
    const auth = await authenticateApiKeyRequest(request);

    if (!auth) {
      return publicApiError(
        requestId,
        401,
        "INVALID_API_KEY",
        "Provide a valid API key in the Authorization header.",
      );
    }

    setRequestMerchantId(auth.merchantId);

    if (!auth.scopes.includes("checkouts:create")) {
      return publicApiError(
        requestId,
        403,
        "FORBIDDEN",
        "This API key does not include the checkouts:create scope.",
      );
    }

    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.checkoutCreate,
        scopeType: "merchant",
        scopeValue: auth.merchantId,
      }),
      policy: RATE_LIMIT_POLICIES.checkoutCreate,
      routeId: "/api/v1/checkouts POST",
    });

    if (!rateLimit.allowed) {
      return createPublicApiRateLimitError({
        policy: RATE_LIMIT_POLICIES.checkoutCreate,
        requestId,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }

    const body = validateCreateCheckoutApiRequest(await request.json());
    const idempotencyKey = parseIdempotencyKey(
      request.headers.get("Idempotency-Key"),
    );
    const requestHash = hashRequestBody(body);
    const database = await connectToDatabase();

    try {
      const result = await executeIdempotentRequest<CreateCheckoutResponseBody>(
        {
          create: async () => {
            const label =
              typeof body.metadata.orderId === "string" &&
              body.metadata.orderId.trim()
                ? body.metadata.orderId.trim()
                : "API checkout";
            const checkout = await createCheckoutForMerchant({
              actorType: "api_key",
              amount: body.amount,
              cancelUrl: body.cancelUrl,
              createdViaApiKeyId: auth.apiKeyId,
              customerEmail: body.customerEmail,
              idempotencyKey,
              label,
              merchantId: auth.merchantId,
              metadata: body.metadata,
              source: "api",
              successUrl: body.successUrl,
            });
            emitMetric(METRIC_NAMES.checkoutsCreatedTotal, 1, {
              merchant_id: auth.merchantId,
            });
            const responseBody = {
              amount: checkout.amount,
              chain: checkout.chain,
              currency: body.currency,
              expiresAt: checkout.expiresAt,
              id: checkout.checkoutRef,
              paymentUrl: new URL(
                checkout.paymentUrlPath,
                request.url,
              ).toString(),
              recipient: checkout.recipient,
              status: checkout.status,
            };

            return {
              body: responseBody,
              checkoutSessionId: checkout.checkoutSessionId,
              statusCode: 201,
            };
          },
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          idempotencyKey,
          requestHash,
          requestMethod: request.method,
          requestPath: new URL(request.url).pathname,
          store: {
            createRecord: async (input) => {
              await database.sql`
              insert into api_idempotency_keys (
                merchant_id,
                api_key_id,
                idempotency_key,
                request_method,
                request_path,
                request_hash,
                response_status_code,
                response_body,
                checkout_session_id,
                expires_at
              ) values (
                ${auth.merchantId},
                ${auth.apiKeyId},
                ${input.idempotencyKey},
                ${input.requestMethod},
                ${input.requestPath},
                ${input.requestHash},
                ${input.statusCode},
                ${JSON.stringify(input.body)}::jsonb,
                ${input.checkoutSessionId ?? null},
                ${input.expiresAt.toISOString()}
              )
            `;
            },
            findRecord: async (input) => {
              const rows = await database.sql<
                {
                  expires_at: string;
                  request_hash: string;
                  response_body: CreateCheckoutResponseBody | null;
                  response_status_code: number | null;
                }[]
              >`
              select
                request_hash,
                response_status_code,
                response_body,
                expires_at::text as expires_at
              from api_idempotency_keys
              where merchant_id = ${auth.merchantId}
                and request_method = ${input.requestMethod}
                and request_path = ${input.requestPath}
                and idempotency_key = ${input.idempotencyKey}
              limit 1
            `;
              const record = rows[0];

              return record
                ? {
                    body: record.response_body,
                    expiresAt: new Date(record.expires_at),
                    requestHash: record.request_hash,
                    statusCode: record.response_status_code,
                  }
                : null;
            },
          },
        },
      );

      return publicApiJson(requestId, result.body, {
        status: result.statusCode,
      });
    } finally {
      await database.release();
    }
  } catch (error) {
    if (error instanceof PublicApiError) {
      return publicApiError(
        requestId,
        error.status,
        error.code,
        error.message,
        error.details,
        undefined,
        error,
      );
    }

    return publicApiError(
      requestId,
      500,
      "CHECKOUT_CREATE_FAILED",
      error instanceof Error ? error.message : "Unable to create the checkout.",
      [],
      undefined,
      error,
    );
  }
}

export const POST = withRequestLogging(
  "/api/v1/checkouts POST",
  createApiCheckout,
);
