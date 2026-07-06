"use client";

import { use } from "react";
import PaymentReceipt from "../../../views/PaymentReceipt";

/**
 * Route: /receipt/[id] — shown after a customer completes payment. Replace
 * the hardcoded defaults with a real fetch keyed on `id`.
 */
export default function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <PaymentReceipt orderDescription={`Checkout ${id}`} />;
}
