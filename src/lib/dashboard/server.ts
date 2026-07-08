/**
 * Schema-backed dashboard query and mutation layer for the authenticated
 * merchant surfaces and public checkout/receipt flows.
 */

import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";
import { AVATAR_COLOR_PALETTE } from "@/components/ui/UserAvatar";
import { getServerSession } from "@/lib/auth/server";
import {
  connectToDatabase,
  DatabaseConnectionError,
} from "@/lib/database/client";
import { enqueueMerchantWebhookJob } from "@/lib/queues/jobs";
import {
  getObject,
  TIGRIS_BUCKET_NAME,
  uploadObject,
} from "@/lib/storage/tigris";
import { verifyWalletOwnershipSignature } from "@/lib/wallet/verify-signature";
import {
  calculateCheckoutExpiryFromNow,
  getCheckoutExpiryPolicy,
} from "./checkout-expiry";
import {
  formatDashboardDate,
  formatShortDate,
  formatTokenAmount,
  formatUsd,
} from "./format";
import type {
  AccountSettingsData,
  ApiKeyListItem,
  CheckoutListItem,
  CheckoutListPageData,
  CreateCheckoutFormData,
  CreateCheckoutPageData,
  CreateCheckoutResult,
  DashboardMetric,
  DashboardPageData,
  DashboardStatus,
  DevelopersPageData,
  FirstLoginPageData,
  MerchantShellData,
  NotificationItem,
  PaymentListItem,
  PaymentsPageData,
  PaymentsQuery,
  PublicCheckoutData,
  PublicReceiptData,
  RecentPaymentItem,
  StoreSettingsData,
  WebhookDeliveryItem,
} from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHECKOUT_PAGE_SIZE = 8;
const BASE_BLOCKCHAIN_SLUG = "base";
const BASE_CHAIN_NUMERIC_ID = 8453;
const BASE_EXPLORER_TX_URL_TEMPLATE = "https://basescan.org/tx/{tx_hash}";
const BASE_USDC_CONTRACT_ADDRESS = "0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913";
const BASE_USDC_CONTRACT_ADDRESS_NORMALIZED =
  BASE_USDC_CONTRACT_ADDRESS.toLowerCase();
type DatabaseSql =
  | Sql<Record<string, unknown>>
  | TransactionSql<Record<string, unknown>>;

interface MerchantContext {
  email: string;
  merchant: MerchantShellData;
  userId: string;
}

interface MerchantWalletContext {
  address: string;
  blockchainName: string;
  chainNumericId: number;
  tokenId: string;
  tokenSymbol: string;
  walletId: string;
}

export class MissingMerchantContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingMerchantContextError";
  }
}

/**
 * Converts store names into stable slug candidates for `merchants.public_slug`.
 *
 * Parameters:
 * - value: User-provided store name entered during onboarding.
 *
 * Returns:
 * - Lower-case URL-safe slug with a non-empty fallback.
 */
function slugifyStoreName(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "merchant";
}

/**
 * Builds a unique merchant slug while preserving human-readable store names.
 *
 * Parameters:
 * - sql: Active transaction-scoped Postgres client.
 * - storeName: Merchant display name supplied during onboarding.
 *
 * Returns:
 * - Unique `public_slug` value for the new merchant row.
 */
async function buildUniqueMerchantSlug(
  sql: DatabaseSql,
  storeName: string,
): Promise<string> {
  const baseSlug = slugifyStoreName(storeName);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix =
      attempt === 0 ? "" : `-${randomBytes(2).toString("hex").toLowerCase()}`;
    const candidate = `${baseSlug}${suffix}`;
    const existing = await sql<{ exists: boolean }[]>`
      select exists (
        select 1
        from merchants
        where lower(public_slug::text) = ${candidate}
      ) as exists
    `;

    if (!existing[0]?.exists) {
      return candidate;
    }
  }

  return `${baseSlug}-${randomBytes(4).toString("hex").toLowerCase()}`;
}

/**
 * Ensures the Base blockchain row and default USDC token exist before
 * onboarding inserts a payout wallet or checkout-dependent merchant state.
 *
 * Parameters:
 * - sql: Active transaction-scoped Postgres client.
 *
 * Returns:
 * - IDs for the Base chain and default USDC token.
 */
async function ensureBaseTokenCatalog(sql: DatabaseSql): Promise<{
  chainId: string;
  tokenId: string;
}> {
  let chain = await sql<{ id: string }[]>`
    select id::text as id
    from blockchains
    where lower(slug::text) = ${BASE_BLOCKCHAIN_SLUG}
       or chain_numeric_id = ${BASE_CHAIN_NUMERIC_ID}
    order by created_at asc
    limit 1
  `;

  if (!chain[0]) {
    chain = await sql<{ id: string }[]>`
      insert into blockchains (
        slug,
        display_name,
        chain_numeric_id,
        explorer_tx_url_template,
        rpc_label
      ) values (
        ${BASE_BLOCKCHAIN_SLUG},
        'Base',
        ${BASE_CHAIN_NUMERIC_ID},
        ${BASE_EXPLORER_TX_URL_TEMPLATE},
        'Base mainnet'
      )
      returning id::text as id
    `;
  }

  let token = await sql<{ id: string }[]>`
    select id::text as id
    from tokens
    where chain_id = ${chain[0].id}
      and (
        lower(symbol::text) = 'usdc'
        or contract_address_normalized = ${BASE_USDC_CONTRACT_ADDRESS_NORMALIZED}
      )
    order by is_mvp_default desc, created_at asc
    limit 1
  `;

  if (!token[0]) {
    token = await sql<{ id: string }[]>`
      insert into tokens (
        chain_id,
        symbol,
        display_name,
        contract_address,
        contract_address_normalized,
        decimals,
        is_enabled,
        is_mvp_default
      ) values (
        ${chain[0].id},
        'USDC',
        'USD Coin',
        ${BASE_USDC_CONTRACT_ADDRESS},
        ${BASE_USDC_CONTRACT_ADDRESS_NORMALIZED},
        6,
        true,
        true
      )
      returning id::text as id
    `;
  } else {
    await sql`
      update tokens
      set
        is_enabled = true,
        is_mvp_default = true
      where id = ${token[0].id}
    `;
  }

  return {
    chainId: chain[0].id,
    tokenId: token[0].id,
  };
}

/**
 * Resolves the current Better Auth session into a user profile and active
 * merchant.
 *
 * Returns:
 * - Merchant-scoped context used by dashboard reads and mutations.
 *
 * Throws:
 * - `Error` when the request is unauthenticated or the user is not mapped to a
 *   merchant in the existing schema.
 */
async function getMerchantContext(): Promise<MerchantContext> {
  const session = await getServerSession();
  const email = session?.user.email?.trim().toLowerCase();

  if (!email) {
    throw new Error("Sign in before using the merchant dashboard.");
  }

  const database = await connectToDatabase();

  try {
    const directMembership = await database.sql<
      {
        avatar_color: string | null;
        description: string | null;
        full_name: string | null;
        logo_asset_id: string | null;
        merchant_id: string;
        public_slug: string;
        status: string;
        store_name: string;
        support_email: string | null;
        two_factor_status: string;
        unread_notifications: number;
        user_id: string;
        verification_status: string;
      }[]
    >`
      select
        up.id as user_id,
        up.full_name,
        up.avatar_color,
        up.two_factor_status,
        m.id as merchant_id,
        m.public_slug::text as public_slug,
        m.display_name as store_name,
        m.support_email::text as support_email,
        m.description,
        m.status::text as status,
        m.verification_status::text as verification_status,
        m.logo_asset_id::text as logo_asset_id,
        (
          select count(*)
          from notifications n
          where n.merchant_id = m.id
            and coalesce(n.user_id, up.id) = up.id
            and n.is_read = false
        )::integer as unread_notifications
      from user_profiles up
      join merchant_members mm
        on mm.user_id = up.id
       and mm.status = 'active'
      join merchants m
        on m.id = mm.merchant_id
      where lower(up.email::text) = ${email}
      order by
        case mm.role
          when 'owner' then 0
          when 'admin' then 1
          when 'developer' then 2
          else 3
        end,
        mm.created_at asc
      limit 1
    `;

    const fallbackOwner =
      directMembership.length > 0
        ? directMembership[0]
        : (
            await database.sql<
              {
                avatar_color: string | null;
                description: string | null;
                full_name: string | null;
                logo_asset_id: string | null;
                merchant_id: string;
                public_slug: string;
                status: string;
                store_name: string;
                support_email: string | null;
                two_factor_status: string;
                unread_notifications: number;
                user_id: string;
                verification_status: string;
              }[]
            >`
              select
                up.id as user_id,
                up.full_name,
                up.avatar_color,
                up.two_factor_status,
                m.id as merchant_id,
                m.public_slug::text as public_slug,
                m.display_name as store_name,
                m.support_email::text as support_email,
                m.description,
                m.status::text as status,
                m.verification_status::text as verification_status,
                m.logo_asset_id::text as logo_asset_id,
                (
                  select count(*)
                  from notifications n
                  where n.merchant_id = m.id
                    and coalesce(n.user_id, up.id) = up.id
                    and n.is_read = false
                )::integer as unread_notifications
              from user_profiles up
              join merchants m
                on m.created_by_user_id = up.id
              where lower(up.email::text) = ${email}
              order by m.created_at asc
              limit 1
            `
          )[0];

    if (!fallbackOwner) {
      throw new MissingMerchantContextError(
        "No merchant record is linked to this account email in user_profiles and merchant_members.",
      );
    }

    return {
      email,
      merchant: {
        description: fallbackOwner.description,
        logoUrl: fallbackOwner.logo_asset_id
          ? `/api/store-logo/${fallbackOwner.logo_asset_id}`
          : null,
        merchantId: fallbackOwner.merchant_id,
        publicSlug: fallbackOwner.public_slug,
        status: fallbackOwner.status,
        storeName: fallbackOwner.store_name,
        supportEmail: fallbackOwner.support_email,
        unreadNotifications: fallbackOwner.unread_notifications,
        userAvatarColor: fallbackOwner.avatar_color,
        userFullName: fallbackOwner.full_name,
        verificationStatus: fallbackOwner.verification_status,
      },
      userId: fallbackOwner.user_id,
    };
  } finally {
    await database.release();
  }
}

