"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { PlatformBadge } from "./platform-badge";
import type { Platform } from "../domain/types";

interface ImportUploadResult {
  importSessionId: string;
  platform: string;
  vehicleCount: number;
  errorCount: number;
  warningCount: number;
  errors: { row: number; message: string }[];
  warnings: { row: number; message: string }[];
}

interface ImportUploadFormProps {
  platform: Platform;
  onSuccess: (result: ImportUploadResult) => void;
}

export function ImportUploadForm({ platform, onSuccess }: ImportUploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setError(null);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("platform", platform);
      formData.append("file", selectedFile);

      const res = await fetch("/api/upload/boersen-import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json() as ImportUploadResult & { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Unbekannter Fehler beim Upload.");
        return;
      }

      onSuccess(data);
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setIsUploading(false);
    }
  }

  const ACCEPT = platform === "autoscout24" ? ".csv,.xml" : ".csv";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <PlatformBadge platform={platform} />
        <span className="text-sm text-gray-600">Export-Datei importieren</span>
      </div>

      <div
        className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-gray-300 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        {selectedFile ? (
          <div className="flex items-center justify-center gap-2 text-gray-700">
            <FileText className="h-5 w-5 text-blue-600" />
            <span className="font-medium">{selectedFile.name}</span>
            <span className="text-xs text-gray-400">
              ({(selectedFile.size / 1024).toFixed(0)} KB)
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="h-8 w-8 text-gray-300 mx-auto" />
            <p className="text-sm text-gray-500">
              Klicken um {platform === "mobile_de" ? "mobile.de CSV" : "AutoScout24 CSV/XML"} zu wählen
            </p>
            <p className="text-xs text-gray-400">Maximale Dateigröße: 10 MB</p>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleFileChange}
        className="hidden"
      />

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <Button
        onClick={handleUpload}
        disabled={!selectedFile || isUploading}
        className="w-full"
      >
        {isUploading ? "Wird hochgeladen…" : "Datei verarbeiten"}
      </Button>
    </div>
  );
}
