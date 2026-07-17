/**
 * Chainstack provider helpers for Base JSON-RPC access. This mirrors the
 * Alchemy client shape so the ProviderRouter can fail over without changing
 * call sites.
 */

import { parseRetryAfterMs } from "./retry-after";

const CHAINSTACK_BASE_RPC_URL = process.env.CHAINSTACK_BASE_RPC_URL?.trim();
const CHAINSTACK_RPC_TIMEOUT_MS = Number.parseInt(
  process.env.RPC_TIMEOUT_MS?.trim() || "8000",
  10,
);

if (!CHAINSTACK_BASE_RPC_URL) {
  throw new Error("Chainstack is not configured. Set CHAINSTACK_BASE_RPC_URL.");
}

if (!URL.canParse(CHAINSTACK_BASE_RPC_URL)) {
  throw new Error("CHAINSTACK_BASE_RPC_URL must be a valid absolute URL.");
}

if (
  !Number.isInteger(CHAINSTACK_RPC_TIMEOUT_MS) ||
  CHAINSTACK_RPC_TIMEOUT_MS <= 0
) {
  throw new Error("RPC_TIMEOUT_MS must be a positive integer.");
}

const CHAINSTACK_CONFIG = {
  baseRpcUrl: CHAINSTACK_BASE_RPC_URL,
  rpcTimeoutMs: CHAINSTACK_RPC_TIMEOUT_MS,
} as const;

interface JsonRpcErrorPayload {
  code: number;
  data?: unknown;
  message: string;
}

interface JsonRpcResponse<T> {
  error?: JsonRpcErrorPayload;
  id?: number | string | null;
  jsonrpc?: string;
  result?: T;
}

/**
 * Error raised when a Chainstack JSON-RPC call fails at the HTTP or provider
 * payload layer.
 */
export class ChainstackRpcError extends Error {
  code?: number;
  data?: unknown;
  httpStatus?: number;
  retryAfterMs?: number;

  constructor(
    message: string,
    options?: {
      code?: number;
      data?: unknown;
      httpStatus?: number;
      retryAfterMs?: number;
    },
  ) {
    super(message);
    this.name = "ChainstackRpcError";
    this.code = options?.code;
    this.data = options?.data;
    this.httpStatus = options?.httpStatus;
    this.retryAfterMs = options?.retryAfterMs;
  }
}

/**
 * Sends a JSON-RPC request to the configured Chainstack Base endpoint.
 *
 * Parameters:
 * - method: JSON-RPC method name.
 * - params: Ordered JSON-RPC parameters.
 *
 * Returns:
 * - Parsed `result` field from the JSON-RPC response.
 *
 * Throws:
 * - `ChainstackRpcError` when the HTTP call fails or Chainstack returns a
 *   JSON-RPC error payload.
 */
export async function chainstackRpcRequest<T>(
  method: string,
  params: readonly unknown[] = [],
): Promise<T> {
  const response = await fetch(CHAINSTACK_CONFIG.baseRpcUrl, {
    body: JSON.stringify({
      id: Date.now(),
      jsonrpc: "2.0",
      method,
      params,
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
    signal: AbortSignal.timeout(CHAINSTACK_CONFIG.rpcTimeoutMs),
  });

  if (!response.ok) {
    throw new ChainstackRpcError(
      `Chainstack RPC request failed with HTTP ${response.status}.`,
      {
        httpStatus: response.status,
        retryAfterMs:
          parseRetryAfterMs(response.headers.get("retry-after")) ?? undefined,
      },
    );
  }

  const payload = (await response.json()) as JsonRpcResponse<T>;

  if (payload.error) {
    throw new ChainstackRpcError(payload.error.message, {
      code: payload.error.code,
      data: payload.error.data,
    });
  }

  if (!("result" in payload)) {
    throw new ChainstackRpcError(
      "Chainstack RPC response did not include a result field.",
    );
  }

  return payload.result as T;
}