/**
 * Creates or repairs the initial merchant graph for a signed-in user who just
 * completed onboarding.
 *
 * Parameters:
 * - input.storeName: Merchant display name to persist on checkout surfaces.
 * - input.storeDescription: Optional short description shown on merchant pages.
 * - input.walletAddress: Base payout wallet controlled by the merchant.
 * - input.walletConfirmed: Explicit user confirmation for the payout address.
 *
 * Returns:
 * - Next route to visit after onboarding completes successfully.
 *
 * Throws:
 * - `Error` when the session is missing, the profile row is absent, or the
 *   onboarding payload is invalid.
 */
export async function completeMerchantOnboarding(input: {
  storeDescription: string;
  storeName: string;
  walletAddress: string;
  walletConfirmed: boolean;
  walletSignature: string;
  walletSignatureTimestampMs: number;
}) {
  const session = await getServerSession();
  const email = session?.user.email?.trim().toLowerCase();
  const fullName = session?.user.name?.trim() || null;
  const storeName = input.storeName.trim();
  const storeDescription = input.storeDescription.trim();
  const walletAddress = input.walletAddress.trim();
  const walletAddressNormalized = walletAddress.toLowerCase();

  if (!email) {
    throw new Error("Sign in before completing onboarding.");
  }

  if (!storeName) {
    throw new Error("Store name is required.");
  }

  if (!input.walletConfirmed) {
    throw new Error("Confirm the payout wallet before continuing.");
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    throw new Error("Wallet address must be a valid Base EVM address.");
  }

  const walletVerification = await verifyWalletOwnershipSignature({
    address: walletAddress,
    signature: input.walletSignature,
    timestampMs: input.walletSignatureTimestampMs,
  });

  if (!walletVerification.ok) {
    throw new Error(walletVerification.message);
  }

  const database = await connectToDatabase();

  try {
    await database.sql.begin(async (sql) => {
      const profileRows = await sql<
        {
          full_name: string | null;
          user_id: string;
        }[]
      >`
        select id::text as user_id, full_name
        from user_profiles
        where lower(email::text) = ${email}
        limit 1
      `;

      if (!profileRows[0]?.user_id) {
        throw new Error(
          "This account does not have a linked user_profiles row yet. Sign out and sign back in to retry provisioning.",
        );
      }

      const userId = profileRows[0].user_id;
      const displayName = fullName || profileRows[0].full_name || storeName;
      const { chainId } = await ensureBaseTokenCatalog(sql);

      const existingMerchantRows = await sql<
        {
          merchant_id: string;
        }[]
      >`
        select mm.merchant_id::text as merchant_id
        from merchant_members mm
        where mm.user_id = ${userId}::uuid
        order by
          case mm.role
            when 'owner' then 0
            when 'admin' then 1
            when 'developer' then 2
            else 3
          end,
          mm.created_at asc
        limit 1
      `;

      const merchantId =
        existingMerchantRows[0]?.merchant_id ??
        (
          await sql<
            {
              id: string;
            }[]
          >`
            insert into merchants (
              public_slug,
              display_name,
              description,
              support_email,
              created_by_user_id
            ) values (
              ${await buildUniqueMerchantSlug(sql, storeName)},
              ${storeName},
              ${storeDescription || null},
              ${email},
              ${userId}::uuid
            )
            returning id::text as id
          `
        )[0].id;

      await sql`
        update user_profiles
        set
          full_name = ${displayName},
          updated_at = now()
        where id = ${userId}::uuid
      `;

      await sql`
        update merchants
        set
          display_name = ${storeName},
          description = ${storeDescription || null},
          support_email = ${email},
          updated_at = now()
        where id = ${merchantId}::uuid
      `;

      await sql`
        insert into merchant_members (
          merchant_id,
          user_id,
          role,
          status,
          joined_at
        ) values (
          ${merchantId}::uuid,
          ${userId}::uuid,
          'owner',
          'active',
          now()
        )
        on conflict (merchant_id, user_id) do update
          set role = 'owner',
              status = 'active',
              joined_at = coalesce(merchant_members.joined_at, excluded.joined_at),
              updated_at = now()
      `;

      await sql`
        insert into merchant_onboarding (
          merchant_id,
          primary_user_id,
          onboarding_status,
          store_details_completed_at,
          wallet_added_at,
          wallet_confirmation_checked_at,
          completed_at
        ) values (
          ${merchantId}::uuid,
          ${userId}::uuid,
          'completed',
          now(),
          now(),
          now(),
          now()
        )
        on conflict (merchant_id) do update
          set primary_user_id = excluded.primary_user_id,
              onboarding_status = 'completed',
              store_details_completed_at = coalesce(
                merchant_onboarding.store_details_completed_at,
                excluded.store_details_completed_at
              ),
              wallet_added_at = excluded.wallet_added_at,
              wallet_confirmation_checked_at = excluded.wallet_confirmation_checked_at,
              completed_at = coalesce(
                merchant_onboarding.completed_at,
                excluded.completed_at
              ),
              updated_at = now()
      `;

      const existingWalletRows = await sql<
        {
          address_normalized: string;
          wallet_id: string;
        }[]
      >`
        select id::text as wallet_id, address_normalized
        from wallet_addresses
        where merchant_id = ${merchantId}::uuid
          and wallet_type = 'merchant_payout'
          and status = 'active'
          and is_primary = true
        order by created_at desc
        limit 1
      `;

      if (!existingWalletRows[0]) {
        await sql`
          insert into wallet_addresses (
            merchant_id,
            chain_id,
            address,
            address_normalized,
            wallet_type,
            label,
            is_primary,
            status,
            verified_at,
            verification_signature,
            created_by_user_id
          ) values (
            ${merchantId}::uuid,
            ${chainId}::uuid,
            ${walletAddress},
            ${walletAddressNormalized},
            'merchant_payout',
            'Primary payout wallet',
            true,
            'active',
            now(),
            ${input.walletSignature},
            ${userId}::uuid
          )
        `;
      } else if (
        existingWalletRows[0].address_normalized !== walletAddressNormalized
      ) {
        await sql`
          update wallet_addresses
          set
            is_primary = false,
            status = 'replaced'
          where id = ${existingWalletRows[0].wallet_id}::uuid
        `;

        await sql`
          insert into wallet_addresses (
            merchant_id,
            chain_id,
            address,
            address_normalized,
            wallet_type,
            label,
            is_primary,
            status,
            verified_at,
            verification_signature,
            created_by_user_id
          ) values (
            ${merchantId}::uuid,
            ${chainId}::uuid,
            ${walletAddress},
            ${walletAddressNormalized},
            'merchant_payout',
            'Primary payout wallet',
            true,
            'active',
            now(),
            ${input.walletSignature},
            ${userId}::uuid
          )
        `;
      }
    });

    return {
      nextPath: "/dashboard/first-login",
    };
  } finally {
    await database.release();
  }
}

/**
 * Looks up the primary active merchant payout wallet and default token/chain.
 *
 * Parameters:
 * - merchantId: Merchant primary key.
 *
 * Returns:
 * - Wallet and network context used by checkout and settings flows.
 */
