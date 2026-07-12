/**
 * Lightweight metric emission for Outpay's Railway-first observability plan.
 *
 * Metrics are emitted as structured JSON log events so Railway can collect and
 * search them immediately. The metric names mirror ARCHITECTURE.md §19.1 and
 * can later be forwarded to a dedicated metrics backend without changing call
 * sites.
 */

import { logger } from "@/lib/logging/logger";

export const METRIC_NAMES = {
  alchemyRpcLatencyMs: "alchemy_rpc_latency_ms",
  alchemyWebhookLatencyMs: "alchemy_webhook_latency_ms",
  chainstackRpcLatencyMs: "chainstack_rpc_latency_ms",
  checkoutPaymentTimeSeconds: "checkout_payment_time_seconds",
  checkoutsCreatedTotal: "checkouts_created_total",
  missedWebhookRecoveredTotal: "missed_webhook_recovered_total",
  paymentsConfirmedTotal: "payments_confirmed_total",
  paymentsDetectedTotal: "payments_detected_total",
  paymentsLateTotal: "payments_late_total",
  paymentsUnderpaidTotal: "payments_underpaid_total",
  providerFailoverCount: "provider_failover_count",
  reconciliationEventsFoundTotal: "reconciliation_events_found_total",
  webhookDeliveryFailureCount: "webhook_delivery_failure_count",
  webhookDeliverySuccessRate: "webhook_delivery_success_rate",
} as const;

export type MetricName = (typeof METRIC_NAMES)[keyof typeof METRIC_NAMES];

/**
 * Emits a counter, gauge, or observation as a structured log event.
 *
 * Parameters:
 * - name: Architecture-defined metric name.
 * - value: Numeric measurement. Counters normally use `1`.
 * - labels: Low-cardinality dimensions safe for log aggregation.
 */
export function emitMetric(
  name: MetricName,
  value: number,
  labels: Record<string, unknown> = {},
): void {
  logger.info(
    {
      metric: name,
      metric_type: name.endsWith("_total") ? "counter" : "gauge",
      metric_value: value,
      ...labels,
    },
    "Metric observed",
  );
}
