import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { getServerSession } from "@/lib/auth/server";
import { breadcrumbJsonLd, createPageMetadata } from "@/lib/seo";
import Home from "../views/Home";

/** Route: / - marketing homepage with Better Auth-aware account actions. */
export const metadata: Metadata = createPageMetadata({
  title: "USDC Stablecoin Checkout on Base",
  description:
    "Accept USDC on Base with hosted checkout, automatic on-chain payment detection, direct settlement, and signed fulfillment webhooks.",
  path: "/",
  keywords: [
    "USDC checkout",
    "stablecoin payments",
    "Base payments",
    "non-custodial checkout",
  ],
});

export default async function HomePage() {
  const session = await getServerSession();

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }])} />
      <Home
        authenticatedUser={
          session
            ? {
                email: session.user.email,
                name: session.user.name,
                picture: session.user.image ?? undefined,
              }
            : null
        }
      />
    </>
  );
}