async function getPrimaryWalletContext(
  merchantId: string,
): Promise<MerchantWalletContext | null> {
  const database = await connectToDatabase();

  try {
    const rows = await database.sql<
      {
        address: string;
        blockchain_name: string;
        chain_numeric_id: number;
        token_id: string;
        token_symbol: string;
        wallet_id: string;
      }[]
    >`
      select
        wa.id as wallet_id,
        wa.address,
        b.display_name as blockchain_name,
        b.chain_numeric_id,
        t.id as token_id,
        t.symbol::text as token_symbol
      from wallet_addresses wa
      join blockchains b
        on b.id = wa.chain_id
      join tokens t
        on t.chain_id = b.id
       and t.is_enabled = true
       and t.is_mvp_default = true
      where wa.merchant_id = ${merchantId}
        and wa.wallet_type = 'merchant_payout'
        and wa.status = 'active'
        and wa.is_primary = true
      order by wa.created_at desc
      limit 1
    `;

    return rows[0]
      ? {
          address: rows[0].address,
          blockchainName: rows[0].blockchain_name,
          chainNumericId: rows[0].chain_numeric_id,
          tokenId: rows[0].token_id,
          tokenSymbol: rows[0].token_symbol,
          walletId: rows[0].wallet_id,
        }
      : null;
  } finally {
    await database.release();
  }
}

function getStatusVariant(status: string): DashboardStatus {
  if (status === "paid") {
    return "paid";
  }

  if (status === "failed") {
    return "failed";
  }

  if (status === "expired") {
    return "expired";
  }

  return "pending";
}

function buildDashboardMetrics(input: {
  openCheckouts: number;
  paidCheckouts30d: number;
  paymentVolume30d: number;
  totalWebhookAttempts30d: number;
  webhookSuccesses30d: number;
}): DashboardMetric[] {
  const completionRate =
    input.paidCheckouts30d + input.openCheckouts > 0
      ? Math.round(
          (input.paidCheckouts30d /
            (input.paidCheckouts30d + input.openCheckouts)) *
            100,
        )
      : 0;
  const successRate =
    input.totalWebhookAttempts30d > 0
      ? `${(
          (input.webhookSuccesses30d / input.totalWebhookAttempts30d) * 100
        ).toFixed(1)}%`
      : "—";

  return [
    {
      label: "Payment volume (30d)",
      sub: `${input.paidCheckouts30d} paid checkouts`,
      tone: "default",
      value: formatUsd(input.paymentVolume30d),
    },
    {
      label: "Paid checkouts",
      sub:
        input.paidCheckouts30d > 0
          ? `${completionRate}% completion`
          : "No completions yet",
      tone: "default",
      value: String(input.paidCheckouts30d),
    },
    {
      label: "Open checkouts",
      sub:
        input.openCheckouts > 0
          ? "Awaiting payment or confirmation"
          : "Nothing awaiting",
      tone: input.openCheckouts > 0 ? "warning" : "default",
      value: String(input.openCheckouts),
    },
    {
      label: "Webhook success rate",
      sub:
        input.totalWebhookAttempts30d > 0
          ? `${input.webhookSuccesses30d} of ${input.totalWebhookAttempts30d} recent attempts succeeded`
          : "No deliveries yet",
      tone: "default",
      value: successRate,
    },
  ];
}

/**
 * Returns the main dashboard data set for the authenticated merchant.
 *
 * Returns:
 * - Metrics, notifications, and recent payments sourced from live tables.
 */
export async function getDashboardPageData(): Promise<DashboardPageData> {
  const context = await getMerchantContext();
  const database = await connectToDatabase();

  try {
    const [aggregate] = await database.sql<
      {
        open_checkouts: number;
        paid_checkouts_30d: number;
        payment_volume_30d: number;
        total_webhook_attempts_30d: number;
        webhook_successes_30d: number;
      }[]
    >`
      select
        (
          select count(*)
          from checkout_sessions cs
          where cs.merchant_id = ${context.merchant.merchantId}
            and cs.status in ('pending', 'detected')
        )::integer as open_checkouts,
        (
          select count(*)
          from payments p
          where p.merchant_id = ${context.merchant.merchantId}
            and p.status = 'paid'
            and coalesce(p.confirmed_at, p.created_at) >= now() - interval '30 days'
        )::integer as paid_checkouts_30d,
        (
          select coalesce(sum(p.amount_usd), 0)
          from payments p
          where p.merchant_id = ${context.merchant.merchantId}
            and p.status = 'paid'
            and coalesce(p.confirmed_at, p.created_at) >= now() - interval '30 days'
        )::float8 as payment_volume_30d,
        (
          select count(*)
          from webhook_delivery_attempts wda
          join webhook_events we
            on we.id = wda.webhook_event_id
          where we.merchant_id = ${context.merchant.merchantId}
            and wda.created_at >= now() - interval '30 days'
        )::integer as total_webhook_attempts_30d,
        (
          select count(*)
          from webhook_delivery_attempts wda
          join webhook_events we
            on we.id = wda.webhook_event_id
          where we.merchant_id = ${context.merchant.merchantId}
            and wda.created_at >= now() - interval '30 days'
            and wda.outcome = 'success'
        )::integer as webhook_successes_30d
    `;

    const notifications = await database.sql<
      {
        body: string;
        created_at: string;
        id: string;
        is_read: boolean;
        title: string;
        type: string;
      }[]
    >`
      select
        id::text as id,
        title,
        body,
        type::text as type,
        is_read,
        created_at::text as created_at
      from notifications
      where merchant_id = ${context.merchant.merchantId}
        and (user_id is null or user_id = ${context.userId})
      order by created_at desc
      limit 6
    `;

    const recentPayments = await database.sql<
      {
        amount_token: string;
        checkout_ref: string;
        created_at: string;
        payment_id: string;
        payment_ref: string;
        sender_address: string;
        status: string;
        symbol: string;
        tx_hash: string | null;
      }[]
    >`
      select
        p.id::text as payment_id,
        p.payment_ref,
        p.created_at::text as created_at,
        p.amount_token::text as amount_token,
        p.sender_address,
        p.status::text as status,
        cs.checkout_ref,
        t.symbol::text as symbol,
        ot.tx_hash
      from payments p
      join checkout_sessions cs
        on cs.id = p.checkout_session_id
      join tokens t
        on t.id = p.token_id
      left join onchain_transactions ot
        on ot.id = p.onchain_transaction_id
      where p.merchant_id = ${context.merchant.merchantId}
      order by coalesce(p.confirmed_at, p.created_at) desc
      limit 8
    `;

    return {
      merchant: context.merchant,
      metrics: buildDashboardMetrics({
        openCheckouts: aggregate?.open_checkouts ?? 0,
        paidCheckouts30d: aggregate?.paid_checkouts_30d ?? 0,
        paymentVolume30d: aggregate?.payment_volume_30d ?? 0,
        totalWebhookAttempts30d: aggregate?.total_webhook_attempts_30d ?? 0,
        webhookSuccesses30d: aggregate?.webhook_successes_30d ?? 0,
      }),
      notifications: notifications.map(
        (notification): NotificationItem => ({
          body: notification.body,
          createdAt: notification.created_at,
          id: notification.id,
          isRead: notification.is_read,
          title: notification.title,
          type: notification.type,
        }),
      ),
      recentPayments: recentPayments.map(
        (payment): RecentPaymentItem => ({
          amountLabel: formatTokenAmount(payment.amount_token, payment.symbol),
          checkoutRef: payment.checkout_ref,
          createdAt: payment.created_at,
          paymentId: payment.payment_id,
          paymentRef: payment.payment_ref,
          senderAddress: payment.sender_address,
          status: getStatusVariant(payment.status),
          txHash: payment.tx_hash,
        }),
      ),
    };
  } finally {
    await database.release();
  }
}

/**
 * Returns the first-login checklist screen with live onboarding progress.
 */
