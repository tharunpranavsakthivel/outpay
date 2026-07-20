import type { Metadata } from "next";
import { cache } from "react";
import { getPublicCheckoutData } from "@/lib/dashboard/server";
import { createPageMetadata } from "@/lib/seo";
import CustomerCheckout from "../../../views/CustomerCheckout";

const getCachedCheckoutData = cache((id: string) => getPublicCheckoutData(id));

/** Route: /checkout/[id] — public customer-facing checkout page. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  try {
    const checkout = await getCachedCheckoutData(id);
    return createPageMetadata({
      title: `${checkout.merchantName} payment`,
      description: `Complete the ${checkout.amountLabel} USDC payment for ${checkout.merchantName} on Base.`,
      path: `/checkout/${encodeURIComponent(id)}`,
      noIndex: true,
    });
  } catch {
    return createPageMetadata({
      title: "Hosted USDC Checkout",
      description:
        "Complete this exact-amount USDC payment on the Base network through Outpay's hosted checkout.",
      path: `/checkout/${encodeURIComponent(id)}`,
      noIndex: true,
    });
  }
}

export default async function CheckoutByIdPage({
  params,
}: PageProps<"/checkout/[id]">) {
  const { id } = await params;
  const data = await getCachedCheckoutData(id);
  return <CustomerCheckout initialData={data} />;
}
