/**
 * Provider router for Base RPC reads. Routes through the configured primary
 * provider, retries once on primary failure, then fails over to the secondary
 * provider when enabled.
 */

import { alchemyRpcRequest } from "@/lib/providers/alchemy";
import { chainstackRpcRequest } from "@/lib/providers/chainstack";

export type RpcProviderName = "alchemy" | "chainstack";

export interface ProviderRouterCallOptions {
  preferSecondaryOnDegradedPrimary?: boolean;
}

export interface ProviderRouterDependencies {
  failoverEnabled: boolean;
  logEvent: (event: ProviderRouterLogEvent) => void;
  primaryProvider: RpcProviderName;
  providers: Record<RpcProviderName, RpcRequestFunction>;
  resolvePrimaryState: (
    provider: RpcProviderName,
  ) => Promise<ProviderHealthStatus | null>;
  secondaryProvider: RpcProviderName;
}

export interface ProviderRouterLogEvent {
  attempt?: number;
  error?: string;
  event: "failover" | "failure";
  method: string;
  provider: RpcProviderName;
  secondaryProvider?: RpcProviderName;
}

export type ProviderHealthStatus =
  | "degraded"
  | "down"
  | "healthy"
  | "rate_limited"
  | "recovering";

export type RpcRequestFunction = <T>(
  method: string,
  params?: readonly unknown[],
) => Promise<T>;

const PRIMARY_PROVIDER = parseProviderName(
  process.env.RPC_PRIMARY_PROVIDER?.trim() || "alchemy",
  "RPC_PRIMARY_PROVIDER",
);
const SECONDARY_PROVIDER = parseProviderName(
  process.env.RPC_SECONDARY_PROVIDER?.trim() || "chainstack",
  "RPC_SECONDARY_PROVIDER",
);
const FAILOVER_ENABLED = parseBooleanEnv(
  process.env.RPC_FAILOVER_ENABLED?.trim(),
  true,
  "RPC_FAILOVER_ENABLED",
);

if (PRIMARY_PROVIDER === SECONDARY_PROVIDER) {
  throw new Error(
    "RPC_PRIMARY_PROVIDER and RPC_SECONDARY_PROVIDER must be different providers.",
  );
}

const DEFAULT_PROVIDER_ROUTER = createProviderRouter({
  failoverEnabled: FAILOVER_ENABLED,
  logEvent: logProviderRouterEvent,
  primaryProvider: PRIMARY_PROVIDER,
  providers: {
    alchemy: alchemyRpcRequest,
    chainstack: chainstackRpcRequest,
  },
  resolvePrimaryState: async (provider) => {
    const { getLatestProviderHealthStatus } = await import("./health");
    return getLatestProviderHealthStatus(provider);
  },
  secondaryProvider: SECONDARY_PROVIDER,
});

/**
 * Error raised when all configured RPC providers fail a routed read.
 */
export class ProviderRouterError extends Error {
  primaryError?: unknown;
  secondaryError?: unknown;

  constructor(
    message: string,
    options?: { primaryError?: unknown; secondaryError?: unknown },
  ) {
    super(message);
    this.name = "ProviderRouterError";
    this.primaryError = options?.primaryError;
    this.secondaryError = options?.secondaryError;
  }
}

/**
 * Routes a JSON-RPC read using the default provider router configuration.
 *
 * Parameters:
 * - method: JSON-RPC method name.
 * - params: Ordered JSON-RPC parameters.
 * - options: Routing hints for degraded-primary cases.
 *
 * Returns:
 * - Parsed JSON-RPC result from the successful provider.
 */
export async function callRpc<T>(
  method: string,
  params: readonly unknown[] = [],
  options?: ProviderRouterCallOptions,
): Promise<T> {
  return DEFAULT_PROVIDER_ROUTER.callRpc<T>(method, params, options);
}

/**
 * Creates an injectable provider router so tests and workers can override the
 * provider functions and health-state resolver.
 *
 * Parameters:
 * - input: Router dependencies and configuration.
 *
 * Returns:
 * - Router with a `callRpc` method implementing retry/failover behavior.
 */
