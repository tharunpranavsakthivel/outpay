import { jsonError } from "@/lib/dashboard/http";
import { replacePrimaryWallet } from "@/lib/dashboard/server";

/**
 * Payout wallet mutation API for replacing the merchant's primary wallet.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      confirmed?: boolean;
      walletAddress?: string;
    };

    return Response.json(
      await replacePrimaryWallet({
        confirmed: Boolean(body.confirmed),
        walletAddress: body.walletAddress ?? "",
      }),
    );
  } catch (error) {
    return jsonError(
      422,
      "PAYOUT_WALLET_UPDATE_FAILED",
      error instanceof Error ? error.message : "Unable to update wallet.",
    );
  }
}
