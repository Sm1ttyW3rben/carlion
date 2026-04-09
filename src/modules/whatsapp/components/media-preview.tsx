"use client";

/**
 * MediaPreview — inline image or document download link.
 * Spec: MOD_17 Section 11.2
 */

import { FileText, Download } from "lucide-react";

interface MediaPreviewProps {
  url: string | null;
  mimeType: string | null;
  messageType: string;
}

export function MediaPreview({ url, mimeType, messageType }: MediaPreviewProps) {
  if (!url) {
    return (
      <span className="text-gray-400 text-sm italic">
        [{messageType}] Medien werden geladen…
      </span>
    );
  }

  const isImage = mimeType?.startsWith("image/") ?? messageType === "image";

  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt="WhatsApp Bild"
        className="max-w-[240px] max-h-[320px] rounded-lg object-contain cursor-pointer"
        onClick={() => window.open(url, "_blank")}
      />
    );
  }

  // Document / audio / video
  const isAudio = mimeType?.startsWith("audio/") ?? messageType === "audio";
  const isVideo = mimeType?.startsWith("video/") ?? messageType === "video";

  if (isAudio) {
    return <audio controls src={url} className="max-w-[240px]" />;
  }

  if (isVideo) {
    return <video controls src={url} className="max-w-[240px] rounded-lg" />;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
    >
      <FileText className="w-4 h-4" />
      Dokument herunterladen
      <Download className="w-3.5 h-3.5" />
    </a>
  );
}
