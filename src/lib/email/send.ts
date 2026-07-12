/**
 * Resend-backed transactional email delivery for Outpay.
 *
 * Exposes the provider boundary plus branded password-reset and onboarding
 * welcome messages. The module performs outbound HTTPS requests and requires
 * RESEND_API_KEY and OUTPAY_EMAIL_FROM at send time.
 */

const RESEND_EMAILS_ENDPOINT = "https://api.resend.com/emails";
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export class EmailConfigurationError extends Error {
  /** Identifies configuration failures before an outbound provider request. */
  name = "EmailConfigurationError";
}

export class EmailDeliveryError extends Error {
  /** Identifies provider or response-contract failures during delivery. */
  name = "EmailDeliveryError";
}

interface EmailConfig {
  apiKey: string;
  from: string;
  replyTo: string | undefined;
}

interface TransactionalEmailMessage {
  html: string;
  subject: string;
  text: string;
  to: string;
}

interface ResendEmailResponse {
  id: string;
}

/**
 * Escapes untrusted values before they are inserted into the HTML template.
 *
 * Parameters:
 * - value: Text that will appear in HTML content or an attribute.
 *
 * Returns:
 * - HTML-safe text.
 */
function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/gu,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

/**
 * Loads and validates the provider configuration from the environment.
 *
 * Parameters:
 * - env: Environment map, injectable for deterministic tests.
 *
 * Returns:
 * - Validated Resend configuration.
 *
 * Throws:
 * - EmailConfigurationError when a required setting is absent.
 */
function getEmailConfig(env: NodeJS.ProcessEnv = process.env): EmailConfig {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.OUTPAY_EMAIL_FROM?.trim();
  const replyTo = env.OUTPAY_EMAIL_REPLY_TO?.trim() || undefined;

  if (!apiKey || !from) {
    throw new EmailConfigurationError(
      "Transactional email is not configured. Set RESEND_API_KEY and OUTPAY_EMAIL_FROM.",
    );
  }

  return { apiKey, from, replyTo };
}

/**
 * Builds the shared Outpay email shell with a consistent brand and CTA.
 *
 * Parameters:
 * - title: Heading displayed in the email body.
 * - greeting: Short introductory copy.
 * - actionLabel: Button label, or `undefined` for informational emails.
 * - actionUrl: Button target, required when `actionLabel` is present.
 * - closing: Closing copy shown below the action.
 *
 * Returns:
 * - Complete HTML email document.
 */
function renderBrandedEmail(input: {
  actionLabel?: string;
  actionUrl?: string;
  closing: string;
  greeting: string;
  title: string;
}): string {
  const action =
    input.actionLabel && input.actionUrl
      ? `<p style="margin:28px 0 24px"><a href="${escapeHtml(input.actionUrl)}" style="background:#18181b;border-radius:7px;color:#fff;display:inline-block;font-size:14px;font-weight:600;padding:12px 18px;text-decoration:none">${escapeHtml(input.actionLabel)}</a></p><p style="color:#71717a;font-size:12px;line-height:1.6;word-break:break-all">If the button does not work, copy and paste this link into your browser:<br>${escapeHtml(input.actionUrl)}</p>`
      : "";

  return `<!doctype html><html lang="en"><body style="background:#f4f4f5;color:#18181b;font-family:Arial,Helvetica,sans-serif;margin:0;padding:32px 16px"><table role="presentation" style="margin:0 auto;max-width:560px;width:100%"><tr><td><div style="background:#18181b;border-radius:10px 10px 0 0;color:#fff;font-size:20px;font-weight:700;padding:22px 28px">outpay</div><div style="background:#fff;border-radius:0 0 10px 10px;padding:32px 28px"><h1 style="font-size:24px;line-height:1.25;margin:0 0 16px">${escapeHtml(input.title)}</h1><p style="font-size:15px;line-height:1.65;margin:0">${escapeHtml(input.greeting)}</p>${action}<p style="font-size:15px;line-height:1.65;margin:24px 0 0">${escapeHtml(input.closing)}</p></div><p style="color:#71717a;font-size:12px;line-height:1.5;margin:18px 4px;text-align:center">You received this email because of activity on your Outpay account.</p></td></tr></table></body></html>`;
}

