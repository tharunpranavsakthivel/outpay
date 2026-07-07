import { jsonError } from "@/lib/dashboard/http";
import { completeMerchantOnboarding } from "@/lib/dashboard/server";

/**
 * Creates the first merchant, owner membership, and payout wallet for the
 * authenticated user finishing onboarding.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      storeDescription?: string;
      storeName?: string;
      walletAddress?: string;
      walletConfirmed?: boolean;
    };

    return Response.json(
      await completeMerchantOnboarding({
        storeDescription: body.storeDescription ?? "",
        storeName: body.storeName ?? "",
        walletAddress: body.walletAddress ?? "",
        walletConfirmed: Boolean(body.walletConfirmed),
      }),
    );
  } catch (error) {
    return jsonError(
      422,
      "ONBOARDING_SUBMIT_FAILED",
      error instanceof Error ? error.message : "Unable to complete onboarding.",
    );
  }
}
