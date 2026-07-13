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
export const WALLET_ADDRESS_CHECKSUM_ERROR =
  "This address's checksum doesn't match — please copy it directly from your wallet.";

const WALLET_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/u;

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
 * Checks whether an input has the structural shape of a Base EVM address.
 *
 * Parameters:
 * - address: Trimmed wallet address supplied by a merchant.
 *
 * Returns:
 * - `true` when the value has the `0x` prefix and exactly 40 hexadecimal
 *   characters; otherwise `false`.
 */
export function isWalletAddressFormatValid(address: string): boolean {
  return WALLET_ADDRESS_PATTERN.test(address);
}

/**
 * Cheap first-line check: rejects malformed addresses and, for mixed-case
 * input, addresses that fail EIP-55 checksum validation. All-lowercase and
 * all-uppercase hexadecimal bodies are valid unchecksummed representations.
 * Intended to run before the (comparatively expensive) signature-recovery
 * step.
 *
 * Parameters:
 * - address: Trimmed wallet address supplied by a merchant.
 *
 * Returns:
 * - `true` when the address is structurally valid and either unchecksummed or
 *   has a valid EIP-55 checksum; otherwise `false`.
 */
export function isChecksumValidAddress(address: string): boolean {
  if (!isWalletAddressFormatValid(address)) {
    return false;
  }

  const hexadecimalBody = address.slice(2);

  if (
    hexadecimalBody.toLowerCase() === hexadecimalBody ||
    hexadecimalBody.toUpperCase() === hexadecimalBody
  ) {
    return true;
  }

  return isAddress(address, { strict: true });
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
      message: WALLET_ADDRESS_CHECKSUM_ERROR,
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
