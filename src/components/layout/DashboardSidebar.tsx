import {
  ArrowLeftRight,
  Code,
  LayoutDashboard,
  Link as LinkIcon,
  Settings,
} from "lucide-react";
import Link from "next/link";
import type React from "react";
import type { NavId } from "../../lib/nav";
import { UserAvatar } from "../ui/UserAvatar";

const ICONS: Record<
  NavId,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  dashboard: LayoutDashboard,
  checkouts: LinkIcon,
  payments: ArrowLeftRight,
  developers: Code,
  settings: Settings,
};

const ITEMS: { id: NavId; label: string; href: string }[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "checkouts", label: "Checkouts", href: "/checkouts" },
  { id: "payments", label: "Payments", href: "/payments" },
  { id: "developers", label: "Developers", href: "/developers" },
];

/**
 * Shared 224px merchant-app sidebar. Used by every dashboard/app screen
 * (Dashboard, Checkouts, Payments, Developers, Settings).
 * `active` highlights the current section; `storeName`/`logoUrl` show in the
 * store card in the footer, above the divider and the signed-in user's row.
 * `userName`/`userAvatarColor` render the user's initials avatar below it,
 * linking through to account settings.
 */
export function DashboardSidebar({
  active,
  logoUrl,
  storeName = "Acme Coffee Co.",
  userAvatarColor,
  userName,
}: {
  active: NavId;
  logoUrl?: string | null;
  storeName?: string;
  userAvatarColor?: string | null;
  userName?: string | null;
}) {
  return (
    <aside className="w-full shrink-0 border-b border-border p-3 lg:sticky lg:top-0 lg:h-screen lg:w-56 lg:border-r lg:border-b-0 lg:flex lg:flex-col">
      <Link
        href="/dashboard"
        className="mb-3 flex items-center gap-2 px-2 py-1 text-foreground no-underline lg:mb-6"
      >
        <img
          src="/logo/light-32.png"
          alt=""
          width={24}
          height={24}
          className="h-6 w-6 shrink-0"
        />
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
          Outpay
        </span>
      </Link>
      <nav className="flex gap-0.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {ITEMS.map((item) => {
          const Icon = ICONS[item.id];
          const isActive = item.id === active;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={[
                "flex shrink-0 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-body no-underline",
                isActive
                  ? "bg-accent text-foreground"
                  : "text-foreground-light hover:bg-accent/60",
              ].join(" ")}
            >
              <Icon
                size={16}
                className={isActive ? "opacity-90" : "opacity-60"}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto">
        <div className="mb-3 flex items-center gap-2.5 rounded-md border border-border bg-accent/40 px-2.5 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-accent text-xs font-semibold text-foreground">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              storeName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <div className="heading-meta text-foreground-lighter">Store</div>
            <div className="truncate text-sm font-body text-foreground">
              {storeName}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 border-t border-border pt-3.5">
          <Link
            href="/settings"
            className="flex min-w-0 flex-1 items-center gap-2.5 no-underline"
          >
            <UserAvatar
              color={userAvatarColor}
              label={userName || storeName}
              size={28}
            />
            <span className="text-sm font-body text-foreground-light truncate">
              {userName || "Your account"}
            </span>
          </Link>
          <Link
            href="/settings"
            aria-label="Settings"
            className="shrink-0 rounded-md p-1.5 text-foreground-light hover:bg-accent/60 no-underline"
          >
            <Settings size={16} className="opacity-60" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
