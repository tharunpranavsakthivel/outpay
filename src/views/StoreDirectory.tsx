/**
 * Public store-directory view with client-side search over the server-loaded
 * directory-safe store records.
 */

"use client";

import { Search, ShieldCheck, Store as StoreIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { MarketingFooter } from "../components/layout/MarketingFooter";
import { MarketingNavbar } from "../components/layout/MarketingNavbar";
import { StatusPill } from "../components/ui/StatusPill";
import type { PublicStore } from "../lib/dashboard/types";

/**
 * Renders the public store directory.
 *
 * Parameters:
 * - initialStores: Active, opted-in stores loaded by the server page.
 *
 * Returns:
 * - Directory page content with an accessible search control and store links.
 */
export default function StoreDirectory({
  initialStores,
}: {
  initialStores: PublicStore[];
}) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const visibleStores = useMemo(
    () =>
      initialStores.filter((store) => {
        if (!normalizedSearch) return true;

        return [
          store.displayName,
          store.publicSlug,
          store.directorySummary ?? "",
        ].some((value) => value.toLowerCase().includes(normalizedSearch));
      }),
    [initialStores, normalizedSearch],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingNavbar activeHref="/stores" />
      <main>
        <section className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-16 sm:px-6 lg:py-24">
            <div className="max-w-2xl">
              <div className="heading-meta text-foreground-lighter">
                Outpay directory
              </div>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl">
                Discover stores accepting USDC.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-foreground-light">
                Browse independent stores that use Outpay for direct,
                non-custodial checkout on Base.
              </p>
            </div>
            <label className="relative block max-w-xl" htmlFor="store-search">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-lighter"
                size={17}
              />
              <input
                id="store-search"
                className="h-12 w-full rounded-lg border border-border-control bg-background pl-10 pr-4 text-sm text-foreground outline-none transition-shadow focus:shadow-focus-ring"
                placeholder="Search stores"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="mx-auto max-w-content px-4 py-12 sm:px-6 lg:py-16">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="heading-meta text-foreground-lighter">
                Featured stores
              </h2>
              <p className="mt-2 text-sm text-foreground-light">
                {visibleStores.length}{" "}
                {visibleStores.length === 1 ? "store" : "stores"} found
              </p>
            </div>
          </div>

          {visibleStores.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visibleStores.map((store) => (
                <Link
                  key={store.publicSlug}
                  href={`/stores/${encodeURIComponent(store.publicSlug)}`}
                  className="group flex min-h-[220px] flex-col rounded-xl border border-border bg-card p-5 no-underline transition-colors hover:border-border-strong hover:bg-accent"
                >
                  <div className="flex items-start justify-between gap-4">
                    {store.logoUrl ? (
                      <img
                        src={store.logoUrl}
                        alt={`${store.displayName} logo`}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-xl border border-border object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-background-surface-200 text-foreground-lighter">
                        <StoreIcon aria-hidden="true" size={21} />
                      </div>
                    )}
                    {store.isVerified && (
                      <StatusPill variant="success">
                        <ShieldCheck aria-hidden="true" size={11} /> Verified
                      </StatusPill>
                    )}
                  </div>
                  <div className="mt-6">
                    <h2 className="m-0 text-lg font-semibold text-foreground group-hover:text-primary">
                      {store.displayName}
                    </h2>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-foreground-light">
                      {store.directorySummary ||
                        "A store accepting USDC through Outpay."}
                    </p>
                  </div>
                  <div className="mt-auto pt-5 text-xs font-medium text-foreground-lighter">
                    View store profile →
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border-strong bg-card px-6 py-16 text-center">
              <StoreIcon
                aria-hidden="true"
                className="mx-auto text-foreground-lighter"
                size={28}
              />
              <h2 className="mt-4 text-lg font-semibold text-foreground">
                No stores found
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-foreground-light">
                Try a different search, or check back soon as more merchants
                join the directory.
              </p>
            </div>
          )}
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
