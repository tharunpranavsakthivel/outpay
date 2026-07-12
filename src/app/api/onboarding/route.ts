/**
 * Creates the first merchant, owner membership, and payout wallet for the
 * authenticated user finishing onboarding.
 */
import { after } from "next/server";
import { jsonError } from "@/lib/dashboard/http";
import { completeMerchantOnboarding } from "@/lib/dashboard/server";
import { logger, withRequestLogging } from "@/lib/logging/logger";
import { registerPrimaryWalletWithAlchemy } from "@/lib/providers/alchemy";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  getClientIp,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";
import { parseJsonBody } from "@/lib/validation/http";
import { onboardingBodySchema } from "@/lib/validation/routes";

async function completeOnboarding(request: Request) {
  try {
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.onboarding,
        scopeType: "ip",
        scopeValue: getClientIp(request),
      }),
      policy: RATE_LIMIT_POLICIES.onboarding,
      routeId: "/api/onboarding POST",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.onboarding,
        rateLimit.retryAfterSeconds,
      );
    }

    const parsedBody = await parseJsonBody(request, onboardingBodySchema);

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const body = parsedBody.data;
    const walletAddress = body.walletAddress;
    const response = await completeMerchantOnboarding({
      storeDescription: body.storeDescription,
      storeName: body.storeName,
      walletAddress,
      walletConfirmed: body.walletConfirmed,
      walletSignature: body.walletSignature,
      walletSignatureTimestampMs: body.walletSignatureTimestampMs,
    });

    if (walletAddress) {
      // Address registration should not block merchant onboarding once the
      // wallet has been persisted locally.
      after(async () => {
        try {
          await registerPrimaryWalletWithAlchemy(walletAddress);
        } catch (error) {
          logger.error(
            { err: error },
            "Alchemy address registration failed after merchant onboarding",
          );
        }
      });
    }

    return Response.json(response);
  } catch (error) {
    return jsonError(
      422,
      "ONBOARDING_SUBMIT_FAILED",
      error instanceof Error ? error.message : "Unable to complete onboarding.",
      undefined,
      error,
    );
  }
}

export const POST = withRequestLogging(
  "/api/onboarding POST",
  completeOnboarding,
);