export function createProviderRouter(input: ProviderRouterDependencies) {
  return {
    /**
     * Executes a routed JSON-RPC read through the configured provider order.
     *
     * Parameters:
     * - method: JSON-RPC method name.
     * - params: Ordered JSON-RPC parameters.
     * - options: Routing hints for degraded-primary cases.
     *
     * Returns:
     * - Parsed JSON-RPC result from the first provider to succeed.
     *
     * Throws:
     * - `ProviderRouterError` when every attempted provider fails.
     */
    async callRpc<T>(
      method: string,
      params: readonly unknown[] = [],
      options?: ProviderRouterCallOptions,
    ): Promise<T> {
      const providerOrder = await resolveProviderOrder(input, options);
      const primaryProvider = providerOrder[0];
      const secondaryProvider = providerOrder[1];
      let lastPrimaryError: unknown;

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          return await input.providers[primaryProvider]<T>(method, params);
        } catch (error) {
          lastPrimaryError = error;
          input.logEvent({
            attempt,
            error: sanitizeErrorMessage(error),
            event: "failure",
            method,
            provider: primaryProvider,
          });
        }
      }

      if (!input.failoverEnabled || !secondaryProvider) {
        throw new ProviderRouterError(
          `Primary RPC provider ${primaryProvider} failed and failover is disabled.`,
          {
            primaryError: lastPrimaryError,
          },
        );
      }

      input.logEvent({
        event: "failover",
        method,
        provider: primaryProvider,
        secondaryProvider,
      });

      try {
        return await input.providers[secondaryProvider]<T>(method, params);
      } catch (error) {
        input.logEvent({
          attempt: 1,
          error: sanitizeErrorMessage(error),
          event: "failure",
          method,
          provider: secondaryProvider,
        });

        throw new ProviderRouterError("All RPC providers failed.", {
          primaryError: lastPrimaryError,
          secondaryError: error,
        });
      }
    },
  };
}

/**
 * Resolves the provider order for a routed RPC call.
 *
 * Parameters:
 * - input: Router configuration and provider-health resolver.
 * - options: Routing hints for degraded-primary cases.
 *
 * Returns:
 * - Ordered list of providers to try.
 */
async function resolveProviderOrder(
  input: ProviderRouterDependencies,
  options?: ProviderRouterCallOptions,
): Promise<[RpcProviderName, RpcProviderName?]> {
  if (options?.preferSecondaryOnDegradedPrimary === false) {
    return [input.primaryProvider, input.secondaryProvider];
  }

  const primaryState = await input.resolvePrimaryState(input.primaryProvider);

  if (
    primaryState === "degraded" ||
    primaryState === "down" ||
    primaryState === "rate_limited"
  ) {
    return [input.secondaryProvider, input.primaryProvider];
  }

  return [input.primaryProvider, input.secondaryProvider];
}

/**
 * Parses a provider-name environment variable.
 *
 * Parameters:
 * - value: Raw environment-variable value.
 * - variableName: Variable name used in error messages.
 *
 * Returns:
 * - Valid provider name.
 */
function parseProviderName(
  value: string,
  variableName: string,
): RpcProviderName {
  if (value === "alchemy" || value === "chainstack") {
    return value;
  }

  throw new Error(`${variableName} must be either "alchemy" or "chainstack".`);
}

/**
 * Parses a boolean-like environment variable.
 *
 * Parameters:
 * - value: Raw environment-variable value.
 * - defaultValue: Fallback used when the variable is unset.
 * - variableName: Variable name used in error messages.
 *
 * Returns:
 * - Parsed boolean value.
 */
function parseBooleanEnv(
  value: string | undefined,
  defaultValue: boolean,
  variableName: string,
): boolean {
  if (value === undefined || value.length === 0) {
    return defaultValue;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`${variableName} must be either "true" or "false".`);
}

/**
 * Emits a structured log entry for provider-router failures and failovers.
 *
 * Parameters:
 * - event: Routing event metadata.
 */
function logProviderRouterEvent(event: ProviderRouterLogEvent): void {
  console.error(
    JSON.stringify({
      attempt: event.attempt ?? null,
      error: event.error ?? null,
      event: event.event,
      method: event.method,
      module: "provider-router",
      provider: event.provider,
      secondaryProvider: event.secondaryProvider ?? null,
      timestamp: new Date().toISOString(),
    }),
  );
}

/**
 * Converts an unknown error into a log-safe single-line message.
 *
 * Parameters:
 * - error: Unknown caught exception.
 *
 * Returns:
 * - Human-readable error message without provider URLs.
 */
function sanitizeErrorMessage(error: unknown): string {
  const rawMessage =
    error instanceof Error ? error.message : "Unknown provider error";

  return rawMessage.replace(/https?:\/\/\S+/giu, "[redacted-url]");
}
