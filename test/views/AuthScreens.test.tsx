// @vitest-environment jsdom
/**
 * Regression tests for the Google OAuth actions on the login and signup
 * screens. These tests mock the Better Auth browser client and verify the
 * user-facing gating and redirect contracts without contacting Google.
 */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginScreen, SignupScreen } from "@/views/AuthScreens";

const mocks = vi.hoisted(() => ({
  socialSignIn: vi.fn().mockResolvedValue({ error: null }),
  toastError: vi.fn(),
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signIn: {
      email: vi.fn(),
      social: mocks.socialSignIn,
    },
    signUp: {
      email: vi.fn(),
    },
  },
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({
    error: mocks.toastError,
    success: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  mocks.socialSignIn.mockClear();
  mocks.toastError.mockClear();
});

describe("Google OAuth auth actions", () => {
  it("renders a Google button on the login screen and uses the dashboard redirect", async () => {
    render(<LoginScreen />);

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    await waitFor(() => {
      expect(mocks.socialSignIn).toHaveBeenCalledWith({
        callbackURL: "/dashboard",
        errorCallbackURL: "/login",
        newUserCallbackURL: "/onboarding",
        provider: "google",
      });
    });
  });

  it("requires legal acceptance before Google can create a signup account", async () => {
    render(<SignupScreen />);

    const googleButton = screen.getByRole("button", {
      name: "Sign up with Google",
    });
    expect(googleButton).toBeDisabled();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Accept the Terms of Service and Privacy Policy",
      }),
    );
    expect(googleButton).toBeEnabled();

    fireEvent.click(googleButton);

    await waitFor(() => {
      expect(mocks.socialSignIn).toHaveBeenCalledWith({
        callbackURL: "/dashboard",
        errorCallbackURL: "/signup",
        newUserCallbackURL: "/onboarding",
        provider: "google",
      });
    });
  });
});
