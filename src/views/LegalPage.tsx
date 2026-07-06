"use client";

export type LegalDocType = "Terms of Service" | "Privacy Policy";

const SECTION_HEADINGS: Record<LegalDocType, string[]> = {
  "Terms of Service": [
    "Acceptance of terms",
    "Using Outpay checkout",
    "Merchant responsibilities",
    "Non-custodial payments",
    "Limitation of liability",
    "Changes to these terms",
  ],
  "Privacy Policy": [
    "Information we collect",
    "How we use your information",
    "On-chain data",
    "Data sharing",
    "Your choices",
    "Changes to this policy",
  ],
};

/**
 * Legal page shell — pass `docType` to render Terms of Service or Privacy
 * Policy. Section bodies are placeholders; replace with real legal copy.
 */
export default function LegalPage({
  docType = "Terms of Service" as LegalDocType,
}: {
  docType?: LegalDocType;
}) {
  const docKind = docType === "Privacy Policy" ? "policy" : "agreement";
  const headings = SECTION_HEADINGS[docType];
  const introText =
    docType === "Privacy Policy"
      ? "This policy explains what information Outpay collects, how it is used, and the choices available to you as a merchant or customer of the platform."
      : "These terms govern your use of Outpay to create checkout links and accept USDC payments. By using Outpay, you agree to the terms below.";

  return (
    <div className="bg-background min-h-screen font-sans flex flex-col">
      <div className="border-b border-border">
        <div className="max-w-content mx-auto flex items-center h-16 px-8">
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
            Outpay
          </span>
        </div>
      </div>

      <div className="max-w-[680px] mx-auto w-full px-6 pt-16 pb-24 flex flex-col gap-2">
        <h1 className="text-[30px] font-semibold tracking-[-0.01em] text-foreground m-0">
          {docType}
        </h1>
        <div className="text-xs text-foreground-lighter mb-8">
          Last updated July 6, 2026
        </div>
        <div className="text-sm text-foreground-light leading-[1.7] mb-8">
          {introText}
        </div>

        {headings.map((heading) => (
          <div
            key={heading}
            className="flex flex-col gap-2.5 pt-7 border-t border-border mt-1"
          >
            <div className="text-base font-semibold text-foreground">
              {heading}
            </div>
            <div className="text-[13.5px] text-foreground-light leading-[1.7]">
              [Placeholder — replace with your actual {docKind} language for
              this section.]
            </div>
          </div>
        ))}

        <div className="flex flex-col gap-1.5 pt-7 mt-6 border-t border-border">
          <div className="text-xs text-foreground-lighter leading-[1.6]">
            Questions about this {docKind}? Contact us at{" "}
            <span className="text-foreground font-medium">
              legal@outpay.dev
            </span>
            .
          </div>
        </div>
      </div>

      <div className="border-t border-border py-6 px-8 text-center">
        <div className="text-xs text-foreground-lighter">
          © 2026 Outpay. Non-custodial checkout for USDC on Base.
        </div>
      </div>
    </div>
  );
}
