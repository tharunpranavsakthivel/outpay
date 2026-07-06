"use client";

import { ChevronRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { MarketingNavbar } from "../components/layout/MarketingNavbar";
import { Button } from "../components/ui/Button";

/**
 * Reference sheet for the marketing navbar component: the interactive
 * desktop navbar (see components/layout/MarketingNavbar.tsx — hover
 * Product/Developers to open its mega menus) plus the mobile nav treatment,
 * which is unique to small screens and not part of the shared component.
 */
export default function MarketingNavbarShowcase() {
  const [mobileOpen, setMobileOpen] = useState(true);

  const mobileLinks = [
    { label: "Product", hasChevron: true },
    { label: "Developers", hasChevron: true },
    { label: "Pricing", hasChevron: false },
    { label: "Company", hasChevron: false },
  ];

  return (
    <div className="bg-background min-h-screen px-6 py-14 flex flex-col items-center gap-14 font-sans">
      <div className="w-full max-w-content flex flex-col gap-1">
        <div className="heading-title font-semibold text-foreground">
          Marketing navbar
        </div>
        <div className="text-sm text-foreground-light">
          Hover Product or Developers on the live component below to open the
          mega menus.
        </div>
      </div>

      <div className="w-full max-w-content flex flex-col gap-3">
        <div className="heading-meta text-foreground-lighter">
          Live component
        </div>
        <div className="w-full border border-border rounded-xl overflow-hidden shadow-xs bg-background">
          <MarketingNavbar />
        </div>
      </div>

      {/* Mobile nav — unique small-screen treatment (hamburger → full menu) */}
      <div className="w-full max-w-content flex flex-col gap-3 items-center">
        <div className="heading-meta text-foreground-lighter w-full max-w-[390px]">
          Mobile — {mobileOpen ? "menu open" : "at rest"}
        </div>
        <div className="w-[390px] border border-border rounded-2xl overflow-hidden shadow-xs bg-background">
          <div className="flex items-center justify-between h-[60px] px-5 border-b border-border">
            <div className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
              Outpay
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="w-[34px] h-[34px] flex items-center justify-center rounded-md cursor-pointer border-0 bg-transparent hover:bg-accent"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
          {mobileOpen && (
            <div className="flex flex-col p-2">
              {mobileLinks.map((link) => (
                <div
                  key={link.label}
                  className="flex items-center justify-between px-3 py-4 rounded-lg cursor-pointer text-[15px] font-body text-foreground hover:bg-accent"
                >
                  {link.label}
                  {link.hasChevron && (
                    <ChevronRight size={16} className="opacity-50" />
                  )}
                </div>
              ))}
              <div className="h-px bg-border my-3 mx-1" />
              <div className="flex flex-col gap-3 px-3 pb-3 pt-1">
                <div className="text-[15px] font-body text-foreground">
                  Log in
                </div>
                <Button variant="primary" size="medium" block>
                  Sign up
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
