/**
 * Shared Outpay wordmark for branded product surfaces.
 *
 * Exposes the product name with its beta label and relies on the design-system
 * `primary` semantic token for the label color. It has no side effects.
 */

/**
 * Renders the Outpay wordmark with a green beta superscript.
 *
 * @param className Optional classes applied to the wordmark wrapper.
 * @returns The accessible text wordmark and beta label.
 */
export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={[
        "inline-flex items-baseline whitespace-nowrap",
        className,
      ].join(" ")}
    >
      Outpay
      <sup className="ml-1 text-[0.6em] font-medium leading-none text-primary">
        beta
      </sup>
    </span>
  );
}
