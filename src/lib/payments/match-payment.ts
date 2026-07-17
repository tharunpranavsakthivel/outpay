/**
 * Core payment-matching logic for T-6.
 *
 * This module evaluates normalized chain events against pending
 * `payment_intents`, persists the outcome transactionally, and returns the
 * follow-up queue actions the worker must perform after the database commit.
 */

import { createHash } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";
import { getCheckoutExpiryPolicy } from "@/lib/dashboard/checkout-expiry";
import { connectToDatabase } from "@/lib/database/client";
import { callRpc } from "@/lib/providers/provider-router";
import type { NormalizedChainEvent } from "./normalize-event";
import {
  buildDetectedTransition,
  buildLateTransition,
  buildMismatchTransition,
  buildPaidTransition,
  type PaymentStatus,
} from "./status-machine";
import {
  compareUsdcAmounts,
  formatUsdcUnitsAsUsd,
  formatUsdcUnitsForDatabase,
  getUsdcAmountPolicy,
  parseUsdcDecimalToUnits,
} from "./usdc";

type DatabaseSql = Sql<Record<string, unknown>>;
type QuerySql =
  | Sql<Record<string, unknown>>
  | TransactionSql<Record<string, unknown>>;

type MatchableChainEvent = Omit<NormalizedChainEvent, "chain"> & {
  chain: string;
};

interface PendingIntentRow {
  blockchain_confirmations_required: number;
  blockchain_id: string;
  blockchain_slug: string;
  checkout_ref: string;
  checkout_session_id: string;
  checkout_status: string;
  current_confirmations: number;
  detected_tx_id: string | null;
  expected_amount_token: string;
  expires_at: string | null;
  merchant_id: string;
  payment_intent_id: string;
  payment_ref: string;
  recipient_address: string;
  recipient_address_normalized: string;
  required_confirmations: number;
  token_contract_address: string;
  token_contract_address_normalized: string;
  token_id: string;
}

interface OnchainTransactionRow {
  amount_token: string;
  block_hash: string | null;
  block_number: string | null;
  confirmations: number;
  from_address: string;
  id: string;
  log_index: number | null;
  raw_event: unknown;
  to_address: string;
  tx_hash: string;
}

interface BlockchainRow {
  confirmations_required: number;
  id: string;
  slug: string;
}

interface TokenRow {
  id: string;
}

export interface PaymentMatchEvaluationInput {
  candidate: {
    checkoutStatus: string;
    confirmationsRequired: number;
    currentConfirmations: number;
    expectedAmountUnits: bigint;
    expectedTokenContractNormalized: string;
    expiresAt: Date | null;
    recipientAddressNormalized: string;
  };
  chainEvent: {
    amountUnits: bigint;
    blockTimestamp: Date;
    chain: string;
    toAddress: string;
    tokenContract: string;
  };
  chainSlug: string;
  graceWindowSeconds: number;
  slightOverpayToleranceUnits: bigint;
  transactionAlreadyConsumed: boolean;
}

export interface PaymentMatchEvaluationResult {
  amountPolicy?: "exact" | "large_overpay" | "slight_overpay" | "underpaid";
  confirmations: number;
  differenceUnits?: bigint;
  outcome:
    | "accepted_paid"
    | "accepted_pending"
    | "duplicate_payment"
    | "late"
    | "large_overpay"
    | "recipient_mismatch"
    | "status_ineligible"
    | "underpaid"
    | "wrong_chain"
    | "wrong_token";
}

export interface MatchChainEventResult {
  evaluation: PaymentMatchEvaluationResult | null;
  followUpConfirmation?: {
    checkoutSessionId: string;
    delayMs: number;
  };
  followUpWebhook?: {
    attemptNumber: number;
    webhookEventId: string;
  };
  matchedCheckoutSessionId?: string;
  matchedMerchantId?: string;
  matchedPaymentId?: string | null;
  previousCheckoutStatus?: string;
  previousMatchStatus?: string;
}

const CONFIRMATION_RECHECK_DELAY_MS = 30_000;

/**
 * Pure rule evaluation for the required checks table in `ARCHITECTURE.md`.
 *
 * Parameters:
 * - input: Candidate intent, normalized event, and runtime policy values.
 *
 * Returns:
 * - Deterministic match outcome used by the transactional persistence layer.
 */
export function evaluatePaymentMatch(
  input: PaymentMatchEvaluationInput,
): PaymentMatchEvaluationResult {
  const confirmations = input.candidate.currentConfirmations;

  if (!["pending", "detected"].includes(input.candidate.checkoutStatus)) {
    return { confirmations, outcome: "status_ineligible" };
  }

  if (input.transactionAlreadyConsumed) {
    return { confirmations, outcome: "duplicate_payment" };
  }

  if (normalizeValue(input.chainEvent.chain) !== input.chainSlug) {
    return { confirmations, outcome: "wrong_chain" };
  }

  if (
    normalizeValue(input.chainEvent.tokenContract) !==
    input.candidate.expectedTokenContractNormalized
  ) {
    return { confirmations, outcome: "wrong_token" };
  }

  if (
    normalizeValue(input.chainEvent.toAddress) !==
    input.candidate.recipientAddressNormalized
  ) {
    return { confirmations, outcome: "recipient_mismatch" };
  }

  if (input.candidate.expiresAt) {
    const hardExpiryTime =
      input.candidate.expiresAt.getTime() + input.graceWindowSeconds * 1000;

    if (input.chainEvent.blockTimestamp.getTime() > hardExpiryTime) {
      return { confirmations, outcome: "late" };
    }
  }

  const amountComparison = compareUsdcAmounts(
    input.candidate.expectedAmountUnits,
    input.chainEvent.amountUnits,
    {
      slightOverpayToleranceUnits: input.slightOverpayToleranceUnits,
    },
  );

  if (amountComparison.amountPolicy === "underpaid") {
    return {
      amountPolicy: "underpaid",
      confirmations,
      differenceUnits: amountComparison.differenceUnits,
      outcome: "underpaid",
    };
  }

  if (amountComparison.amountPolicy === "large_overpay") {
    return {
      amountPolicy: "large_overpay",
      confirmations,
      differenceUnits: amountComparison.differenceUnits,
      outcome: "large_overpay",
    };
  }

  if (confirmations < input.candidate.confirmationsRequired) {
    return {
      amountPolicy: amountComparison.amountPolicy,
      confirmations,
      differenceUnits: amountComparison.differenceUnits,
      outcome: "accepted_pending",
    };
  }

  return {
    amountPolicy: amountComparison.amountPolicy,
    confirmations,
    differenceUnits: amountComparison.differenceUnits,
    outcome: "accepted_paid",
  };
}

