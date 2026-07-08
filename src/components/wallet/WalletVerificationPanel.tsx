"use client";

import { ShieldCheck, Wallet } from "lucide-react";
import { useState } from "react";
import {
  connectAndSignWalletChallenge,
  hasBrowserWallet,
  type WalletSignatureProof,
} from "@/lib/wallet/browser-wallet";
import {
  buildWalletChallengeMessage,
  verifyWalletOwnershipSignature,
} from "@/lib/wallet/verify-signature";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

/**
 * Wallet-ownership proof step shared by onboarding and the Settings
 * wallet-change modal. Prefers a browser-injected wallet (MetaMask-style
 * `eth_requestAccounts` + `personal_sign`); falls back to a manual path
 * where the merchant pastes a signature produced elsewhere over the same
 * challenge message. Either path still requires a real signature - this
 * fallback is a lower-trust *entry method*, not a way to skip verification.
 *
 * Parameters:
 * - address: Wallet address currently entered in the surrounding form.
 * - onAddressChange: Called when a connected wallet reports a different
 *   address than what was typed, so the caller can keep the two in sync.
 * - proof: The currently accepted signature proof, or null if unverified.
 * - onProofChange: Called with a verified proof, or null to clear it.
 */
export function WalletVerificationPanel({
  address,
  onAddressChange,
  proof,
  onProofChange,
}: {
  address: string;
  onAddressChange: (address: string) => void;
  proof: WalletSignatureProof | null;
  onProofChange: (proof: WalletSignatureProof | null) => void;
}) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pastedSignature, setPastedSignature] = useState("");
  const [manualTimestampMs, setManualTimestampMs] = useState(() => Date.now());
  const browserWalletAvailable = hasBrowserWallet();

  const connectWallet = async () => {
    setError(null);
    setIsConnecting(true);
    try {
      const nextProof = await connectAndSignWalletChallenge();
      onAddressChange(nextProof.address);
      onProofChange(nextProof);
    } catch (connectError) {
      onProofChange(null);
      setError(
        connectError instanceof Error
          ? connectError.message
          : "Unable to connect and sign with your wallet.",
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const verifyPastedSignature = async () => {
    setError(null);
    const trimmedAddress = address.trim();

    if (!trimmedAddress) {
      setError("Enter a wallet address first.");
      return;
    }

    const result = await verifyWalletOwnershipSignature({
      address: trimmedAddress,
      signature: pastedSignature.trim(),
      timestampMs: manualTimestampMs,
    });

    if (!result.ok) {
      onProofChange(null);
      setError(result.message);
      return;
    }

    onProofChange({
      address: trimmedAddress,
      signature: pastedSignature.trim(),
      timestampMs: manualTimestampMs,
    });
  };

  if (proof) {
    return (
      <div className="flex gap-2 items-start text-xs leading-[1.5] bg-primary/10 border border-border-brand rounded-lg p-3 text-foreground">
        <ShieldCheck size={14} className="shrink-0 mt-0.5" />
        <div className="min-w-0">
          <div className="font-medium">Wallet ownership verified</div>
          <div className="text-foreground-light break-all">
            Signed by {proof.address}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onProofChange(null)}
          className="ml-auto shrink-0 bg-transparent border-0 p-0 text-foreground-light underline underline-offset-2 cursor-pointer"
        >
          Reset
        </button>
      </div>
    );
  }

  if (browserWalletAvailable) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          size="medium"
          onClick={connectWallet}
          disabled={isConnecting}
        >
          <Wallet size={14} />
          {isConnecting ? "Waiting for wallet..." : "Connect wallet to verify"}
        </Button>
        {error && <div className="text-xs text-destructive">{error}</div>}
      </div>
    );
  }

  const trimmedAddress = address.trim();
  const challengeMessage = trimmedAddress
    ? buildWalletChallengeMessage({
        address: trimmedAddress,
        timestampMs: manualTimestampMs,
      })
    : null;

  return (
    <div className="flex flex-col gap-2.5 border border-border rounded-lg p-3">
      <div className="text-xs text-foreground-light leading-[1.5]">
        No browser wallet was detected. As a lower-trust fallback, sign the
        message below with your wallet through any other tool (hardware wallet
        app, `cast wallet sign`, etc.) and paste the resulting signature here.
      </div>
      {trimmedAddress ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <code className="text-[11px] bg-foreground/[0.04] border border-border rounded px-2 py-1.5 break-all flex-1">
              {challengeMessage}
            </code>
            <Button
              type="button"
              variant="text"
              size="tiny"
              onClick={() => setManualTimestampMs(Date.now())}
            >
              Refresh
            </Button>
          </div>
          <Input
            label="Signature"
            placeholder="0x..."
            value={pastedSignature}
            onChange={(event) => setPastedSignature(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            size="medium"
            disabled={!pastedSignature.trim()}
            onClick={verifyPastedSignature}
          >
            Verify signature
          </Button>
        </>
      ) : (
        <div className="text-xs text-foreground-lighter">
          Enter a wallet address above to generate the message to sign.
        </div>
      )}
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}
