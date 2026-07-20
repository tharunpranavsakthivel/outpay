/**
 * Server-rendered JSON-LD script component for public Outpay pages.
 *
 * The component escapes `<` before embedding JSON so structured data cannot
 * terminate the script tag if future content includes user-controlled text.
 */

type JsonLdProps = {
  data: Record<string, unknown>;
};

/**
 * Renders one sanitized JSON-LD block.
 *
 * Parameters:
 * - data: Schema.org object to serialize.
 *
 * Returns:
 * - A script element consumed by crawlers and validators.
 */
export function JsonLd({ data }: JsonLdProps) {
  const serializedData = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      // JSON-LD requires a script payload; serialized data escapes `<` first.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized JSON-LD is required by Schema.org consumers.
      dangerouslySetInnerHTML={{ __html: serializedData }}
    />
  );
}
