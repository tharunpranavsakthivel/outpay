import { buildWalletChallengeMessage } from "./verify-signature";

/**
 * Minimal browser-injected wallet (MetaMask-style) connect flow used to
 * prove control of a payout wallet during onboarding and wallet replacement.
 * Scoped to `window.ethereum` (EIP-1193) providers for MVP; no WalletConnect
 * or RPC calls are made here, only the injected provider's `eth_requestAccounts`
 * and `personal_sign` methods.
 */

interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export interface WalletSignatureProof {
  address: string;
  signature: string;
  timestampMs: number;
}

/** True when a browser-injected wallet (e.g. MetaMask) is available. */
export function hasBrowserWallet(): boolean {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

/**
 * Requests account access from the injected wallet and signs the Outpay
 * payout-wallet ownership challenge with the connected account.
 *
 * Returns:
 * - The connected account address (the source of truth - the merchant may
 *   have typed a different address, so callers should use this value), the
 *   signature, and the timestamp embedded in the signed message.
 *
 * Throws:
 * - `Error` when no browser wallet is detected or the user rejects the
 *   connection/signature request.
 */
export async function connectAndSignWalletChallenge(): Promise<WalletSignatureProof> {
  const provider = window.ethereum;

  if (!provider) {
    throw new Error(
      "No browser wallet detected. Install MetaMask or use the manual verification path below.",
    );
  }

  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  const address = accounts[0];

  if (!address) {
    throw new Error("No wallet account was returned by the browser wallet.");
  }

  const timestampMs = Date.now();
  const message = buildWalletChallengeMessage({ address, timestampMs });
  const signature = (await provider.request({
    method: "personal_sign",
    params: [message, address],
  })) as string;

  return { address, signature, timestampMs };
}
