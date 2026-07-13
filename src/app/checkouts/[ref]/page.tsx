import { notFound } from "next/navigation";
import { withMerchantContext } from "@/lib/dashboard/route";
import {
  getCheckoutDetailPageData,
  MerchantCheckoutNotFoundError,
} from "@/lib/dashboard/server";
import CheckoutDetail from "../../../views/CheckoutDetail";

/** Route: /checkouts/[ref] — authenticated merchant checkout detail. */
export default async function CheckoutDetailPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  try {
    const data = await withMerchantContext(
      () => getCheckoutDetailPageData(ref),
      `/checkouts/${ref}`,
    );

    return <CheckoutDetail initialData={data} />;
  } catch (error) {
    if (error instanceof MerchantCheckoutNotFoundError) {
      notFound();
    }

    throw error;
  }
}