export async function getFirstLoginPageData(): Promise<FirstLoginPageData> {
  const context = await getMerchantContext();
  const database = await connectToDatabase();

  try {
    const [state] = await database.sql<
      {
        checkout_count: number;
        last_test_sent_at: string | null;
        primary_wallet_count: number;
      }[]
    >`
      select
        (
          select count(*)
          from wallet_addresses wa
          where wa.merchant_id = ${context.merchant.merchantId}
            and wa.wallet_type = 'merchant_payout'
            and wa.status = 'active'
            and wa.is_primary = true
        )::integer as primary_wallet_count,
        (
          select count(*)
          from checkout_sessions cs
          where cs.merchant_id = ${context.merchant.merchantId}
        )::integer as checkout_count,
        (
          select max(we.last_test_sent_at)::text
          from webhook_endpoints we
          where we.merchant_id = ${context.merchant.merchantId}
        ) as last_test_sent_at
    `;

    return {
      checklist: [
        {
          actionLabel: "Add wallet",
          description:
            "Payments go directly to this address. The dashboard uses the active primary payout wallet.",
          done: (state?.primary_wallet_count ?? 0) > 0,
          href: "/settings",
          key: "wallet",
          title: "Add your payout wallet",
        },
        {
          actionLabel: "Create checkout",
          description:
            "Your first checkout inserts a checkout session and payment intent using the live schema.",
          done: (state?.checkout_count ?? 0) > 0,
          href: "/checkouts/new",
          key: "checkout",
          title: "Create your first checkout",
        },
        {
          actionLabel: "Send test",
          description:
            "Queue a signed webhook event so delivery history and retry state start populating.",
          done: Boolean(state?.last_test_sent_at),
          href: "/developers",
          key: "webhook",
          title: "Send a test webhook",
        },
      ],
      merchant: context.merchant,
      metrics: buildDashboardMetrics({
        openCheckouts: 0,
        paidCheckouts30d: 0,
        paymentVolume30d: 0,
        totalWebhookAttempts30d: 0,
        webhookSuccesses30d: 0,
      }),
    };
  } finally {
    await database.release();
  }
}

/**
 * Returns every checkout for the authenticated merchant.
 */
export async function getCheckoutListPageData(): Promise<CheckoutListPageData> {
  const context = await getMerchantContext();
  const database = await connectToDatabase();

  try {
    const rows = await database.sql.begin(async (sql) => {
      await reconcileCheckoutExpiry(sql, {
        merchantId: context.merchant.merchantId,
      });

      return sql<
        {
          amount_token: string;
          checkout_id: string;
          checkout_ref: string;
          created_at: string;
          order_reference: string | null;
          paid_at: string | null;
          public_token: string;
          redirect_url: string | null;
          status: string;
          symbol: string;
          title: string;
        }[]
      >`
        select
          cs.id::text as checkout_id,
          cs.checkout_ref,
          cs.public_token,
          cs.label as title,
          cs.order_reference,
          cs.amount_token::text as amount_token,
          t.symbol::text as symbol,
          cs.status::text as status,
          cs.created_at::text as created_at,
          cs.paid_at::text as paid_at,
          cs.redirect_url
        from checkout_sessions cs
        join tokens t
          on t.id = cs.token_id
        where cs.merchant_id = ${context.merchant.merchantId}
        order by cs.created_at desc
      `;
    });

    return {
      checkouts: rows.map(
        (checkout): CheckoutListItem => ({
          amountLabel: formatTokenAmount(
            checkout.amount_token,
            checkout.symbol,
          ),
          canDeactivate:
            checkout.status === "pending" || checkout.status === "detected",
          checkoutId: checkout.checkout_id,
          checkoutRef: checkout.checkout_ref,
          createdAt:
            formatShortDate(checkout.created_at) ?? checkout.created_at,
          label: checkout.title,
          orderReference: checkout.order_reference,
          paidAt: checkout.paid_at,
          publicToken: checkout.public_token,
          redirectUrl: checkout.redirect_url,
          status: checkout.status,
        }),
      ),
      merchant: context.merchant,
    };
  } finally {
    await database.release();
  }
}

/**
 * Returns create-checkout prerequisites for the merchant UI.
 */
export async function getCreateCheckoutPageData(): Promise<CreateCheckoutPageData> {
  const context = await getMerchantContext();
  const wallet = await getPrimaryWalletContext(context.merchant.merchantId);

  if (!wallet) {
    throw new Error(
      "No active primary payout wallet exists for this merchant. Add one in Settings before creating a checkout.",
    );
  }

  return {
    chainName: wallet.blockchainName,
    merchant: context.merchant,
    payoutWallet: wallet.address,
    tokenSymbol: wallet.tokenSymbol,
  };
}

function normalizePositiveAmount(value: string) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new Error("Amount must be a positive number.");
  }

  return Number(numericValue.toFixed(2));
}

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

function createCheckoutRef() {
  return `chk_${randomBytes(6).toString("hex")}`;
}

function createPublicToken() {
  return randomBytes(10).toString("hex");
}

/**
 * Backfills missing checkout expiry timestamps, mirrors them to payment
 * intents, and lazily flips overdue pending/detected sessions to `expired`.
 *
 * Parameters:
 * - sql: Active transaction-scoped Postgres client.
 * - lookupId: Optional public token or checkout ref for a single checkout read.
 * - merchantId: Optional merchant scope for dashboard list reads.
 */
async function reconcileCheckoutExpiry(
  sql: DatabaseSql,
  input: { lookupId?: string; merchantId?: string },
): Promise<void> {
  const policy = getCheckoutExpiryPolicy();
  const lookupId = input.lookupId ?? null;
  const merchantId = input.merchantId ?? null;

  await sql`
    update checkout_sessions cs
    set
      expires_at = cs.created_at + make_interval(secs => ${policy.ttlSeconds}),
      updated_at = now()
    where cs.status in ('pending', 'detected')
      and cs.expires_at is null
      and (${merchantId}::uuid is null or cs.merchant_id = ${merchantId}::uuid)
      and (
        ${lookupId}::text is null
        or cs.public_token = ${lookupId}
        or cs.checkout_ref = ${lookupId}
      )
  `;

  await sql`
    update payment_intents pi
    set
      expires_at = cs.expires_at,
      updated_at = now()
    from checkout_sessions cs
    where pi.checkout_session_id = cs.id
      and pi.expires_at is null
      and cs.expires_at is not null
      and (${merchantId}::uuid is null or cs.merchant_id = ${merchantId}::uuid)
      and (
        ${lookupId}::text is null
        or cs.public_token = ${lookupId}
        or cs.checkout_ref = ${lookupId}
      )
  `;

  const expiredPendingRows = await sql<
    {
      checkout_id: string;
      checkout_ref: string;
      from_status: string;
    }[]
  >`
    update checkout_sessions cs
    set
      status = 'expired',
      updated_at = now()
    where cs.status = 'pending'
      and cs.expires_at is not null
      and cs.expires_at <= now()
      and (${merchantId}::uuid is null or cs.merchant_id = ${merchantId}::uuid)
      and (
        ${lookupId}::text is null
        or cs.public_token = ${lookupId}
        or cs.checkout_ref = ${lookupId}
      )
    returning
      cs.id::text as checkout_id,
      cs.checkout_ref,
      'pending'::text as from_status
  `;

  const expiredDetectedRows = await sql<
    {
      checkout_id: string;
      checkout_ref: string;
      from_status: string;
    }[]
  >`
    update checkout_sessions cs
    set
      status = 'expired',
      updated_at = now()
    where cs.status = 'detected'
      and cs.expires_at is not null
      and cs.expires_at + make_interval(secs => ${policy.detectedGraceSeconds}) <= now()
      and (${merchantId}::uuid is null or cs.merchant_id = ${merchantId}::uuid)
      and (
        ${lookupId}::text is null
        or cs.public_token = ${lookupId}
        or cs.checkout_ref = ${lookupId}
      )
    returning
      cs.id::text as checkout_id,
      cs.checkout_ref,
      'detected'::text as from_status
  `;

  for (const row of [...expiredPendingRows, ...expiredDetectedRows]) {
    const message =
      row.from_status === "detected"
        ? `Checkout ${row.checkout_ref} expired after the confirmation grace window elapsed.`
        : `Checkout ${row.checkout_ref} expired after the payment window elapsed.`;

    await sql`
      insert into checkout_status_history (
        checkout_session_id,
        from_status,
        to_status,
        reason_code,
        actor_type,
        message
      ) values (
        ${row.checkout_id}::uuid,
        ${row.from_status}::checkout_status_enum,
        'expired',
        'expired_timeout',
        'system',
        ${message}
      )
    `;
  }
}

function createApiSecret(environment: "test" | "live") {
  const prefix = environment === "test" ? "outpay_test_" : "outpay_live_";
  const raw = `${prefix}${randomBytes(24).toString("hex")}`;

  return {
    hash: hashSecret(raw),
    keyPrefix: raw.slice(0, 14),
    lastFour: raw.slice(-4),
    raw,
  };
}

function createWebhookSecret() {
  const raw = `whsec_${randomBytes(24).toString("hex")}`;

  return {
    hash: hashSecret(raw),
    prefix: raw.slice(0, 14),
    raw,
  };
}

/**
 * Inserts a new dashboard checkout backed by checkout_sessions,
 * payment_intents, and checkout_status_history.
 */