/**
 * Matches one normalized chain event against the active checkout set.
 *
 * Parameters:
 * - input: Queue payload and source linkage for the event.
 *
 * Returns:
 * - Persisted evaluation outcome plus any required follow-up jobs.
 */
export async function matchNormalizedChainEvent(input: {
  chainEvent: MatchableChainEvent;
  rawEventId: string;
}): Promise<MatchChainEventResult> {
  const database = await connectToDatabase();

  try {
    const sql = database.sql;
    const latestBlockNumber = await fetchLatestBlockNumber();
    const blockTimestamp = await fetchBlockTimestamp(
      input.chainEvent.blockNumber,
    );
    const blockchain = await resolveBlockchain(sql, input.chainEvent.chain);
    const token =
      blockchain &&
      (await resolveToken(sql, blockchain.id, input.chainEvent.tokenContract));
    const confirmations = computeConfirmations(
      latestBlockNumber,
      input.chainEvent.blockNumber,
    );
    const candidate = selectBestIntentCandidate(
      await loadActiveIntentsByRecipient(
        sql,
        normalizeValue(input.chainEvent.toAddress),
      ),
      {
        amountUnits: input.chainEvent.amountUnits,
        chain: input.chainEvent.chain,
        tokenContract: input.chainEvent.tokenContract,
      },
    );
    const onchainTransaction =
      blockchain && token
        ? await upsertOnchainTransaction(sql, {
            blockTimestamp,
            blockchainId: blockchain.id,
            chainEvent: input.chainEvent,
            confirmations,
            rawEventId: input.rawEventId,
            tokenId: token.id,
          })
        : null;

    if (!candidate) {
      if (onchainTransaction) {
        await markRawEventProcessed(sql, input.rawEventId);
      }

      return { evaluation: null };
    }

    const evaluation = evaluatePaymentMatch(
      buildEvaluationInput({
        blockTimestamp,
        candidate,
        confirmations,
        expectedAmountUnits: parseUsdcDecimalToUnits(
          candidate.expected_amount_token,
        ),
        chainEvent: input.chainEvent,
        transactionAlreadyConsumed:
          onchainTransaction === null
            ? false
            : await isTransactionConsumedByDifferentCheckout(
                sql,
                onchainTransaction.id,
                candidate.checkout_session_id,
              ),
      }),
    );

    return persistEvaluation(sql, {
      candidate,
      evaluation,
      observedAmountUnits: input.chainEvent.amountUnits,
      onchainTransaction,
      rawEventId: input.rawEventId,
    });
  } finally {
    await database.release();
  }
}

/**
 * Rechecks a previously detected payment against the latest block height.
 *
 * Parameters:
 * - checkoutSessionId: Checkout whose detected transaction should be re-read.
 *
 * Returns:
 * - Persisted evaluation outcome plus any required follow-up jobs.
 */
export async function recheckDetectedPayment(input: {
  checkoutSessionId: string;
}): Promise<MatchChainEventResult> {
  const database = await connectToDatabase();

  try {
    const sql = database.sql;
    const candidate = await loadIntentByCheckoutSessionId(
      sql,
      input.checkoutSessionId,
    );

    if (!candidate?.detected_tx_id) {
      return { evaluation: null };
    }

    const onchainTransaction = await loadOnchainTransaction(
      sql,
      candidate.detected_tx_id,
    );

    if (!onchainTransaction) {
      return { evaluation: null };
    }

    const latestBlockNumber = await fetchLatestBlockNumber();
    const confirmations = computeConfirmations(
      latestBlockNumber,
      BigInt(onchainTransaction.block_number || "0"),
    );
    const blockTimestamp = await resolveStoredBlockTimestamp(
      onchainTransaction,
      BigInt(onchainTransaction.block_number || "0"),
    );
    const evaluation = evaluatePaymentMatch(
      buildEvaluationInput({
        blockTimestamp,
        candidate,
        confirmations,
        expectedAmountUnits: parseUsdcDecimalToUnits(
          candidate.expected_amount_token,
        ),
        chainEvent: {
          amountUnits: parseUsdcDecimalToUnits(onchainTransaction.amount_token),
          blockHash: onchainTransaction.block_hash ?? undefined,
          blockNumber: BigInt(onchainTransaction.block_number || "0"),
          chain: candidate.blockchain_slug,
          eventName: "Transfer",
          fromAddress: onchainTransaction.from_address,
          logIndex: onchainTransaction.log_index ?? 0,
          provider: "alchemy",
          toAddress: onchainTransaction.to_address,
          tokenContract: candidate.token_contract_address,
          txHash: onchainTransaction.tx_hash,
        },
        transactionAlreadyConsumed: false,
      }),
    );

    return persistEvaluation(sql, {
      candidate,
      evaluation,
      observedAmountUnits: parseUsdcDecimalToUnits(
        onchainTransaction.amount_token,
      ),
      onchainTransaction,
      rawEventId: extractRawEventId(onchainTransaction.raw_event),
    });
  } finally {
    await database.release();
  }
}

