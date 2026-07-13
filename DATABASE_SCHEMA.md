# Outpay Database Schema Plan

## 1. Repository Feature Analysis

### What exists in the repository

The current `outpay` repository is a Next.js 16 App Router application with implemented API route handlers, PostgreSQL-backed server flows, and queue/worker code. The schema below is grounded in the current repository surfaces and migration history, with later migrations taking precedence over the initial design snapshot.

- Actual application screens and forms in `src/views/*`
- Route structure in `src/app/*`
- Developer/product copy that defines the intended backend contracts
- Product constraints in the supplied context: non-custodial, USDC on Base only for MVP

### Key repository surfaces and required data support

#### Authentication and merchant onboarding

Files:

- `src/views/AuthScreens.tsx`
- `src/app/auth/page.tsx`
- `src/app/onboarding/page.tsx`

Observed features:

- Sign up
- Log in
- Forgot password / reset email flow
- 3-step onboarding
- Store name, description, optional logo
- Base payout wallet capture and confirmation

Database support required:

- Auth-linked user profile table
- Merchant/store table
- Merchant membership table
- Onboarding progress / checklist
- Wallet table with validation and change history

#### Merchant dashboard and first-login checklist

Files:

- `src/views/MerchantDashboard.tsx`
- `src/views/FirstLoginDashboard.tsx`
- `src/views/NotificationBell.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/first-login/page.tsx`

Observed features:

- 30-day payment volume
- Paid / pending checkouts
- Webhook success rate
- Recent payments list
- Setup checklist: add wallet, create checkout, send test webhook
- Notifications dropdown

Database support required:

- Checkout and payment status data
- Webhook delivery history
- Merchant KPI query support
- Notification inbox
- Setup progress flags

#### Checkout creation and checkout listing

Files:

- `src/views/CreateCheckout.tsx`
- `src/views/CheckoutsList.tsx`
- `src/app/checkouts/new/page.tsx`
- `src/app/checkouts/page.tsx`

Observed features:

- Create checkout with product/order name
- USD input converted to USDC display
- Optional order reference
- Optional redirect URL
- Hosted checkout link generation
- QR code
- Checkout statuses: active, paid, expired
- Link copy and deactivate actions

Database support required:

- Checkout session table
- Checkout status history
- Idempotent checkout creation
- Redirect URL storage
- Public hosted slug / token
- Deactivation metadata

#### Customer checkout and receipt

Files:

- `src/views/CustomerCheckout.tsx`
- `src/views/PaymentReceipt.tsx`
- `src/app/checkout/[id]/page.tsx`
- `src/app/receipt/[id]/page.tsx`

Observed features:

- Public checkout page by ID
- Exact amount due in USDC
- Base-only warning
- Merchant receiving address
- Live payment status: waiting, detected, paid, expired
- Receipt with tx hash, paid time, redirect countdown

Database support required:

- Public checkout lookup
- Payment detection state
- Blockchain transaction storage
- Receipt / confirmed payment data
- Customer redirect state

#### Payments ledger

Files:

- `src/views/Payments.tsx`
- `src/app/payments/page.tsx`

Observed features:

- Full payment ledger
- Search by wallet or tx hash
- Filter by status
- Date ranges
- Detail drawer with confirmations, sender, recipient, hash, checkout ref
- Block explorer link

Database support required:

- Payment table
- On-chain transaction table
- Checkout-to-payment mapping
- Searchable wallet/hash indexes
- Status history / confirmation counts

#### Developers / API / webhooks

Files:

- `src/views/Developers.tsx`
- `src/views/Changelog.tsx`
- `src/views/MarketingDetailPage.tsx`
- `src/app/developers/*`
- `src/app/changelog/page.tsx`

Observed features:

- Test and live API keys
- Secret reveal/hide UX
- `POST /v1/checkouts`
- Signed webhook configuration
- HMAC webhook secret
- Delivery history
- Test webhook sending
- `checkout.paid` payload
- Idempotency key mention in changelog
- Retry-safe delivery model in developer copy

Database support required:

- API key table
- Idempotency key table
- Webhook endpoint + signing secret
- Webhook event and delivery attempt tables
- API request usage / rate limit support
- Developer changelog can stay content-only and does not require core DB storage

#### Settings and account management

Files:

- `src/views/Settings.tsx`
- `src/views/AccountSettings.tsx`
- `src/app/settings/page.tsx`
- `src/app/settings/account/page.tsx`

Observed features:

- Store profile editing
- Support email
- Wallet change modal with confirmation
- Webhook endpoint
- Locked payment options: USDC on Base only
- Store deactivation
- Account name/email
- Password change
- 2FA coming soon

Database support required:

- Store profile fields
- Account profile fields
- Wallet versioning
- Webhook config
- Merchant status lifecycle
- Security preferences

#### Pricing and sales contact

Files:

- `src/views/Pricing.tsx`
- `src/views/Contact.tsx`
- `src/views/Company.tsx`

Observed features:

- 1,000 free paid transactions monthly
- 1.5% fee after allowance
- Corporate pricing / contact sales
- Implementation planning inquiries
- Partnerships inquiries

Current persistence decision:

- Pricing and sales copy remains UI-only for now.
- No billing, metering, fee-ledger, or enterprise-contact workflow is scheduled.
- Reintroduce those tables in a future feature migration when a consuming workflow exists.

### Important repository-driven implementation notes

1. The schema is now partly implemented. Active API and worker paths are the authority for operational tables; product copy alone does not justify a persisted table.
2. The UI and docs use both `chk_*` and `ch_*` style checkout identifiers. The schema should use internal UUID primary keys plus a separate public `checkout_ref` to avoid hard-coupling to either prefix until the API is standardized.
3. The app is explicitly non-custodial. No billing or platform-fee ledger tables are active until a billing workflow is scheduled.
4. The repository does not currently include a public store directory route, but the product brief does. The schema below supports it through merchant public profile and verification fields.
5. No dedicated admin screens exist yet, but support workflows are implied by store deactivation/reactivation, wallet review risk, and webhook retry operations. `merchant_reviews` remains reserved for T-42; enterprise contact requests are not persisted until T-44 is wired.

## 2. Core Product Entities

### Table: `user_profiles`

- Purpose: Application profile for each authenticated user mirrored from Better Auth.
- Justified by: `src/views/AuthScreens.tsx`, `src/views/AccountSettings.tsx`, and
  `src/lib/auth/index.ts`
- Primary key: `id uuid` references `auth.users(id)`

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | none | PK, FK to `auth.users.id` |
| `email` | `citext` | yes | none | normalized login email |
| `full_name` | `text` | no | `null` | account settings |
| `avatar_url` | `text` | no | `null` | future account avatar |
| `password_changed_at` | `timestamptz` | no | `null` | supports security audit |
| `two_factor_status` | `two_factor_status_enum` | yes | `'disabled'` | matches coming-soon security path |
| `terms_accepted_at` | `timestamptz` | no | `null` | server-generated Terms of Service acceptance time |
| `privacy_accepted_at` | `timestamptz` | no | `null` | server-generated Privacy Policy acceptance time |
| `last_login_at` | `timestamptz` | no | `null` | auth analytics |
| `created_at` | `timestamptz` | yes | `now()` | |
| `updated_at` | `timestamptz` | yes | `now()` | |

- Unique constraints:
  - `unique(email)`
- Indexes:
  - `idx_user_profiles_email`
- Migration note:
  - `0009_legal_acceptance_tracking` adds the same acceptance timestamps to
    Better Auth's `"user"` table so the signup write and profile mirror use the
    same server-generated values.
- RLS:
  - User can `select` and `update` own row only.
  - Admin/support service role can read all.
- Example:

```json
{
  "id": "0d5fa7f8-f0e5-4f77-8e0f-efb8b257e7c0",
  "email": "jordan@acmecoffee.com",
  "full_name": "Jordan Reyes",
  "two_factor_status": "disabled"
}
```

### Table: `merchants`

- Purpose: Canonical merchant/business/store record.
- Justified by: `src/views/AuthOnboarding.tsx`, `src/views/Settings.tsx`, `src/views/MerchantDashboard.tsx`

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `public_slug` | `citext` | yes | none | merchant public URL slug |
| `legal_name` | `text` | no | `null` | future compliance / invoicing |
| `display_name` | `text` | yes | none | store name shown in checkout |
| `description` | `text` | no | `null` | short store description |
| `logo_asset_id` | `uuid` | no | `null` | FK to `file_assets.id` |
| `support_email` | `citext` | no | `null` | settings page |
| `website_url` | `text` | no | `null` | future directory profile |
| `status` | `merchant_status_enum` | yes | `'active'` | active, paused, deactivated, under_review |
| `verification_status` | `merchant_verification_status_enum` | yes | `'unverified'` | supports verified directory stores |
| `is_directory_listed` | `boolean` | yes | `false` | public directory control |
| `directory_summary` | `text` | no | `null` | public listing summary |
| `deactivated_at` | `timestamptz` | no | `null` | danger zone workflow |
| `deactivated_reason` | `text` | no | `null` | support / risk reason |
| `created_by_user_id` | `uuid` | yes | none | FK to `user_profiles.id` |
| `created_at` | `timestamptz` | yes | `now()` | |
| `updated_at` | `timestamptz` | yes | `now()` | |

- Foreign keys:
  - `logo_asset_id -> file_assets.id`
  - `created_by_user_id -> user_profiles.id`
- Unique constraints:
  - `unique(public_slug)`
