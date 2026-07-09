/**
 * Merchant webhook URL validation helpers.
 *
 * The dashboard must reject internal/private destinations at configuration
 * time so a malicious merchant cannot pivot the webhook worker into SSRF.
 */

import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const WEBHOOK_DNS_TIMEOUT_MS = 2_000;
const PRIVATE_ADDRESS_BLOCKLIST = buildPrivateAddressBlockList();

export class WebhookUrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookUrlValidationError";
  }
}

/**
 * Validates and normalizes a merchant-configured webhook URL.
 *
 * Parameters:
 * - rawUrl: User-provided destination URL.
 *
 * Returns:
 * - Normalized absolute URL string safe to persist.
 */
export async function validateMerchantWebhookUrl(
  rawUrl: string,
): Promise<string> {
  const trimmedUrl = rawUrl.trim();

  if (!trimmedUrl || !URL.canParse(trimmedUrl)) {
    throw new WebhookUrlValidationError(
      "Webhook URL must be a valid absolute HTTP or HTTPS URL.",
    );
  }

  const parsedUrl = new URL(trimmedUrl);

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new WebhookUrlValidationError(
      "Webhook URL must use the http:// or https:// protocol.",
    );
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new WebhookUrlValidationError(
      "Webhook URLs cannot include embedded credentials.",
    );
  }

  await assertPublicWebhookHostname(parsedUrl.hostname);

  return parsedUrl.toString();
}

/**
 * Rejects loopback, private, and link-local destinations for webhook hosts.
 *
 * Parameters:
 * - hostname: URL hostname to inspect.
 */
export async function assertPublicWebhookHostname(
  hostname: string,
): Promise<void> {
  const normalizedHostname = hostname.trim().toLowerCase();

  if (
    normalizedHostname === "localhost" ||
    normalizedHostname.endsWith(".localhost") ||
    normalizedHostname.endsWith(".local")
  ) {
    throw new WebhookUrlValidationError(
      "Webhook URL must not target localhost or other local network hostnames.",
    );
  }

  if (isIpAddressBlocked(normalizedHostname)) {
    throw new WebhookUrlValidationError(
      "Webhook URL must not target private, loopback, or link-local IP ranges.",
    );
  }

  const resolvedAddresses = await resolveHostnameAddresses(normalizedHostname);

  if (resolvedAddresses.some((address) => isIpAddressBlocked(address))) {
    throw new WebhookUrlValidationError(
      "Webhook URL resolves to a private, loopback, or link-local IP range.",
    );
  }
}

function buildPrivateAddressBlockList(): BlockList {
  const blockList = new BlockList();

  blockList.addSubnet("0.0.0.0", 8, "ipv4");
  blockList.addSubnet("10.0.0.0", 8, "ipv4");
  blockList.addSubnet("100.64.0.0", 10, "ipv4");
  blockList.addSubnet("127.0.0.0", 8, "ipv4");
  blockList.addSubnet("169.254.0.0", 16, "ipv4");
  blockList.addSubnet("172.16.0.0", 12, "ipv4");
  blockList.addSubnet("192.168.0.0", 16, "ipv4");
  blockList.addSubnet("198.18.0.0", 15, "ipv4");
  blockList.addSubnet("224.0.0.0", 4, "ipv4");

  blockList.addAddress("::", "ipv6");
  blockList.addAddress("::1", "ipv6");
  blockList.addSubnet("fc00::", 7, "ipv6");
  blockList.addSubnet("fe80::", 10, "ipv6");
  blockList.addSubnet("ff00::", 8, "ipv6");

  return blockList;
}

function isIpAddressBlocked(address: string): boolean {
  const mappedIpv4 = extractIpv4FromMappedIpv6(address);

  if (mappedIpv4) {
    return PRIVATE_ADDRESS_BLOCKLIST.check(mappedIpv4, "ipv4");
  }

  const family = isIP(address);

  if (family === 4) {
    return PRIVATE_ADDRESS_BLOCKLIST.check(address, "ipv4");
  }

  if (family === 6) {
    return PRIVATE_ADDRESS_BLOCKLIST.check(address, "ipv6");
  }

  return false;
}

async function resolveHostnameAddresses(hostname: string): Promise<string[]> {
  const lookupPromise = lookup(hostname, {
    all: true,
    verbatim: true,
  }).then((records) => records.map((record) => record.address));

  const timeoutPromise = new Promise<string[]>((_, reject) => {
    const timer = setTimeout(() => {
      reject(
        new WebhookUrlValidationError(
          "Webhook URL hostname lookup timed out. Use a public hostname with working DNS.",
        ),
      );
    }, WEBHOOK_DNS_TIMEOUT_MS);

    timer.unref?.();
  });

  try {
    return await Promise.race([lookupPromise, timeoutPromise]);
  } catch (error) {
    throw new WebhookUrlValidationError(
      error instanceof Error
        ? error.message
        : "Webhook URL hostname could not be resolved.",
    );
  }
}

function extractIpv4FromMappedIpv6(address: string): string | null {
  const loweredAddress = address.toLowerCase();
  const mappedPrefix = "::ffff:";

  if (!loweredAddress.startsWith(mappedPrefix)) {
    return null;
  }

  const ipv4Candidate = loweredAddress.slice(mappedPrefix.length);
  return isIP(ipv4Candidate) === 4 ? ipv4Candidate : null;
}