function buildEvaluationInput(input: {
  blockTimestamp: Date;
  candidate: PendingIntentRow;
  confirmations: number;
  expectedAmountUnits: bigint;
  chainEvent: MatchableChainEvent;
  transactionAlreadyConsumed: boolean;
}): PaymentMatchEvaluationInput {
  return {
    candidate: {
      checkoutStatus: input.candidate.checkout_status,
      confirmationsRequired: Math.max(
        input.candidate.required_confirmations,
        input.candidate.blockchain_confirmations_required,
      ),
      currentConfirmations: input.confirmations,
      expectedAmountUnits: input.expectedAmountUnits,
      expectedTokenContractNormalized:
        input.candidate.token_contract_address_normalized,
      expiresAt: input.candidate.expires_at
        ? new Date(input.candidate.expires_at)
        : null,
      recipientAddressNormalized: input.candidate.recipient_address_normalized,
    },
    chainEvent: {
      amountUnits: input.chainEvent.amountUnits,
      blockTimestamp: input.blockTimestamp,
      chain: input.chainEvent.chain,
      toAddress: input.chainEvent.toAddress,
      tokenContract: input.chainEvent.tokenContract,
    },
    chainSlug: input.candidate.blockchain_slug,
    graceWindowSeconds: getCheckoutExpiryPolicy().detectedGraceSeconds,
    slightOverpayToleranceUnits:
      getUsdcAmountPolicy().slightOverpayToleranceUnits,
    transactionAlreadyConsumed: input.transactionAlreadyConsumed,
  };
}