- Indexes:
  - `idx_merchants_public_slug`
  - `idx_merchants_status`
  - `idx_merchants_verification_status`
  - partial index on `is_directory_listed = true`
- RLS:
  - Merchant members can read their merchant.
  - Only owners/admins can update merchant profile/settings.
  - Public anonymous read may be allowed on directory-safe columns when `is_directory_listed = true`.
- Example:

```json
{
  "public_slug": "acme-coffee",
  "display_name": "Acme Coffee Co.",
  "status": "active",
  "verification_status": "verified",
  "is_directory_listed": true
}
```

### Table: `merchant_members`

- Purpose: Team membership and role mapping between users and merchants.
- Justified by: product brief team members/roles, `src/views/Home.tsx`, `src/views/MarketingDetailPage.tsx`

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `merchant_id` | `uuid` | yes | none | FK |
| `user_id` | `uuid` | yes | none | FK |
| `role` | `merchant_role_enum` | yes | `'member'` | owner/admin/developer/finance/support/member/viewer |
| `status` | `member_status_enum` | yes | `'active'` | invitation lifecycle |
| `invited_by_user_id` | `uuid` | no | `null` | FK |
| `invited_email` | `citext` | no | `null` | before signup acceptance |
| `joined_at` | `timestamptz` | no | `null` | |
| `created_at` | `timestamptz` | yes | `now()` | |
| `updated_at` | `timestamptz` | yes | `now()` | |

- Foreign keys:
  - `merchant_id -> merchants.id`
  - `user_id -> user_profiles.id`
  - `invited_by_user_id -> user_profiles.id`
- Unique constraints:
  - `unique(merchant_id, user_id)`
- Indexes:
  - `idx_merchant_members_user_id`
  - `idx_merchant_members_merchant_role`
- RLS:
  - Users can read their own membership rows.
  - Merchant owners/admins can manage members.
  - Service role can manage invitations and sync auth acceptance.

### Table: `merchant_onboarding`

- Purpose: Persist onboarding state, setup checklist completion, and first-login flow.
- Justified by: `src/views/AuthOnboarding.tsx`, `src/views/FirstLoginDashboard.tsx`

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `merchant_id` | `uuid` | yes | none | PK, FK |
| `primary_user_id` | `uuid` | yes | none | FK |
| `onboarding_status` | `onboarding_status_enum` | yes | `'store_details'` | current step |
| `store_details_completed_at` | `timestamptz` | no | `null` | |
| `wallet_added_at` | `timestamptz` | no | `null` | |
| `wallet_confirmation_checked_at` | `timestamptz` | no | `null` | |
| `first_checkout_created_at` | `timestamptz` | no | `null` | |
| `test_webhook_sent_at` | `timestamptz` | no | `null` | |
| `completed_at` | `timestamptz` | no | `null` | |
| `created_at` | `timestamptz` | yes | `now()` | |
| `updated_at` | `timestamptz` | yes | `now()` | |

- Unique constraints:
  - one row per merchant
- Indexes:
  - `idx_merchant_onboarding_status`
- RLS:
  - Merchant members can read.
  - Owners/admins can update.

### Table: `file_assets`

- Purpose: Store uploaded asset metadata such as merchant logos.
- Justified by: `src/views/AuthOnboarding.tsx`, `src/views/Settings.tsx`

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `owner_merchant_id` | `uuid` | no | `null` | FK |
| `storage_bucket` | `text` | yes | none | Supabase storage bucket |
| `storage_path` | `text` | yes | none | object path |
| `mime_type` | `text` | yes | none | |
| `byte_size` | `bigint` | yes | none | |
| `sha256` | `text` | no | `null` | dedupe / integrity |
| `uploaded_by_user_id` | `uuid` | no | `null` | FK |
| `created_at` | `timestamptz` | yes | `now()` | |

- Indexes:
  - `idx_file_assets_owner_merchant_id`
  - `idx_file_assets_storage_path`
- RLS:
  - Merchant members can access only their merchant assets.

### Table: `wallet_addresses`

- Purpose: Track merchant payout wallets and future customer wallet records.
- Justified by: `src/views/AuthOnboarding.tsx`, `src/views/Settings.tsx`, `src/views/CustomerCheckout.tsx`, `src/views/Payments.tsx`

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `merchant_id` | `uuid` | no | `null` | merchant payout wallet |
| `customer_id` | `uuid` | no | `null` | optional known customer wallet |
| `chain_id` | `uuid` | yes | none | FK to `blockchains.id` |
| `address` | `text` | yes | none | EVM checksum-preserving text |
| `address_normalized` | `text` | yes | none | lowercased for uniqueness/search |
| `wallet_type` | `wallet_type_enum` | yes | `'merchant_payout'` | merchant_payout/customer_sender |
| `label` | `text` | no | `null` | internal label |
| `is_primary` | `boolean` | yes | `false` | active payout wallet |
| `status` | `wallet_status_enum` | yes | `'active'` | active/replaced/disabled |
| `verified_at` | `timestamptz` | no | `null` | set once the merchant proves control via wallet signature (T-2) |
| `verification_signature` | `text` | no | `null` | raw `personal_sign` signature over the ownership challenge message, retained for audit |
| `replaced_by_wallet_id` | `uuid` | no | `null` | self FK |
| `created_by_user_id` | `uuid` | no | `null` | FK |
| `created_at` | `timestamptz` | yes | `now()` | |
| `updated_at` | `timestamptz` | yes | `now()` | maintained by `trg_wallet_addresses_updated_at` |

- Foreign keys:
  - `merchant_id -> merchants.id`
  - `customer_id -> customers.id`
  - `chain_id -> blockchains.id`
  - `replaced_by_wallet_id -> wallet_addresses.id`
- Unique constraints:
  - `unique(chain_id, address_normalized, wallet_type, merchant_id)` for merchant wallets
- Indexes:
  - `idx_wallet_addresses_merchant_primary`
  - `idx_wallet_addresses_address_normalized`
  - `idx_wallet_addresses_customer_id`
- RLS:
  - Merchant members can read merchant payout wallets.
  - Only owner/admin can change primary payout wallet.
- Example:

```json
{
  "merchant_id": "merchant-uuid",
  "address": "0x4d92c8A1e5Bf0d3a6C71298fE4b0d9A2c1e0aa10",
  "address_normalized": "0x4d92c8a1e5bf0d3a6c71298fe4b0d9a2c1e0aa10",
  "wallet_type": "merchant_payout",
  "is_primary": true
}
```

### Table: `wallet_change_requests`

- Purpose: Audit wallet changes because mistakes are irreversible.
- Justified by: `src/views/Settings.tsx`, `src/views/AuthScreens.tsx`

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `merchant_id` | `uuid` | yes | none | FK |
| `old_wallet_id` | `uuid` | no | `null` | FK |
| `new_wallet_id` | `uuid` | yes | none | FK |
| `requested_by_user_id` | `uuid` | yes | none | FK |
| `confirmation_text_acknowledged` | `boolean` | yes | `false` | explicit irreversible acknowledgment |
| `status` | `wallet_change_status_enum` | yes | `'applied'` | pending/applied/rejected |
| `applied_at` | `timestamptz` | no | `null` | |
| `notes` | `text` | no | `null` | support note |
| `created_at` | `timestamptz` | yes | `now()` | |

- Indexes:
  - `idx_wallet_change_requests_merchant_id`
  - `idx_wallet_change_requests_created_at`
- RLS:
  - Merchant owners/admins can read and create.
  - Support/admin can read all.

### Table: `customers`

- Purpose: Optional customer record for repeat buyers tied to checkout sessions and payments.
- Justified by: public checkout flow, ledger sender wallet tracking, developer integration needs

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `merchant_id` | `uuid` | yes | none | FK |
| `external_customer_ref` | `text` | no | `null` | merchant-side customer id |
| `email` | `citext` | no | `null` | future receipts / CRM |
| `name` | `text` | no | `null` | |
| `metadata` | `jsonb` | yes | `'{}'::jsonb` | integration-defined fields |
| `created_at` | `timestamptz` | yes | `now()` | |
| `updated_at` | `timestamptz` | yes | `now()` | |

- Unique constraints:
  - `unique(merchant_id, external_customer_ref)` where not null
- Indexes:
  - `idx_customers_merchant_id`
  - `idx_customers_email`
- RLS:
  - Merchant members can access only their merchant customers.

## 3. Payment Infrastructure

### Table: `blockchains`

- Purpose: Chain catalog. MVP is Base only, but the repo already frames future multi-chain growth.
- Justified by: repeated “USDC on Base only” copy in `src/views/CreateCheckout.tsx`, `src/views/CustomerCheckout.tsx`, `src/views/Settings.tsx`

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `slug` | `citext` | yes | none | `base` |
| `display_name` | `text` | yes | none | `Base` |
| `chain_numeric_id` | `integer` | yes | none | 8453 |
| `is_enabled` | `boolean` | yes | `true` | |
| `confirmations_required` | `integer` | yes | `1` | changelog says one confirmation |
| `explorer_tx_url_template` | `text` | yes | none | `https://basescan.org/tx/{hash}` |
| `rpc_label` | `text` | no | `null` | provider label |
| `created_at` | `timestamptz` | yes | `now()` | |

- Unique constraints:
  - `unique(slug)`
  - `unique(chain_numeric_id)`
- Example:

```json
{
  "slug": "base",
  "display_name": "Base",
  "chain_numeric_id": 8453,
  "confirmations_required": 1
}
```

### Table: `tokens`

