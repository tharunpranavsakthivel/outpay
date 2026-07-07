"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { AVATAR_COLOR_PALETTE, UserAvatar } from "@/components/ui/UserAvatar";

/**
 * Palette swatch picker for the signed-in user's initials avatar. Saves
 * immediately on click via `/api/settings/account-avatar-color`, no separate
 * "Save" step.
 */
export function AvatarColorPicker({
  fallbackLabel,
  initialColor,
}: {
  fallbackLabel: string;
  initialColor: string | null;
}) {
  const [color, setColor] = useState(initialColor);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  async function selectColor(nextColor: string) {
    if (nextColor === color || isSaving) {
      return;
    }

    const previousColor = color;
    setColor(nextColor);
    setErrorMessage(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/settings/account-avatar-color", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarColor: nextColor }),
      });

      if (!response.ok) {
        setColor(previousColor);
        setErrorMessage("Unable to save avatar color.");
        toast.error("Unable to save avatar color.");
        return;
      }

      toast.success("Avatar color updated.");
    } catch {
      setColor(previousColor);
      setErrorMessage("Unable to save avatar color.");
      toast.error("Unable to save avatar color.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-3.5">
      <UserAvatar color={color} label={fallbackLabel} size={56} />
      <div>
        <div className="flex gap-1.5">
          {AVATAR_COLOR_PALETTE.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={`Use ${swatch} avatar color`}
              disabled={isSaving}
              onClick={() => selectColor(swatch)}
              className={[
                "h-6 w-6 rounded-full border-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                color === swatch ? "border-foreground" : "border-transparent",
              ].join(" ")}
              style={{ backgroundColor: swatch }}
            />
          ))}
        </div>
        <div className="text-[11px] text-foreground-lighter mt-1.5">
          Avatar background color.
        </div>
        {errorMessage && (
          <div className="text-[11px] text-destructive mt-1">
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}
