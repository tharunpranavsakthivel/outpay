/**
 * Zod schemas for every request body, query string, and dynamic route
 * parameter accepted by Outpay API route handlers.
 */

import { z } from "zod";
import {
  isChecksumValidAddress,
  isWalletAddressFormatValid,
  WALLET_ADDRESS_CHECKSUM_ERROR,
} from "@/lib/wallet/verify-signature";

/**
 * Creates an optional text field that normalizes absent values to an empty
 * string for existing dashboard service contracts.
 */
const optionalTrimmedText = (max: number) =>
  z.string().trim().max(max).default("");

/**
 * Creates an optional absolute URL field while preserving the dashboard's
 * empty-string representation for an omitted URL.
 */
const optionalAbsoluteUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => value === "" || URL.canParse(value), {
    message: "Must be a valid absolute URL.",
  })
  .default("");

const requiredPathIdentifier = z
  .string()
  .trim()
  .min(1, "Identifier is required.")
  .max(255, "Identifier is too long.");

const walletAddress = z
  .string()
  .trim()
  .refine(isWalletAddressFormatValid, {
    message: "Must be a valid Base EVM wallet address.",
  })
  .refine((value) => {
    return !isWalletAddressFormatValid(value) || isChecksumValidAddress(value);
  }, WALLET_ADDRESS_CHECKSUM_ERROR);

const walletSignature = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]+$/u, "Must be a hexadecimal wallet signature.")
  .min(2, "Wallet signature is required.")
  .max(2048, "Wallet signature is too long.");

const walletSignatureTimestampMs = z
  .number()
  .finite()
  .int()
  .positive("Wallet signature timestamp is required.");

export const checkoutParamsSchema = z.object({
  checkoutRef: requiredPathIdentifier,
});

export const idParamsSchema = z.object({
  id: requiredPathIdentifier,
});

export const assetIdParamsSchema = z.object({
  assetId: requiredPathIdentifier,
});

export const dashboardPaymentsQuerySchema = z.object({
  dateRange: z.enum(["7d", "30d", "90d", "all"]).default("30d"),
  page: z.coerce.number().finite().int().min(1).default(1),
  search: z.string().trim().max(200).default(""),
  status: z
    .enum(["all", "paid", "pending", "failed", "expired"])
    .default("all"),
});

export const publicPaymentsQuerySchema = z.object({
  limit: z.coerce.number().finite().int().min(1).max(100).default(25),
  status: z.enum(["paid", "pending", "failed", "expired"]).optional(),
});

export const adminSearchQuerySchema = z.object({
  search: z.string().trim().max(200).default(""),
});

export const adminReconciliationBodySchema = z.object({
  chain: z.literal("base").default("base"),
  fromBlock: z.coerce.number().finite().int().min(0),
  toBlock: z.coerce.number().finite().int().min(0),
});

export const adminMerchantDisableBodySchema = z.object({
  confirmationText: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(500),
});

export const dashboardCheckoutBodySchema = z.object({
  amountUsd: z.string().trim().min(1, "Amount is required.").max(50),
  label: z.string().trim().min(1, "Checkout name is required.").max(200),
  orderReference: optionalTrimmedText(200),
  redirectUrl: optionalAbsoluteUrl,
});

export const checkoutActionBodySchema = z.object({
  action: z.literal("deactivate"),
});

export const notificationActionBodySchema = z.object({
  action: z.literal("mark-all-read"),
});

export const onboardingBodySchema = z.object({
  storeDescription: optionalTrimmedText(1000),
  storeName: z.string().trim().min(1, "Store name is required.").max(200),
  walletAddress,
  walletConfirmed: z.boolean(),
  walletSignature,
  walletSignatureTimestampMs,
});

export const payoutWalletBodySchema = z.object({
  confirmed: z.boolean(),
  walletAddress,
  walletSignature,
  walletSignatureTimestampMs,
});

export const storeProfileBodySchema = z.object({
  description: optionalTrimmedText(1000),
  directorySummary: z.string().trim().max(1000).optional(),
  isDirectoryListed: z.boolean().optional(),
  storeName: z.string().trim().min(1, "Store name is required.").max(200),
  supportEmail: z
    .string()
    .trim()
    .max(320)
    .refine((value) => value === "" || z.email().safeParse(value).success, {
      message: "Must be a valid email address.",
    })
    .default(""),
  websiteUrl: optionalAbsoluteUrl,
});

export const accountProfileBodySchema = z.object({
  fullName: optionalTrimmedText(200),
});

export const accountAvatarColorBodySchema = z.object({
  avatarColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/u, "Must be a six-digit hex color."),
});

export const storeStatusBodySchema = z.object({
  action: z.literal("deactivate"),
  confirmationText: z
    .string()
    .trim()
    .min(1, "Confirmation text is required.")
    .max(200),
});

export const apiKeyBodySchema = z.object({
  environment: z.enum(["test", "live"]),
  name: z.string().trim().min(1, "API key name is required.").max(200),
});

export const apiKeyActionBodySchema = z.object({
  action: z.literal("revoke"),
});

/**
 * Validates the public enterprise contact form payload before persistence.
 * The honeypot is intentionally accepted as an optional field so automated
 * submissions can be rejected without exposing a separate anti-spam endpoint.
 */
export const contactBodySchema = z.object({
  company_name: z
    .string()
    .trim()
    .min(1, "Company name is required.")
    .max(200, "Company name is too long."),
  message: z
    .string()
    .trim()
    .min(1, "Message is required.")
    .max(5000, "Message is too long."),
  monthly_transaction_volume: z
    .string()
    .trim()
    .max(200, "Transaction volume is too long.")
    .default(""),
  request_type: z.enum(["pricing", "implementation", "partnership", "general"]),
  website: z.string().trim().max(200).default(""),
  work_email: z
    .string()
    .trim()
    .max(320, "Work email is too long.")
    .email("Must be a valid work email address."),
});

export const webhookEndpointBodySchema = z.object({
  url: z
    .string()
    .trim()
    .max(2048)
    .refine((value) => URL.canParse(value), {
      message: "Must be a valid absolute URL.",
    }),
});

export const publicCreateCheckoutBodySchema = z
  .object({
    amount: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/u)
      .refine((value) => Number(value) > 0, {
        message: "Must be a positive decimal amount with up to 2 decimals.",
      }),
    cancelUrl: z
      .union([z.string().trim().url(), z.literal(""), z.null()])
      .default(""),
    chain: z.literal("base"),
    currency: z.literal("USDC"),
    customerEmail: z
      .union([z.string().trim().email(), z.literal(""), z.null()])
      .default(""),
    metadata: z.record(z.string(), z.unknown()).default({}),
    successUrl: z.string().trim().url(),
  })
  .transform((value) => ({
    ...value,
    cancelUrl: value.cancelUrl || null,
    customerEmail: value.customerEmail || null,
  }));

export const alchemyWebhookPayloadSchema = z.record(z.string(), z.unknown());
