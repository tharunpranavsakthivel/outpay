"use client";

import { Building2, Mail, MessageSquare } from "lucide-react";
import { type FormEvent, useState } from "react";
import { MarketingFooter } from "../components/layout/MarketingFooter";
import { MarketingNavbar } from "../components/layout/MarketingNavbar";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

const CONTACT_REASONS = [
  {
    Icon: Building2,
    title: "Corporate pricing",
    desc: "Volume terms for merchants processing beyond the standard free allowance.",
  },
  {
    Icon: MessageSquare,
    title: "Implementation planning",
    desc: "Plan API, webhook, and checkout migration details before rollout.",
  },
  {
    Icon: Mail,
    title: "Partnerships",
    desc: "Talk with the team about ecosystem, agency, or platform partnerships.",
  },
];

type SubmissionState =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

interface ContactErrorPayload {
  error?: {
    details?: Array<{ field?: string; issue: string }>;
    message?: string;
  };
}

/** Contact page for corporate pricing, implementation help, and partnerships. */
export default function Contact() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionState, setSubmissionState] = useState<SubmissionState>({
    kind: "idle",
  });

  /**
   * Sends the contact form to the public API and updates user-visible status.
   *
   * Parameters:
   * - event: Browser submit event for the contact form.
   *
   * Returns:
   * - A promise that resolves after the request has been handled.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmissionState({ kind: "idle" });

    try {
      const form = event.currentTarget;
      const response = await fetch("/api/contact", {
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as ContactErrorPayload;

      if (!response.ok) {
        const details = payload.error?.details
          ?.map((detail) => `${detail.field ?? "Form"}: ${detail.issue}`)
          .join(" ");

        setSubmissionState({
          kind: "error",
          message:
            details ||
            payload.error?.message ||
            "Unable to submit your request. Please try again shortly.",
        });
        return;
      }

      form.reset();
      setSubmissionState({
        kind: "success",
        message: "Thanks — your inquiry has been sent to the Outpay team.",
      });
    } catch {
      setSubmissionState({
        kind: "error",
        message: "Unable to reach Outpay. Please try again shortly.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bg-background min-h-screen font-sans flex flex-col">
      <div className="sticky top-0 z-20">
        <MarketingNavbar activeHref="/company" />
      </div>

      <div className="max-w-content mx-auto grid grid-cols-1 items-start gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16 lg:py-[88px]">
        <div className="op-hero-in flex flex-col gap-5">
          <div className="heading-meta text-foreground-lighter">Contact</div>
          <h1 className="text-[36px] font-semibold tracking-normal leading-[1.12] text-foreground m-0 sm:text-[48px] sm:leading-[1.08]">
            Talk to Outpay about stablecoin checkout at scale.
          </h1>
          <p className="text-base leading-[1.6] text-foreground-light m-0">
            Tell us about your transaction volume, checkout stack, and USDC
            payment requirements. We will route your inquiry to the right next
            step.
          </p>
          <div className="grid grid-cols-1 gap-3 pt-2">
            <h2 className="text-lg font-semibold text-foreground m-0">
              How can we help?
            </h2>
            {CONTACT_REASONS.map((reason) => (
              <div key={reason.title} className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
                  <reason.Icon size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {reason.title}
                  </h3>
                  <div className="text-xs text-foreground-light leading-[1.5] mt-0.5">
                    {reason.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <form
          className="op-hero-in-delay flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-xs sm:p-7"
          onSubmit={handleSubmit}
        >
          <div>
            <h2 className="text-xl font-semibold text-foreground m-0 mb-1">
              Contact sales
            </h2>
            <p className="text-sm text-foreground-light m-0">
              Share enough context for a focused follow-up.
            </p>
          </div>
          <Input
            id="contact-work-email"
            label="Work email"
            name="work_email"
            placeholder="you@company.com"
            required
            type="email"
          />
          <Input
            id="contact-company-name"
            label="Company"
            name="company_name"
            placeholder="Company name"
            required
          />
          <Input
            id="contact-monthly-volume"
            label="Monthly transaction volume"
            name="monthly_transaction_volume"
            placeholder="e.g. 5,000"
          />
          <label
            className="flex flex-col gap-1.5"
            htmlFor="contact-request-type"
          >
            <span className="text-xs font-medium text-foreground-light">
              What can we help with?
            </span>
            <select
              className="h-[34px] rounded-sm border border-border-control bg-foreground/[0.026] px-3 text-sm text-foreground outline-none focus:shadow-focus-ring"
              defaultValue=""
              id="contact-request-type"
              name="request_type"
              required
            >
              <option disabled value="">
                Select a topic
              </option>
              <option value="pricing">Corporate pricing</option>
              <option value="implementation">Implementation planning</option>
              <option value="partnership">Partnerships</option>
              <option value="general">Something else</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5" htmlFor="contact-message">
            <span className="text-xs font-medium text-foreground-light">
              Message
            </span>
            <textarea
              className="min-h-[110px] resize-y rounded-sm border border-border-control bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-border-strong"
              id="contact-message"
              name="message"
              placeholder="Tell us about your payment flow."
              required
            />
          </label>
          <label
            className="absolute -left-[10000px] h-px w-px overflow-hidden"
            htmlFor="contact-website"
          >
            Website
            <input id="contact-website" name="website" tabIndex={-1} />
          </label>
          {submissionState.kind !== "idle" && (
            <p
              aria-live="polite"
              className={
                submissionState.kind === "success"
                  ? "text-sm text-foreground"
                  : "text-sm text-destructive"
              }
              role={submissionState.kind === "success" ? "status" : "alert"}
            >
              {submissionState.message}
            </p>
          )}
          <Button
            disabled={isSubmitting}
            type="submit"
            variant="primary"
            size="medium"
            block
          >
            {isSubmitting ? "Sending…" : "Send message"}
          </Button>
        </form>
      </div>

      <MarketingFooter />
    </div>
  );
}
