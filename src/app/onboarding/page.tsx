import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo";
import { OnboardingScreen } from "../../views/AuthScreens";

/** Route: /onboarding - 3-step merchant setup wizard. */
export const metadata: Metadata = createPageMetadata({
  title: "Set up your merchant account",
  description:
    "Configure your merchant profile and Base payout wallet in Outpay.",
  path: "/onboarding",
  noIndex: true,
});

export default OnboardingScreen;
