// @vitest-environment jsdom
/**
 * Unit tests for the shared Outpay beta wordmark.
 * Verifies the semantic superscript element and design-system brand color.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandWordmark } from "@/components/ui/BrandWordmark";

describe("BrandWordmark", () => {
  it("renders beta as a green superscript beside Outpay", () => {
    render(<BrandWordmark />);

    expect(screen.getByText("Outpay")).toBeDefined();
    const beta = screen.getByText("beta");
    expect(beta.tagName).toBe("SUP");
    expect(beta).toHaveClass("text-primary");
  });
});
