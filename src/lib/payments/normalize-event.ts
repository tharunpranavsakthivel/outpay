/**
 * Provider payload normalization helpers that map raw chain activity into the
 * internal `NormalizedChainEvent` contract defined by ARCHITECTURE.md.
 */

export type NormalizedChainEvent = {
  amountUnits: bigint;
  blockHash?: string;
  blockNumber: bigint;
  chain: "base";
  eventName: "Transfer";
  fromAddress: string;
  logIndex: number;
  provider: "alchemy" | "chainstack";
  toAddress: string;
  tokenContract: string;
  txHash: string;
};

interface RpcTransferLogShape {
  address?: unknown;
  blockHash?: unknown;
  blockNumber?: unknown;
  data?: unknown;
  logIndex?: unknown;
  removed?: unknown;
  topics?: unknown;
  transactionHash?: unknown;
}

/**
 * Converts an Alchemy Address Activity payload into normalized transfer events.
 *
 * Parameters:
 * - payload: Parsed webhook JSON body.
 *
 * Returns:
 * - Zero or more normalized transfer events suitable for downstream matching.
 */
export function normalizeAlchemyAddressActivityPayload(
  payload: unknown,
): NormalizedChainEvent[] {
  return readAlchemyActivities(payload)
    .map((activity) => normalizeActivity(activity))
    .filter((event): event is NormalizedChainEvent => event !== null);
}

/**
 * Converts raw `eth_getLogs` transfer logs into normalized chain events.
 *
 * Parameters:
 * - payload: JSON-RPC `eth_getLogs` result payload.
 * - provider: Provider name that served the scan.
 *
 * Returns:
 * - Zero or more normalized USDC transfer events suitable for downstream
 *   matching and reconciliation.
 */
export function normalizeRpcTransferLogs(
  payload: unknown,
  provider: "alchemy" | "chainstack",
): NormalizedChainEvent[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) => normalizeRpcTransferLog(item, provider))
    .filter((event): event is NormalizedChainEvent => event !== null);
}

/**
 * Normalizes a single Alchemy activity item.
 *
 * Parameters:
 * - activity: Raw activity object from the webhook payload.
 *
 * Returns:
 * - Normalized transfer event, or `null` when required fields are missing.
 */
function normalizeActivity(
  activity: Record<string, unknown>,
): NormalizedChainEvent | null {
  // Alchemy's Address Activity webhook nests the log-level fields (logIndex,
  // blockHash, blockNumber, transactionHash) under `activity.log`, not at the
  // top level of the activity entry. Top-level fields are still checked first
  // for forward/backward compatibility with other Alchemy payload shapes.
  const log = asRecord(activity.log);
  const txHash =
    readString(activity.hash) ||
    readString(activity.transactionHash) ||
    readString(log?.transactionHash);
  const tokenContract =
    readString(asRecord(activity.rawContract)?.address) ||
    readString(activity.contractAddress);
  const fromAddress =
    readString(activity.fromAddress) || readString(activity.from);
  const toAddress = readString(activity.toAddress) || readString(activity.to);
  const blockHash =
    readString(activity.blockHash) || readString(log?.blockHash) || undefined;
  const blockNumber = parseBigIntField(
    activity.blockNum ?? activity.blockNumber ?? log?.blockNumber,
  );
  const logIndex = parseIntegerField(activity.logIndex ?? log?.logIndex);
  const amountUnits = parseAmountUnits(activity);

  if (
    !txHash ||
    !tokenContract ||
    !fromAddress ||
    !toAddress ||
    blockNumber === null ||
    logIndex === null ||
    amountUnits === null ||
    // A zero-value Transfer is valid on-chain (some contracts emit it as a
    // no-op) but can never satisfy a checkout's positive expected amount,
    // and `onchain_transactions.amount_token` has a `> 0` check constraint.
    amountUnits <= BigInt(0)
  ) {
    return null;
  }

  return {
    amountUnits,
    blockHash,
    blockNumber,
    chain: "base",
    eventName: "Transfer",
    fromAddress,
    logIndex,
    provider: "alchemy",
    toAddress,
    tokenContract,
    txHash,
  };
}

/**
 * Normalizes one `eth_getLogs` transfer log.
 *
 * Parameters:
 * - payload: Raw log object returned by JSON-RPC.
 * - provider: Provider name that served the scan.
 *
 * Returns:
 * - Normalized transfer event, or `null` when required fields are absent or
 *   the log was removed during a reorg.
 */
