// @vitest-environment jsdom
/**
 * Regression tests for the marketing Developers mega-menu documentation links.
 * The menu must send users to the canonical hosted Outpay documentation.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarketingNavbar } from "@/components/layout/MarketingNavbar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("Marketing Developers navigation", () => {
  it("links developer resources to the canonical Outpay documentation", () => {
    render(<MarketingNavbar />);
    fireEvent.focus(screen.getByRole("button", { name: "Developers" }));

    const apiReferenceLinks = screen.getAllByRole("link", {
      name: /API reference/i,
    });
    expect(apiReferenceLinks).toHaveLength(2);
    for (const link of apiReferenceLinks) {
      expect(link).toHaveAttribute(
        "href",
        "https://docs.outpay.tech/docs/api-reference/overview",
      );
    }

    expect(
      screen.getByRole("link", { name: /^Webhooks Guide/ }),
    ).toHaveAttribute("href", "https://docs.outpay.tech/docs/webhooks");
    const quickstartLinks = screen.getAllByRole("link", {
      name: /^Quickstart/,
    });
    expect(quickstartLinks).toHaveLength(2);
    for (const link of quickstartLinks) {
      expect(link).toHaveAttribute(
        "href",
        "https://docs.outpay.tech/docs/getting-started/quickstart",
      );
    }
    expect(screen.getByRole("link", { name: /^Changelog/ })).toHaveAttribute(
      "href",
      "https://docs.outpay.tech/docs/changelog",
    );
  });
});

describe("Marketing authenticated navigation", () => {
  it("shows dashboard links only for authenticated users", () => {
    cleanup();
    render(<MarketingNavbar />);

    expect(screen.queryByRole("link", { name: /^Dashboard$/ })).toBeNull();

    cleanup();
    render(
      <MarketingNavbar
        authenticatedUser={{
          name: "Alex Merchant",
          email: "alex@example.com",
        }}
      />,
    );

    const dashboardLinks = screen.getAllByRole("link", {
      name: /^Dashboard$/,
    });
    expect(dashboardLinks).toHaveLength(1);
    expect(dashboardLinks[0]).toHaveAttribute("href", "/dashboard");

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    const mobileDashboardLink = screen.getAllByRole("link", {
      name: /^Dashboard$/,
    })[1];
    expect(mobileDashboardLink).toHaveAttribute("href", "/dashboard");
  });
});
