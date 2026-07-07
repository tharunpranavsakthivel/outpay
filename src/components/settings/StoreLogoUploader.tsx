"use client";

import { ImagePlus } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const ACCEPTED_FILE_TYPES = "image/png,image/jpeg,image/webp,image/svg+xml";

/**
 * Store logo upload control for Settings > Store profile. Uploads
 * immediately on file select via `/api/settings/store-logo`.
 */
export function StoreLogoUploader({
  initialLogoUrl,
}: {
  initialLogoUrl: string | null;
}) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  async function handleFileSelected(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setErrorMessage(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/settings/store-logo", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as
        | { url: string }
        | { error?: { message?: string } };

      if (!response.ok || !("url" in payload)) {
        const message =
          "error" in payload && payload.error?.message
            ? payload.error.message
            : "Unable to upload store logo.";
        setErrorMessage(message);
        toast.error(message);
        return;
      }

      setLogoUrl(payload.url);
      toast.success("Store logo updated.");
    } catch {
      setErrorMessage("Unable to upload store logo.");
      toast.error("Unable to upload store logo.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-3.5">
      <div className="w-14 h-14 rounded-xl bg-accent shrink-0 flex items-center justify-center overflow-hidden">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImagePlus size={18} className="opacity-50" />
        )}
      </div>
      <div>
        <Button
          variant="outline"
          size="tiny"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? "Uploading..." : "Upload logo"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          className="hidden"
          onChange={handleFileSelected}
        />
        <div className="text-[11px] text-foreground-lighter mt-1.5">
          PNG, JPEG, WebP, or SVG, up to 5MB.
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