async function persistEvaluation(
  sql: DatabaseSql,
  input: {
    candidate: PendingIntentRow;
    evaluation: PaymentMatchEvaluationResult;
    observedAmountUnits: bigint;
    onchainTransaction: OnchainTransactionRow | null;
    rawEventId: string | null;
  },
): Promise<MatchChainEventResult> {
  return sql.begin(async (transaction) => {
    const baseProperties = {
      amount_policy: input.evaluation.amountPolicy ?? null,
      confirmations: input.evaluation.confirmations,
      difference_units: input.evaluation.differenceUnits?.toString() ?? null,
      tx_hash: input.onchainTransaction?.tx_hash ?? null,
    };

    if (input.evaluation.outcome === "wrong_chain") {
      await insertFailure(transaction, {
        candidate: input.candidate,
        details: baseProperties,
        failureType: "wrong_network",
        onchainTransactionId: null,
        observedAmountUnits: input.observedAmountUnits,
      });
      await insertEventLog(transaction, {
        checkoutSessionId: input.candidate.checkout_session_id,
        eventName: "payment.ignored_wrong_chain",
        eventProperties: baseProperties,
        merchantId: input.candidate.merchant_id,
      });
      await markRawEventProcessed(transaction, input.rawEventId);
      return { evaluation: input.evaluation };
    }

    if (input.evaluation.outcome === "wrong_token") {
      await insertFailure(transaction, {
        candidate: input.candidate,
        details: baseProperties,
        failureType: "wrong_token",
        onchainTransactionId: input.onchainTransaction?.id ?? null,
        observedAmountUnits: input.observedAmountUnits,
      });
      await insertEventLog(transaction, {
        checkoutSessionId: input.candidate.checkout_session_id,
        eventName: "payment.ignored_wrong_token",
        eventProperties: baseProperties,
        merchantId: input.candidate.merchant_id,
      });
      await markRawEventProcessed(transaction, input.rawEventId);
      return { evaluation: input.evaluation };
    }

    if (input.evaluation.outcome === "duplicate_payment") {
      await insertFailure(transaction, {
        candidate: input.candidate,
        details: baseProperties,
        failureType: "duplicate_payment",
        onchainTransactionId: input.onchainTransaction?.id ?? null,
        observedAmountUnits: input.observedAmountUnits,
      });
      await insertEventLog(transaction, {
        checkoutSessionId: input.candidate.checkout_session_id,
        eventName: "payment.duplicate_detected",
        eventProperties: baseProperties,
        merchantId: input.candidate.merchant_id,
      });
      await markRawEventProcessed(transaction, input.rawEventId);
      return { evaluation: input.evaluation };
    }

    if (input.evaluation.outcome === "late") {
      await upsertPayment(transaction, {
        amountUnits: input.observedAmountUnits,
        candidate: input.candidate,
        confirmations: input.evaluation.confirmations,
        failureReason: "late_payment",
        onchainTransactionId: input.onchainTransaction?.id ?? null,
        senderAddress: input.onchainTransaction?.from_address ?? null,
        paymentStatus: "expired",
      });
      await updatePaymentIntent(transaction, {
        candidate: input.candidate,
        confirmedPaymentId: null,
        confirmations: input.evaluation.confirmations,
        detectedTxId: input.onchainTransaction?.id ?? null,
        matchStatus: "expired",
      });
      await updateCheckoutStatus(transaction, {
        candidate: input.candidate,
        transition: buildLateTransition(input.candidate.checkout_ref),
      });
      await insertFailure(transaction, {
        candidate: input.candidate,
        details: baseProperties,
        failureType: "late_payment",
        onchainTransactionId: input.onchainTransaction?.id ?? null,
        observedAmountUnits: input.observedAmountUnits,
      });
      await insertEventLog(transaction, {
        checkoutSessionId: input.candidate.checkout_session_id,
        eventName: "payment.late_detected",
        eventProperties: baseProperties,
        merchantId: input.candidate.merchant_id,
      });
      await markRawEventProcessed(transaction, input.rawEventId);
      return {
        evaluation: input.evaluation,
        matchedCheckoutSessionId: input.candidate.checkout_session_id,
        matchedMerchantId: input.candidate.merchant_id,
        matchedPaymentId: null,
        previousCheckoutStatus: input.candidate.checkout_status,
        previousMatchStatus: "awaiting_payment",
      };
    }

    if (
      input.evaluation.outcome === "underpaid" ||
      input.evaluation.outcome === "large_overpay" ||
      input.evaluation.outcome === "recipient_mismatch"
    ) {
      const failureType =
        input.evaluation.outcome === "recipient_mismatch"
          ? "recipient_mismatch"
          : "amount_mismatch";
      const description =
        input.evaluation.outcome === "underpaid"
          ? "underpaid transfer"
          : input.evaluation.outcome === "large_overpay"
            ? "overpayment outside the configured tolerance"
            : "recipient address mismatch";

      await upsertPayment(transaction, {
        amountUnits: input.observedAmountUnits,
        candidate: input.candidate,
        confirmations: input.evaluation.confirmations,
        failureReason: failureType,
        onchainTransactionId: input.onchainTransaction?.id ?? null,
        senderAddress: input.onchainTransaction?.from_address ?? null,
        paymentStatus: "failed",
      });
      await updatePaymentIntent(transaction, {
        candidate: input.candidate,
        confirmedPaymentId: null,
        confirmations: input.evaluation.confirmations,
        detectedTxId: input.onchainTransaction?.id ?? null,
        matchStatus: "mismatched",
      });
      await updateCheckoutStatus(transaction, {
        candidate: input.candidate,
        transition: buildMismatchTransition(
          input.candidate.checkout_ref,
          description,
        ),
      });
      await insertFailure(transaction, {
        candidate: input.candidate,
        details: { ...baseProperties, failure_type: failureType },
        failureType,
        onchainTransactionId: input.onchainTransaction?.id ?? null,
        observedAmountUnits: input.observedAmountUnits,
      });
      await insertEventLog(transaction, {
        checkoutSessionId: input.candidate.checkout_session_id,
        eventName: "payment.match_failed",
        eventProperties: { ...baseProperties, failure_type: failureType },
        merchantId: input.candidate.merchant_id,
      });
      await markRawEventProcessed(transaction, input.rawEventId);
      return {
        evaluation: input.evaluation,
        matchedCheckoutSessionId: input.candidate.checkout_session_id,
        matchedMerchantId: input.candidate.merchant_id,
        matchedPaymentId: null,
        previousCheckoutStatus: input.candidate.checkout_status,
        previousMatchStatus: "awaiting_payment",
      };
    }

    if (input.evaluation.outcome === "accepted_pending") {
      const payment = await upsertPayment(transaction, {
        amountUnits: input.observedAmountUnits,
        candidate: input.candidate,
        confirmations: input.evaluation.confirmations,
        failureReason: null,
        onchainTransactionId: input.onchainTransaction?.id ?? null,
        senderAddress: input.onchainTransaction?.from_address ?? null,
        paymentStatus: "pending",
      });
      await updatePaymentIntent(transaction, {
        candidate: input.candidate,
        confirmedPaymentId: null,
        confirmations: input.evaluation.confirmations,
        detectedTxId: input.onchainTransaction?.id ?? null,
        matchStatus: "detected",
      });
      await updateCheckoutStatus(transaction, {
        candidate: input.candidate,
        transition: buildDetectedTransition({
          checkoutRef: input.candidate.checkout_ref,
          confirmations: input.evaluation.confirmations,
          requiredConfirmations: Math.max(
            input.candidate.required_confirmations,
            input.candidate.blockchain_confirmations_required,
          ),
        }),
      });
      await insertNotification(transaction, {
        body: `Payment detected for checkout ${input.candidate.checkout_ref}. Waiting for additional confirmations.`,
        merchantId: input.candidate.merchant_id,
        resourceId: payment.id,
        title: `Payment detected for ${input.candidate.checkout_ref}`,
        type: "payment_pending",
      });
      await insertEventLog(transaction, {
        checkoutSessionId: input.candidate.checkout_session_id,
        eventName: "payment.detected",
        eventProperties: baseProperties,
        merchantId: input.candidate.merchant_id,
      });
      await insertReconcilerRecoveryArtifacts(transaction, {
        candidate: input.candidate,
        checkoutSessionId: input.candidate.checkout_session_id,
        paymentId: payment.id,
        rawEventId: input.rawEventId,
        txHash: input.onchainTransaction?.tx_hash ?? null,
      });
      await markRawEventProcessed(transaction, input.rawEventId);
      return {
        evaluation: input.evaluation,
        followUpConfirmation: {
          checkoutSessionId: input.candidate.checkout_session_id,
          delayMs: CONFIRMATION_RECHECK_DELAY_MS,
        },
        matchedCheckoutSessionId: input.candidate.checkout_session_id,
        matchedMerchantId: input.candidate.merchant_id,
        matchedPaymentId: payment.id,
        previousCheckoutStatus: input.candidate.checkout_status,
        previousMatchStatus:
          input.candidate.detected_tx_id === null
            ? "awaiting_payment"
            : "detected",
      };
    }

    const payment = await upsertPayment(transaction, {
      amountUnits: input.observedAmountUnits,
      candidate: input.candidate,
      confirmations: input.evaluation.confirmations,
      failureReason: null,
      onchainTransactionId: input.onchainTransaction?.id ?? null,
      senderAddress: input.onchainTransaction?.from_address ?? null,
      paymentStatus: "paid",
    });
    await updatePaymentIntent(transaction, {
      candidate: input.candidate,
      confirmedPaymentId: payment.id,
      confirmations: input.evaluation.confirmations,
      detectedTxId: input.onchainTransaction?.id ?? null,
      matchStatus: "confirmed",
    });
    await updateCheckoutStatus(transaction, {
      candidate: input.candidate,
      transition: buildPaidTransition(input.candidate.checkout_ref),
    });
    await insertNotification(transaction, {
      body: `Payment confirmed for checkout ${input.candidate.checkout_ref}.`,
      merchantId: input.candidate.merchant_id,
      resourceId: payment.id,
      title: `Payment paid for ${input.candidate.checkout_ref}`,
      type: "payment_paid",
    });
    const webhookEventId = await upsertWebhookEvent(transaction, {
      candidate: input.candidate,
      confirmedAt: new Date().toISOString(),
      paymentId: payment.id,
      txHash: input.onchainTransaction?.tx_hash ?? null,
    });
    await insertEventLog(transaction, {
      checkoutSessionId: input.candidate.checkout_session_id,
      eventName: "payment.confirmed",
      eventProperties: baseProperties,
      merchantId: input.candidate.merchant_id,
    });
    await insertReconcilerRecoveryArtifacts(transaction, {
      candidate: input.candidate,
      checkoutSessionId: input.candidate.checkout_session_id,
      paymentId: payment.id,
      rawEventId: input.rawEventId,
      txHash: input.onchainTransaction?.tx_hash ?? null,
    });
    await markRawEventProcessed(transaction, input.rawEventId);
    return {
      evaluation: input.evaluation,
      followUpWebhook: {
        attemptNumber: 1,
        webhookEventId,
      },
      matchedCheckoutSessionId: input.candidate.checkout_session_id,
      matchedMerchantId: input.candidate.merchant_id,
      matchedPaymentId: payment.id,
      previousCheckoutStatus: input.candidate.checkout_status,
      previousMatchStatus:
        input.candidate.detected_tx_id === null
          ? "awaiting_payment"
          : "detected",
    };
  });
}