export async function createDashboardCheckout(
  input: CreateCheckoutFormData,
): Promise<CreateCheckoutResult> {
  const context = await getMerchantContext();
  const wallet = await getPrimaryWalletContext(context.merchant.merchantId);
  const expiryPolicy = getCheckoutExpiryPolicy();

  if (!wallet) {
    throw new Error(
      "Add an active primary payout wallet before creating a checkout.",
    );
  }

  const amountUsd = normalizePositiveAmount(input.amountUsd);
  const label = input.label.trim();
  const orderReference = input.orderReference.trim();
  const redirectUrl = input.redirectUrl.trim();

  if (!label) {
    throw new Error("A checkout label is required.");
  }

  if (redirectUrl && !URL.canParse(redirectUrl)) {
    throw new Error("Redirect URL must be a valid absolute URL.");
  }

  const database = await connectToDatabase();
  const checkoutRef = createCheckoutRef();
  const publicToken = createPublicToken();
  const expiresAt = calculateCheckoutExpiryFromNow(new Date(), expiryPolicy);

  try {
    await database.sql.begin(async (sql) => {
      const [checkout] = await sql<
        {
          amount_token: string;
          checkout_ref: string;
          public_token: string;
        }[]
      >`
        insert into checkout_sessions (
          checkout_ref,
          public_token,
          merchant_id,
          token_id,
          recipient_wallet_id,
          label,
          order_reference,
          amount_usd,
          amount_token,
          expires_at,
          status,
          redirect_url,
          success_url,
          source,
          created_by_user_id
        ) values (
          ${checkoutRef},
          ${publicToken},
          ${context.merchant.merchantId},
          ${wallet.tokenId},
          ${wallet.walletId},
          ${label},
          ${orderReference || null},
          ${amountUsd},
          ${amountUsd},
          ${expiresAt.toISOString()},
          'pending',
          ${redirectUrl || null},
          ${redirectUrl || null},
          'dashboard',
          ${context.userId}
        )
        returning checkout_ref, public_token, amount_token::text
      `;

      await sql`
        insert into payment_intents (
          checkout_session_id,
          merchant_id,
          token_id,
          recipient_wallet_id,
          expected_amount_token,
          expires_at,
          required_confirmations
        )
        select
          id,
          merchant_id,
          token_id,
          recipient_wallet_id,
          amount_token,
          expires_at,
          1
        from checkout_sessions
        where checkout_ref = ${checkout.checkout_ref}
      `;

      await sql`
        insert into checkout_status_history (
          checkout_session_id,
          to_status,
          reason_code,
          actor_type,
          actor_user_id,
          message
        )
        select
          id,
          'pending',
          'created',
          'user',
          ${context.userId},
          ${`Checkout ${checkout.checkout_ref} created from the merchant dashboard.`}
        from checkout_sessions
        where checkout_ref = ${checkout.checkout_ref}
      `;

      await sql`
        insert into merchant_onboarding (
          merchant_id,
          primary_user_id,
          first_checkout_created_at
        ) values (
          ${context.merchant.merchantId},
          ${context.userId},
          now()
        )
        on conflict (merchant_id) do update
          set first_checkout_created_at = coalesce(
                merchant_onboarding.first_checkout_created_at,
                excluded.first_checkout_created_at
              ),
              updated_at = now()
      `;
    });

    return {
      amountLabel: formatTokenAmount(amountUsd, wallet.tokenSymbol),
      checkoutRef,
      checkoutUrl: `/checkout/${publicToken}`,
      publicToken,
      receiptUrl: `/receipt/${checkoutRef}`,
    };
  } finally {
    await database.release();
  }
}

/**
 * Marks a pending or detected checkout as deactivated and records its history.
 *
 * Parameters:
 * - checkoutRef: Public merchant-facing checkout identifier.
 */
export async function deactivateCheckout(checkoutRef: string) {
  const context = await getMerchantContext();
  const database = await connectToDatabase();

  try {
    const result = await database.sql.begin(async (sql) => {
      const rows = await sql<
        {
          id: string;
          status: string;
        }[]
      >`
        update checkout_sessions
        set
          status = 'deactivated',
          deactivated_at = now(),
          deactivated_by_user_id = ${context.userId},
          updated_at = now()
        where merchant_id = ${context.merchant.merchantId}
          and checkout_ref = ${checkoutRef}
          and status in ('pending', 'detected')
        returning id::text as id, status::text as status
      `;

      if (!rows[0]) {
        throw new Error(
          "Only pending or detected checkouts can be deactivated from the dashboard.",
        );
      }

      await sql`
        insert into checkout_status_history (
          checkout_session_id,
          from_status,
          to_status,
          reason_code,
          actor_type,
          actor_user_id,
          message
        ) values (
          ${rows[0].id},
          'pending',
          'deactivated',
          'manual_deactivation',
          'user',
          ${context.userId},
          ${`Checkout ${checkoutRef} was deactivated from the merchant dashboard.`}
        )
      `;

      return rows[0];
    });

    return result;
  } finally {
    await database.release();
  }
}

function buildDateCutoff(query: PaymentsQuery) {
  if (query.dateRange === "7d") {
    return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  if (query.dateRange === "90d") {
    return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  }

  if (query.dateRange === "all") {
    return null;
  }

  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Returns the payments ledger slice for the requested filters and page.
 */
export async function getPaymentsPageData(
  overrides?: Partial<PaymentsQuery>,
): Promise<PaymentsPageData> {
  const context = await getMerchantContext();
  const query: PaymentsQuery = {
    dateRange: overrides?.dateRange ?? "30d",
    page: Math.max(1, overrides?.page ?? 1),
    search: overrides?.search?.trim() ?? "",
    status: overrides?.status ?? "all",
  };
  const dateCutoff = buildDateCutoff(query);
  const database = await connectToDatabase();
  const offset = (query.page - 1) * CHECKOUT_PAGE_SIZE;

  try {
    const totalRows = await database.sql<
      {
        count: number;
      }[]
    >`
      select count(*)::integer as count
      from payments p
      left join onchain_transactions ot
        on ot.id = p.onchain_transaction_id
      where p.merchant_id = ${context.merchant.merchantId}
        and (${query.status} = 'all' or p.status::text = ${query.status})
        and (
          ${query.search} = ''
          or lower(p.sender_address) like lower(${`%${query.search}%`})
          or lower(p.recipient_address) like lower(${`%${query.search}%`})
          or lower(coalesce(ot.tx_hash, '')) like lower(${`%${query.search}%`})
        )
        and (${dateCutoff}::timestamptz is null or coalesce(p.confirmed_at, p.created_at) >= ${dateCutoff})
    `;

    const payments = await database.sql<
      {
        amount_token: string;
        checkout_ref: string;
        confirmations: number;
        created_at: string;
        explorer_tx_url_template: string | null;
        order_reference: string | null;
        payment_id: string;
        payment_ref: string;
        recipient_address: string;
        sender_address: string;
        status: string;
        symbol: string;
        tx_hash: string | null;
      }[]
    >`
      select
        p.id::text as payment_id,
        p.payment_ref,
        p.amount_token::text as amount_token,
        p.status::text as status,
        p.sender_address,
        p.recipient_address,
        p.confirmations,
        p.created_at::text as created_at,
        cs.checkout_ref,
        cs.order_reference,
        t.symbol::text as symbol,
        ot.tx_hash,
        b.explorer_tx_url_template
      from payments p
      join checkout_sessions cs
        on cs.id = p.checkout_session_id
      join tokens t
        on t.id = p.token_id
      join blockchains b
        on b.id = t.chain_id
      left join onchain_transactions ot
        on ot.id = p.onchain_transaction_id
      where p.merchant_id = ${context.merchant.merchantId}
        and (${query.status} = 'all' or p.status::text = ${query.status})
        and (
          ${query.search} = ''
          or lower(p.sender_address) like lower(${`%${query.search}%`})
          or lower(p.recipient_address) like lower(${`%${query.search}%`})
          or lower(coalesce(ot.tx_hash, '')) like lower(${`%${query.search}%`})
        )
        and (${dateCutoff}::timestamptz is null or coalesce(p.confirmed_at, p.created_at) >= ${dateCutoff})
      order by coalesce(p.confirmed_at, p.created_at) desc
      limit ${CHECKOUT_PAGE_SIZE}
      offset ${offset}
    `;

    const totalCount = totalRows[0]?.count ?? 0;

    return {
      merchant: context.merchant,
      payments: payments.map(
        (payment): PaymentListItem => ({
          amountLabel: formatTokenAmount(payment.amount_token, payment.symbol),
          checkoutRef: payment.checkout_ref,
          confirmations: payment.confirmations,
          datetime:
            formatDashboardDate(payment.created_at) ?? payment.created_at,
          explorerUrl:
            payment.tx_hash && payment.explorer_tx_url_template
              ? payment.explorer_tx_url_template.replace(
                  "{tx_hash}",
                  payment.tx_hash,
                )
              : payment.tx_hash
                ? `https://basescan.org/tx/${payment.tx_hash}`
                : null,
          orderReference:
            payment.order_reference ?? `Checkout ${payment.checkout_ref}`,
          paymentId: payment.payment_id,
          paymentRef: payment.payment_ref,
          recipientAddress: payment.recipient_address,
          senderAddress: payment.sender_address,
          status: getStatusVariant(payment.status),
          txHash: payment.tx_hash,
        }),
      ),
      query,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / CHECKOUT_PAGE_SIZE)),
    };
  } finally {
    await database.release();
  }
}

