/**
 * Payout wallet mutation API for replacing the merchant's primary wallet.
 */
import { after } from "next/server";
import { jsonError } from "@/lib/dashboard/http";
import { replacePrimaryWallet } from "@/lib/dashboard/server";
import { registerPrimaryWalletWithAlchemy } from "@/lib/providers/alchemy";

export async function POST(request: Request) {
  try {
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
          console.error(
            JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown Alchemy registration error",
              level: "error",
              message:
                "Alchemy address registration failed after payout-wallet update",
              module: "api/settings/payout-wallet",
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
      "PAYOUT_WALLET_UPDATE_FAILED",
      error instanceof Error ? error.message : "Unable to update wallet.",
    );
  }
}
