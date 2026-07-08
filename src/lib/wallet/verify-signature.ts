import { isAddress, recoverMessageAddress } from "viem";

/**
 * Wallet-ownership signature verification. Pure crypto only (no RPC calls) so
 * this is safe to run in both server route handlers and tests: the merchant
 * proves control of a payout wallet by signing a short-lived challenge
 * message with the wallet's private key, and we recover the signer address
 * from that signature and compare it to the claimed address.
 */

/** Signatures are only accepted within this window to prevent replaying an
 * old signature against a later wallet-change request. */
export const WALLET_CHALLENGE_MAX_AGE_MS = 5 * 60 * 1000;

export type WalletVerificationFailureReason =
  | "invalid_address_checksum"
  | "signature_timestamp_stale"
  | "signature_timestamp_invalid"
  | "signature_mismatch";

export type WalletVerificationResult =
  | { ok: true }
  | { ok: false; reason: WalletVerificationFailureReason; message: string };

/**
 * Builds the exact message the merchant's wallet must sign to prove control
 * of `address`. Client and server must construct this identically so the
 * server can reconstruct the expected message from the claimed address and
 * timestamp before verifying the signature against it.
 */
export function buildWalletChallengeMessage(input: {
  address: string;
  timestampMs: number;
}): string {
  return `Confirm Outpay payout wallet: ${input.address} at ${new Date(input.timestampMs).toISOString()}`;
}

/**
 * Cheap first-line check: rejects malformed addresses and, for mixed-case
 * input, addresses that fail EIP-55 checksum validation. Intended to run
 * before the (comparatively expensive) signature-recovery step.
 */
export function isChecksumValidAddress(address: string): boolean {
  return isAddress(address);
}

/**
 * Verifies that `signature` was produced by the private key controlling
 * `address` over the challenge message for `timestampMs`, and that the
 * timestamp is recent enough to not be a replayed signature.
 *
 * Parameters:
 * - address: Wallet address the merchant claims to control.
 * - signature: Hex-encoded personal_sign signature over the challenge message.
 * - timestampMs: Epoch milliseconds embedded in the signed challenge message.
 * - now: Injectable clock for testing; defaults to the current time.
 *
 * Returns:
 * - `{ ok: true }` when the signature recovers to `address` and the
 *   timestamp is fresh.
 * - `{ ok: false, reason, message }` otherwise.
 */
export async function verifyWalletOwnershipSignature(input: {
  address: string;
  signature: string;
  timestampMs: number;
  now?: number;
}): Promise<WalletVerificationResult> {
  const now = input.now ?? Date.now();

  if (!isChecksumValidAddress(input.address)) {
    return {
      ok: false,
      reason: "invalid_address_checksum",
      message:
        "Wallet address failed EIP-55 checksum validation. Double-check the address casing.",
    };
  }

  if (
    !Number.isFinite(input.timestampMs) ||
    input.timestampMs <= 0 ||
    input.timestampMs > now
  ) {
    return {
      ok: false,
      reason: "signature_timestamp_invalid",
      message: "Signed challenge timestamp is invalid.",
    };
  }

  if (now - input.timestampMs > WALLET_CHALLENGE_MAX_AGE_MS) {
    return {
      ok: false,
      reason: "signature_timestamp_stale",
      message:
        "This wallet signature has expired. Sign the challenge again to continue.",
    };
  }

  const message = buildWalletChallengeMessage({
    address: input.address,
    timestampMs: input.timestampMs,
  });

  try {
    const recoveredAddress = await recoverMessageAddress({
      message,
      signature: input.signature as `0x${string}`,
    });

    if (recoveredAddress.toLowerCase() !== input.address.toLowerCase()) {
      return {
        ok: false,
        reason: "signature_mismatch",
        message:
          "The signature does not match the claimed wallet address. Sign with the wallet you want to use for payouts.",
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      reason: "signature_mismatch",
      message: "Unable to verify the wallet signature.",
    };
  }
}
