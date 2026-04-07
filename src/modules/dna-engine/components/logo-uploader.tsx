"use client";

import { useRef, useState } from "react";

interface LogoUploaderProps {
  currentLogoUrl?: string | null;
  onUploadSuccess: (result: {
    logoFileId: string;
    faviconFileId: string;
    logoUrl: string;
    faviconUrl: string;
  }) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

export function LogoUploader({
  currentLogoUrl,
  onUploadSuccess,
  onError,
  disabled,
}: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentLogoUrl ?? null);

  async function uploadFile(file: File) {
    setIsUploading(true);

    // Client-side pre-validation
    if (file.size > 5 * 1024 * 1024) {
      onError?.("Logo ist zu groß. Maximal 5 MB erlaubt.");
      setIsUploading(false);
      return;
    }

    // Show preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    const formData = new FormData();
    formData.append("logo", file);

    try {
      const res = await fetch("/api/upload/branding-logo", {
        method: "POST",
        body: formData,
      });

      const data = await res.json() as Record<string, unknown>;

      if (!res.ok) {
        URL.revokeObjectURL(objectUrl);
        setPreview(currentLogoUrl ?? null);
        onError?.(String(data.error ?? "Upload fehlgeschlagen"));
        return;
      }

      onUploadSuccess(data as Parameters<typeof onUploadSuccess>[0]);
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      setPreview(currentLogoUrl ?? null);
      onError?.(err instanceof Error ? err.message : "Upload fehlgeschlagen");
    } finally {
      setIsUploading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void uploadFile(file);
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium text-gray-700">Logo</label>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            inputRef.current?.click();
          }
        }}
        className={[
          "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed",
          "cursor-pointer transition-colors min-h-32 p-4 text-center",
          "focus:outline-none focus:ring-2 focus:ring-blue-500",
          disabled ? "cursor-not-allowed opacity-50 bg-gray-50" : "hover:border-blue-400 hover:bg-blue-50",
          isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white",
        ].join(" ")}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Logo Vorschau"
            className="max-h-24 max-w-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span className="text-sm">
              {isUploading ? "Wird hochgeladen…" : "Logo hierher ziehen oder tippen zum Auswählen"}
            </span>
            <span className="text-xs">PNG, JPG oder WebP · max. 5 MB · min. 100×100px</span>
          </div>
        )}

        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileSelect}
        className="sr-only"
        tabIndex={-1}
      />

      {preview && !isUploading && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && inputRef.current?.click()}
          className="text-sm text-blue-600 hover:text-blue-800 underline text-left disabled:opacity-50"
        >
          Logo ersetzen
        </button>
      )}
    </div>
  );
}
