import type { Metadata } from "next";
import { cache } from "react";
import { getPublicReceiptData } from "@/lib/dashboard/server";
import { createPageMetadata } from "@/lib/seo";
import PaymentReceipt from "../../../views/PaymentReceipt";

const getCachedReceiptData = cache((id: string) => getPublicReceiptData(id));

/** Route: /receipt/[id] — shown after a customer completes payment. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  try {
    const receipt = await getCachedReceiptData(id);
    return createPageMetadata({
      title: `${receipt.merchantName} payment receipt`,
      description: `Payment receipt for ${receipt.amountLabel} received by ${receipt.merchantName} on Base.`,
      path: `/receipt/${encodeURIComponent(id)}`,
      noIndex: true,
    });
  } catch {
    return createPageMetadata({
      title: "Payment Receipt",
      description:
        "View the confirmation details for an Outpay USDC payment on Base.",
      path: `/receipt/${encodeURIComponent(id)}`,
      noIndex: true,
    });
  }
}

export default async function ReceiptPage({
  params,
}: PageProps<"/receipt/[id]">) {
  const { id } = await params;
  const data = await getCachedReceiptData(id);
  return <PaymentReceipt initialData={data} />;
}