- Purpose: Token catalog. MVP needs USDC on Base, with future USDT support explicitly mentioned.
- Justified by: `src/views/Settings.tsx`, supplied context

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `chain_id` | `uuid` | yes | none | FK |
| `symbol` | `citext` | yes | none | `USDC` |
| `display_name` | `text` | yes | none | |
| `contract_address` | `text` | yes | none | ERC-20 contract |
| `contract_address_normalized` | `text` | yes | none | lowercased search form |
| `decimals` | `smallint` | yes | none | typically 6 for USDC |
| `is_enabled` | `boolean` | yes | `true` | |
| `is_mvp_default` | `boolean` | yes | `false` | flags USDC on Base |
| `created_at` | `timestamptz` | yes | `now()` | |

- Unique constraints:
  - `unique(chain_id, symbol)`
  - `unique(chain_id, contract_address_normalized)`
- Indexes:
  - `idx_tokens_chain_symbol`

### Table: `checkout_sessions`

- Purpose: Main hosted checkout/payment request object.
- Justified by: `src/views/CreateCheckout.tsx`, `src/views/CheckoutsList.tsx`, `src/views/CustomerCheckout.tsx`, `src/views/Developers.tsx`

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `checkout_ref` | `text` | yes | none | public API/display id like `chk_*` |
| `public_token` | `text` | yes | none | route token for `/checkout/[id]` |
| `merchant_id` | `uuid` | yes | none | FK |
| `customer_id` | `uuid` | no | `null` | FK |
| `token_id` | `uuid` | yes | none | FK to `tokens.id` |
| `recipient_wallet_id` | `uuid` | yes | none | FK to active merchant payout wallet snapshot |
| `label` | `text` | yes | none | product/order name |
| `order_reference` | `text` | no | `null` | optional order ref |
| `amount_usd` | `numeric(20,2)` | yes | none | source UI input |
| `amount_token` | `numeric(20,8)` | yes | none | exact due amount |
| `status` | `checkout_status_enum` | yes | `'pending'` | pending/detected/paid/expired/deactivated/failed |
| `redirect_url` | `text` | no | `null` | post-payment redirect |
| `success_url` | `text` | no | `null` | future explicit success URL |
| `cancel_url` | `text` | no | `null` | future cancel path |
| `idempotency_key` | `text` | no | `null` | caller-supplied key, unique per merchant, dedupes retried creation requests |
| `expires_at` | `timestamptz` | no | `null` | needed for expired state |
| `paid_at` | `timestamptz` | no | `null` | receipt data |
| `detected_at` | `timestamptz` | no | `null` | detected-confirming state |
| `deactivated_at` | `timestamptz` | no | `null` | merchant action |
| `deactivated_by_user_id` | `uuid` | no | `null` | FK |
| `source` | `checkout_source_enum` | yes | `'dashboard'` | dashboard/api/integration |
| `metadata` | `jsonb` | yes | `'{}'::jsonb` | merchant-defined fields |
| `created_by_user_id` | `uuid` | no | `null` | dashboard creator |
| `created_via_api_key_id` | `uuid` | no | `null` | API creator |
| `created_at` | `timestamptz` | yes | `now()` | |
| `updated_at` | `timestamptz` | yes | `now()` | |

- Foreign keys:
  - `merchant_id -> merchants.id`
  - `customer_id -> customers.id`
  - `token_id -> tokens.id`
  - `recipient_wallet_id -> wallet_addresses.id`
  - `deactivated_by_user_id -> user_profiles.id`
  - `created_by_user_id -> user_profiles.id`
  - `created_via_api_key_id -> api_keys.id`
- Unique constraints:
  - `unique(checkout_ref)`
  - `unique(public_token)`
  - `unique(merchant_id, idempotency_key)` (`uq_checkout_sessions_merchant_idempotency_key`)
- Indexes:
  - `idx_checkout_sessions_merchant_created_at`
  - `idx_checkout_sessions_merchant_status`
  - `idx_checkout_sessions_public_token`
  - `idx_checkout_sessions_order_reference`
  - `idx_checkout_sessions_expires_at` partial for unpaid checkouts
- RLS:
  - Merchant members can CRUD their own merchant checkouts.
  - Anonymous users can only `select` via a restricted public view or policy on columns needed for hosted checkout when status is public-displayable and not deactivated.
- Example:

```json
{
  "checkout_ref": "chk_8f2a91b4e6d7",
  "public_token": "8f2a91b4e6d7",
  "label": "Espresso subscription — 1 month",
  "order_reference": "Order #4471",
  "amount_usd": "124.00",
  "amount_token": "124.000000",
  "status": "pending"
}
```

### Table: `checkout_status_history`

- Purpose: Immutable timeline for created, detected, paid, expired, deactivated, failed transitions.
- Justified by: dashboard, public checkout state, receipt, payment detail drawer

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `bigserial` | yes | auto | PK |
| `checkout_session_id` | `uuid` | yes | none | FK |
| `from_status` | `checkout_status_enum` | no | `null` | |
| `to_status` | `checkout_status_enum` | yes | none | |
| `reason_code` | `checkout_status_reason_enum` | no | `null` | expired_timeout/manual_deactivation/payment_confirmed/etc |
| `message` | `text` | no | `null` | |
| `actor_type` | `actor_type_enum` | yes | `'system'` | system/user/worker/webhook |
| `actor_user_id` | `uuid` | no | `null` | FK |
| `created_at` | `timestamptz` | yes | `now()` | |

- Indexes:
  - `idx_checkout_status_history_checkout_created_at`
- RLS:
  - Merchant members can read for their merchant checkouts.
  - Service role/worker can insert.

### Table: `payment_intents`

- Purpose: Logical matching target for worker detection and webhook fulfillment. Kept separate from checkout session so detection, retries, and tx matching remain auditable.
- Justified by: product copy around “backend worker detects the payment” and “match amount, token, network, and destination wallet”

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `checkout_session_id` | `uuid` | yes | none | FK |
| `merchant_id` | `uuid` | yes | none | denormalized FK |
| `token_id` | `uuid` | yes | none | FK |
| `recipient_wallet_id` | `uuid` | yes | none | FK |
| `expected_amount_token` | `numeric(20,8)` | yes | none | |
| `match_status` | `payment_match_status_enum` | yes | `'awaiting_payment'` | awaiting_payment/detected/confirmed/mismatched/expired |
| `required_confirmations` | `integer` | yes | `1` | from chain config snapshot |
| `current_confirmations` | `integer` | yes | `0` | worker updated |
| `detected_tx_id` | `uuid` | no | `null` | FK once found |
| `confirmed_payment_id` | `uuid` | no | `null` | FK once settled |
| `expires_at` | `timestamptz` | no | `null` | |
| `detected_at` | `timestamptz` | no | `null` | |
| `confirmed_at` | `timestamptz` | no | `null` | |
| `created_at` | `timestamptz` | yes | `now()` | |
| `updated_at` | `timestamptz` | yes | `now()` | |

- Unique constraints:
  - `unique(checkout_session_id)`
- Indexes:
  - `idx_payment_intents_match_status`
  - `idx_payment_intents_expires_at`
  - `idx_payment_intents_merchant_id`
- RLS:
  - Merchant members can read.
  - Worker/service role writes.

### Table: `onchain_transactions`

- Purpose: Raw chain transaction record observed by the detection worker.
- Justified by: `src/views/Payments.tsx`, `src/views/PaymentReceipt.tsx`, `src/views/Product.tsx`

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `chain_id` | `uuid` | yes | none | FK |
| `token_id` | `uuid` | yes | none | FK |
| `tx_hash` | `text` | yes | none | |
| `tx_hash_normalized` | `text` | yes | none | lowercased |
| `block_number` | `bigint` | no | `null` | |
| `block_hash` | `text` | no | `null` | |
| `log_index` | `integer` | no | `null` | ERC-20 transfer event index |
| `from_address` | `text` | yes | none | |
| `from_address_normalized` | `text` | yes | none | |
| `to_address` | `text` | yes | none | |
| `to_address_normalized` | `text` | yes | none | |
| `amount_token` | `numeric(20,8)` | yes | none | |
| `confirmations` | `integer` | yes | `0` | |
| `observed_at` | `timestamptz` | yes | `now()` | first seen |
| `confirmed_at` | `timestamptz` | no | `null` | chain confirmation threshold crossed |
| `raw_event` | `jsonb` | no | `null` | RPC payload for debugging |
| `created_at` | `timestamptz` | yes | `now()` | |

- Unique constraints:
  - `unique(chain_id, tx_hash_normalized, coalesce(log_index, -1))`
- Indexes:
  - `idx_onchain_transactions_tx_hash_normalized`
  - `idx_onchain_transactions_to_address_normalized`
  - `idx_onchain_transactions_from_address_normalized`
  - `idx_onchain_transactions_observed_at`
- RLS:
  - Merchant members read via joined payments only.
  - Worker/service role inserts/updates.

### Table: `payments`

