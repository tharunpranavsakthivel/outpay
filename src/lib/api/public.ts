/**
 * Shared request validation, idempotency, and response helpers for the public
 * `/api/v1/*` REST API.
 */

import { createHash, randomUUID } from "node:crypto";

export interface PublicApiErrorDetail {
  field?: string;
  issue: string;
}

export class PublicApiError extends Error {
  code: string;
  details: PublicApiErrorDetail[];
  status: number;

  constructor(
    status: number,
    code: string,
    message: string,
    details: PublicApiErrorDetail[] = [],
  ) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "PublicApiError";
    this.status = status;
  }
}

export interface CreateCheckoutApiRequest {
  amount: string;
  cancelUrl: string | null;
  chain: "base";
  currency: "USDC";
  customerEmail: string | null;
  metadata: Record<string, unknown>;
  successUrl: string;
}

export interface StoredIdempotencyRecord<TBody> {
  body: TBody | null;
  expiresAt: Date;
  requestHash: string;
  statusCode: number | null;
}

export interface IdempotencyStore<TBody> {
  createRecord: (input: {
    body: TBody;
    checkoutSessionId?: string | null;
    expiresAt: Date;
    idempotencyKey: string;
    requestHash: string;
    requestMethod: string;
    requestPath: string;
    statusCode: number;
  }) => Promise<void>;
  findRecord: (input: {
    idempotencyKey: string;
    requestMethod: string;
    requestPath: string;
  }) => Promise<StoredIdempotencyRecord<TBody> | null>;
}

/**
 * Resolves or generates the request identifier for error and success
 * envelopes.
 *
 * Parameters:
 * - request: Incoming HTTP request.
 *
 * Returns:
 * - Stable request identifier for the current response.
 */
export function getPublicApiRequestId(request: Request) {
  return (
    request.headers.get("x-request-id")?.trim() ||
    request.headers.get("x-correlation-id")?.trim() ||
    randomUUID()
  );
}

/**
 * Produces the public API JSON error envelope required by the architecture.
 *
 * Parameters:
 * - requestId: Correlation identifier returned in the body and header.
 * - status: HTTP status code.
 * - code: Stable application error code.
 * - message: Human-readable message.
 * - details: Optional validation or conflict detail list.
 * - headers: Optional response headers such as `Retry-After`.
 *
 * Returns:
 * - JSON response with the shared error envelope.
 */
export function publicApiError(
  requestId: string,
  status: number,
  code: string,
  message: string,
  details: PublicApiErrorDetail[] = [],
  headers?: HeadersInit,
) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("x-request-id", requestId);

  return Response.json(
    {
      error: {
        code,
        details,
        message,
        request_id: requestId,
      },
    },
    {
      headers: responseHeaders,
      status,
    },
  );
}

/**
 * Builds a JSON success response carrying the request identifier header.
 *
 * Parameters:
 * - requestId: Correlation identifier for the response.
 * - body: Serializable response payload.
 * - init: Optional HTTP status and headers.
 *
 * Returns:
 * - JSON response with `x-request-id` attached.
 */
export function publicApiJson(
  requestId: string,
  body: unknown,
  init?: ResponseInit,
) {
  const headers = new Headers(init?.headers);
  headers.set("x-request-id", requestId);

  return Response.json(body, {
    ...init,
    headers,
  });
}

/**
 * Parses and validates the optional idempotency key header.
 *
 * Parameters:
 * - value: Raw `Idempotency-Key` header value.
 *
 * Returns:
 * - Normalized key string or `null` when the header is absent.
 *
 * Throws:
 * - `PublicApiError` when the header is malformed.
 */
export function parseIdempotencyKey(value: string | null) {
  if (value === null) {
    return null;
  }

  const trimmedValue = value.trim();

  if (
    trimmedValue.length < 1 ||
    trimmedValue.length > 255 ||
    !/^[A-Za-z0-9:_-]+$/u.test(trimmedValue)
  ) {
    throw new PublicApiError(
      400,
      "INVALID_IDEMPOTENCY_KEY",
      "Idempotency-Key must be 1-255 characters using letters, numbers, colon, underscore, or hyphen.",
      [{ field: "Idempotency-Key", issue: "Malformed idempotency key." }],
    );
  }

  return trimmedValue;
}

/**
 * Canonically serializes JSON-like request bodies so idempotency hashes are
 * stable across equivalent key orderings.
 *
 * Parameters:
 * - value: Arbitrary JSON-compatible value.
 *
 * Returns:
 * - Deterministic JSON string.
 */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right),
    );

    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

/**
 * Hashes a normalized request body for idempotency replay comparisons.
 *
 * Parameters:
 * - body: Parsed request payload.
 *
 * Returns:
 * - Hex-encoded SHA-256 request digest.
 */
export function hashRequestBody(body: unknown) {
  return createHash("sha256").update(stableStringify(body)).digest("hex");
}

/**
 * Validates the public checkout-create request body against the documented
 * MVP schema.
 *
 * Parameters:
 * - body: Parsed request JSON.
 *
 * Returns:
 * - Strongly typed checkout-create payload.
 *
 * Throws:
 * - `PublicApiError` when the body is invalid.
 */
