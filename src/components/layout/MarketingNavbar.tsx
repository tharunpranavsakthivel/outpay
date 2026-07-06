"use client";

import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  History,
  LayoutDashboard,
  Link2,
  type LucideIcon,
  Menu,
  Radar,
  Rocket,
  ShieldCheck,
  Webhook,
  X,
} from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useState } from "react";
import { Button } from "../ui/Button";

const PRODUCT_ITEMS = [
  {
    Icon: Link2,
    title: "Checkout Links",
    desc: "Shareable payment pages you can send for any order.",
    href: "/product/checkout-links",
  },
  {
    Icon: LayoutDashboard,
    title: "Merchant Dashboard",
    desc: "Track payments, webhooks, and payouts in one place.",
    href: "/product/merchant-dashboard",
  },
  {
    Icon: Webhook,
    title: "Signed Webhooks",
    desc: "Get notified the moment a payment confirms on-chain.",
    href: "/product/signed-webhooks",
  },
  {
    Icon: Radar,
    title: "Payment Detection",
    desc: "Automatic on-chain verification, no manual polling.",
    href: "/product/payment-detection",
  },
];

const DEV_ITEMS = [
  {
    Icon: BookOpen,
    title: "API Reference",
    desc: "Endpoints for checkout sessions, orders, and stores.",
    href: "/developers/api-reference",
  },
  {
    Icon: Webhook,
    title: "Webhooks Guide",
    desc: "Verify signatures and handle payment events safely.",
    href: "/developers/webhooks",
  },
  {
    Icon: Rocket,
    title: "Quickstart",
    desc: "Accept your first USDC payment in minutes.",
    href: "/developers/quickstart",
  },
  {
    Icon: History,
    title: "Changelog",
    desc: "See what shipped recently on Outpay.",
    href: "/changelog",
  },
];

const TOP_LINKS = [
  { label: "Pricing", href: "/pricing" },
  { label: "Company", href: "/company" },
];

type MegaMenuItem = {
  Icon: LucideIcon;
  title: string;
  desc: string;
  href: string;
};

/**
 * Shared mega-menu item. It keeps icon, title, and supporting text aligned so
 * both dropdowns read as one system while still allowing different layouts.
 */
function MegaMenuItemLink({ item }: { item: MegaMenuItem }) {
  return (
    <Link
      href={item.href}
      className="group flex items-start gap-3 rounded-lg border border-transparent p-3.5 no-underline transition-all duration-200 hover:border-border hover:bg-accent"
    >
      <div className="w-9 h-9 shrink-0 rounded-lg bg-background-surface-200 border border-border flex items-center justify-center text-foreground transition-colors group-hover:bg-background">
        <item.Icon size={17} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          {item.title}
          <ArrowUpRight
            size={13}
            className="opacity-0 transition-opacity group-hover:opacity-70"
          />
        </div>
        <div className="mt-1 text-xs text-foreground-light leading-[1.5]">
          {item.desc}
        </div>
      </div>
    </Link>
  );
}

/**
 * Floating mega-menu shell. It anchors the dropdown below the navbar without
 * changing page layout height, matching a premium provider navigation pattern.
 */
function MegaMenuShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute left-1/2 top-full z-30 w-[calc(100vw-48px)] max-w-content -translate-x-1/2 pt-3">
      <div className="op-mega-menu overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
        {children}
      </div>
    </div>
  );
}

/** Product dropdown content with a compact feature grid and checkout preview. */
function ProductMegaMenu() {
  return (
    <MegaMenuShell>
      <div className="grid grid-cols-[1.08fr_0.92fr] gap-0">
        <div className="p-5">
          <div className="heading-meta text-foreground-lighter mb-3">
            Product platform
          </div>
          <div className="grid grid-cols-2 gap-1">
            {PRODUCT_ITEMS.map((item) => (
              <MegaMenuItemLink key={item.title} item={item} />
            ))}
          </div>
        </div>
        <div className="border-l border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="heading-meta text-foreground-lighter mb-1">
                Payment flow
              </div>
              <div className="text-sm font-semibold text-foreground">
                Checkout to confirmed order
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
              <ShieldCheck size={17} />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            {[
              "Hosted checkout",
              "USDC transfer detected",
              "Signed webhook sent",
            ].map((step, index) => (
              <div key={step} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-accent border border-border flex items-center justify-center text-[11px] text-foreground">
                    {index + 1}
                  </div>
                  {index < 2 && <div className="w-px h-7 bg-border my-1" />}
                </div>
                <div className="pt-1 text-sm text-foreground">{step}</div>
              </div>
            ))}
          </div>
          <Link
            href="/product"
            className="mt-4 flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3 no-underline text-sm font-medium text-foreground hover:bg-accent"
          >
            Explore product
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </MegaMenuShell>
  );
}

/** Developer dropdown content with documentation routes and API preview. */
function DevelopersMegaMenu() {
  return (
    <MegaMenuShell>
      <div className="grid grid-cols-[0.92fr_1.08fr] gap-0">
        <div className="p-5">
          <div className="heading-meta text-foreground-lighter mb-3">
            Developer resources
          </div>
          <div className="flex flex-col gap-1">
            {DEV_ITEMS.map((item) => (
              <MegaMenuItemLink key={item.title} item={item} />
            ))}
          </div>
        </div>
        <div className="border-l border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="heading-meta text-foreground-lighter mb-1">
                API preview
              </div>
              <div className="text-sm font-semibold text-foreground">
                Create checkout session
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-foreground-light">
              <Check size={13} />
              Server-side
            </div>
          </div>
          <pre className="m-0 rounded-lg border border-border bg-background-surface-200 p-4 font-mono text-[11px] leading-[1.75] text-foreground whitespace-pre-wrap break-all">{`curl -X POST https://api.outpay.dev/v1/checkouts \\
  -H "Authorization: Bearer OUTPAY_SECRET_KEY" \\
  -d amount=124.00 \\
  -d currency=USDC`}</pre>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link
              href="/developers/quickstart"
              className="rounded-lg border border-border bg-background px-4 py-3 no-underline text-sm font-medium text-foreground hover:bg-accent"
            >
              Quickstart
            </Link>
            <Link
              href="/developers/api-reference"
              className="rounded-lg border border-border bg-background px-4 py-3 no-underline text-sm font-medium text-foreground hover:bg-accent"
            >
              API reference
            </Link>
          </div>
        </div>
      </div>
    </MegaMenuShell>
  );
}

