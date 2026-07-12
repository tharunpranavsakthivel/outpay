/**
 * Payout wallet mutation API for replacing the merchant's primary wallet.
 */
import { after } from "next/server";
import { jsonError } from "@/lib/dashboard/http";
import {
  getCurrentMerchantIdForRateLimit,
  replacePrimaryWallet,
} from "@/lib/dashboard/server";
import { logger, withRequestLogging } from "@/lib/logging/logger";
import { registerPrimaryWalletWithAlchemy } from "@/lib/providers/alchemy";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

async function updatePayoutWallet(request: Request) {
  try {
    const merchantId = await getCurrentMerchantIdForRateLimit();
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        scopeType: "merchant",
        scopeValue: merchantId,
      }),
      policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
      routeId: "/api/settings/payout-wallet POST",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        rateLimit.retryAfterSeconds,
      );
    }

    const body = (await request.json()) as {
      confirmed?: boolean;
      walletAddress?: string;
      walletSignature?: string;
      walletSignatureTimestampMs?: number;
    };
    const walletAddress = body.walletAddress?.trim() ?? "";
    const response = await replacePrimaryWallet({
      confirmed: Boolean(body.confirmed),
      walletAddress,
      walletSignature: body.walletSignature ?? "",
      walletSignatureTimestampMs: body.walletSignatureTimestampMs ?? 0,
    });

    if (walletAddress) {
      // The wallet change is already committed locally; provider registration is
      // scheduled post-response so the dashboard mutation stays fast.
      after(async () => {
        try {
          await registerPrimaryWalletWithAlchemy(walletAddress);
        } catch (error) {
          logger.error(
            { err: error },
            "Alchemy address registration failed after payout-wallet update",
          );
        }
      });
    }

    return Response.json(response);
  } catch (error) {
    return jsonError(
      422,
      "PAYOUT_WALLET_UPDATE_FAILED",
      error instanceof Error ? error.message : "Unable to update wallet.",
      undefined,
      error,
    );
  }
}

export const POST = withRequestLogging(
  "/api/settings/payout-wallet POST",
  updatePayoutWallet,
);
