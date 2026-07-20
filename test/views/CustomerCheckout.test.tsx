// @vitest-environment jsdom
/**
 * Tests for the customer checkout page's automatic status polling: the
 * pending -> paid transition, interval/listener cleanup, recovery from a
 * dropped connection, and the one-time paid-success animation.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { act, cleanup, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { PublicCheckoutData } from "@/lib/dashboard/types";
import CustomerCheckout from "@/views/CustomerCheckout";

function buildCheckout(
  overrides: Partial<PublicCheckoutData> = {},
): PublicCheckoutData {
  return {
    amountLabel: "1.00 USDC",
    chainName: "Base",
    checkoutRef: "chk_test123",
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    merchantName: "Test Merchant",
    orderDescription: "Order #1",
    paymentUri: "ethereum:0xabc@8453?value=1.00",
    publicToken: "public_token_123",
    redirectUrl: null,
    status: "waiting",
    tokenSymbol: "USDC",
    walletAddress: "0x1111111111111111111111111111111111111111",
    ...overrides,
  };
}

function renderCheckout(initialData: PublicCheckoutData) {
  return render(
    <ToastProvider>
      <CustomerCheckout initialData={initialData} />
    </ToastProvider>,
  );
}

function mockFetchSequence(...responses: Array<PublicCheckoutData | Error>) {
  const fetchMock = vi.fn();

  for (const response of responses) {
    if (response instanceof Error) {
      fetchMock.mockImplementationOnce(() => Promise.reject(response));
    } else {
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          json: () => Promise.resolve(response),
          ok: true,
        } as Response),
      );
    }
  }

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Advances fake timers and flushes the microtask queue so any in-flight
 * mocked fetch/json promises resolve and their resulting state updates are
 * committed before assertions run. */
async function advanceAndFlush(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CustomerCheckout automatic status updates", () => {
  it("detects a pending -> paid transition from the poll and updates the UI without a manual refresh", async () => {
    const paidCheckout = buildCheckout({ status: "paid" });
    const fetchMock = mockFetchSequence(paidCheckout);
    renderCheckout(buildCheckout({ status: "waiting" }));

    expect(screen.getByText("Waiting for payment")).toBeDefined();

    await advanceAndFlush(5000);

    expect(screen.getByText("Paid")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/public/checkouts/public_token_123",
      { cache: "no-store" },
    );
  });

  it("stops polling once the checkout reaches a terminal state", async () => {
    const paidCheckout = buildCheckout({ status: "paid" });
    const fetchMock = mockFetchSequence(paidCheckout);
    renderCheckout(buildCheckout({ status: "waiting" }));

    await advanceAndFlush(5000);
    expect(screen.getByText("Paid")).toBeDefined();

    const callsAtPaid = fetchMock.mock.calls.length;

    // Several more poll intervals worth of time passing must not trigger
    // any further fetches once the checkout is paid.
    await advanceAndFlush(20_000);

    expect(fetchMock.mock.calls.length).toBe(callsAtPaid);
  });

  it("clears its interval and event listeners on unmount", async () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const fetchMock = mockFetchSequence();
    const { unmount } = renderCheckout(buildCheckout({ status: "waiting" }));

    const onlineHandlerCalls = addEventListenerSpy.mock.calls.filter(
      ([eventName]) => eventName === "online",
    );
    expect(onlineHandlerCalls.length).toBeGreaterThan(0);

    unmount();

    const removedOnlineHandlerCalls = removeEventListenerSpy.mock.calls.filter(
      ([eventName]) => eventName === "online",
    );
    expect(removedOnlineHandlerCalls.length).toBe(onlineHandlerCalls.length);

    // No poll should fire after unmount even though enough time has passed
    // for several intervals.
    await advanceAndFlush(20_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("recovers after a failed request instead of breaking the polling loop, and refreshes immediately when connectivity returns", async () => {
    const paidCheckout = buildCheckout({ status: "paid" });
    const fetchMock = mockFetchSequence(
      new Error("network request failed"),
      paidCheckout,
    );
    renderCheckout(buildCheckout({ status: "waiting" }));

    // First poll tick fails; the component must not throw or leave an
    // unhandled rejection, and must still be showing the waiting state.
    await advanceAndFlush(5000);
    expect(screen.getByText("Waiting for payment")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Simulate the browser regaining connectivity before the next
    // scheduled poll tick — this should trigger an immediate refresh
    // rather than waiting out the rest of the 5s interval.
    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText("Paid")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refreshes immediately when the tab regains visibility", async () => {
    const paidCheckout = buildCheckout({ status: "paid" });
    const fetchMock = mockFetchSequence(paidCheckout);
    renderCheckout(buildCheckout({ status: "waiting" }));

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText("Paid")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("CustomerCheckout paid-success animation", () => {
  it("plays the celebration animation once for a live pending -> paid transition", async () => {
    const paidCheckout = buildCheckout({ status: "paid" });
    mockFetchSequence(paidCheckout);
    renderCheckout(buildCheckout({ status: "waiting" }));

    await advanceAndFlush(5000);

    const badge = screen.getByRole("img", { name: "Payment successful" });
    expect(badge.querySelector(".op-success-badge")).not.toBeNull();
  });

  it("does not replay the animation on a fresh load that is already paid", () => {
    renderCheckout(buildCheckout({ status: "paid" }));

    const badge = screen.getByRole("img", { name: "Payment successful" });
    expect(badge.querySelector(".op-success-badge")).toBeNull();
  });

  it("does not show the badge at all while still waiting for payment", () => {
    renderCheckout(buildCheckout({ status: "waiting" }));

    expect(
      screen.queryByRole("img", { name: "Payment successful" }),
    ).toBeNull();
  });
});
