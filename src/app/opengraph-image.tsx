/**
 * Branded default Open Graph image for Outpay pages without route-specific art.
 *
 * Uses Next.js ImageResponse so social crawlers receive a stable 1200×630 PNG
 * without adding a binary asset or a runtime image dependency.
 */

import { ImageResponse } from "next/og";

export const alt = "Outpay — non-custodial USDC checkout on Base";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Generates the branded social sharing image.
 *
 * Parameters:
 * - None; the image is static for the site-level fallback.
 *
 * Returns:
 * - Next.js ImageResponse rendered as a PNG.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        background: "#f7f7f5",
        color: "#18181b",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Arial, sans-serif",
        height: "100%",
        justifyContent: "space-between",
        padding: "72px",
        width: "100%",
      }}
    >
      <div style={{ alignItems: "center", display: "flex", gap: "18px" }}>
        <div
          style={{
            background: "#d6ff3f",
            border: "2px solid #18181b",
            borderRadius: "18px",
            height: "48px",
            width: "48px",
          }}
        />
        <div style={{ fontSize: "32px", fontWeight: 700 }}>Outpay</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ color: "#52525b", fontSize: "24px" }}>
          Stablecoin payment infrastructure
        </div>
        <div
          style={{
            fontSize: "64px",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            lineHeight: 1.05,
            maxWidth: "940px",
          }}
        >
          Non-custodial USDC checkout on Base.
        </div>
      </div>
      <div style={{ color: "#52525b", display: "flex", fontSize: "24px" }}>
        Hosted checkout · On-chain detection · Signed webhooks
      </div>
    </div>,
    size,
  );
}