async function loadActiveIntentsByRecipient(
  sql: QuerySql,
  recipientAddressNormalized: string,
): Promise<PendingIntentRow[]> {
  return sql<PendingIntentRow[]>`
    select
      pi.id::text as payment_intent_id,
      cs.id::text as checkout_session_id,
      cs.checkout_ref,
      cs.status::text as checkout_status,
      cs.merchant_id::text as merchant_id,
      cs.expires_at::text as expires_at,
      pi.expected_amount_token::text as expected_amount_token,
      wa.address as recipient_address,
      wa.address_normalized as recipient_address_normalized,
      t.id::text as token_id,
      t.contract_address as token_contract_address,
      t.contract_address_normalized as token_contract_address_normalized,
      b.id::text as blockchain_id,
      b.slug::text as blockchain_slug,
      b.confirmations_required as blockchain_confirmations_required,
      pi.required_confirmations,
      pi.current_confirmations,
      pi.detected_tx_id::text as detected_tx_id,
      coalesce(p.payment_ref, ${"pay_pending"}) as payment_ref
    from payment_intents pi
    join checkout_sessions cs
      on cs.id = pi.checkout_session_id
    join wallet_addresses wa
      on wa.id = pi.recipient_wallet_id
    join tokens t
      on t.id = pi.token_id
    join blockchains b
      on b.id = t.chain_id
    left join payments p
      on p.checkout_session_id = cs.id
    where wa.address_normalized = ${recipientAddressNormalized}
      and cs.status in ('pending', 'detected')
      and pi.match_status in ('awaiting_payment', 'detected')
    order by cs.created_at asc
  `;
}

async function loadIntentByCheckoutSessionId(
  sql: QuerySql,
  checkoutSessionId: string,
): Promise<PendingIntentRow | null> {
  const rows = await sql<PendingIntentRow[]>`
    select
      pi.id::text as payment_intent_id,
      cs.id::text as checkout_session_id,
      cs.checkout_ref,
      cs.status::text as checkout_status,
      cs.merchant_id::text as merchant_id,
      cs.expires_at::text as expires_at,
      pi.expected_amount_token::text as expected_amount_token,
      wa.address as recipient_address,
      wa.address_normalized as recipient_address_normalized,
      t.id::text as token_id,
      t.contract_address as token_contract_address,
      t.contract_address_normalized as token_contract_address_normalized,
      b.id::text as blockchain_id,
      b.slug::text as blockchain_slug,
      b.confirmations_required as blockchain_confirmations_required,
      pi.required_confirmations,
      pi.current_confirmations,
      pi.detected_tx_id::text as detected_tx_id,
      coalesce(p.payment_ref, ${`pay_${checkoutSessionId}`}) as payment_ref
    from payment_intents pi
    join checkout_sessions cs
      on cs.id = pi.checkout_session_id
    join wallet_addresses wa
      on wa.id = pi.recipient_wallet_id
    join tokens t
      on t.id = pi.token_id
    join blockchains b
      on b.id = t.chain_id
    left join payments p
      on p.checkout_session_id = cs.id
    where cs.id = ${checkoutSessionId}::uuid
    limit 1
  `;

  return rows[0] ?? null;
}

function selectBestIntentCandidate(
  candidates: PendingIntentRow[],
  input: {
    amountUnits: bigint;
    chain: string;
    tokenContract: string;
  },
): PendingIntentRow | null {
  if (candidates.length === 0) {
    return null;
  }

  const normalizedChain = normalizeValue(input.chain);
  const normalizedToken = normalizeValue(input.tokenContract);
  const exactRows = candidates.filter(
    (candidate) =>
      candidate.blockchain_slug === normalizedChain &&
      candidate.token_contract_address_normalized === normalizedToken &&
      parseUsdcDecimalToUnits(candidate.expected_amount_token) ===
        input.amountUnits,
  );

  if (exactRows.length === 1) {
    return withPaymentRef(exactRows[0]);
  }

  const sameChainAndToken = candidates.filter(
    (candidate) =>
      candidate.blockchain_slug === normalizedChain &&
      candidate.token_contract_address_normalized === normalizedToken,
  );

  if (sameChainAndToken.length === 1) {
    return withPaymentRef(sameChainAndToken[0]);
  }

  if (candidates.length === 1) {
    return withPaymentRef(candidates[0]);
  }

  return null;
}

function withPaymentRef(candidate: PendingIntentRow): PendingIntentRow {
  return {
    ...candidate,
    payment_ref:
      candidate.payment_ref === "pay_pending"
        ? `pay_${candidate.checkout_session_id}`
        : candidate.payment_ref,
  };
}

async function resolveBlockchain(
  sql: QuerySql,
  chainSlug: string,
): Promise<BlockchainRow | null> {
  const rows = await sql<BlockchainRow[]>`
    select
      id::text as id,
      slug::text as slug,
      confirmations_required
    from blockchains
    where slug = ${normalizeValue(chainSlug)}
    limit 1
  `;

  return rows[0] ?? null;
}

async function resolveToken(
  sql: QuerySql,
  blockchainId: string,
  tokenContract: string,
): Promise<TokenRow | null> {
  const rows = await sql<TokenRow[]>`
    select id::text as id
    from tokens
    where chain_id = ${blockchainId}::uuid
      and contract_address_normalized = ${normalizeValue(tokenContract)}
    limit 1
  `;

  return rows[0] ?? null;
}

