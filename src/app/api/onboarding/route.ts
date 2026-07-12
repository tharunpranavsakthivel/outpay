/**
 * Creates the first merchant, owner membership, and payout wallet for the
 * authenticated user finishing onboarding.
 */
import { after } from "next/server";
import { jsonError } from "@/lib/dashboard/http";
import { completeMerchantOnboarding } from "@/lib/dashboard/server";
import { registerPrimaryWalletWithAlchemy } from "@/lib/providers/alchemy";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  getClientIp,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

export async function POST(request: Request) {
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

    const body = (await request.json()) as {
      storeDescription?: string;
      storeName?: string;
      walletAddress?: string;
      walletConfirmed?: boolean;
      walletSignature?: string;
      walletSignatureTimestampMs?: number;
    };
    const walletAddress = body.walletAddress?.trim() ?? "";
    const response = await completeMerchantOnboarding({
      storeDescription: body.storeDescription ?? "",
      storeName: body.storeName ?? "",
      walletAddress,
      walletConfirmed: Boolean(body.walletConfirmed),
      walletSignature: body.walletSignature ?? "",
      walletSignatureTimestampMs: body.walletSignatureTimestampMs ?? 0,
    });

    if (walletAddress) {
      // Address registration should not block merchant onboarding once the
      // wallet has been persisted locally.
      after(async () => {
        try {
          await registerPrimaryWalletWithAlchemy(walletAddress);
        } catch (error) {
          console.error(
            JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown Alchemy registration error",
              level: "error",
              message:
                "Alchemy address registration failed after merchant onboarding",
              module: "api/onboarding",
              timestamp: new Date().toISOString(),
              walletAddress,
            }),
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
    );
  }
}