function normalizeRpcTransferLog(
  payload: unknown,
  provider: "alchemy" | "chainstack",
): NormalizedChainEvent | null {
  const log = asRecord(payload) as RpcTransferLogShape | null;
  const topics = Array.isArray(log?.topics) ? log.topics : null;

  if (!log || topics === null || log.removed === true || topics.length < 3) {
    return null;
  }

  const tokenContract = readString(log.address);
  const txHash = readString(log.transactionHash);
  const blockHash = readString(log.blockHash) ?? undefined;
  const blockNumber = parseBigIntField(log.blockNumber);
  const logIndex = parseIntegerField(log.logIndex);
  const amountUnits = parseBigIntField(log.data);
  const fromAddress = parseIndexedAddress(topics[1]);
  const toAddress = parseIndexedAddress(topics[2]);

  if (
    !tokenContract ||
    !txHash ||
    !fromAddress ||
    !toAddress ||
    blockNumber === null ||
    logIndex === null ||
    amountUnits === null ||
    // A zero-value Transfer is valid on-chain (some contracts emit it as a
    // no-op) but can never satisfy a checkout's positive expected amount,
    // and `onchain_transactions.amount_token` has a `> 0` check constraint.
    amountUnits <= BigInt(0)
  ) {
    return null;
  }

  return {
    amountUnits,
    blockHash,
    blockNumber,
    chain: "base",
    eventName: "Transfer",
    fromAddress,
    logIndex,
    provider,
    toAddress,
    tokenContract,
    txHash,
  };
}

/**
 * Reads the activity array from supported Alchemy webhook payload shapes.
 *
 * Parameters:
 * - payload: Parsed webhook payload.
 *
 * Returns:
 * - Activity objects from either the top-level or nested `event.activity`.
 */
function readAlchemyActivities(payload: unknown): Record<string, unknown>[] {
  const payloadRecord = asRecord(payload);

  if (Array.isArray(payloadRecord?.activity)) {
    return payloadRecord.activity
      .map((item) => asRecord(item))
      .filter((item): item is Record<string, unknown> => item !== null);
  }

  const eventRecord = asRecord(payloadRecord?.event);

  if (Array.isArray(eventRecord?.activity)) {
    return eventRecord.activity
      .map((item) => asRecord(item))
      .filter((item): item is Record<string, unknown> => item !== null);
  }

  return [];
}

/**
 * Parses the token transfer amount into base units.
 *
 * Parameters:
 * - activity: Raw activity object.
 *
 * Returns:
 * - Base-unit bigint amount, or `null` when no precise amount is available.
 */
function parseAmountUnits(activity: Record<string, unknown>): bigint | null {
  const rawContract = asRecord(activity.rawContract);
  const directRawAmount =
    parseBigIntField(rawContract?.rawValue) ??
    parseBigIntField(rawContract?.value) ??
    parseBigIntField(activity.rawValue) ??
    parseBigIntField(activity.value);

  if (directRawAmount !== null) {
    return directRawAmount;
  }

  const decimals =
    parseIntegerField(rawContract?.decimals) ??
    parseIntegerField(rawContract?.decimal) ??
    parseIntegerField(activity.decimals);
  const decimalAmount =
    readString(activity.amount) || readString(rawContract?.value);

  if (decimals === null || !decimalAmount) {
    return null;
  }

  return parseDecimalUnits(decimalAmount, decimals);
}

/**
 * Parses either a decimal or hex integer field into bigint.
 *
 * Parameters:
 * - value: Candidate field value.
 *
 * Returns:
 * - Parsed bigint, or `null` when the value is absent/invalid.
 */
function parseBigIntField(value: unknown): bigint | null {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? BigInt(Math.trunc(value)) : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

/**
 * Parses an integer field into a JavaScript number.
 *
 * Parameters:
 * - value: Candidate integer field.
 *
 * Returns:
 * - Integer number when valid, otherwise `null`.
 */
function parseIntegerField(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  const parsedBigInt = parseBigIntField(value);

  if (parsedBigInt === null) {
    return null;
  }

  const parsedNumber = Number(parsedBigInt);
  return Number.isSafeInteger(parsedNumber) ? parsedNumber : null;
}

/**
 * Parses an indexed 32-byte address topic into a canonical `0x` address.
 *
 * Parameters:
 * - value: Indexed topic value from `eth_getLogs`.
 *
 * Returns:
 * - Lower 20-byte EVM address string, or `null` when invalid.
 */
function parseIndexedAddress(value: unknown): string | null {
  const topic = readString(value)?.trim().toLowerCase();

  if (!topic || !/^0x[0-9a-f]{64}$/u.test(topic)) {
    return null;
  }

  return `0x${topic.slice(-40)}`;
}

/**
 * Converts a decimal token amount string into base units using the supplied
 * decimals count.
 *
 * Parameters:
 * - value: Decimal string such as `1.23`.
 * - decimals: Token decimals count.
 *
 * Returns:
 * - Bigint base units, or `null` when the value cannot be represented exactly.
 */
function parseDecimalUnits(value: string, decimals: number): bigint | null {
  const trimmed = value.trim();

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }

  const [wholePart, fractionPart = ""] = trimmed.split(".");

  if (fractionPart.length > decimals) {
    return null;
  }

  const paddedFraction = `${fractionPart}${"0".repeat(decimals)}`.slice(
    0,
    decimals,
  );

  return BigInt(`${wholePart}${paddedFraction}`);
}

/**
 * Narrows unknown values to plain object records.
 *
 * Parameters:
 * - value: Candidate object value.
 *
 * Returns:
 * - Object record when valid, otherwise `null`.
 */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

/**
 * Reads a trimmed string from an unknown field.
 *
 * Parameters:
 * - value: Candidate string field.
 *
 * Returns:
 * - Trimmed string when present, otherwise `null`.
 */
function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
