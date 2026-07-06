import type React from "react";
import { useState } from "react";

/** Tabs — bottom-border list, active tab gets a 2px foreground underline. */
export interface TabDef {
  value: string;
  label: string;
}

export interface TabsProps {
  tabs: TabDef[];
  value?: string;
  onChange?: (value: string) => void;
  children: (active: string) => React.ReactNode;
}

export function Tabs({ tabs, value, onChange, children }: TabsProps) {
  const [internal, setInternal] = useState(tabs[0]?.value);
  const active = value ?? internal;
  const setActive = onChange ?? setInternal;
  return (
    <div className="font-sans">
      <div className="flex items-center gap-5 border-b border-border">
        {tabs.map((t) => (
          <button
            type="button"
            key={t.value}
            onClick={() => setActive(t.value)}
            className={[
              "bg-transparent border-0 py-2 px-0.5 text-sm cursor-pointer font-inherit border-b-2 -mb-px",
              active === t.value
                ? "border-foreground text-foreground"
                : "border-transparent text-foreground-lighter",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-4">{children(active)}</div>
    </div>
  );
}
