// @vitest-environment jsdom
/**
 * Regression tests for the homepage hero call-to-action.
 * The hero must send authenticated merchants to the dashboard while keeping
 * the signup route for visitors who do not have an active session.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home from "@/views/Home";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
});

describe("homepage hero call-to-action", () => {
  it("keeps the hero signup link for signed-out visitors", () => {
    render(<Home />);

    const signupLinks = screen.getAllByRole("link", { name: "Sign up" });

    expect(signupLinks[0]).toHaveAttribute("href", "/signup");
  });

  it("routes the hero signup link to the dashboard for signed-in users", () => {
    render(
      <Home
        authenticatedUser={{
          name: "Alex Merchant",
          email: "alex@example.com",
        }}
      />,
    );

    const signupLinks = screen.getAllByRole("link", { name: "Sign up" });

    expect(signupLinks[0]).toHaveAttribute("href", "/dashboard");
  });
});
