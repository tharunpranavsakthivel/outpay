import { getPublicReceiptData } from "@/lib/dashboard/server";
import PaymentReceipt from "../../../views/PaymentReceipt";

/** Route: /receipt/[id] — shown after a customer completes payment. */
export default async function ReceiptPage({
  params,
}: PageProps<"/receipt/[id]">) {
  const { id } = await params;
  const data = await getPublicReceiptData(id);
  return <PaymentReceipt initialData={data} />;
}
