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
  { id: "settings", label: "Settings", href: "/settings" },
];

/**
 * Shared 224px merchant-app sidebar. Used by every dashboard/app screen
 * (Dashboard, Checkouts, Payments, Developers, Settings).
 * `active` highlights the current section; `storeName` shows in the footer.
 */
export function DashboardSidebar({
  active,
  storeName = "Acme Coffee Co.",
}: {
  active: NavId;
  storeName?: string;
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
      <div className="mt-auto hidden border-t border-border pt-3.5 lg:block">
        <div className="heading-meta text-foreground-lighter mb-1">Store</div>
        <div className="text-sm font-body text-foreground-light">
          {storeName}
        </div>
      </div>
    </aside>
  );
}