/**
 * Shared marketing navbar with hover mega-menus for Product / Developers.
 * Used on Home, Pricing, Product (sticky, inside a max-w-content wrapper on
 * the page itself). See screens/MarketingNavbarShowcase.tsx for the full
 * interactive + reference-frame specimen this was extracted from.
 */
export function MarketingNavbar({ activeHref }: { activeHref?: string }) {
  const [openMenu, setOpenMenu] = useState<"product" | "developers" | null>(
    null,
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav
      aria-label="Marketing"
      className="relative border-b border-border bg-background"
      onMouseLeave={() => setOpenMenu(null)}
    >
      <div className="max-w-content mx-auto flex flex-col">
        <div className="flex items-center justify-between min-h-16 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-10">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-foreground no-underline"
            >
              <img
                src="/logo/light-32.png"
                alt=""
                width={24}
                height={24}
                className="h-6 w-6 shrink-0"
              />
              Outpay
            </Link>
            <div className="hidden items-center gap-7 lg:flex">
              <button
                type="button"
                onMouseEnter={() => setOpenMenu("product")}
                onFocus={() => setOpenMenu("product")}
                aria-expanded={openMenu === "product"}
                aria-haspopup="true"
                className={[
                  "h-8 flex items-center gap-1 rounded-sm text-sm cursor-pointer bg-transparent border-0 px-1.5 font-inherit transition-colors hover:text-foreground focus-visible:shadow-focus-ring",
                  openMenu === "product"
                    ? "text-foreground font-medium"
                    : "text-foreground-light font-body",
                ].join(" ")}
              >
                Product
                <ChevronDown
                  size={14}
                  className={[
                    "opacity-60 transition-transform",
                    openMenu === "product" ? "rotate-180" : "",
                  ].join(" ")}
                />
              </button>
              <button
                type="button"
                onMouseEnter={() => setOpenMenu("developers")}
                onFocus={() => setOpenMenu("developers")}
                aria-expanded={openMenu === "developers"}
                aria-haspopup="true"
                className={[
                  "h-8 flex items-center gap-1 rounded-sm text-sm cursor-pointer bg-transparent border-0 px-1.5 font-inherit transition-colors hover:text-foreground focus-visible:shadow-focus-ring",
                  openMenu === "developers"
                    ? "text-foreground font-medium"
                    : "text-foreground-light font-body",
                ].join(" ")}
              >
                Developers
                <ChevronDown
                  size={14}
                  className={[
                    "opacity-60 transition-transform",
                    openMenu === "developers" ? "rotate-180" : "",
                  ].join(" ")}
                />
              </button>
              {TOP_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onMouseEnter={() => setOpenMenu(null)}
                  className={[
                    "h-8 inline-flex items-center rounded-sm px-1.5 text-sm font-body no-underline cursor-pointer hover:text-foreground focus-visible:shadow-focus-ring",
                    activeHref === link.href
                      ? "text-foreground font-medium"
                      : "text-foreground-light",
                  ].join(" ")}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="hidden items-center gap-5 lg:flex">
            <Link
              href="/company/contact"
              className="text-sm font-body text-foreground-light no-underline cursor-pointer hover:text-foreground"
            >
              Contact sales
            </Link>
            <Button variant="primary" size="small">
              Start building
            </Button>
          </div>
          <button
            type="button"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            onClick={() => {
              setMobileMenuOpen((value) => !value);
              setOpenMenu(null);
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border bg-background text-foreground lg:hidden"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {openMenu === "product" && <ProductMegaMenu />}

        {openMenu === "developers" && <DevelopersMegaMenu />}

        {mobileMenuOpen && (
          <div className="border-t border-border px-4 py-4 lg:hidden">
            <div className="grid gap-5">
              <div>
                <div className="heading-meta mb-2 text-foreground-lighter">
                  Product
                </div>
                <div className="grid gap-1">
                  {[
                    { title: "Overview", href: "/product" },
                    ...PRODUCT_ITEMS,
                  ].map((item) => (
                    <Link
                      key={item.title}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground no-underline hover:bg-accent"
                    >
                      {item.title}
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <div className="heading-meta mb-2 text-foreground-lighter">
                  Developers
                </div>
                <div className="grid gap-1">
                  {[
                    { title: "Overview", href: "/developers" },
                    ...DEV_ITEMS,
                  ].map((item) => (
                    <Link
                      key={item.title}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground no-underline hover:bg-accent"
                    >
                      {item.title}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="grid gap-1 border-t border-border pt-3">
                {[
                  ...TOP_LINKS,
                  { label: "Contact sales", href: "/company/contact" },
                ].map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={[
                      "rounded-lg px-3 py-2.5 text-sm font-medium no-underline hover:bg-accent",
                      activeHref === link.href
                        ? "text-foreground"
                        : "text-foreground-light",
                    ].join(" ")}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              <Button variant="primary" size="medium" block>
                Start building
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
