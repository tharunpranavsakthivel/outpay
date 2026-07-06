"use client";

import { use } from "react";
import CustomerCheckout from "../../../views/CustomerCheckout";

/**
 * Route: /checkout/[id] — public customer-facing checkout page. Replace the
 * hardcoded defaults with a real fetch keyed on `id` (Server Component +
 * `fetch` in a wrapping layer, or a client fetch here).
 */
export default function CheckoutByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <CustomerCheckout
      amount="124.00"
      orderDescription={`Checkout ${id}`}
      showDemoControl={false}
    />
  );
}