- Purpose: Confirmed or terminal payment result shown in dashboard and receipt.
- Justified by: `src/views/MerchantDashboard.tsx`, `src/views/Payments.tsx`, `src/views/PaymentReceipt.tsx`

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `payment_ref` | `text` | yes | none | public/support-safe id |
| `merchant_id` | `uuid` | yes | none | FK |
| `checkout_session_id` | `uuid` | yes | none | FK |
| `payment_intent_id` | `uuid` | yes | none | FK |
| `onchain_transaction_id` | `uuid` | no | `null` | FK |
| `sender_wallet_id` | `uuid` | no | `null` | FK if known customer wallet saved |
| `sender_address` | `text` | yes | none | full address snapshot |
| `recipient_address` | `text` | yes | none | full address snapshot |
| `token_id` | `uuid` | yes | none | FK |
| `amount_token` | `numeric(20,8)` | yes | none | |
| `amount_usd` | `numeric(20,2)` | yes | none | |
| `status` | `payment_status_enum` | yes | `'pending'` | pending/paid/failed/expired |
| `confirmations` | `integer` | yes | `0` | |
| `confirmed_at` | `timestamptz` | no | `null` | |
| `failure_reason` | `text` | no | `null` | |
| `created_at` | `timestamptz` | yes | `now()` | |
| `updated_at` | `timestamptz` | yes | `now()` | |

- Unique constraints:
  - `unique(payment_ref)`
  - `unique(checkout_session_id)` for one successful/terminal payment per checkout MVP
- Indexes:
  - `idx_payments_merchant_created_at`
  - `idx_payments_merchant_status`
  - `idx_payments_sender_address`
  - `idx_payments_recipient_address`
  - `idx_payments_confirmed_at`
  - `idx_payments_onchain_transaction_id`
  - `idx_payments_payment_intent_id`
- RLS:
  - Merchant members can read only their merchant payments.
  - Anonymous receipt access should use a limited view keyed by a receipt token, not direct table exposure.
- Example:

```json
{
  "payment_ref": "pay_01J0YJ7Q0P4A",
  "checkout_session_id": "checkout-uuid",
  "sender_address": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  "recipient_address": "0x4d92c8A1e5Bf0d3a6C71298fE4b0d9A2c1e0aa10",
  "amount_token": "124.000000",
  "status": "paid",
  "confirmations": 24
}
```

### Table: `payment_match_failures`

- Purpose: Record mismatched, partial, wrong-network, wrong-token, duplicate, or late transfers that should not mark a checkout paid.
- Active implementation: `src/lib/payments/match-payment.ts` inserts these rows during the transactional payment-matching path.

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `checkout_session_id` | `uuid` | no | `null` | FK if identifiable |
| `payment_intent_id` | `uuid` | no | `null` | FK |
| `onchain_transaction_id` | `uuid` | no | `null` | FK |
| `failure_type` | `payment_failure_type_enum` | yes | none | wrong_network/wrong_token/amount_mismatch/etc |
| `expected_amount_token` | `numeric(20,8)` | no | `null` | |
| `observed_amount_token` | `numeric(20,8)` | no | `null` | |
| `details` | `jsonb` | yes | `'{}'::jsonb` | |
| `created_at` | `timestamptz` | yes | `now()` | |

- Indexes:
  - `idx_payment_match_failures_checkout_session_id`
  - `idx_payment_match_failures_failure_type`
- RLS:
  - Merchant members can read own merchant failures through checkout join.
  - Worker/service role inserts.

### Table: `provider_events_raw`

- Purpose: Stores raw webhook/RPC payloads from Alchemy and later any other on-chain data provider before they are normalized, so detection failures can be replayed or debugged from the original payload.
- Justified by: `ARCHITECTURE.md` §14.6 (payment-detection pipeline)

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `provider` | `text` | yes | none | e.g. `alchemy` |
| `provider_event_id` | `text` | no | `null` | provider-assigned event id, used for de-dupe |
| `chain` | `text` | yes | none | chain slug the event was observed on |
| `payload` | `jsonb` | yes | none | raw provider payload |
| `signature_valid` | `boolean` | yes | `false` | whether the provider's webhook signature verified |
| `received_at` | `timestamptz` | yes | `now()` | |
| `processed_at` | `timestamptz` | no | `null` | set once normalized into `chain_events` |
| `error` | `text` | no | `null` | processing failure detail |

- Unique constraints:
  - `unique(provider, provider_event_id)`
- RLS:
  - Worker/service role only; not merchant-readable.

### Table: `chain_cursors`

- Purpose: Tracks the last safely-scanned block per chain/provider/cursor type so RPC scanning workers can resume without re-scanning or skipping blocks.
- Justified by: `ARCHITECTURE.md` §13.3, §14.12 (payment-detection pipeline)

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `chain` | `text` | yes | none | chain slug |
| `provider` | `text` | yes | none | data source for this cursor |
| `cursor_type` | `text` | yes | none | distinguishes multiple scan strategies per chain/provider |
| `last_scanned_block` | `bigint` | yes | none | only advanced after data is durably written |
| `last_success_at` | `timestamptz` | no | `null` | |
| `last_error_at` | `timestamptz` | no | `null` | |
| `updated_at` | `timestamptz` | yes | `now()` | |

- Unique constraints:
  - `unique(chain, provider, cursor_type)`
- RLS:
  - Worker/service role only; not merchant-readable.

## 4. Merchant Dashboard and Admin Features

### Table: `merchant_reviews`

- Purpose: Internal review / verification / support operations for merchants.
- Justified by: product brief merchant verification and directory; store deactivation/reactivation implied by `src/views/Settings.tsx`

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `merchant_id` | `uuid` | yes | none | FK |
| `review_type` | `merchant_review_type_enum` | yes | none | onboarding/verification/reactivation/risk |
| `status` | `merchant_review_status_enum` | yes | `'open'` | |
| `opened_by_user_id` | `uuid` | no | `null` | FK |
| `assigned_to_user_id` | `uuid` | no | `null` | FK |
| `resolution_notes` | `text` | no | `null` | |
| `resolved_at` | `timestamptz` | no | `null` | |
| `created_at` | `timestamptz` | yes | `now()` | |

- Indexes:
  - `idx_merchant_reviews_merchant_status`
- RLS:
  - Internal admin/support only.

### Table: `notifications`

- Purpose: Merchant notification inbox for paid payments, pending confirmations, and failed webhooks.
- Justified by: `src/views/NotificationBell.tsx`

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `merchant_id` | `uuid` | yes | none | FK |
| `user_id` | `uuid` | no | `null` | FK for user-targeted notices |
| `type` | `notification_type_enum` | yes | none | payment_paid/webhook_failed/checkout_pending/etc |
| `title` | `text` | yes | none | |
| `body` | `text` | yes | none | |
| `resource_type` | `resource_type_enum` | no | `null` | checkout/payment/webhook_delivery |
| `resource_id` | `uuid` | no | `null` | |
| `is_read` | `boolean` | yes | `false` | |
| `read_at` | `timestamptz` | no | `null` | |
| `created_at` | `timestamptz` | yes | `now()` | |

- Indexes:
  - `idx_notifications_user_unread`
  - `idx_notifications_merchant_created_at`
- RLS:
  - User sees notifications for merchants they belong to and user-targeted notifications to themselves.

## 5. Integrations and API Access

### Table: `api_keys`

- Purpose: Test/live API credentials for checkout creation.
- Justified by: `src/views/Developers.tsx`

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `merchant_id` | `uuid` | yes | none | FK |
| `environment` | `api_environment_enum` | yes | none | test/live |
| `name` | `text` | yes | none | operator label |
| `key_prefix` | `text` | yes | none | safe display prefix |
| `secret_hash` | `text` | yes | none | never store plaintext |
| `last_four` | `text` | yes | none | display |
| `status` | `api_key_status_enum` | yes | `'active'` | active/revoked |
| `created_by_user_id` | `uuid` | no | `null` | FK |
| `last_used_at` | `timestamptz` | no | `null` | |
| `revoked_at` | `timestamptz` | no | `null` | |
| `created_at` | `timestamptz` | yes | `now()` | |

- Unique constraints:
  - `unique(key_prefix)`
- Indexes:
  - `idx_api_keys_merchant_environment`
  - `idx_api_keys_status`
- RLS:
  - Merchant owners/admin/developer roles can read metadata.
  - Plain secret is returned once at creation from server code only.

### Table: `api_idempotency_keys`

- Purpose: Prevent duplicate checkout creation retries.
- Active implementation: `src/app/api/v1/checkouts/route.ts` stores and replays idempotent checkout responses.

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `merchant_id` | `uuid` | yes | none | FK |
| `api_key_id` | `uuid` | no | `null` | FK |
| `idempotency_key` | `text` | yes | none | header value |
| `request_method` | `text` | yes | none | `POST` |
| `request_path` | `text` | yes | none | `/v1/checkouts` |
| `request_hash` | `text` | yes | none | normalized request body hash |
| `response_status_code` | `integer` | no | `null` | |
| `response_body` | `jsonb` | no | `null` | |
| `checkout_session_id` | `uuid` | no | `null` | FK |
| `expires_at` | `timestamptz` | yes | none | retention window |
| `created_at` | `timestamptz` | yes | `now()` | |

- Unique constraints:
  - `unique(merchant_id, request_method, request_path, idempotency_key)`
- Indexes:
  - `idx_api_idempotency_keys_expires_at`

### Table: `webhook_endpoints`

- Purpose: Merchant webhook configuration and signing secret lifecycle.
- Justified by: `src/views/Developers.tsx`, `src/views/Settings.tsx`

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `merchant_id` | `uuid` | yes | none | FK |
| `environment` | `api_environment_enum` | yes | `'live'` | test/live |
| `url` | `text` | yes | none | endpoint URL |
| `signing_secret_hash` | `text` | yes | none | stored hashed |
| `signing_secret_prefix` | `text` | yes | none | reveal-safe prefix |
| `status` | `webhook_endpoint_status_enum` | yes | `'active'` | active/disabled |
| `subscribed_events` | `text[]` | yes | `ARRAY['checkout.paid']::text[]` | MVP event list |
| `last_test_sent_at` | `timestamptz` | no | `null` | |
| `created_by_user_id` | `uuid` | no | `null` | FK |
| `created_at` | `timestamptz` | yes | `now()` | |
| `updated_at` | `timestamptz` | yes | `now()` | |