/**
 * Returns store settings backed by merchants, wallets, tokens, and webhooks.
 */
export async function getStoreSettingsData(): Promise<StoreSettingsData> {
  const context = await getMerchantContext();
  const wallet = await getPrimaryWalletContext(context.merchant.merchantId);
  const database = await connectToDatabase();

  try {
    const [merchantDetails] = await database.sql<
      {
        last_test_sent_at: string | null;
        signing_secret_prefix: string | null;
        status: string | null;
        url: string | null;
        website_url: string | null;
      }[]
    >`
      select
        m.website_url,
        we.url,
        we.status::text as status,
        we.signing_secret_prefix,
        we.last_test_sent_at::text as last_test_sent_at
      from merchants m
      left join webhook_endpoints we
        on we.merchant_id = m.id
       and we.environment = 'live'
      where m.id = ${context.merchant.merchantId}
      limit 1
    `;

    return {
      chainName: wallet?.blockchainName ?? "Base",
      lastWebhookTestAt: merchantDetails?.last_test_sent_at ?? null,
      merchant: context.merchant,
      payoutWallet: wallet?.address ?? null,
      tokenSymbol: wallet?.tokenSymbol ?? "USDC",
      webhookSecretPrefix: merchantDetails?.signing_secret_prefix ?? null,
      webhookStatus: merchantDetails?.status ?? null,
      webhookUrl: merchantDetails?.url ?? null,
      websiteUrl: merchantDetails?.website_url ?? null,
    };
  } finally {
    await database.release();
  }
}

/**
 * Updates store profile fields that are directly modeled on `merchants`.
 */
export async function updateStoreProfile(input: {
  description: string;
  storeName: string;
  supportEmail: string;
  websiteUrl: string;
}) {
  const context = await getMerchantContext();
  const database = await connectToDatabase();
  const storeName = input.storeName.trim();
  const supportEmail = input.supportEmail.trim();
  const websiteUrl = input.websiteUrl.trim();

  if (!storeName) {
    throw new Error("Store name is required.");
  }

  if (supportEmail && !supportEmail.includes("@")) {
    throw new Error("Support email must be a valid email address.");
  }

  if (websiteUrl && !URL.canParse(websiteUrl)) {
    throw new Error("Website URL must be a valid absolute URL.");
  }

  try {
    const [merchant] = await database.sql<
      {
        description: string | null;
        display_name: string;
        support_email: string | null;
        website_url: string | null;
      }[]
    >`
      update merchants
      set
        display_name = ${storeName},
        description = ${input.description.trim() || null},
        support_email = ${supportEmail || null},
        website_url = ${websiteUrl || null},
        updated_at = now()
      where id = ${context.merchant.merchantId}
      returning
        display_name,
        description,
        support_email::text,
        website_url
    `;

    return merchant;
  } finally {
    await database.release();
  }
}

/**
 * Replaces the current primary payout wallet and records the change request.
 */
export async function replacePrimaryWallet(input: {
  confirmed: boolean;
  walletAddress: string;
  walletSignature: string;
  walletSignatureTimestampMs: number;
}) {
  const context = await getMerchantContext();
  const currentWallet = await getPrimaryWalletContext(
    context.merchant.merchantId,
  );

  if (!input.confirmed) {
    throw new Error("You must confirm the new wallet address before saving.");
  }

  const nextAddress = input.walletAddress.trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(nextAddress)) {
    throw new Error("Wallet address must be a valid Base EVM address.");
  }

  if (!currentWallet) {
    throw new Error("No Base payout wallet is configured for this merchant.");
  }

  const walletVerification = await verifyWalletOwnershipSignature({
    address: nextAddress,
    signature: input.walletSignature,
    timestampMs: input.walletSignatureTimestampMs,
  });

  if (!walletVerification.ok) {
    throw new Error(walletVerification.message);
  }

  const database = await connectToDatabase();

  try {
    await database.sql.begin(async (sql) => {
      const [newWallet] = await sql<
        {
          id: string;
        }[]
      >`
        insert into wallet_addresses (
          merchant_id,
          chain_id,
          address,
          address_normalized,
          wallet_type,
          label,
          is_primary,
          status,
          verified_at,
          verification_signature,
          created_by_user_id
        )
        select
          ${context.merchant.merchantId},
          wa.chain_id,
          ${nextAddress},
          ${nextAddress.toLowerCase()},
          'merchant_payout',
          'Primary payout wallet',
          true,
          'active',
          now(),
          ${input.walletSignature},
          ${context.userId}
        from wallet_addresses wa
        where wa.id = ${currentWallet.walletId}
        returning id::text
      `;

      await sql`
        update wallet_addresses
        set
          is_primary = false,
          status = 'replaced',
          replaced_by_wallet_id = ${newWallet.id}
        where id = ${currentWallet.walletId}
      `;

      await sql`
        insert into wallet_change_requests (
          merchant_id,
          old_wallet_id,
          new_wallet_id,
          requested_by_user_id,
          confirmation_text_acknowledged,
          status,
          applied_at
        ) values (
          ${context.merchant.merchantId},
          ${currentWallet.walletId},
          ${newWallet.id},
          ${context.userId},
          true,
          'applied',
          now()
        )
      `;

      await sql`
        insert into merchant_onboarding (
          merchant_id,
          primary_user_id,
          wallet_added_at,
          wallet_confirmation_checked_at
        ) values (
          ${context.merchant.merchantId},
          ${context.userId},
          now(),
          now()
        )
        on conflict (merchant_id) do update
          set wallet_added_at = now(),
              wallet_confirmation_checked_at = now(),
              updated_at = now()
      `;
    });

    return {
      walletAddress: nextAddress,
    };
  } finally {
    await database.release();
  }
}

/**
 * Upserts the merchant's live webhook endpoint and rotates the stored secret.
 */
export async function upsertWebhookEndpoint(input: { url: string }) {
  const context = await getMerchantContext();
  const database = await connectToDatabase();
  const url = input.url.trim();

  if (!url || !URL.canParse(url)) {
    throw new Error("Webhook URL must be a valid absolute URL.");
  }

  const secret = createWebhookSecret();

  try {
    const [endpoint] = await database.sql<
      {
        last_test_sent_at: string | null;
        signing_secret_prefix: string;
        url: string;
      }[]
    >`
      insert into webhook_endpoints (
        merchant_id,
        environment,
        url,
        signing_secret_hash,
        signing_secret_prefix,
        status,
        created_by_user_id
      ) values (
        ${context.merchant.merchantId},
        'live',
        ${url},
        ${secret.hash},
        ${secret.prefix},
        'active',
        ${context.userId}
      )
      on conflict (merchant_id, environment) do update
        set
          url = excluded.url,
          signing_secret_hash = excluded.signing_secret_hash,
          signing_secret_prefix = excluded.signing_secret_prefix,
          status = 'active',
          updated_at = now()
      returning
        url,
        signing_secret_prefix,
        last_test_sent_at::text
    `;

    return {
      endpoint,
      revealedSecret: secret.raw,
    };
  } finally {
    await database.release();
  }
}

/**
 * Queues a durable test webhook delivery using the live webhook tables and the
 * BullMQ merchant-webhooks queue.
 */
