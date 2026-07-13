/**
 * Shared dashboard data contracts for the authenticated merchant application
 * and the public checkout/receipt surfaces.
 */

export type DashboardStatus = "paid" | "pending" | "failed" | "expired";

export type MerchantRole =
  | "owner"
  | "admin"
  | "developer"
  | "finance"
  | "support"
  | "member"
  | "viewer";

export interface MerchantShellData {
  merchantId: string;
  role: MerchantRole;
  publicSlug: string;
  storeName: string;
  supportEmail: string | null;
  description: string | null;
  status: string;
  verificationStatus: string;
  unreadNotifications: number;
  logoUrl: string | null;
  userAvatarColor: string | null;
  userFullName: string | null;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface DashboardMetric {
  label: string;
  value: string;
  sub: string;
  tone: "default" | "warning";
}

export interface RecentPaymentItem {
  paymentId: string;
  paymentRef: string;
  createdAt: string;
  amountLabel: string;
  status: DashboardStatus;
  senderAddress: string;
  txHash: string | null;
  checkoutRef: string;
}

export interface DashboardPageData {
  merchant: MerchantShellData;
  metrics: DashboardMetric[];
  notifications: NotificationItem[];
  recentPayments: RecentPaymentItem[];
}

export interface FirstLoginChecklistItem {
  key: "wallet" | "checkout" | "webhook";
  title: string;
  description: string;
  done: boolean;
  href: string;
  actionLabel: string;
}

export interface FirstLoginPageData {
  merchant: MerchantShellData;
  metrics: DashboardMetric[];
  checklist: FirstLoginChecklistItem[];
}

export interface CheckoutListItem {
  checkoutId: string;
  checkoutRef: string;
  publicToken: string;
  label: string;
  orderReference: string | null;
  amountLabel: string;
  status: string;
  createdAt: string;
  redirectUrl: string | null;
  paidAt: string | null;
  canDeactivate: boolean;
}

export interface CheckoutListPageData {
  merchant: MerchantShellData;
  checkouts: CheckoutListItem[];
}

export interface CreateCheckoutFormData {
  label: string;
  amountUsd: string;
  idempotencyKey?: string | null;
  orderReference: string;
  redirectUrl: string;
}

export interface CreateCheckoutPageData {
  merchant: MerchantShellData;
  payoutWallet: string;
  tokenSymbol: string;
  chainName: string;
}

export interface CreateCheckoutResult {
  checkoutRef: string;
  publicToken: string;
  checkoutUrl: string;
  receiptUrl: string;
  amountLabel: string;
}

export interface PaymentsQuery {
  dateRange: "7d" | "30d" | "90d" | "all";
  page: number;
  search: string;
  status: "all" | DashboardStatus;
}

export interface PaymentListItem {
  paymentId: string;
  paymentRef: string;
  datetime: string;
  orderReference: string;
  amountLabel: string;
  status: DashboardStatus;
  senderAddress: string;
  recipientAddress: string;
  txHash: string | null;
  confirmations: number;
  checkoutRef: string;
  explorerUrl: string | null;
}

export interface PaymentsPageData {
  merchant: MerchantShellData;
  payments: PaymentListItem[];
  query: PaymentsQuery;
  totalCount: number;
  totalPages: number;
}

export interface StoreSettingsData {
  directorySummary: string | null;
  isDirectoryListed: boolean;
  merchant: MerchantShellData;
  websiteUrl: string | null;
  payoutWallet: string | null;
  tokenSymbol: string;
  chainName: string;
  webhookUrl: string | null;
  webhookStatus: string | null;
  webhookSecretPrefix: string | null;
  lastWebhookTestAt: string | null;
}

export interface PublicStore {
  directorySummary: string | null;
  displayName: string;
  isVerified: boolean;
  logoUrl: string | null;
  publicSlug: string;
  websiteUrl: string | null;
}

export interface PublicStoreDirectoryData {
  stores: PublicStore[];
}

export interface AccountSettingsData {
  merchant: MerchantShellData;
  email: string;
  fullName: string | null;
  passwordChangedAt: string | null;
  twoFactorStatus: string;
}

export interface ApiKeyListItem {
  id: string;
  environment: "test" | "live";
  name: string;
  keyPrefix: string;
  lastFour: string;
  scopes: string[];
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface WebhookDeliveryItem {
  id: string;
  eventType: string;
  deliveryStatus: string;
  outcome: string;
  responseStatusCode: number | null;
  createdAt: string;
  attemptNumber: number;
  canRetry: boolean;
}

export interface DevelopersPageData {
  merchant: MerchantShellData;
  apiKeys: ApiKeyListItem[];
  webhookUrl: string | null;
  webhookSecretPrefix: string | null;
  webhookStatus: string | null;
  webhookDeliveries: WebhookDeliveryItem[];
  lastWebhookPayload: string;
}

export interface PublicCheckoutData {
  checkoutRef: string;
  publicToken: string;
  merchantName: string;
  orderDescription: string;
  amountLabel: string;
  expiresAt: string;
  status: "waiting" | "detected" | "paid" | "expired";
  walletAddress: string;
  chainName: string;
  tokenSymbol: string;
  paymentUri: string;
  redirectUrl: string | null;
}

export interface PublicReceiptData {
  amountLabel: string;
  merchantName: string;
  orderDescription: string;
  paidAt: string | null;
  txHash: string | null;
  explorerUrl: string | null;
  redirectUrl: string | null;
}