- Unique constraints:
  - `unique(merchant_id, environment)`
- Indexes:
  - `idx_webhook_endpoints_merchant_environment`
- RLS:
  - Merchant admin/developer roles manage.
  - Secret plaintext only returned once from server action/API.

### Table: `webhook_events`

- Purpose: Event objects generated by Outpay and queued for delivery.
- Justified by: `src/views/Developers.tsx`, `src/views/Product.tsx`, `src/views/MarketingDetailPage.tsx`

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `merchant_id` | `uuid` | yes | none | FK |
| `checkout_session_id` | `uuid` | no | `null` | FK |
| `payment_id` | `uuid` | no | `null` | FK |
| `event_type` | `webhook_event_type_enum` | yes | none | `checkout.paid` MVP |
| `payload` | `jsonb` | yes | none | signed JSON payload |
| `payload_sha256` | `text` | yes | none | integrity / dedupe |
| `delivery_status` | `webhook_delivery_status_enum` | yes | `'pending'` | |
| `emitted_at` | `timestamptz` | yes | `now()` | |
| `created_at` | `timestamptz` | yes | `now()` | |

- Indexes:
  - `idx_webhook_events_merchant_emitted_at`
  - `idx_webhook_events_delivery_status`
  - `idx_webhook_events_checkout_session_id`
  - `idx_webhook_events_payment_id`
- RLS:
  - Merchant members can read their own events.
  - Worker/service role inserts/updates.

### Table: `webhook_delivery_attempts`

- Purpose: Delivery log with retries, response codes, and observability.
- Justified by: `src/views/Developers.tsx`, `src/views/NotificationBell.tsx`, `src/views/Changelog.tsx`

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `webhook_event_id` | `uuid` | yes | none | FK |
| `webhook_endpoint_id` | `uuid` | yes | none | FK |
| `attempt_number` | `integer` | yes | none | starts at 1 |
| `request_headers` | `jsonb` | no | `null` | sanitized |
| `request_body` | `jsonb` | no | `null` | optional debug copy |
| `response_status_code` | `integer` | no | `null` | |
| `response_body_excerpt` | `text` | no | `null` | clipped |
| `outcome` | `webhook_attempt_outcome_enum` | yes | none | success/http_error/timeout/network_error |
| `next_retry_at` | `timestamptz` | no | `null` | |
| `duration_ms` | `integer` | no | `null` | |
| `created_at` | `timestamptz` | yes | `now()` | |

- Unique constraints:
  - `unique(webhook_event_id, attempt_number)`
- Indexes:
  - `idx_webhook_delivery_attempts_event_attempt`
  - `idx_webhook_delivery_attempts_next_retry_at`
  - `idx_webhook_delivery_attempts_response_status_code`
- RLS:
  - Merchant members can read attempts for their merchant events.
  - Worker/service role writes.

### Table: `integration_installations`

- Purpose: Merchant integration settings for ecommerce platforms or custom backends.
- Justified by: supplied brief says ecommerce integrations/APIs; developer pages imply direct integrations

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `merchant_id` | `uuid` | yes | none | FK |
| `provider` | `integration_provider_enum` | yes | none | custom/shopify/woocommerce/etc |
| `status` | `integration_status_enum` | yes | `'active'` | |
| `external_store_id` | `text` | no | `null` | |
| `config` | `jsonb` | yes | `'{}'::jsonb` | provider-specific config |
| `created_by_user_id` | `uuid` | no | `null` | FK |
| `created_at` | `timestamptz` | yes | `now()` | |
| `updated_at` | `timestamptz` | yes | `now()` | |

- Unique constraints:
  - `unique(merchant_id, provider, coalesce(external_store_id, ''))`
- Indexes:
  - `idx_integration_installations_merchant_provider`
- RLS:
  - Merchant admin/developer roles manage.

### Table: `api_rate_limit_counters`

- Purpose: Rate limit state for API keys and merchant-level throttling.
- Justified by: explicit request to cover rate limits and usage limits; Redis may later replace active counters, but SQL remains useful for policy config and durable audit

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `merchant_id` | `uuid` | yes | none | FK |
| `api_key_id` | `uuid` | no | `null` | FK |
| `scope` | `rate_limit_scope_enum` | yes | none | merchant/api_key/ip |
| `window_starts_at` | `timestamptz` | yes | none | bucket start |
| `window_ends_at` | `timestamptz` | yes | none | bucket end |
| `request_count` | `integer` | yes | `0` | |
| `limit_count` | `integer` | yes | none | configured limit |
| `created_at` | `timestamptz` | yes | `now()` | |

- Indexes:
  - `idx_api_rate_limit_counters_scope_window`
  - `idx_api_rate_limit_counters_api_key_id`
- RLS:
  - Internal service only.

## 6. Analytics, Logs, and Audit Trail

### Table: `audit_logs`

- Purpose: Durable audit trail for sensitive merchant and system operations.
- Active implementation: `src/lib/dashboard/server.ts` records audit events for merchant, wallet, checkout, webhook, and API-key mutations.

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `bigserial` | yes | auto | PK |
| `merchant_id` | `uuid` | no | `null` | FK |
| `actor_user_id` | `uuid` | no | `null` | FK |
| `actor_type` | `actor_type_enum` | yes | none | user/system/worker/api_key |
| `api_key_id` | `uuid` | no | `null` | FK |
| `action` | `audit_action_enum` | yes | none | wallet_changed, checkout_created, store_deactivated, etc |
| `resource_type` | `resource_type_enum` | yes | none | |
| `resource_id` | `uuid` | no | `null` | |
| `request_id` | `text` | no | `null` | |
| `metadata` | `jsonb` | yes | `'{}'::jsonb` | sanitized context |
| `created_at` | `timestamptz` | yes | `now()` | |

- Indexes:
  - `idx_audit_logs_merchant_created_at`
  - `idx_audit_logs_resource`
  - `idx_audit_logs_actor_user_id`
- RLS:
  - Merchant owners/admins can read their merchant audit logs.
  - Support/admin can read all.
  - Only backend service inserts.

### Table: `event_logs`

- Purpose: Domain events for payment matching, reconciliation recovery, reporting, and operational debugging.
- Active implementation: `src/lib/payments/match-payment.ts` records payment and reconciler events; additional producers can append domain events as workflows become active.

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `bigserial` | yes | auto | PK |
| `merchant_id` | `uuid` | no | `null` | FK |
| `user_id` | `uuid` | no | `null` | FK |
| `checkout_session_id` | `uuid` | no | `null` | FK |
| `event_name` | `text` | yes | none | `checkout_viewed`, `wallet_copy_clicked`, etc |
| `event_properties` | `jsonb` | yes | `'{}'::jsonb` | |
| `occurred_at` | `timestamptz` | yes | `now()` | |

- Indexes:
  - `idx_event_logs_merchant_occurred_at`
  - `idx_event_logs_event_name_occurred_at`
- RLS:
  - Internal analytics access; merchant exposure via aggregates/views.

### Table: `error_logs`

- Purpose: Structured application/worker/API errors.
- Justified by: required background worker, webhook retries, payment detection flows, `src/views/Error500.tsx`

| Column | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | PK |
| `merchant_id` | `uuid` | no | `null` | FK |
| `checkout_session_id` | `uuid` | no | `null` | FK |
| `payment_id` | `uuid` | no | `null` | FK |
| `webhook_event_id` | `uuid` | no | `null` | FK |
| `source` | `error_source_enum` | yes | none | web/api/worker/webhook |
| `severity` | `error_severity_enum` | yes | none | warning/error/critical |
| `error_code` | `text` | yes | none | machine-readable code |
| `message` | `text` | yes | none | |
| `details` | `jsonb` | yes | `'{}'::jsonb` | sanitized context |
| `resolved_at` | `timestamptz` | no | `null` | |
| `created_at` | `timestamptz` | yes | `now()` | |

- Indexes:
  - `idx_error_logs_source_created_at`
  - `idx_error_logs_merchant_created_at`
  - `idx_error_logs_error_code`
- RLS:
  - Internal support/admin primarily.
  - Merchant-visible subset can be exposed through safe dashboard views if desired.

## 7. Enums

Recommended PostgreSQL enums:

