"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Toast — lightweight notification system matching the Outpay design
 * system's card/pill styling. No external dependency: the codebase's other
 * UI primitives (Button, StatusPill, Card) are all hand-built, so this
 * follows the same convention instead of pulling in a toast library.
 */
export type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  variant: ToastVariant;
  title: string;
  description?: string;
}

export interface ToastApi {
  (title: string, description?: string): void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const VARIANT_ICON: Record<ToastVariant, typeof CheckCircle2> = {
  error: XCircle,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
};

const VARIANT_ICON_CLASSES: Record<ToastVariant, string> = {
  error: "text-destructive",
  info: "text-foreground-light",
  success: "text-primary",
  warning: "text-warning",
};

const TOAST_DURATION_MS = 4500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, title: string, description?: string) => {
      const id = idRef.current++;
      setToasts((current) => [...current, { description, id, title, variant }]);
      window.setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    },
    [dismiss],
  );

  const toast = useMemo(() => {
    const base = ((title: string, description?: string) =>
      push("info", title, description)) as ToastApi;
    base.success = (title, description) => push("success", title, description);
    base.error = (title, description) => push("error", title, description);
    base.warning = (title, description) => push("warning", title, description);
    base.info = (title, description) => push("info", title, description);
    return base;
  }, [push]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[100] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2"
      >
        {toasts.map((item) => {
          const Icon = VARIANT_ICON[item.variant];
          return (
            <output
              key={item.id}
              className="flex items-start gap-2.5 rounded-lg border border-border bg-card px-3.5 py-3 shadow-lg animate-[op-modal-in_0.18s_ease-out]"
            >
              <Icon
                size={17}
                className={[
                  "shrink-0 mt-0.5",
                  VARIANT_ICON_CLASSES[item.variant],
                ].join(" ")}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">
                  {item.title}
                </div>
                {item.description && (
                  <div className="mt-0.5 text-xs leading-[1.5] text-foreground-lighter">
                    {item.description}
                  </div>
                )}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismiss(item.id)}
                className="shrink-0 cursor-pointer border-0 bg-transparent p-0.5 text-foreground-lighter hover:text-foreground"
              >
                <X size={14} />
              </button>
            </output>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return context;
}
