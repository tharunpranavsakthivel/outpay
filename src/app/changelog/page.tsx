import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, createPageMetadata } from "@/lib/seo";
import Changelog from "../../views/Changelog";

export const metadata: Metadata = createPageMetadata({
  title: "Changelog | Product and API Updates",
  description:
    "Follow Outpay product releases, API changes, payment detection updates, webhook improvements, and dashboard fixes.",
  path: "/changelog",
  keywords: [
    "Outpay changelog",
    "stablecoin payments product updates",
    "USDC checkout API changes",
  ],
});

export default function ChangelogPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Changelog", path: "/changelog" },
        ])}
      />
      <Changelog />
    </>
  );
}