- `two_factor_status_enum`: `disabled`, `pending_setup`, `enabled`
- `merchant_status_enum`: `active`, `paused`, `deactivated`, `under_review`
- `merchant_verification_status_enum`: `unverified`, `pending_review`, `verified`, `rejected`
- `merchant_role_enum`: `owner`, `admin`, `developer`, `finance`, `support`, `member`, `viewer`
- `member_status_enum`: `invited`, `active`, `suspended`, `removed`
- `onboarding_status_enum`: `store_details`, `wallet_address`, `confirm`, `completed`
- `wallet_type_enum`: `merchant_payout`, `customer_sender`
- `wallet_status_enum`: `active`, `replaced`, `disabled`
- `wallet_change_status_enum`: `pending`, `applied`, `rejected`
- `checkout_status_enum`: `pending`, `detected`, `paid`, `expired`, `deactivated`, `failed`
- `checkout_status_reason_enum`: `created`, `payment_detected`, `payment_confirmed`, `expired_timeout`, `manual_deactivation`, `invalid_payment`, `reactivated`
- `checkout_source_enum`: `dashboard`, `api`, `integration`
- `payment_match_status_enum`: `awaiting_payment`, `detected`, `confirmed`, `mismatched`, `expired`
- `payment_status_enum`: `pending`, `paid`, `failed`, `expired`
- `payment_failure_type_enum`: `wrong_network`, `wrong_token`, `amount_mismatch`, `late_payment`, `duplicate_payment`, `recipient_mismatch`, `unknown`
- `merchant_review_type_enum`: `onboarding`, `verification`, `reactivation`, `risk`
- `merchant_review_status_enum`: `open`, `in_review`, `approved`, `rejected`, `closed`
- `notification_type_enum`: `payment_paid`, `payment_pending`, `checkout_expired`, `webhook_failed`, `webhook_recovered`, `store_status_changed`
- `resource_type_enum`: `merchant`, `wallet`, `checkout`, `payment`, `webhook_event`, `webhook_delivery`, `api_key`, `contact_request`
- `api_environment_enum`: `test`, `live`
- `api_key_status_enum`: `active`, `revoked`
- `webhook_endpoint_status_enum`: `active`, `disabled`
- `webhook_event_type_enum`: `checkout.paid`
- `webhook_delivery_status_enum`: `pending`, `processing`, `delivered`, `failed`, `exhausted`
- `webhook_attempt_outcome_enum`: `success`, `http_error`, `timeout`, `network_error`, `skipped`
- `integration_provider_enum`: `custom`, `shopify`, `woocommerce`, `bigcommerce`, `headless`
- `integration_status_enum`: `active`, `disabled`, `error`
- `rate_limit_scope_enum`: `merchant`, `api_key`, `ip`
- `actor_type_enum`: `user`, `system`, `worker`, `api_key`
- `audit_action_enum`: `merchant_created`, `merchant_updated`, `wallet_changed`, `checkout_created`, `checkout_deactivated`, `payment_confirmed`, `webhook_endpoint_updated`, `api_key_created`, `api_key_revoked`, `store_deactivated`, `store_reactivated`
- `error_source_enum`: `web`, `api`, `worker`, `webhook`
- `error_severity_enum`: `warning`, `error`, `critical`

## 8. Relationships

High-level relationship mapping:

- `auth.users 1:1 user_profiles`
- `user_profiles M:N merchants` through `merchant_members`
- `merchants 1:N wallet_addresses`
- `merchants 1:1 merchant_onboarding`
- `merchants 1:N customers`
- `merchants 1:N checkout_sessions`
- `checkout_sessions 1:1 payment_intents`
- `checkout_sessions 1:N checkout_status_history`
- `checkout_sessions 1:0..1 payments`
- `payments 1:1 onchain_transactions` in the successful/terminal MVP path
- `merchants 1:N api_keys`
- `merchants 1:1 webhook_endpoints` per environment
- `webhook_events 1:N webhook_delivery_attempts`
- `merchants 1:N notifications`
- `merchants 1:N audit_logs`
- `merchants 1:N error_logs`

Practical flow:

1. User signs up.
2. `user_profiles` row is created from `auth.users`.
3. Merchant is created in `merchants`.
4. Owner membership is inserted into `merchant_members`.
5. Onboarding progress is tracked in `merchant_onboarding`.
6. Payout wallet is inserted into `wallet_addresses`.
7. Merchant creates a checkout in `checkout_sessions`.
8. Worker watches Base and records raw txs in `onchain_transactions`.
9. Match result updates `payment_intents`.
10. Successful settlement creates/updates `payments`.
11. Checkout becomes paid in `checkout_sessions` and `checkout_status_history`.
12. `webhook_events` and `webhook_delivery_attempts` are created.
13. Notification entries are inserted.

## 9. Indexes and Performance Recommendations

Critical indexes:

- `checkout_sessions(merchant_id, created_at desc)` for list views.
- `checkout_sessions(merchant_id, status)` for dashboard counts.
- `checkout_sessions(public_token)` for public checkout page lookup.
- `payments(merchant_id, created_at desc)` for recent payments.
- `payments(merchant_id, status, confirmed_at desc)` for filters.
- `payments using gin (to_tsvector('simple', coalesce(sender_address,'') || ' ' || coalesce(recipient_address,'') || ' ' || coalesce(payment_ref,'')))` if search expands.
- `onchain_transactions(tx_hash_normalized)` for explorer/tx lookup.
- `onchain_transactions(to_address_normalized, observed_at desc)` for worker matching.
- `webhook_delivery_attempts(webhook_event_id, attempt_number)` for delivery history.
- `webhook_delivery_attempts(next_retry_at)` for retry scheduler.
- `notifications(user_id, is_read, created_at desc)` for bell dropdown.
- `audit_logs(merchant_id, created_at desc)` for admin/support review.

Additional recommendations:

- Partition `audit_logs`, `event_logs`, and possibly `error_logs` by month once volume grows.
- Consider materialized views for dashboard KPIs if merchant/payment volume grows past interactive query thresholds.
- Consider trigram indexes on `order_reference` if merchants search human-readable order IDs frequently.
- Store normalized lowercase wallet and tx hash strings for exact search; keep original case for display.

## 10. Security and Row-Level Security Rules

Recommended Supabase/PostgreSQL RLS model:

### User access

- `user_profiles`: user can read/update only `id = auth.uid()`.

### Merchant membership access

- Use a helper function like `is_merchant_member(merchant_uuid uuid)` and `merchant_role_at_least(merchant_uuid uuid, roles merchant_role_enum[])`.
- Apply those helpers consistently across merchant-scoped tables.

### Merchant data

- Read:
  - Any active merchant member can read merchant-scoped operational data for their merchant.
- Write:
  - `owner`, `admin` can update merchant profile, wallet, webhook endpoint, store settings.
  - `developer` can manage API keys and integrations.
  - `finance` can read payments, fees, and usage, but not rotate secrets.
  - `viewer` is read-only.

### Public hosted checkout

- Do not expose base tables directly to anonymous clients.
- Preferred pattern:
  - Create a security-definer RPC or restricted view for public checkout reads by `public_token`.
  - Expose only merchant display name, logo, amount, token symbol, wallet address, status, and redirect-safe fields.

### Receipts

- Same approach as public checkout:
  - expose via receipt token, RPC, or generated signed URL
  - do not grant anonymous access to the full `payments` table

### API-key access

- API keys should authenticate through server middleware, not direct table reads.
- Plaintext key never stored.
- Only hashed secret in DB.

### Webhooks

- Webhook event payloads and delivery attempts are merchant-readable.
- Signing secrets are never readable after creation except by privileged server code during secret generation flow.

### Admin/support

- Internal admin role can bypass RLS through service role.
- Support-facing dashboards should read from the same tables through backend services, not direct client RLS elevation.

## 11. Migration Order

Recommended creation order:

1. Enable extensions and helper functions
2. Create enums
3. Create `file_assets`
4. Create `blockchains`
5. Create `tokens`
6. Create `user_profiles`
7. Create `merchants`
8. Create `merchant_members`
9. Create `merchant_onboarding`
10. Create `customers`
11. Create `wallet_addresses`
12. Create `wallet_change_requests`
13. Create `api_keys`
14. Create `webhook_endpoints`
15. Create `integration_installations`
16. Create `checkout_sessions`
17. Create `checkout_status_history`
18. Create `payment_intents`
19. Create `onchain_transactions`
20. Create `payments`
21. Create `payment_match_failures`
22. Create `webhook_events`
23. Create `webhook_delivery_attempts`
24. Create `merchant_reviews`
25. Create `notifications`
26. Create `audit_logs`
27. Create `event_logs`
28. Create `error_logs`
29. Create `api_idempotency_keys`
30. Create `api_rate_limit_counters`
31. Create `provider_events_raw` and `chain_cursors`; add later payment-pipeline columns and indexes through migrations
32. Add policies, indexes, and triggers

`db/migrations/` is the source of truth for the schema that actually exists. This document and the SQL in §12 describe the current active schema; later feature migrations must update both when they introduce new persisted workflows.

## 12. Final PostgreSQL/Supabase SQL Schema