export function validateCreateCheckoutApiRequest(
  body: unknown,
): CreateCheckoutApiRequest {
  const details: PublicApiErrorDetail[] = [];

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new PublicApiError(
      400,
      "INVALID_REQUEST_BODY",
      "Request body must be a JSON object.",
      [{ issue: "Expected a JSON object." }],
    );
  }

  const candidate = body as Record<string, unknown>;
  const amount =
    typeof candidate.amount === "string" ? candidate.amount.trim() : "";
  const currency = candidate.currency;
  const chain = candidate.chain;
  const successUrl =
    typeof candidate.successUrl === "string" ? candidate.successUrl.trim() : "";
  const cancelUrl =
    typeof candidate.cancelUrl === "string" ? candidate.cancelUrl.trim() : "";
  const customerEmail =
    typeof candidate.customerEmail === "string"
      ? candidate.customerEmail.trim()
      : "";
  const metadata = candidate.metadata;

  if (!/^\d+(\.\d{1,2})?$/u.test(amount) || Number(amount) <= 0) {
    details.push({
      field: "amount",
      issue:
        "Amount must be a positive decimal string with up to 2 decimal places.",
    });
  }

  if (currency !== "USDC") {
    details.push({
      field: "currency",
      issue: "Currency must be USDC for the current MVP.",
    });
  }

  if (chain !== "base") {
    details.push({
      field: "chain",
      issue: "Chain must be base for the current MVP.",
    });
  }

  if (!successUrl || !URL.canParse(successUrl)) {
    details.push({
      field: "successUrl",
      issue: "Success URL must be a valid absolute URL.",
    });
  }

  if (cancelUrl && !URL.canParse(cancelUrl)) {
    details.push({
      field: "cancelUrl",
      issue: "Cancel URL must be a valid absolute URL.",
    });
  }

  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(customerEmail)) {
    details.push({
      field: "customerEmail",
      issue: "Customer email must be a valid email address.",
    });
  }

  if (
    metadata !== undefined &&
    (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
  ) {
    details.push({
      field: "metadata",
      issue: "Metadata must be a JSON object when provided.",
    });
  }

  if (details.length > 0) {
    throw new PublicApiError(
      422,
      "VALIDATION_FAILED",
      "The request body did not match the checkout schema.",
      details,
    );
  }

  return {
    amount,
    cancelUrl: cancelUrl || null,
    chain: "base",
    currency: "USDC",
    customerEmail: customerEmail || null,
    metadata: (metadata as Record<string, unknown> | undefined) ?? {},
    successUrl,
  };
}

/**
 * Executes a create-style request exactly once for a given idempotency key.
 *
 * Parameters:
 * - options: Request identity, persistence store, and create callback.
 *
 * Returns:
 * - Response payload plus a replay flag indicating whether storage was reused.
 *
 * Throws:
 * - `PublicApiError` when the stored request has expired or the body hash does
 *   not match the original request.
 */
export async function executeIdempotentRequest<TBody>(options: {
  create: () => Promise<{
    body: TBody;
    checkoutSessionId?: string | null;
    statusCode: number;
  }>;
  expiresAt: Date;
  idempotencyKey: string | null;
  requestHash: string;
  requestMethod: string;
  requestPath: string;
  store: IdempotencyStore<TBody>;
}): Promise<{ body: TBody; replayed: boolean; statusCode: number }> {
  if (!options.idempotencyKey) {
    const created = await options.create();

    return {
      body: created.body,
      replayed: false,
      statusCode: created.statusCode,
    };
  }

  const existingRecord = await options.store.findRecord({
    idempotencyKey: options.idempotencyKey,
    requestMethod: options.requestMethod,
    requestPath: options.requestPath,
  });

  if (existingRecord) {
    if (existingRecord.expiresAt.getTime() <= Date.now()) {
      throw new PublicApiError(
        409,
        "EXPIRED_IDEMPOTENCY_KEY",
        "The supplied Idempotency-Key has expired and cannot be replayed.",
        [
          {
            field: "Idempotency-Key",
            issue: "Stored idempotency record expired.",
          },
        ],
      );
    }

    if (existingRecord.requestHash !== options.requestHash) {
      throw new PublicApiError(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "The supplied Idempotency-Key was already used with a different request body.",
        [
          {
            field: "Idempotency-Key",
            issue: "Request body does not match the original submission.",
          },
        ],
      );
    }

    return {
      body: existingRecord.body as TBody,
      replayed: true,
      statusCode: existingRecord.statusCode ?? 200,
    };
  }

  const created = await options.create();
  await options.store.createRecord({
    body: created.body,
    checkoutSessionId: created.checkoutSessionId,
    expiresAt: options.expiresAt,
    idempotencyKey: options.idempotencyKey,
    requestHash: options.requestHash,
    requestMethod: options.requestMethod,
    requestPath: options.requestPath,
    statusCode: created.statusCode,
  });

  return {
    body: created.body,
    replayed: false,
    statusCode: created.statusCode,
  };
}
