/**
 * Unit tests for the wallet-ownership signature verification helper backing
 * T-2: a merchant must cryptographically prove control of a payout wallet
 * before it is accepted, and stale/mismatched/invalid-checksum signatures
 * must all be rejected.
 */

import { describe, expect, it } from "bun:test";
import { privateKeyToAccount } from "viem/accounts";
import {
  buildWalletChallengeMessage,
  isChecksumValidAddress,
  verifyWalletOwnershipSignature,
  WALLET_CHALLENGE_MAX_AGE_MS,
} from "@/lib/wallet/verify-signature";

const PRIVATE_KEY =
  "0x6eaca4acdae3dffd88fdb6cdf4ba30c7320910a53282df13b9e13cd7f9e4051e" as `0x${string}`;
const account = privateKeyToAccount(PRIVATE_KEY);
const OWNED_ADDRESS = account.address;
const OTHER_PRIVATE_KEY =
  "0xc0f3d7161f966a6e86214633795972f013d61b33e92c8eff9c60d74b2567c012" as `0x${string}`;
const otherAccount = privateKeyToAccount(OTHER_PRIVATE_KEY);

async function signChallenge(timestampMs: number) {
  const message = buildWalletChallengeMessage({
    address: OWNED_ADDRESS,
    timestampMs,
  });
  return account.signMessage({ message });
}

describe("wallet ownership signature verification", () => {
  it("accepts a valid, fresh signature from the claimed address", async () => {
    const timestampMs = Date.now();
    const signature = await signChallenge(timestampMs);

    const result = await verifyWalletOwnershipSignature({
      address: OWNED_ADDRESS,
      signature,
      timestampMs,
    });

    expect(result.ok).toBe(true);
  });

  it("rejects a signature produced by a different wallet", async () => {
    const timestampMs = Date.now();
    const message = buildWalletChallengeMessage({
      address: OWNED_ADDRESS,
      timestampMs,
    });
    const mismatchedSignature = await otherAccount.signMessage({ message });

    const result = await verifyWalletOwnershipSignature({
      address: OWNED_ADDRESS,
      signature: mismatchedSignature,
      timestampMs,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("signature_mismatch");
    }
  });

  it("rejects a stale signature older than the replay window", async () => {
    const timestampMs = Date.now() - (WALLET_CHALLENGE_MAX_AGE_MS + 1_000);
    const signature = await signChallenge(timestampMs);

    const result = await verifyWalletOwnershipSignature({
      address: OWNED_ADDRESS,
      signature,
      timestampMs,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("signature_timestamp_stale");
    }
  });

  it("rejects a checksum-invalid address before the signature is checked", async () => {
    const timestampMs = Date.now();
    // Flip the case of the first alphabetic character to break the EIP-55
    // checksum while keeping the address otherwise well-formed.
    const letterIndex = [...OWNED_ADDRESS].findIndex(
      (char, index) => index >= 2 && /[a-fA-F]/.test(char),
    );
    const flippedChar =
      OWNED_ADDRESS[letterIndex] === OWNED_ADDRESS[letterIndex].toLowerCase()
        ? OWNED_ADDRESS[letterIndex].toUpperCase()
        : OWNED_ADDRESS[letterIndex].toLowerCase();
    const badChecksumAddress =
      OWNED_ADDRESS.slice(0, letterIndex) +
      flippedChar +
      OWNED_ADDRESS.slice(letterIndex + 1);
    // Sign with the (correct) owned address's message, but claim a
    // checksum-mangled version of it - the checksum check must fail first.
    const signature = await signChallenge(timestampMs);

    expect(isChecksumValidAddress(badChecksumAddress)).toBe(false);

    const result = await verifyWalletOwnershipSignature({
      address: badChecksumAddress,
      signature,
      timestampMs,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_address_checksum");
    }
  });

  it("accepts all-lowercase addresses (no checksum information to validate)", () => {
    expect(isChecksumValidAddress(OWNED_ADDRESS.toLowerCase())).toBe(true);
  });
});
