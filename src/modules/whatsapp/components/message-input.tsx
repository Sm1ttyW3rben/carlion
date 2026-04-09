"use client";

/**
 * MessageInput — text input + send button for the chat window.
 * Disabled when 24h reply window is closed.
 * Spec: MOD_17 Section 11.2
 */

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

interface MessageInputProps {
  onSend: (body: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({ onSend, disabled, placeholder }: MessageInputProps) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSend() {
    const trimmed = body.trim();
    if (!trimmed || sending || disabled) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setBody("");
      textareaRef.current?.focus();
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="flex items-end gap-2 p-3 border-t bg-white">
      <Textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? "Antwortfenster abgelaufen" : (placeholder ?? "Nachricht schreiben… (Enter zum Senden)")}
        disabled={disabled || sending}
        rows={1}
        className="flex-1 resize-none min-h-[40px] max-h-[120px] overflow-y-auto"
      />
      <Button
        onClick={handleSend}
        disabled={!body.trim() || disabled || sending}
        size="sm"
        className="flex-shrink-0"
      >
        <Send className="w-4 h-4" />
      </Button>
    </div>
  );
}