async function upsertOnchainTransaction(
  sql: QuerySql,
  input: {
    blockTimestamp: Date;
    blockchainId: string;
    chainEvent: MatchableChainEvent;
    confirmations: number;
    rawEventId: string;
    tokenId: string;
  },
): Promise<OnchainTransactionRow> {
  const rows = await sql<OnchainTransactionRow[]>`
    insert into onchain_transactions (
      chain_id,
      token_id,
      tx_hash,
      tx_hash_normalized,
      block_number,
      block_hash,
      log_index,
      from_address,
      from_address_normalized,
      to_address,
      to_address_normalized,
      amount_token,
      confirmations,
      confirmed_at,
      raw_event
    ) values (
      ${input.blockchainId}::uuid,
      ${input.tokenId}::uuid,
      ${input.chainEvent.txHash},
      ${normalizeValue(input.chainEvent.txHash)},
      ${input.chainEvent.blockNumber.toString()}::bigint,
      ${input.chainEvent.blockHash ?? null},
      ${input.chainEvent.logIndex},
      ${input.chainEvent.fromAddress},
      ${normalizeValue(input.chainEvent.fromAddress)},
      ${input.chainEvent.toAddress},
      ${normalizeValue(input.chainEvent.toAddress)},
      ${formatUsdcUnitsForDatabase(input.chainEvent.amountUnits, 8)},
      ${input.confirmations},
      ${input.confirmations > 0 ? new Date().toISOString() : null},
      ${JSON.stringify({
        blockTimestamp: input.blockTimestamp.toISOString(),
        chain: input.chainEvent.chain,
        provider: input.chainEvent.provider,
        rawEventId: input.rawEventId,
      })}::jsonb
    )
    on conflict (chain_id, tx_hash_normalized, coalesce(log_index, -1))
    do update set
      confirmations = excluded.confirmations,
      confirmed_at = coalesce(excluded.confirmed_at, onchain_transactions.confirmed_at),
      raw_event = onchain_transactions.raw_event || excluded.raw_event
    returning
      id::text as id,
      amount_token::text as amount_token,
      block_hash,
      block_number::text as block_number,
      confirmations,
      from_address,
      log_index,
      raw_event,
      to_address,
      tx_hash
  `;

  return rows[0] as OnchainTransactionRow;
}

async function loadOnchainTransaction(
  sql: QuerySql,
  onchainTransactionId: string,
): Promise<OnchainTransactionRow | null> {
  const rows = await sql<OnchainTransactionRow[]>`
    select
      id::text as id,
      amount_token::text as amount_token,
      block_hash,
      block_number::text as block_number,
      confirmations,
      from_address,
      log_index,
      raw_event,
      to_address,
      tx_hash
    from onchain_transactions
    where id = ${onchainTransactionId}::uuid
    limit 1
  `;

  return rows[0] ?? null;
}

async function isTransactionConsumedByDifferentCheckout(
  sql: QuerySql,
  onchainTransactionId: string,
  checkoutSessionId: string,
): Promise<boolean> {
  const rows = await sql<{ checkout_session_id: string }[]>`
    select checkout_session_id::text as checkout_session_id
    from payments
    where onchain_transaction_id = ${onchainTransactionId}::uuid
      and checkout_session_id <> ${checkoutSessionId}::uuid
    limit 1
  `;

  return Boolean(rows[0]);
}

async function updatePaymentIntent(
  sql: QuerySql,
  input: {
    candidate: PendingIntentRow;
    confirmedPaymentId: string | null;
    confirmations: number;
    detectedTxId: string | null;
    matchStatus: "confirmed" | "detected" | "expired" | "mismatched";
  },
): Promise<void> {
  await sql`
    update payment_intents
    set
      match_status = ${input.matchStatus}::payment_match_status_enum,
      current_confirmations = ${input.confirmations},
      detected_tx_id = coalesce(${input.detectedTxId}::uuid, detected_tx_id),
      detected_at = case
        when ${input.detectedTxId}::uuid is not null then coalesce(detected_at, now())
        else detected_at
      end,
      confirmed_payment_id = coalesce(${input.confirmedPaymentId}::uuid, confirmed_payment_id),
      confirmed_at = case
        when ${input.confirmedPaymentId}::uuid is not null then coalesce(confirmed_at, now())
        else confirmed_at
      end,
      updated_at = now()
    where id = ${input.candidate.payment_intent_id}::uuid
  `;
}

async function updateCheckoutStatus(
  sql: QuerySql,
  input: {
    candidate: PendingIntentRow;
    transition: ReturnType<
      | typeof buildDetectedTransition
      | typeof buildLateTransition
      | typeof buildMismatchTransition
      | typeof buildPaidTransition
    >;
  },
): Promise<void> {
  await sql`
    update checkout_sessions
    set
      status = ${input.transition.checkoutStatus}::checkout_status_enum,
      detected_at = case
        when ${input.transition.checkoutStatus} = 'detected' then coalesce(detected_at, now())
        else detected_at
      end,
      paid_at = case
        when ${input.transition.checkoutStatus} = 'paid' then coalesce(paid_at, now())
        else paid_at
      end,
      updated_at = now()
    where id = ${input.candidate.checkout_session_id}::uuid
  `;

  await sql`
    insert into checkout_status_history (
      checkout_session_id,
      from_status,
      to_status,
      reason_code,
      actor_type,
      message
    )
    select
      ${input.candidate.checkout_session_id}::uuid,
      ${input.candidate.checkout_status}::checkout_status_enum,
      ${input.transition.checkoutStatus}::checkout_status_enum,
      ${input.transition.checkoutReasonCode}::checkout_status_reason_enum,
      'worker',
      ${input.transition.checkoutMessage}
    where not exists (
      select 1
      from checkout_status_history
      where checkout_session_id = ${input.candidate.checkout_session_id}::uuid
        and to_status = ${input.transition.checkoutStatus}::checkout_status_enum
        and reason_code = ${input.transition.checkoutReasonCode}::checkout_status_reason_enum
        and message = ${input.transition.checkoutMessage}
    )
  `;
}

