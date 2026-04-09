"use client";

/**
 * MessageBubble — single WhatsApp message in the chat view.
 * Inbound: left-aligned. Outbound: right-aligned.
 * Spec: MOD_17 Section 11.2
 */

import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { SendStatusIcon } from "./send-status-icon";
import { MediaPreview } from "./media-preview";
import type { MessageView } from "../domain/types";

interface MessageBubbleProps {
  message: MessageView;
  onRetry?: (messageId: string) => void;
}

export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const isOutbound = message.direction === "outbound";
  const time = new Date(message.timestamp).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const hasMedia = message.messageType !== "text" && message.messageType !== "unknown";

  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"} mb-2`}>
      <div
        className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
          isOutbound
            ? "bg-green-100 text-gray-900 rounded-tr-sm"
            : "bg-white border border-gray-200 text-gray-900 rounded-tl-sm"
        }`}
      >
        {/* Media */}
        {hasMedia && (
          <div className="mb-1">
            <MediaPreview
              url={message.mediaUrl}
              mimeType={message.mediaMimeType}
              messageType={message.messageType}
            />
          </div>
        )}

        {/* Text body */}
        {message.body && (
          <p className="whitespace-pre-wrap break-words">{message.body}</p>
        )}

        {/* Metadata row */}
        <div className={`flex items-center gap-1 mt-0.5 ${isOutbound ? "justify-end" : "justify-start"}`}>
          {isOutbound && message.sentBy && (
            <span className="text-xs text-gray-400">{message.sentBy.name}</span>
          )}
          <span className="text-xs text-gray-400">{time}</span>
          {isOutbound && <SendStatusIcon status={message.sendStatus} />}
        </div>

        {/* Failed: retry button */}
        {message.sendStatus === "failed" && onRetry && (
          <div className="mt-1.5 flex items-center gap-1">
            <span className="text-xs text-red-500">Senden fehlgeschlagen.</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-1.5 text-xs text-red-600 hover:text-red-700"
              onClick={() => onRetry(message.id)}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Erneut senden
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