export async function queueTestWebhookDelivery() {
  const context = await getMerchantContext();
  const database = await connectToDatabase();

  try {
    const [endpoint] = await database.sql<
      {
        id: string;
        url: string;
      }[]
    >`
      select id::text as id, url
      from webhook_endpoints
      where merchant_id = ${context.merchant.merchantId}
        and environment = 'live'
        and status = 'active'
      limit 1
    `;

    if (!endpoint) {
      throw new Error(
        "Configure a live webhook endpoint before sending a test.",
      );
    }

    const [payment] = await database.sql<
      {
        amount_token: string;
        checkout_ref: string;
        payment_id: string;
        symbol: string;
        tx_hash: string | null;
      }[]
    >`
      select
        p.id::text as payment_id,
        p.amount_token::text as amount_token,
        cs.checkout_ref,
        t.symbol::text as symbol,
        ot.tx_hash
      from payments p
      join checkout_sessions cs
        on cs.id = p.checkout_session_id
      join tokens t
        on t.id = p.token_id
      left join onchain_transactions ot
        on ot.id = p.onchain_transaction_id
      where p.merchant_id = ${context.merchant.merchantId}
      order by coalesce(p.confirmed_at, p.created_at) desc
      limit 1
    `;

    const payload = {
      amount: payment?.amount_token ?? "0.00",
      checkout_ref: payment?.checkout_ref ?? "test_checkout",
      confirmed_at: new Date().toISOString(),
      currency: payment?.symbol ?? "USDC",
      event: "checkout.paid",
      tx_hash: payment?.tx_hash ?? null,
    };

    const payloadText = JSON.stringify(payload);
    let webhookEventId = "";

    await database.sql.begin(async (sql) => {
      const [event] = await sql<
        {
          id: string;
        }[]
      >`
        insert into webhook_events (
          merchant_id,
          payment_id,
          event_type,
          payload,
          payload_sha256,
          delivery_status
        ) values (
          ${context.merchant.merchantId},
          ${payment?.payment_id ?? null},
          'checkout.paid',
          ${payloadText}::jsonb,
          ${hashSecret(payloadText)},
          'pending'
        )
        returning id::text
      `;
      webhookEventId = event.id;

      await sql`
        update webhook_endpoints
        set last_test_sent_at = now(), updated_at = now()
        where id = ${endpoint.id}
      `;

      await sql`
        insert into merchant_onboarding (
          merchant_id,
          primary_user_id,
          test_webhook_sent_at
        ) values (
          ${context.merchant.merchantId},
          ${context.userId},
          now()
        )
        on conflict (merchant_id) do update
          set test_webhook_sent_at = now(),
              updated_at = now()
      `;
    });

    await enqueueMerchantWebhookJob({
      attemptNumber: 1,
      webhookEventId,
    });

    return payload;
  } finally {
    await database.release();
  }
}

/**
 * Marks the merchant as deactivated and records a deactivation reason.
 */
export async function deactivateStore(input: { confirmationText: string }) {
  const context = await getMerchantContext();

  if (input.confirmationText.trim() !== context.merchant.storeName) {
    throw new Error("Type the exact store name to confirm deactivation.");
  }

  const database = await connectToDatabase();

  try {
    await database.sql`
      update merchants
      set
        status = 'deactivated',
        deactivated_at = now(),
        deactivated_reason = 'Merchant deactivated the store from dashboard settings.',
        updated_at = now()
      where id = ${context.merchant.merchantId}
    `;

    return {
      status: "deactivated",
    };
  } finally {
    await database.release();
  }
}

/**
 * Returns account settings from user_profiles plus the current merchant shell.
 */
export async function getAccountSettingsData(): Promise<AccountSettingsData> {
  const context = await getMerchantContext();
  const database = await connectToDatabase();

  try {
    const [profile] = await database.sql<
      {
        email: string;
        full_name: string | null;
        password_changed_at: string | null;
        two_factor_status: string;
      }[]
    >`
      select
        email::text as email,
        full_name,
        password_changed_at::text,
        two_factor_status::text
      from user_profiles
      where id = ${context.userId}
      limit 1
    `;

    if (!profile) {
      throw new Error(
        "User profile record is missing for the current session.",
      );
    }

    return {
      email: profile.email,
      fullName: profile.full_name,
      merchant: context.merchant,
      passwordChangedAt: profile.password_changed_at,
      twoFactorStatus: profile.two_factor_status,
    };
  } finally {
    await database.release();
  }
}

/**
 * Updates mutable account profile fields that safely live in user_profiles.
 */
export async function updateAccountProfile(input: { fullName: string }) {
  const context = await getMerchantContext();
  const database = await connectToDatabase();

  try {
    const [profile] = await database.sql<
      {
        full_name: string | null;
      }[]
    >`
      update user_profiles
      set
        full_name = ${input.fullName.trim() || null},
        updated_at = now()
      where id = ${context.userId}
      returning full_name
    `;

    return profile;
  } finally {
    await database.release();
  }
}

/**
 * Persists the user's chosen initials-avatar background color.
 *
 * Parameters:
 * - avatarColor: Hex color from `AVATAR_COLOR_PALETTE`.
 *
 * Throws:
 * - `Error` when the color is not one of the allowed palette values.
 */
export async function updateAccountAvatarColor(input: { avatarColor: string }) {
  if (!AVATAR_COLOR_PALETTE.includes(input.avatarColor as never)) {
    throw new Error("Choose one of the provided avatar colors.");
  }

  const context = await getMerchantContext();
  const database = await connectToDatabase();

  try {
    const [profile] = await database.sql<
      {
        avatar_color: string | null;
      }[]
    >`
      update user_profiles
      set
        avatar_color = ${input.avatarColor},
        updated_at = now()
      where id = ${context.userId}
      returning avatar_color
    `;

    return profile;
  } finally {
    await database.release();
  }
}

/**
 * Uploads a new store logo to object storage, records it in `file_assets`,
 * and points `merchants.logo_asset_id` at the new row. Each upload creates a
 * fresh asset row (rather than overwriting the previous object), so the
 * returned URL is unique per upload and safe to cache forever.
 *
 * Parameters:
 * - buffer: Raw image bytes.
 * - contentType: MIME type validated by the caller against
 *   `ALLOWED_LOGO_CONTENT_TYPES`.
 *
 * Returns:
 * - `logoUrl` pointing at the new asset via `/api/store-logo/[assetId]`.
 */
export async function uploadStoreLogo(input: {
  buffer: Buffer;
  contentType: string;
}): Promise<{ logoUrl: string }> {
  const context = await getMerchantContext();
  const assetId = randomUUID();
  const storagePath = `merchant-logos/${assetId}`;
  const sha256 = createHash("sha256").update(input.buffer).digest("hex");

  await uploadObject({
    buffer: input.buffer,
    contentType: input.contentType,
    key: storagePath,
  });

  const database = await connectToDatabase();

  try {
    await database.sql.begin(async (sql) => {
      await sql`
        insert into file_assets (
          id,
          owner_merchant_id,
          storage_bucket,
          storage_path,
          mime_type,
          byte_size,
          sha256,
          uploaded_by_user_id
        )
        values (
          ${assetId}::uuid,
          ${context.merchant.merchantId}::uuid,
          ${TIGRIS_BUCKET_NAME},
          ${storagePath},
          ${input.contentType},
          ${input.buffer.length},
          ${sha256},
          ${context.userId}::uuid
        )
      `;

      await sql`
        update merchants
        set
          logo_asset_id = ${assetId}::uuid,
          updated_at = now()
        where id = ${context.merchant.merchantId}::uuid
      `;
    });
  } finally {
    await database.release();
  }

  return { logoUrl: `/api/store-logo/${assetId}` };
}

/**
 * Streams a previously uploaded store logo asset. Public by design — store
 * logos are shown on public checkout pages.
 *
 * Parameters:
 * - assetId: `file_assets.id` referenced by `merchants.logo_asset_id`.
 *
 * Returns:
 * - Image bytes and content type when the asset exists.
 * - `null` when the asset row or the underlying object is missing.
 */
export async function getStoreLogoObject(
  assetId: string,
): Promise<{ buffer: Uint8Array; contentType: string } | null> {
  if (!UUID_PATTERN.test(assetId)) {
    return null;
  }

  const database = await connectToDatabase();

  let storagePath: string;
  let mimeType: string;

  try {
    const [asset] = await database.sql<
      { mime_type: string; storage_path: string }[]
    >`
      select storage_path, mime_type
      from file_assets
      where id = ${assetId}::uuid
      limit 1
    `;

    if (!asset) {
      return null;
    }

    storagePath = asset.storage_path;
    mimeType = asset.mime_type;
  } finally {
    await database.release();
  }

  const object = await getObject({ key: storagePath });

  return object ? { buffer: object.buffer, contentType: mimeType } : null;
}

/**
 * Returns API key, webhook, and delivery data for the developers page.
 */
