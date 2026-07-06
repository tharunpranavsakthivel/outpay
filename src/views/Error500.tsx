"use client";

import { ServerCrash } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/ui/Button";

/** Generic 500 error page. */
export default function Error500() {
  const [retrying, setRetrying] = useState(false);
  const [errorRef] = useState(() => Math.random().toString(36).slice(2, 8));

  const handleRetry = () => {
    setRetrying(true);
    setTimeout(() => setRetrying(false), 1200);
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground flex flex-col items-center justify-center px-5 py-16 gap-5 text-center">
      <div className="text-[15px] font-semibold tracking-[-0.01em] mb-2">
        Outpay
      </div>
      <div className="w-[52px] h-[52px] rounded-2xl bg-accent flex items-center justify-center">
        <ServerCrash size={24} className="opacity-70" />
      </div>
      <div className="flex flex-col gap-2 max-w-[420px]">
        <div className="text-xl font-semibold tracking-[-0.01em]">
          Something went wrong on our end
        </div>
        <div className="text-sm text-foreground-lighter leading-[1.6]">
          We hit an unexpected error loading this page. Nothing was lost — your
          store, payments, and settings are unaffected.
        </div>
      </div>
      <div className="flex items-center gap-2.5 mt-2">
        <Button variant="primary" size="medium" onClick={handleRetry}>
          {retrying ? "Retrying…" : "Try again"}
        </Button>
        <Button variant="outline" size="medium">
          Back to dashboard
        </Button>
      </div>
      <div className="text-[11px] font-mono text-foreground-lighter mt-5">
        Error reference: 500-{errorRef}
      </div>
    </div>
  );
}
