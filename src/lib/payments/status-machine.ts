/**
 * Status-transition helpers for payment detection.
 *
 * The checked-in database enums are narrower than the aspirational architecture
 * state machine, so this module maps T-6 outcomes onto the concrete
 * `checkout_sessions.status`, `payment_intents.match_status`, and
 * `payments.status` values that exist today.
 */

export type CheckoutStatus =
  | "deactivated"
  | "detected"
  | "expired"
  | "failed"
  | "paid"
  | "pending";
export type CheckoutReasonCode =
  | "created"
  | "expired_timeout"
  | "invalid_payment"
  | "manual_deactivation"
  | "payment_confirmed"
  | "payment_detected"
  | "reactivated";
export type PaymentIntentStatus =
  | "awaiting_payment"
  | "confirmed"
  | "detected"
  | "expired"
  | "mismatched";
export type PaymentStatus = "expired" | "failed" | "paid" | "pending";

export interface StatusTransition {
  checkoutMessage: string;
  checkoutReasonCode: CheckoutReasonCode;
  checkoutStatus: CheckoutStatus;
  notificationType?: "payment_paid" | "payment_pending";
  paymentIntentStatus: PaymentIntentStatus;
  paymentStatus?: PaymentStatus;
}

/**
 * Returns the persisted status mapping for a successful-but-unconfirmed match.
 *
 * Parameters:
 * - checkoutRef: Human-facing checkout reference used in history messages.
 * - confirmations: Current transfer confirmations.
 * - requiredConfirmations: Minimum confirmations required before settlement.
 *
 * Returns:
 * - Status transition metadata for a detected payment awaiting settlement.
 */
export function buildDetectedTransition(input: {
  checkoutRef: string;
  confirmations: number;
  requiredConfirmations: number;
}): StatusTransition {
  return {
    checkoutMessage: `Checkout ${input.checkoutRef} has a detected payment with ${input.confirmations}/${input.requiredConfirmations} confirmations.`,
    checkoutReasonCode: "payment_detected",
    checkoutStatus: "detected",
    notificationType: "payment_pending",
    paymentIntentStatus: "detected",
    paymentStatus: "pending",
  };
}

/**
 * Returns the persisted status mapping for a fully confirmed settlement.
 *
 * Parameters:
 * - checkoutRef: Human-facing checkout reference used in history messages.
 *
 * Returns:
 * - Status transition metadata for a paid checkout.
 */
export function buildPaidTransition(checkoutRef: string): StatusTransition {
  return {
    checkoutMessage: `Checkout ${checkoutRef} was marked paid after on-chain confirmation.`,
    checkoutReasonCode: "payment_confirmed",
    checkoutStatus: "paid",
    notificationType: "payment_paid",
    paymentIntentStatus: "confirmed",
    paymentStatus: "paid",
  };
}

/**
 * Returns the persisted status mapping for terminal amount mismatches.
 *
 * Parameters:
 * - checkoutRef: Human-facing checkout reference used in history messages.
 * - description: Short failure description included in the history message.
 *
 * Returns:
 * - Status transition metadata for a failed checkout.
 */
export function buildMismatchTransition(
  checkoutRef: string,
  description: string,
): StatusTransition {
  return {
    checkoutMessage: `Checkout ${checkoutRef} received an invalid payment: ${description}.`,
    checkoutReasonCode: "invalid_payment",
    checkoutStatus: "failed",
    paymentIntentStatus: "mismatched",
    paymentStatus: "failed",
  };
}

/**
 * Returns the persisted status mapping for post-expiry transfers.
 *
 * Parameters:
 * - checkoutRef: Human-facing checkout reference used in history messages.
 *
 * Returns:
 * - Status transition metadata for a late payment.
 */
export function buildLateTransition(checkoutRef: string): StatusTransition {
  return {
    checkoutMessage: `Checkout ${checkoutRef} received a payment after the expiry window closed.`,
    checkoutReasonCode: "invalid_payment",
    checkoutStatus: "expired",
    paymentIntentStatus: "expired",
    paymentStatus: "expired",
  };
}