```sql
create extension if not exists pgcrypto;
create extension if not exists citext;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create type two_factor_status_enum as enum ('disabled', 'pending_setup', 'enabled');
create type merchant_status_enum as enum ('active', 'paused', 'deactivated', 'under_review');
create type merchant_verification_status_enum as enum ('unverified', 'pending_review', 'verified', 'rejected');
create type merchant_role_enum as enum ('owner', 'admin', 'developer', 'finance', 'support', 'member', 'viewer');
create type member_status_enum as enum ('invited', 'active', 'suspended', 'removed');
create type onboarding_status_enum as enum ('store_details', 'wallet_address', 'confirm', 'completed');
create type wallet_type_enum as enum ('merchant_payout', 'customer_sender');
create type wallet_status_enum as enum ('active', 'replaced', 'disabled');
create type wallet_change_status_enum as enum ('pending', 'applied', 'rejected');
create type checkout_status_enum as enum ('pending', 'detected', 'paid', 'expired', 'deactivated', 'failed');
create type checkout_status_reason_enum as enum ('created', 'payment_detected', 'payment_confirmed', 'expired_timeout', 'manual_deactivation', 'invalid_payment', 'reactivated');
create type checkout_source_enum as enum ('dashboard', 'api', 'integration');
create type payment_match_status_enum as enum ('awaiting_payment', 'detected', 'confirmed', 'mismatched', 'expired');
create type payment_status_enum as enum ('pending', 'paid', 'failed', 'expired');
create type payment_failure_type_enum as enum ('wrong_network', 'wrong_token', 'amount_mismatch', 'late_payment', 'duplicate_payment', 'recipient_mismatch', 'unknown');
create type merchant_review_type_enum as enum ('onboarding', 'verification', 'reactivation', 'risk');
create type merchant_review_status_enum as enum ('open', 'in_review', 'approved', 'rejected', 'closed');
create type notification_type_enum as enum ('payment_paid', 'payment_pending', 'checkout_expired', 'webhook_failed', 'webhook_recovered', 'store_status_changed');
create type resource_type_enum as enum ('merchant', 'wallet', 'checkout', 'payment', 'webhook_event', 'webhook_delivery', 'api_key', 'contact_request');
create type api_environment_enum as enum ('test', 'live');
create type api_key_status_enum as enum ('active', 'revoked');
create type webhook_endpoint_status_enum as enum ('active', 'disabled');
create type webhook_event_type_enum as enum ('checkout.paid');
create type webhook_delivery_status_enum as enum ('pending', 'processing', 'delivered', 'failed', 'exhausted');
create type webhook_attempt_outcome_enum as enum ('success', 'http_error', 'timeout', 'network_error', 'skipped');
create type integration_provider_enum as enum ('custom', 'shopify', 'woocommerce', 'bigcommerce', 'headless');
create type integration_status_enum as enum ('active', 'disabled', 'error');
create type rate_limit_scope_enum as enum ('merchant', 'api_key', 'ip');
create type actor_type_enum as enum ('user', 'system', 'worker', 'api_key');
create type audit_action_enum as enum ('merchant_created', 'merchant_updated', 'wallet_changed', 'checkout_created', 'checkout_deactivated', 'payment_confirmed', 'webhook_endpoint_updated', 'api_key_created', 'api_key_revoked', 'store_deactivated', 'store_reactivated');
create type error_source_enum as enum ('web', 'api', 'worker', 'webhook');
create type error_severity_enum as enum ('warning', 'error', 'critical');

create table file_assets (
  id uuid primary key default gen_random_uuid(),
  owner_merchant_id uuid,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  sha256 text,
  uploaded_by_user_id uuid,
  created_at timestamptz not null default now()
);

create table blockchains (
  id uuid primary key default gen_random_uuid(),
  slug citext not null unique,
  display_name text not null,
  chain_numeric_id integer not null unique,
  is_enabled boolean not null default true,
  confirmations_required integer not null default 1 check (confirmations_required >= 0),
  explorer_tx_url_template text not null,
  rpc_label text,
  created_at timestamptz not null default now()
);

create table tokens (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references blockchains(id),
  symbol citext not null,
  display_name text not null,
  contract_address text not null,
  contract_address_normalized text not null,
  decimals smallint not null check (decimals >= 0),
  is_enabled boolean not null default true,
  is_mvp_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (chain_id, symbol),
  unique (chain_id, contract_address_normalized)
);

create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  full_name text,
  avatar_url text,
  password_changed_at timestamptz,
  two_factor_status two_factor_status_enum not null default 'disabled',
  last_login_at timestamptz,
  privacy_accepted_at timestamptz,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table merchants (
  id uuid primary key default gen_random_uuid(),
  public_slug citext not null unique,
  legal_name text,
  display_name text not null,
  description text,
  logo_asset_id uuid references file_assets(id),
  support_email citext,
  website_url text,
  status merchant_status_enum not null default 'active',
  verification_status merchant_verification_status_enum not null default 'unverified',
  is_directory_listed boolean not null default false,
  directory_summary text,
  deactivated_at timestamptz,
  deactivated_reason text,
  created_by_user_id uuid not null references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table file_assets
  add constraint file_assets_owner_merchant_fk
  foreign key (owner_merchant_id) references merchants(id);

alter table file_assets
  add constraint file_assets_uploaded_by_user_fk
  foreign key (uploaded_by_user_id) references user_profiles(id);

create table merchant_members (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  role merchant_role_enum not null default 'member',
  status member_status_enum not null default 'active',
  invited_by_user_id uuid references user_profiles(id),
  invited_email citext,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, user_id)
);

create table merchant_onboarding (
  merchant_id uuid primary key references merchants(id) on delete cascade,
  primary_user_id uuid not null references user_profiles(id),
  onboarding_status onboarding_status_enum not null default 'store_details',
  store_details_completed_at timestamptz,
  wallet_added_at timestamptz,
  wallet_confirmation_checked_at timestamptz,
  first_checkout_created_at timestamptz,
  test_webhook_sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  external_customer_ref text,
  email citext,
  name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, external_customer_ref)
);

create table wallet_addresses (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  chain_id uuid not null references blockchains(id),
  address text not null check (address ~ '^0x[a-fA-F0-9]{40}$'),
  address_normalized text not null,
  wallet_type wallet_type_enum not null default 'merchant_payout',
  label text,
  is_primary boolean not null default false,
  status wallet_status_enum not null default 'active',
  verified_at timestamptz,
  replaced_by_wallet_id uuid references wallet_addresses(id),
  created_by_user_id uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  check ((merchant_id is not null) <> (customer_id is not null))
);

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  environment api_environment_enum not null,
  name text not null,
  key_prefix text not null unique,
  secret_hash text not null,
  last_four text not null,
  status api_key_status_enum not null default 'active',
  created_by_user_id uuid references user_profiles(id),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  environment api_environment_enum not null default 'live',
  url text not null,
  signing_secret_hash text not null,
  signing_secret_prefix text not null,
  status webhook_endpoint_status_enum not null default 'active',
  subscribed_events text[] not null default array['checkout.paid']::text[],
  last_test_sent_at timestamptz,
  created_by_user_id uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, environment)
);

create table integration_installations (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  provider integration_provider_enum not null,
  status integration_status_enum not null default 'active',
  external_store_id text,
  config jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  checkout_ref text not null unique,
  public_token text not null unique,
  merchant_id uuid not null references merchants(id) on delete cascade,
  customer_id uuid references customers(id),
  token_id uuid not null references tokens(id),
  recipient_wallet_id uuid not null references wallet_addresses(id),
  label text not null,
  order_reference text,
  amount_usd numeric(20,2) not null check (amount_usd > 0),
  amount_token numeric(20,8) not null check (amount_token > 0),
  status checkout_status_enum not null default 'pending',
  redirect_url text,
  success_url text,
  cancel_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  detected_at timestamptz,
  deactivated_at timestamptz,
  deactivated_by_user_id uuid references user_profiles(id),
  source checkout_source_enum not null default 'dashboard',
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references user_profiles(id),
  created_via_api_key_id uuid references api_keys(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table wallet_change_requests (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  old_wallet_id uuid references wallet_addresses(id),
  new_wallet_id uuid not null references wallet_addresses(id),
  requested_by_user_id uuid not null references user_profiles(id),
  confirmation_text_acknowledged boolean not null default false,
  status wallet_change_status_enum not null default 'applied',
  applied_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table checkout_status_history (
  id bigserial primary key,
  checkout_session_id uuid not null references checkout_sessions(id) on delete cascade,
  from_status checkout_status_enum,
  to_status checkout_status_enum not null,
  reason_code checkout_status_reason_enum,
  message text,
  actor_type actor_type_enum not null default 'system',
  actor_user_id uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

create table payment_intents (
  id uuid primary key default gen_random_uuid(),
  checkout_session_id uuid not null unique references checkout_sessions(id) on delete cascade,
  merchant_id uuid not null references merchants(id) on delete cascade,
  token_id uuid not null references tokens(id),
  recipient_wallet_id uuid not null references wallet_addresses(id),
  expected_amount_token numeric(20,8) not null check (expected_amount_token > 0),
  match_status payment_match_status_enum not null default 'awaiting_payment',
  required_confirmations integer not null default 1 check (required_confirmations >= 0),
  current_confirmations integer not null default 0 check (current_confirmations >= 0),
  detected_tx_id uuid,
  confirmed_payment_id uuid,
  expires_at timestamptz,
  detected_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table onchain_transactions (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references blockchains(id),
  token_id uuid not null references tokens(id),
  tx_hash text not null,
  tx_hash_normalized text not null,
  block_number bigint,
  block_hash text,
  log_index integer,
  from_address text not null,
  from_address_normalized text not null,
  to_address text not null,
  to_address_normalized text not null,
  amount_token numeric(20,8) not null check (amount_token > 0),
  confirmations integer not null default 0 check (confirmations >= 0),
  observed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  raw_event jsonb,
  created_at timestamptz not null default now()
);

create unique index uq_onchain_transactions_hash_log
on onchain_transactions (chain_id, tx_hash_normalized, coalesce(log_index, -1));

create table payments (
  id uuid primary key default gen_random_uuid(),
  payment_ref text not null unique,
  merchant_id uuid not null references merchants(id) on delete cascade,
  checkout_session_id uuid not null unique references checkout_sessions(id) on delete cascade,
  payment_intent_id uuid not null references payment_intents(id) on delete cascade,
  onchain_transaction_id uuid references onchain_transactions(id),
  sender_wallet_id uuid references wallet_addresses(id),
  sender_address text not null,
  recipient_address text not null,
  token_id uuid not null references tokens(id),
  amount_token numeric(20,8) not null check (amount_token > 0),
  amount_usd numeric(20,2) not null check (amount_usd > 0),
  status payment_status_enum not null default 'pending',
  confirmations integer not null default 0 check (confirmations >= 0),
  confirmed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table payment_intents
  add constraint payment_intents_detected_tx_fk
  foreign key (detected_tx_id) references onchain_transactions(id);

alter table payment_intents
  add constraint payment_intents_confirmed_payment_fk
  foreign key (confirmed_payment_id) references payments(id);

create table payment_match_failures (
  id uuid primary key default gen_random_uuid(),
  checkout_session_id uuid references checkout_sessions(id) on delete cascade,
  payment_intent_id uuid references payment_intents(id) on delete cascade,
  onchain_transaction_id uuid references onchain_transactions(id),
  failure_type payment_failure_type_enum not null,
  expected_amount_token numeric(20,8),
  observed_amount_token numeric(20,8),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  checkout_session_id uuid references checkout_sessions(id) on delete cascade,
  payment_id uuid references payments(id) on delete cascade,
  event_type webhook_event_type_enum not null,
  payload jsonb not null,
  payload_sha256 text not null,
  delivery_status webhook_delivery_status_enum not null default 'pending',
  emitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table webhook_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  webhook_event_id uuid not null references webhook_events(id) on delete cascade,
  webhook_endpoint_id uuid not null references webhook_endpoints(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  request_headers jsonb,
  request_body jsonb,
  response_status_code integer,
  response_body_excerpt text,
  outcome webhook_attempt_outcome_enum not null,
  next_retry_at timestamptz,
  duration_ms integer,
  created_at timestamptz not null default now(),
  unique (webhook_event_id, attempt_number)
);

create table merchant_reviews (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  review_type merchant_review_type_enum not null,
  status merchant_review_status_enum not null default 'open',
  opened_by_user_id uuid references user_profiles(id),
  assigned_to_user_id uuid references user_profiles(id),
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  user_id uuid references user_profiles(id) on delete cascade,
  type notification_type_enum not null,
  title text not null,
  body text not null,
  resource_type resource_type_enum,
  resource_id uuid,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id bigserial primary key,
  merchant_id uuid references merchants(id) on delete cascade,
  actor_user_id uuid references user_profiles(id),
  actor_type actor_type_enum not null,
  api_key_id uuid references api_keys(id),
  action audit_action_enum not null,
  resource_type resource_type_enum not null,
  resource_id uuid,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table event_logs (
  id bigserial primary key,
  merchant_id uuid references merchants(id) on delete cascade,
  user_id uuid references user_profiles(id),
  checkout_session_id uuid references checkout_sessions(id) on delete cascade,
  event_name text not null,
  event_properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table error_logs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade,
  checkout_session_id uuid references checkout_sessions(id) on delete cascade,
  payment_id uuid references payments(id) on delete cascade,
  webhook_event_id uuid references webhook_events(id) on delete cascade,
  source error_source_enum not null,
  severity error_severity_enum not null,
  error_code text not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table api_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  api_key_id uuid references api_keys(id),
  idempotency_key text not null,
  request_method text not null,
  request_path text not null,
  request_hash text not null,
  response_status_code integer,
  response_body jsonb,
  checkout_session_id uuid references checkout_sessions(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (merchant_id, request_method, request_path, idempotency_key)
);

create table api_rate_limit_counters (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  api_key_id uuid references api_keys(id),
  scope rate_limit_scope_enum not null,
  window_starts_at timestamptz not null,
  window_ends_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  limit_count integer not null check (limit_count >= 0),
  created_at timestamptz not null default now()
);

create index idx_user_profiles_email on user_profiles(email);
create index idx_merchants_public_slug on merchants(public_slug);
create index idx_merchants_status on merchants(status);
create index idx_merchants_verification_status on merchants(verification_status);
create index idx_merchant_members_user_id on merchant_members(user_id);
create index idx_merchant_members_merchant_role on merchant_members(merchant_id, role);
create index idx_merchant_onboarding_status on merchant_onboarding(onboarding_status);
create index idx_customers_merchant_id on customers(merchant_id);
create index idx_customers_email on customers(email);
create index idx_wallet_addresses_merchant_primary on wallet_addresses(merchant_id, is_primary);
create index idx_wallet_addresses_address_normalized on wallet_addresses(address_normalized);
create index idx_wallet_addresses_customer_id on wallet_addresses(customer_id);
create index idx_wallet_change_requests_merchant_id on wallet_change_requests(merchant_id);
create index idx_checkout_sessions_merchant_created_at on checkout_sessions(merchant_id, created_at desc);
create index idx_checkout_sessions_merchant_status on checkout_sessions(merchant_id, status);
create index idx_checkout_sessions_public_token on checkout_sessions(public_token);
create index idx_checkout_sessions_order_reference on checkout_sessions(order_reference);
create index idx_checkout_sessions_expires_at on checkout_sessions(expires_at) where status in ('pending', 'detected');
create index idx_checkout_status_history_checkout_created_at on checkout_status_history(checkout_session_id, created_at desc);
create index idx_payment_intents_match_status on payment_intents(match_status);
create index idx_payment_intents_expires_at on payment_intents(expires_at);
create index idx_payment_intents_merchant_id on payment_intents(merchant_id);
create index idx_onchain_transactions_tx_hash_normalized on onchain_transactions(tx_hash_normalized);
create index idx_onchain_transactions_to_address_normalized on onchain_transactions(to_address_normalized, observed_at desc);
create index idx_onchain_transactions_from_address_normalized on onchain_transactions(from_address_normalized);
create index idx_payments_merchant_created_at on payments(merchant_id, created_at desc);
create index idx_payments_merchant_status on payments(merchant_id, status, confirmed_at desc);
create index idx_payments_sender_address on payments(sender_address);
create index idx_payments_recipient_address on payments(recipient_address);
create index idx_payments_confirmed_at on payments(confirmed_at desc);
create index idx_payment_match_failures_checkout_session_id on payment_match_failures(checkout_session_id);
create index idx_payment_match_failures_failure_type on payment_match_failures(failure_type);
create index idx_api_keys_merchant_environment on api_keys(merchant_id, environment);
create index idx_api_keys_status on api_keys(status);
create index idx_webhook_endpoints_merchant_environment on webhook_endpoints(merchant_id, environment);
create index idx_webhook_events_merchant_emitted_at on webhook_events(merchant_id, emitted_at desc);
create index idx_webhook_events_delivery_status on webhook_events(delivery_status);
create index idx_webhook_delivery_attempts_event_attempt on webhook_delivery_attempts(webhook_event_id, attempt_number);
create index idx_webhook_delivery_attempts_next_retry_at on webhook_delivery_attempts(next_retry_at);
create index idx_webhook_delivery_attempts_response_status_code on webhook_delivery_attempts(response_status_code);
create index idx_merchant_reviews_merchant_status on merchant_reviews(merchant_id, status);
create index idx_notifications_user_unread on notifications(user_id, is_read, created_at desc);
create index idx_notifications_merchant_created_at on notifications(merchant_id, created_at desc);
create index idx_audit_logs_merchant_created_at on audit_logs(merchant_id, created_at desc);
create index idx_audit_logs_resource on audit_logs(resource_type, resource_id);
create index idx_event_logs_merchant_occurred_at on event_logs(merchant_id, occurred_at desc);
create index idx_event_logs_event_name_occurred_at on event_logs(event_name, occurred_at desc);
create index idx_error_logs_source_created_at on error_logs(source, created_at desc);
create index idx_error_logs_merchant_created_at on error_logs(merchant_id, created_at desc);
create index idx_error_logs_error_code on error_logs(error_code, created_at desc);
create index idx_api_idempotency_keys_expires_at on api_idempotency_keys(expires_at);
create index idx_api_rate_limit_counters_scope_window on api_rate_limit_counters(scope, window_starts_at, window_ends_at);
create index idx_api_rate_limit_counters_api_key_id on api_rate_limit_counters(api_key_id);

create trigger trg_user_profiles_updated_at
before update on user_profiles
for each row execute function set_updated_at();

create trigger trg_merchants_updated_at
before update on merchants
for each row execute function set_updated_at();

create trigger trg_merchant_members_updated_at
before update on merchant_members
for each row execute function set_updated_at();

create trigger trg_merchant_onboarding_updated_at
before update on merchant_onboarding
for each row execute function set_updated_at();

create trigger trg_customers_updated_at
before update on customers
for each row execute function set_updated_at();

create trigger trg_webhook_endpoints_updated_at
before update on webhook_endpoints
for each row execute function set_updated_at();

create trigger trg_integration_installations_updated_at
before update on integration_installations
for each row execute function set_updated_at();

create trigger trg_checkout_sessions_updated_at
before update on checkout_sessions
for each row execute function set_updated_at();

create trigger trg_payment_intents_updated_at
before update on payment_intents
for each row execute function set_updated_at();

create trigger trg_payments_updated_at
before update on payments
for each row execute function set_updated_at();

```

### Recommended seeded MVP rows

- `blockchains`: one `base` row
- `tokens`: one `USDC` row on Base

### Final implementation guidance

- Build dashboard metrics from base tables first; add materialized summary tables only when query volume proves necessary.
- Keep public checkout and receipt access behind backend/RPC boundaries rather than exposing raw tables to anonymous clients.
- Standardize one public checkout ID format before implementing API handlers.
- Store secrets hashed only; reveal once at creation.
- Use webhook idempotency and audit logs from day one.