/**
 * Sends one transactional message through Resend.
 *
 * Parameters:
 * - message: Validated recipient, subject, plain-text body, and HTML body.
 *
 * Returns:
 * - Resend's accepted message identifier.
 *
 * Throws:
 * - EmailConfigurationError when provider settings are missing.
 * - EmailDeliveryError when the request fails or Resend returns an invalid
 *   response.
 */
export async function sendTransactionalEmail(
  message: TransactionalEmailMessage,
): Promise<ResendEmailResponse> {
  const recipient = message.to.trim();

  if (!EMAIL_ADDRESS_PATTERN.test(recipient)) {
    throw new EmailDeliveryError("Transactional email recipient is invalid.");
  }

  const config = getEmailConfig();
  const payload = {
    from: config.from,
    html: message.html,
    ...(config.replyTo ? { reply_to: config.replyTo } : {}),
    subject: message.subject,
    text: message.text,
    to: [recipient],
  };

  let response: Response;

  try {
    response = await fetch(RESEND_EMAILS_ENDPOINT, {
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    throw new EmailDeliveryError("Resend email request failed.", {
      cause: error,
    });
  }

  let responseBody: string;

  try {
    responseBody = await response.text();
  } catch (error) {
    throw new EmailDeliveryError("Resend email response could not be read.", {
      cause: error,
    });
  }

  if (!response.ok) {
    throw new EmailDeliveryError(
      `Resend rejected the email request with HTTP ${response.status}.`,
    );
  }

  let parsedResponse: unknown;

  try {
    parsedResponse = JSON.parse(responseBody);
  } catch (error) {
    throw new EmailDeliveryError(
      "Resend returned a malformed success response.",
      { cause: error },
    );
  }

  if (
    !parsedResponse ||
    typeof parsedResponse !== "object" ||
    !("id" in parsedResponse) ||
    typeof parsedResponse.id !== "string" ||
    !parsedResponse.id
  ) {
    throw new EmailDeliveryError(
      "Resend returned a success response without a message ID.",
    );
  }

  return { id: parsedResponse.id };
}

/**
 * Sends the Better Auth password-reset link to the account owner.
 *
 * Parameters:
 * - email: Better Auth user's email address.
 * - name: Better Auth user's display name.
 * - url: Better Auth-generated reset URL containing the expiring token.
 *
 * Returns:
 * - Resend's accepted message identifier.
 */
export function sendResetPasswordEmail(input: {
  email: string;
  name: string;
  url: string;
}): Promise<ResendEmailResponse> {
  const greeting = input.name.trim()
    ? `We received a request to reset the password for ${input.name.trim()}.`
    : "We received a request to reset the password for your Outpay account.";

  return sendTransactionalEmail({
    html: renderBrandedEmail({
      actionLabel: "Reset password",
      actionUrl: input.url,
      closing: "This link expires in one hour and can only be used once.",
      greeting,
      title: "Reset your Outpay password",
    }),
    subject: "Reset your Outpay password",
    text: `${greeting}\n\nReset your password: ${input.url}\n\nThis link expires in one hour and can only be used once.`,
    to: input.email,
  });
}

/**
 * Sends the reusable onboarding welcome message after merchant setup.
 *
 * Parameters:
 * - email: New merchant user's email address.
 * - name: New merchant user's display name.
 * - storeName: Merchant name created during onboarding.
 *
 * Returns:
 * - Resend's accepted message identifier.
 */
export function sendOnboardingWelcomeEmail(input: {
  email: string;
  name: string;
  storeName: string;
}): Promise<ResendEmailResponse> {
  const greeting = input.name.trim()
    ? `Hi ${input.name.trim()}, your Outpay merchant account is ready.`
    : "Your Outpay merchant account is ready.";
  const closing = `${input.storeName.trim() || "Your store"} is now set up to accept non-custodial USDC payments on Base.`;

  return sendTransactionalEmail({
    html: renderBrandedEmail({
      closing,
      greeting,
      title: "Welcome to Outpay",
    }),
    subject: "Welcome to Outpay",
    text: `${greeting}\n\n${closing}`,
    to: input.email,
  });
}
