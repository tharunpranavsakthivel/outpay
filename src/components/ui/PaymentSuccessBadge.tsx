"use client";

import { CheckCircle2 } from "lucide-react";

export interface PaymentSuccessBadgeProps {
  /**
   * Plays the entrance pop + ring animation once. Pass `false` to render the
   * same badge in its final state with no motion — e.g. when a checkout
   * page loads fresh and is already `paid`, where replaying the celebration
   * would be noise rather than feedback. `prefers-reduced-motion` is
   * handled separately in CSS regardless of this prop.
   */
  animate?: boolean;
}

/**
 * Checkmark badge shown on the customer checkout page when a payment is
 * detected as paid. Mirrors the badge markup already used on the public
 * receipt page (`PaymentReceipt.tsx`) for visual consistency, with an
 * optional one-time entrance animation layered on top.
 */
export function PaymentSuccessBadge({
  animate = true,
}: PaymentSuccessBadgeProps) {
  return (
    <div
      className="relative flex items-center justify-center w-12 h-12"
      role="img"
      aria-label="Payment successful"
    >
      {animate && (
        <span
          className="absolute inset-0 rounded-full bg-primary/20 op-success-ring"
          aria-hidden="true"
        />
      )}
      <div
        className={[
          "relative w-12 h-12 rounded-full bg-primary/[0.14] flex items-center justify-center",
          animate ? "op-success-badge" : "",
        ].join(" ")}
      >
        <CheckCircle2 size={26} />
      </div>
    </div>
  );
}
