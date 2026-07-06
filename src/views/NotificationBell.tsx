"use client";

import { AlertTriangle, Bell, CheckCircle, Clock } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { DashboardSidebar } from "../components/layout/DashboardSidebar";
import { Button } from "../components/ui/Button";

interface Notification {
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  text: string;
  time: string;
  unread: boolean;
}

const RAW_NOTIFICATIONS: Notification[] = [
  {
    Icon: CheckCircle,
    text: "Payment received — 124.00 USDC for Order #4192.",
    time: "4 minutes ago",
    unread: true,
  },
  {
    Icon: AlertTriangle,
    text: "Webhook delivery failed (3 attempts). Next retry in 4 minutes.",
    time: "22 minutes ago",
    unread: true,
  },
  {
    Icon: Clock,
    text: "Checkout for Order #4191 is awaiting confirmation.",
    time: "1 hour ago",
    unread: false,
  },
  {
    Icon: CheckCircle,
    text: "Payment received — 312.00 USDC for Order #4183.",
    time: "Yesterday",
    unread: false,
  },
];

/** Header notification bell with unread dot + dropdown panel. */
export default function NotificationBell() {
  const [isBellOpen, setIsBellOpen] = useState(true);
  const [unreadCount, setUnreadCount] = useState(2);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground lg:flex">
      <DashboardSidebar active="dashboard" />
      <main className="flex-1 min-w-0 flex flex-col relative">
        <div className="sticky top-0 z-10 bg-background flex items-center justify-between px-8 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[7px] bg-accent flex items-center justify-center text-xs font-semibold">
              AC
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Acme Coffee Co.</span>
              <span className="text-[11px] text-foreground-lighter">
                outpay.dev/acme-coffee
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 relative">
            <button
              type="button"
              aria-label="Toggle notifications"
              onClick={() => setIsBellOpen((v) => !v)}
              className={[
                "w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer relative border hover:bg-accent bg-transparent",
                isBellOpen ? "border-border-control" : "border-transparent",
              ].join(" ")}
            >
              <Bell size={17} className="opacity-75" />
              {unreadCount > 0 && (
                <div className="absolute top-[7px] right-2 w-[7px] h-[7px] rounded-full bg-destructive border-[1.5px] border-background" />
              )}
            </button>
            <Button variant="primary" size="medium">
              Create checkout
            </Button>

            {isBellOpen && (
              <div className="absolute top-11 right-[100px] w-[340px] bg-popover border border-border rounded-xl shadow-lg z-40 overflow-hidden">
                <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
                  <div className="text-sm font-semibold">Notifications</div>
                  <button
                    type="button"
                    onClick={() => setUnreadCount(0)}
                    className="text-xs text-foreground-lighter cursor-pointer hover:text-foreground bg-transparent border-0 p-0 font-inherit"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-[360px] overflow-y-auto">
                  {RAW_NOTIFICATIONS.map((n) => (
                    <div
                      key={`${n.text}-${n.time}`}
                      className={[
                        "flex gap-2.5 px-4 py-3 border-b border-border",
                        n.unread ? "bg-foreground/[0.026]" : "bg-transparent",
                      ].join(" ")}
                    >
                      <n.Icon size={15} className="shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[12.5px] text-foreground leading-[1.45]">
                          {n.text}
                        </div>
                        <div className="text-[11px] text-foreground-lighter mt-0.5">
                          {n.time}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-8 pt-7 pb-12">
          <h1 className="heading-title m-0">Dashboard</h1>
          <p className="m-0 mt-1.5 text-xs text-foreground-lighter">
            Click the bell in the header to toggle the notifications dropdown.
          </p>
        </div>
      </main>
    </div>
  );
}