async function upsertPayment(
  sql: QuerySql,
  input: {
    amountUnits: bigint;
    candidate: PendingIntentRow;
    confirmations: number;
    failureReason: string | null;
    onchainTransactionId: string | null;
    senderAddress: string | null;
    paymentStatus: PaymentStatus;
  },
): Promise<{ id: string }> {
  const rows = await sql<{ id: string }[]>`
    insert into payments (
      payment_ref,
      merchant_id,
      checkout_session_id,
      payment_intent_id,
      onchain_transaction_id,
      sender_address,
      recipient_address,
      token_id,
      amount_token,
      amount_usd,
      status,
      confirmations,
      confirmed_at,
      failure_reason
    ) values (
      ${input.candidate.payment_ref},
      ${input.candidate.merchant_id}::uuid,
      ${input.candidate.checkout_session_id}::uuid,
      ${input.candidate.payment_intent_id}::uuid,
      ${input.onchainTransactionId}::uuid,
      ${input.senderAddress ?? input.candidate.recipient_address},
      ${input.candidate.recipient_address},
      ${input.candidate.token_id}::uuid,
      ${formatUsdcUnitsForDatabase(input.amountUnits, 8)},
      ${formatUsdcUnitsAsUsd(input.amountUnits)},
      ${input.paymentStatus}::payment_status_enum,
      ${input.confirmations},
      ${input.paymentStatus === "paid" ? new Date().toISOString() : null},
      ${input.failureReason}
    )
    on conflict (checkout_session_id)
    do update set
      onchain_transaction_id = coalesce(excluded.onchain_transaction_id, payments.onchain_transaction_id),
      sender_address = excluded.sender_address,
      amount_token = excluded.amount_token,
      amount_usd = excluded.amount_usd,
      status = excluded.status,
      confirmations = excluded.confirmations,
      confirmed_at = coalesce(excluded.confirmed_at, payments.confirmed_at),
      failure_reason = excluded.failure_reason,
      updated_at = now()
    returning id::text as id
  `;

  return rows[0] as { id: string };
}

async function insertFailure(
  sql: QuerySql,
  input: {
    candidate: PendingIntentRow;
    details: Record<string, unknown>;
    failureType:
      | "amount_mismatch"
      | "duplicate_payment"
      | "late_payment"
      | "recipient_mismatch"
      | "wrong_network"
      | "wrong_token";
    onchainTransactionId: string | null;
    observedAmountUnits: bigint;
  },
): Promise<void> {
  await sql`
    insert into payment_match_failures (
      checkout_session_id,
      payment_intent_id,
      onchain_transaction_id,
      failure_type,
      expected_amount_token,
      observed_amount_token,
      details
    )
    select
      ${input.candidate.checkout_session_id}::uuid,
      ${input.candidate.payment_intent_id}::uuid,
      ${input.onchainTransactionId}::uuid,
      ${input.failureType}::payment_failure_type_enum,
      ${input.candidate.expected_amount_token},
      ${formatUsdcUnitsForDatabase(input.observedAmountUnits, 8)},
      ${JSON.stringify(input.details)}::jsonb
    where not exists (
      select 1
      from payment_match_failures
      where payment_intent_id = ${input.candidate.payment_intent_id}::uuid
        and coalesce(onchain_transaction_id, '00000000-0000-0000-0000-000000000000'::uuid) =
            coalesce(${input.onchainTransactionId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
        and failure_type = ${input.failureType}::payment_failure_type_enum
    )
  `;
}

async function insertNotification(
  sql: QuerySql,
  input: {
    body: string;
    merchantId: string;
    resourceId: string;
    title: string;
    type: "payment_paid" | "payment_pending";
  },
): Promise<void> {
  await sql`
    insert into notifications (
      merchant_id,
      type,
      title,
      body,
      resource_type,
      resource_id
    )
    select
      ${input.merchantId}::uuid,
      ${input.type}::notification_type_enum,
      ${input.title},
      ${input.body},
      'payment',
      ${input.resourceId}::uuid
    where not exists (
      select 1
      from notifications
      where merchant_id = ${input.merchantId}::uuid
        and type = ${input.type}::notification_type_enum
        and resource_id = ${input.resourceId}::uuid
        and title = ${input.title}
    )
  `;
}

async function insertEventLog(
  sql: QuerySql,
  input: {
    checkoutSessionId: string;
    eventName: string;
    eventProperties: Record<string, unknown>;
    merchantId: string;
  },
): Promise<void> {
  await sql`
    insert into event_logs (
      merchant_id,
      checkout_session_id,
      event_name,
      event_properties
    )
    select
      ${input.merchantId}::uuid,
      ${input.checkoutSessionId}::uuid,
      ${input.eventName},
      ${JSON.stringify(input.eventProperties)}::jsonb
    where not exists (
      select 1
      from event_logs
      where checkout_session_id = ${input.checkoutSessionId}::uuid
        and event_name = ${input.eventName}
        and event_properties = ${JSON.stringify(input.eventProperties)}::jsonb
    )
  `;
}