export async function getDevelopersPageData(): Promise<DevelopersPageData> {
  const context = await getMerchantContext();
  const database = await connectToDatabase();

  try {
    const apiKeys = await database.sql<
      {
        created_at: string;
        environment: "test" | "live";
        id: string;
        key_prefix: string;
        last_four: string;
        last_used_at: string | null;
        name: string;
        status: string;
      }[]
    >`
      select
        id::text as id,
        environment::text as environment,
        name,
        key_prefix,
        last_four,
        status::text as status,
        last_used_at::text,
        created_at::text
      from api_keys
      where merchant_id = ${context.merchant.merchantId}
      order by created_at desc
    `;

    const [endpoint] = await database.sql<
      {
        signing_secret_prefix: string | null;
        status: string | null;
        url: string | null;
      }[]
    >`
      select
        url,
        signing_secret_prefix,
        status::text as status
      from webhook_endpoints
      where merchant_id = ${context.merchant.merchantId}
        and environment = 'live'
      limit 1
    `;

    const deliveries = await database.sql<
      {
        attempt_number: number;
        created_at: string;
        delivery_status: string;
        event_type: string;
        id: string;
        outcome: string;
        response_status_code: number | null;
      }[]
    >`
      select
        wda.id::text as id,
        wda.attempt_number,
        wda.created_at::text as created_at,
        wda.response_status_code,
        wda.outcome::text as outcome,
        we.event_type::text as event_type,
        we.delivery_status::text as delivery_status
      from webhook_delivery_attempts wda
      join webhook_events we
        on we.id = wda.webhook_event_id
      where we.merchant_id = ${context.merchant.merchantId}
      order by wda.created_at desc
      limit 10
    `;

    const [payload] = await database.sql<
      {
        payload: string | null;
      }[]
    >`
      select payload::text as payload
      from webhook_events
      where merchant_id = ${context.merchant.merchantId}
      order by created_at desc
      limit 1
    `;

    return {
      apiKeys: apiKeys.map(
        (apiKey): ApiKeyListItem => ({
          createdAt: apiKey.created_at,
          environment: apiKey.environment,
          id: apiKey.id,
          keyPrefix: apiKey.key_prefix,
          lastFour: apiKey.last_four,
          lastUsedAt: apiKey.last_used_at,
          name: apiKey.name,
          status: apiKey.status,
        }),
      ),
      lastWebhookPayload:
        payload?.payload ??
        JSON.stringify(
          {
            amount: "0.00",
            checkout_ref: "test_checkout",
            confirmed_at: new Date().toISOString(),
            currency: "USDC",
            event: "checkout.paid",
            tx_hash: null,
          },
          null,
          2,
        ),
      merchant: context.merchant,
      webhookDeliveries: deliveries.map(
        (delivery): WebhookDeliveryItem => ({
          attemptNumber: delivery.attempt_number,
          createdAt: delivery.created_at,
          deliveryStatus: delivery.delivery_status,
          eventType: delivery.event_type,
          id: delivery.id,
          outcome: delivery.outcome,
          responseStatusCode: delivery.response_status_code,
        }),
      ),
      webhookSecretPrefix: endpoint?.signing_secret_prefix ?? null,
      webhookStatus: endpoint?.status ?? null,
      webhookUrl: endpoint?.url ?? null,
    };
  } finally {
    await database.release();
  }
}

/**
 * Creates a new API key row and returns the one-time raw secret.
 */
export async function createApiKey(input: {
  environment: "test" | "live";
  name: string;
}) {
  const context = await getMerchantContext();
  const database = await connectToDatabase();
  const name = input.name.trim();

  if (!name) {
    throw new Error("API key name is required.");
  }

  const secret = createApiSecret(input.environment);

  try {
    const [apiKey] = await database.sql<
      {
        created_at: string;
        environment: "test" | "live";
        id: string;
        key_prefix: string;
        last_four: string;
        name: string;
        status: string;
      }[]
    >`
      insert into api_keys (
        merchant_id,
        environment,
        name,
        key_prefix,
        secret_hash,
        last_four,
        status,
        created_by_user_id
      ) values (
        ${context.merchant.merchantId},
        ${input.environment},
        ${name},
        ${secret.keyPrefix},
        ${secret.hash},
        ${secret.lastFour},
        'active',
        ${context.userId}
      )
      returning
        id::text as id,
        environment::text as environment,
        name,
        key_prefix,
        last_four,
        status::text as status,
        created_at::text
    `;

    return {
      apiKey,
      revealedSecret: secret.raw,
    };
  } finally {
    await database.release();
  }
}

/**
 * Marks every unread notification for the current merchant user as read.
 */
export async function markNotificationsRead() {
  const context = await getMerchantContext();
  const database = await connectToDatabase();

  try {
    await database.sql`
      update notifications
      set
        is_read = true,
        read_at = now()
      where merchant_id = ${context.merchant.merchantId}
        and (user_id is null or user_id = ${context.userId})
        and is_read = false
    `;
  } finally {
    await database.release();
  }
}

/**
 * Resolves a public checkout by its public token or merchant-facing ref.
 */
export async function getPublicCheckoutData(
  id: string,
): Promise<PublicCheckoutData> {
  const database = await connectToDatabase();

  try {
    const rows = await database.sql.begin(async (sql) => {
      await reconcileCheckoutExpiry(sql, {
        lookupId: id,
      });

      return sql<
        {
          address: string;
          amount_token: string;
          chain_name: string;
          checkout_ref: string;
          display_name: string;
          expires_at: string;
          label: string;
          public_token: string;
          redirect_url: string | null;
          status: string;
          symbol: string;
        }[]
      >`
        select
          cs.checkout_ref,
          cs.public_token,
          cs.label,
          cs.amount_token::text,
          cs.status::text as status,
          cs.expires_at::text as expires_at,
          cs.redirect_url,
          m.display_name,
          wa.address,
          b.display_name as chain_name,
          t.symbol::text as symbol
        from checkout_sessions cs
        join merchants m
          on m.id = cs.merchant_id
        join wallet_addresses wa
          on wa.id = cs.recipient_wallet_id
        join tokens t
          on t.id = cs.token_id
        join blockchains b
          on b.id = t.chain_id
        where cs.public_token = ${id}
           or cs.checkout_ref = ${id}
        limit 1
      `;
    });

    const checkout = rows[0];

    if (!checkout) {
      throw new Error("Checkout not found.");
    }

    return {
      amountLabel: formatTokenAmount(checkout.amount_token, checkout.symbol),
      chainName: checkout.chain_name,
      checkoutRef: checkout.checkout_ref,
      expiresAt: checkout.expires_at,
      merchantName: checkout.display_name,
      orderDescription: checkout.label,
      paymentUri: `ethereum:${checkout.address}@8453?value=${checkout.amount_token}`,
      publicToken: checkout.public_token,
      redirectUrl: checkout.redirect_url,
      status:
        checkout.status === "paid"
          ? "paid"
          : checkout.status === "detected"
            ? "detected"
            : checkout.status === "expired" || checkout.status === "deactivated"
              ? "expired"
              : "waiting",
      tokenSymbol: checkout.symbol,
      walletAddress: checkout.address,
    };
  } finally {
    await database.release();
  }
}

/**
 * Resolves a public receipt by payment ref, checkout ref, or checkout token.
 */
export async function getPublicReceiptData(
  id: string,
): Promise<PublicReceiptData> {
  const database = await connectToDatabase();

  try {
    const rows = await database.sql<
      {
        amount_token: string;
        confirmed_at: string | null;
        display_name: string;
        explorer_tx_url_template: string;
        label: string;
        redirect_url: string | null;
        symbol: string;
        tx_hash: string | null;
      }[]
    >`
      select
        p.amount_token::text,
        p.confirmed_at::text,
        m.display_name,
        cs.label,
        coalesce(cs.success_url, cs.redirect_url) as redirect_url,
        t.symbol::text as symbol,
        ot.tx_hash,
        b.explorer_tx_url_template
      from checkout_sessions cs
      join merchants m
        on m.id = cs.merchant_id
      left join payments p
        on p.checkout_session_id = cs.id
      join tokens t
        on t.id = cs.token_id
      join blockchains b
        on b.id = t.chain_id
      left join onchain_transactions ot
        on ot.id = p.onchain_transaction_id
      where cs.public_token = ${id}
         or cs.checkout_ref = ${id}
         or p.payment_ref = ${id}
      order by coalesce(p.confirmed_at, p.created_at, cs.updated_at) desc
      limit 1
    `;

    const receipt = rows[0];

    if (!receipt) {
      throw new Error("Receipt not found.");
    }

    return {
      amountLabel: formatTokenAmount(receipt.amount_token, receipt.symbol),
      explorerUrl:
        receipt.tx_hash && receipt.explorer_tx_url_template
          ? receipt.explorer_tx_url_template.replace(
              "{tx_hash}",
              receipt.tx_hash,
            )
          : receipt.tx_hash
            ? `https://basescan.org/tx/${receipt.tx_hash}`
            : null,
      merchantName: receipt.display_name,
      orderDescription: receipt.label,
      paidAt: receipt.confirmed_at,
      redirectUrl: receipt.redirect_url,
      txHash: receipt.tx_hash,
    };
  } finally {
    await database.release();
  }
}

export { CHECKOUT_PAGE_SIZE, DatabaseConnectionError };
