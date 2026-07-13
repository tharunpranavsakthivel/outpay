/**
 * Public store profile view. It renders only the directory-safe public store
 * contract and never receives support or internal merchant fields.
 */

import {
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  Store as StoreIcon,
} from "lucide-react";
import Link from "next/link";
import { MarketingFooter } from "../components/layout/MarketingFooter";
import { MarketingNavbar } from "../components/layout/MarketingNavbar";
import { StatusPill } from "../components/ui/StatusPill";
import type { PublicStore } from "../lib/dashboard/types";

/**
 * Renders a public profile for one directory-listed store.
 *
 * Parameters:
 * - store: Directory-safe public store record.
 *
 * Returns:
 * - Public store profile page content.
 */
export default function StoreProfile({ store }: { store: PublicStore }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingNavbar activeHref="/stores" />
      <main>
        <section className="border-b border-border bg-card">
          <div className="mx-auto max-w-content px-4 py-8 sm:px-6 lg:py-12">
            <Link
              href="/stores"
              className="inline-flex items-center gap-2 text-sm text-foreground-light no-underline hover:text-foreground"
            >
              <ArrowLeft aria-hidden="true" size={15} /> Back to stores
            </Link>
          </div>
        </section>
        <section className="mx-auto max-w-content px-4 py-12 sm:px-6 lg:py-20">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                {store.logoUrl ? (
                  <img
                    src={store.logoUrl}
                    alt={`${store.displayName} logo`}
                    width={72}
                    height={72}
                    className="h-[72px] w-[72px] rounded-2xl border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-border bg-card text-foreground-lighter">
                    <StoreIcon aria-hidden="true" size={28} />
                  </div>
                )}
                <div>
                  <div className="heading-meta text-foreground-lighter">
                    Store profile
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h1 className="m-0 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
                      {store.displayName}
                    </h1>
                    {store.isVerified && (
                      <StatusPill variant="success">
                        <ShieldCheck aria-hidden="true" size={11} /> Verified
                      </StatusPill>
                    )}
                  </div>
                </div>
              </div>
              <p className="mt-8 max-w-2xl text-lg leading-8 text-foreground-light">
                {store.directorySummary ||
                  "This store accepts USDC payments through Outpay."}
              </p>
            </div>
            <aside className="h-fit rounded-xl border border-border bg-card p-5">
              <div className="heading-meta text-foreground-lighter">
                Store details
              </div>
              <div className="mt-5 flex flex-col gap-4">
                {store.websiteUrl && (
                  <a
                    href={store.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 text-sm font-medium text-foreground no-underline hover:text-primary"
                  >
                    Visit website <ExternalLink aria-hidden="true" size={15} />
                  </a>
                )}
                <div className="flex items-center justify-between gap-3 text-sm text-foreground-light">
                  <span>Payment network</span>
                  <span className="font-medium text-foreground">Base</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm text-foreground-light">
                  <span>Payment asset</span>
                  <span className="font-medium text-foreground">USDC</span>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
