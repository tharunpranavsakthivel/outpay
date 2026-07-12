"use client";

import { NON_CUSTODIAL_DISCLAIMER } from "../lib/legal/compliance";

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
    "Data retention",
    "Your choices",
    "Changes to this policy",
  ],
};

const SECTION_CONTENT: Record<LegalDocType, Record<string, string>> = {
  "Terms of Service": {
    "Acceptance of terms":
      "These Terms of Service are an interim product draft pending review and approval by qualified legal counsel. By creating an Outpay account, accessing the dashboard, or using an Outpay checkout, you confirm that you are authorized to act for yourself or your business and agree to these terms. If you do not agree, do not use the service.",
    "Using Outpay checkout":
      "Outpay provides tools to create checkout sessions, display payment instructions, verify supported on-chain payments, and notify merchants about payment status. Outpay does not guarantee that a transaction will confirm, that a wallet provider will remain available, or that a customer will send the correct asset, network, amount, or recipient. Merchants are responsible for the prices, descriptions, expiry settings, wallet addresses, refunds, and customer support attached to their checkouts.",
    "Merchant responsibilities":
      "Merchants must use Outpay only for lawful goods and services, maintain accurate business and support information, and comply with applicable tax, consumer-protection, payments, sanctions, export-control, and privacy laws. Outpay maintains a prohibited businesses policy and may restrict categories of business, jurisdictions, wallets, or transactions that present legal, fraud, sanctions, or abuse risk. Where required by the business model or law, Outpay may request merchant KYB information, apply sanctions screening, or conduct transaction monitoring before allowing continued use.",
    "Non-custodial payments": `${NON_CUSTODIAL_DISCLAIMER} A customer authorizes a blockchain transaction through the customer's wallet, and a merchant controls the receiving wallet. Cryptocurrency payments are generally irreversible; Outpay cannot reverse, recall, or recover a payment sent to the wrong address, on the wrong network, or in the wrong amount.`,
    "Limitation of liability":
      "Outpay is provided on an as-available basis. To the maximum extent permitted by law, Outpay is not responsible for blockchain congestion, protocol changes, wallet or exchange failures, incorrect payment details, lost keys, unsupported assets, fraud by a customer or merchant, or indirect, incidental, special, consequential, or punitive losses. Counsel should review and finalize any exclusions, warranties, liability cap, indemnity, dispute-resolution, and governing-law terms before production use.",
    "Changes to these terms":
      "We may update these terms to reflect product, legal, or security changes. We will post the revised version with a new effective date and, where appropriate, provide additional notice. Continued use after the effective date means you accept the revised terms. Material changes should be reviewed by legal counsel before publication.",
  },
  "Privacy Policy": {
    "Information we collect":
      "This interim Privacy Policy is pending review and approval by qualified legal counsel. We may collect account details such as name, email address, login and session records, merchant profile and support details, checkout and payment metadata, wallet addresses, transaction hashes, device and request information, and messages sent to support. We do not need a customer's private key or seed phrase to provide the service and you must never submit one to Outpay.",
    "How we use your information":
      "We use information to provide authentication, create and display checkout sessions, verify supported payments, protect the service from fraud and abuse, send operational notifications, provide support, maintain security and reliability, comply with legal obligations, and measure product performance. We do not use customer wallet credentials to access funds.",
    "On-chain data":
      "Blockchain networks are public and permanent. When a wallet submits a transaction, the wallet address, transaction hash, token, amount, recipient, block data, and related information may be visible on the network and to anyone who inspects it. Outpay cannot delete or alter data already recorded on a public blockchain.",
    "Data sharing":
      "We may share information with infrastructure, database, authentication, analytics, payment-verification, communications, and security providers that process it for us; with merchants when needed to identify a checkout or payment; with professional advisers; or when required to comply with law, protect rights, investigate abuse, or respond to a valid legal process. We do not sell private keys or wallet credentials.",
    "Data retention":
      "We retain account, merchant, checkout, payment, audit, and support records for as long as reasonably necessary to provide the service, prevent abuse, resolve disputes, satisfy accounting and legal obligations, and maintain security. Retention periods and deletion procedures will be finalized with counsel and documented before production launch. Public blockchain records remain outside Outpay's control and may persist indefinitely.",
    "Your choices":
      "Subject to applicable law, you may ask to access, correct, export, or delete personal information associated with your account, or object to certain processing. Some records may need to be retained for legal, security, fraud-prevention, dispute, or accounting reasons. Contact legal@outpay.dev to make a request or ask a privacy question.",
    "Changes to this policy":
      "We may update this policy when our processing, product, or legal obligations change. The revised policy will be posted with a new effective date. Material changes should be reviewed by legal counsel and, where appropriate, communicated directly to affected users.",
  },
};

/**
 * Legal page shell — pass `docType` to render the interim Terms of Service or
 * Privacy Policy copy while counsel prepares the final documents.
 */
export default function LegalPage({
  docType = "Terms of Service" as LegalDocType,
}: {
  docType?: LegalDocType;
}) {
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
          <p className="m-0">{introText}</p>
          <p className="m-0 mt-3 text-xs text-warning">
            Interim product copy pending legal counsel review and approval.
          </p>
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
              {SECTION_CONTENT[docType][heading]}
            </div>
          </div>
        ))}

        <div className="flex flex-col gap-1.5 pt-7 mt-6 border-t border-border">
          <div className="text-xs text-foreground-lighter leading-[1.6]">
            Questions about this document? Contact us at{" "}
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