async function upsertWebhookEvent(
  sql: QuerySql,
  input: {
    candidate: PendingIntentRow;
    confirmedAt: string;
    paymentId: string;
    txHash: string | null;
  },
): Promise<string> {
  const paymentRow = (
    await sql<{ amount_token: string; symbol: string }[]>`
      select
        p.amount_token::text as amount_token,
        t.symbol::text as symbol
      from payments p
      join tokens t
        on t.id = p.token_id
      where p.id = ${input.paymentId}::uuid
      limit 1
    `
  )[0];
  const payloadJson = JSON.stringify({
    amount: paymentRow?.amount_token ?? "0.00",
    checkout_ref: input.candidate.checkout_ref,
    confirmed_at: input.confirmedAt,
    currency: paymentRow?.symbol ?? "USDC",
    event: "checkout.paid",
    tx_hash: input.txHash,
  });
  const payloadSha256 = createHash("sha256").update(payloadJson).digest("hex");
  const insertedRows = await sql<{ id: string }[]>`
    insert into webhook_events (
      merchant_id,
      checkout_session_id,
      payment_id,
      event_type,
      payload,
      payload_sha256,
      delivery_status
    )
    select
      ${input.candidate.merchant_id}::uuid,
      ${input.candidate.checkout_session_id}::uuid,
      ${input.paymentId}::uuid,
      'checkout.paid',
      ${payloadJson}::jsonb,
      ${payloadSha256},
      'pending'
    where not exists (
      select 1
      from webhook_events
      where checkout_session_id = ${input.candidate.checkout_session_id}::uuid
        and payment_id = ${input.paymentId}::uuid
        and event_type = 'checkout.paid'
    )
    returning id::text as id
  `;

  if (insertedRows[0]) {
    return insertedRows[0].id;
  }

  const existingRows = await sql<{ id: string }[]>`
    select id::text as id
    from webhook_events
    where checkout_session_id = ${input.candidate.checkout_session_id}::uuid
      and payment_id = ${input.paymentId}::uuid
      and event_type = 'checkout.paid'
    limit 1
  `;

  return existingRows[0]?.id ?? "";
}

async function markRawEventProcessed(
  sql: QuerySql,
  rawEventId: string | null,
): Promise<void> {
  if (!rawEventId) {
    return;
  }

  await sql`
    update provider_events_raw
    set processed_at = now(), error = null
    where id = ${rawEventId}::uuid
  `;
}

async function insertReconcilerRecoveryArtifacts(
  sql: QuerySql,
  input: {
    candidate: PendingIntentRow;
    checkoutSessionId: string;
    paymentId: string;
    rawEventId: string | null;
    txHash: string | null;
  },
): Promise<void> {
  if (!input.rawEventId || input.candidate.detected_tx_id !== null) {
    return;
  }

  const rawEventRows = await sql<
    { recovery_source: string | null; source_type: string | null }[]
  >`
    select
      payload->>'__outpayRecoverySource' as recovery_source,
      payload->>'__outpaySource' as source_type
    from provider_events_raw
    where id = ${input.rawEventId}::uuid
    limit 1
  `;
  const rawEvent = rawEventRows[0];

  if (
    rawEvent?.source_type !== "reconciler" ||
    rawEvent.recovery_source !== "missed_webhook"
  ) {
    return;
  }

  await sql`
    insert into notifications (
      merchant_id,
      type,
      title,
      body,
      resource_type,
      resource_id
    )
    select
      ${input.candidate.merchant_id}::uuid,
      'webhook_recovered'::notification_type_enum,
      ${`Recovered missed webhook for ${input.candidate.checkout_ref}`},
      ${`The reconciler recovered an on-chain transfer for checkout ${input.candidate.checkout_ref}${input.txHash ? ` (${input.txHash})` : ""}.`},
      'payment'::resource_type_enum,
      ${input.paymentId}::uuid
    where not exists (
      select 1
      from notifications
      where merchant_id = ${input.candidate.merchant_id}::uuid
        and type = 'webhook_recovered'::notification_type_enum
        and resource_id = ${input.paymentId}::uuid
    )
  `;

  await sql`
    insert into event_logs (
      merchant_id,
      checkout_session_id,
      event_name,
      event_properties
    )
    select
      ${input.candidate.merchant_id}::uuid,
      ${input.checkoutSessionId}::uuid,
      'reconciler.missed_webhook_recovered',
      ${JSON.stringify({
        counter_name: "missed_webhook_recovered_total",
        raw_event_id: input.rawEventId,
        tx_hash: input.txHash,
      })}::jsonb
    where not exists (
      select 1
      from event_logs
      where checkout_session_id = ${input.checkoutSessionId}::uuid
        and event_name = 'reconciler.missed_webhook_recovered'
        and event_properties->>'raw_event_id' = ${input.rawEventId}
    )
  `;
}

async function fetchLatestBlockNumber(): Promise<bigint> {
  const latestBlockHex = await callRpc<string>("eth_blockNumber", []);
  return BigInt(latestBlockHex);
}

/**
 * Block timestamps are immutable once mined, so a same-process lookup for a
 * block already seen this run is served from cache instead of re-fetching.
 * This matters most during reconciliation backlog catch-up, where many
 * transfers routinely share the same block. Bounded to avoid unbounded
 * growth in a long-lived worker process.
 */
const BLOCK_TIMESTAMP_CACHE_MAX_SIZE = 5000;
const blockTimestampCache = new Map<string, Date>();

async function fetchBlockTimestamp(blockNumber: bigint): Promise<Date> {
  const cacheKey = blockNumber.toString();
  const cached = blockTimestampCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const block = await callRpc<{ timestamp: string }>("eth_getBlockByNumber", [
    `0x${blockNumber.toString(16)}`,
    false,
  ]);
  const timestamp = new Date(Number.parseInt(block.timestamp, 16) * 1000);

  if (blockTimestampCache.size >= BLOCK_TIMESTAMP_CACHE_MAX_SIZE) {
    const oldestKey = blockTimestampCache.keys().next().value;

    if (oldestKey !== undefined) {
      blockTimestampCache.delete(oldestKey);
    }
  }

  blockTimestampCache.set(cacheKey, timestamp);

  return timestamp;
}

async function resolveStoredBlockTimestamp(
  onchainTransaction: OnchainTransactionRow,
  blockNumber: bigint,
): Promise<Date> {
  const rawEvent = asRecord(onchainTransaction.raw_event);
  const rawTimestamp = rawEvent?.blockTimestamp;

  if (typeof rawTimestamp === "string") {
    return new Date(rawTimestamp);
  }

  return fetchBlockTimestamp(blockNumber);
}

function computeConfirmations(
  latestBlockNumber: bigint,
  txBlockNumber: bigint,
): number {
  if (latestBlockNumber < txBlockNumber) {
    return 0;
  }

  return Number(latestBlockNumber - txBlockNumber + BigInt(1));
}

function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

function extractRawEventId(rawEvent: unknown): string | null {
  const record = asRecord(rawEvent);
  return typeof record?.rawEventId === "string" ? record.rawEventId : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}
