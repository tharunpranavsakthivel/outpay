/**
 * Structured application logging and request correlation for Outpay.
 *
 * Exports a pino logger, request-handler wrapper, request context helpers, and
 * redaction utilities. Secrets are removed before values reach the logger and
 * again by pino's field redaction as a defense in depth control.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import pino, { type Logger } from "pino";

const REDACTED_VALUE = "[REDACTED]";
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u;
const SENSITIVE_KEY_PATTERN =
  /(?:access[_-]?key|api[_-]?key|authorization|cookie|database[_-]?(?:url|password)|password|private[_-]?key|secret|signing[_-]?secret|token)/iu;
const SENSITIVE_TEXT_PATTERNS = [
  /((?:postgres(?:ql)?|redis):\/\/)[^\s"']+/giu,
  /((?:bearer|basic)\s+)[^\s"']+/giu,
  /((?:api[-_]?key|password|secret|token)\s*[:=]\s*)[^\s,}]+/giu,
];

const requestLogStorage = new AsyncLocalStorage<RequestLogContext>();

export interface RequestLogContext {
  module: string;
  request_id: string;
  merchant_id?: string;
}

export interface LogFields {
  [key: string]: unknown;
  merchant_id?: string;
  request_id?: string;
}

export type RouteHandler<TContext = unknown> = (
  request: Request,
  context: TContext,
) => Response | Promise<Response>;

/**
 * Pino logger configured for machine-readable JSON logs with stable field
 * names. Pino's numeric level is formatted back to its text label so Railway
 * logs remain searchable without a second parsing convention.
 */
export const logger: Logger = pino({
  base: null,
  formatters: {
    level: (label) => ({ level: label }),
  },
  level: process.env.OUTPAY_LOG_LEVEL?.trim() || "info",
  messageKey: "message",
  redact: {
    censor: REDACTED_VALUE,
    paths: [
      "*.access_key",
      "*.api_key",
      "*.authorization",
      "*.cookie",
      "*.database_url",
      "*.password",
      "*.private_key",
      "*.secret",
      "*.signing_secret",
      "*.token",
      "*.webhook_secret",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
  },
  serializers: {
    err: serializeError,
  },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
});

/**
 * Resolves a safe request identifier from trusted correlation headers or
 * generates a UUID when the caller did not provide one.
 *
 * Parameters:
 * - request: Incoming route-handler request.
 *
 * Returns:
 * - A bounded identifier safe to return in a response header and log field.
 */
export function getRequestId(request: Request): string {
  const suppliedId =
    request.headers.get("x-request-id")?.trim() ||
    request.headers.get("x-correlation-id")?.trim();

  return suppliedId && REQUEST_ID_PATTERN.test(suppliedId)
    ? suppliedId
    : randomUUID();
}

/**
 * Returns the request context for code running inside a wrapped route.
 */
export function getRequestLogContext(): RequestLogContext | undefined {
  return requestLogStorage.getStore();
}

/**
 * Adds the authenticated merchant identifier to the active request context.
 * Calls outside a wrapped request are intentionally ignored because they have
 * no safe correlation scope to attach to.
 *
 * Parameters:
 * - merchantId: Internal merchant UUID known after authentication.
 */
export function setRequestMerchantId(merchantId: string): void {
  const context = getRequestLogContext();

  if (context) {
    context.merchant_id = merchantId;
  }
}

/**
 * Runs an API handler inside an async request context and guarantees request
 * ID response propagation plus a structured fallback for uncaught failures.
 *
 * Parameters:
 * - module: Stable route/module identifier used in every log line.
 * - handler: Existing Next.js route handler to invoke.
 *
 * Returns:
 * - Wrapped route handler preserving the original response contract.
 *
 * Throws:
 * - Handler errors are logged and converted to the standard 500 envelope so
 *   an uncaught exception cannot lose its request correlation.
 */
export function withRequestLogging<TContext = unknown>(
  module: string,
  handler: RouteHandler<TContext>,
): RouteHandler<TContext> {
  return async (request, context) => {
    const requestContext: RequestLogContext = {
      module,
      request_id: getRequestId(request),
    };

    return requestLogStorage.run(requestContext, async () => {
      try {
        const response = await handler(request, context);
        return withRequestIdHeader(response, requestContext.request_id);
      } catch (error) {
        logApiError(error, {
          error_code: "UNHANDLED_ROUTE_ERROR",
          status: 500,
        });

        return Response.json(
          {
            error: {
              code: "INTERNAL_SERVER_ERROR",
              message: "An unexpected server error occurred.",
              request_id: requestContext.request_id,
            },
          },
          {
            headers: { "x-request-id": requestContext.request_id },
            status: 500,
          },
        );
      }
    });
  };
}

/**
 * Logs an API exception with sanitized error details and request context.
 *
 * Parameters:
 * - error: Unknown value caught at an API boundary.
 * - fields: Additional safe fields such as the stable error code or merchant.
 */
export function logApiError(error: unknown, fields: LogFields = {}): void {
  writeLog("error", "API request failed", {
    ...fields,
    err: error,
  });
}

/**
 * Logs a structured API error response, including validation failures that do
 * not have a thrown exception behind them.
 *
 * Parameters:
 * - fields: Status, error code, and optional caught exception metadata.
 */
export function logApiErrorResponse(fields: LogFields): void {
  const level = fields.err === undefined ? "warn" : "error";
  writeLog(level, "API error response", fields);
}

/**
 * Adds the correlation header without mutating a potentially shared response.
 */
export function withRequestIdHeader(
  response: Response,
  requestId: string,
): Response {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", requestId);

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function writeLog(
  level: "error" | "info" | "warn",
  message: string,
  fields: LogFields,
): void {
  const context = getRequestLogContext();
  const safeFields = sanitizeLogFields({
    ...(context ?? {}),
    ...fields,
  });

  // Keep the original exception available to pino's error serializer while
  // sanitizing every other value before serialization.
  if (fields.err !== undefined) {
    safeFields.err = fields.err;
  }

  logger[level](safeFields, message);
}

function serializeError(error: unknown): Record<string, string> {
  if (error instanceof Error) {
    return {
      message: redactText(error.message),
      name: error.name,
      stack: redactText(error.stack ?? ""),
    };
  }

  return {
    message: redactText(String(error)),
    name: "UnknownError",
    stack: "",
  };
}

export function sanitizeLogFields(fields: LogFields): LogFields {
  return sanitizeLogValue(fields) as LogFields;
}

function sanitizeLogValue(value: unknown, key = "", depth = 0): unknown {
  if (depth > 8) {
    return "[TRUNCATED]";
  }

  if (key && SENSITIVE_KEY_PATTERN.test(key)) {
    return REDACTED_VALUE;
  }

  if (typeof value === "string") {
    return redactText(value);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeLogValue(entry, "", depth + 1));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeLogValue(entryValue, entryKey, depth + 1),
      ]),
    );
  }

  return value;
}

function redactText(value: string): string {
  return SENSITIVE_TEXT_PATTERNS.reduce(
    (redacted, pattern) => redacted.replace(pattern, `$1${REDACTED_VALUE}`),
    value,
  );
}
