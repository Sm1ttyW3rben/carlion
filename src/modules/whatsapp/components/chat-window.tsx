"use client";

/**
 * ChatWindow — message list + input for a single WhatsApp conversation.
 * Realtime updates via Supabase Realtime on whatsapp_messages.
 * Spec: MOD_17 Section 11.2
 */

import { useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { User, ChevronDown, Archive } from "lucide-react";
import { api } from "@/shared/lib/trpc/client";
import { MessageBubble } from "./message-bubble";
import { MessageInput } from "./message-input";
import { ReplyWindowBanner } from "./reply-window-banner";
import type { ConversationView } from "../domain/types";

interface ChatWindowProps {
  conversation: ConversationView;
  onArchive?: () => void;
}

export function ChatWindow({ conversation, onArchive }: ChatWindowProps) {
  const utils = api.useUtils();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.whatsapp.getMessages.useInfiniteQuery(
      { conversationId: conversation.id, limit: 50 },
      { getNextPageParam: (p) => p.nextCursor }
    );

  const sendMutation = api.whatsapp.sendMessage.useMutation({
    onSuccess: () => {
      void utils.whatsapp.getMessages.invalidate({ conversationId: conversation.id });
      void utils.whatsapp.listConversations.invalidate();
    },
  });

  const retryMutation = api.whatsapp.retryMessage.useMutation({
    onSuccess: () => void utils.whatsapp.getMessages.invalidate({ conversationId: conversation.id }),
  });

  const markReadMutation = api.whatsapp.markAsRead.useMutation({
    onSuccess: () => void utils.whatsapp.listConversations.invalidate(),
  });

  const archiveMutation = api.whatsapp.archiveConversation.useMutation({
    onSuccess: () => {
      void utils.whatsapp.listConversations.invalidate();
      onArchive?.();
    },
  });

  // Mark as read when conversation opens
  useEffect(() => {
    if (conversation.unreadCount > 0) {
      markReadMutation.mutate({ conversationId: conversation.id });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.pages]);

  // Messages are returned newest-first per page; reverse for display (oldest at top)
  const allMessages = (data?.pages ?? [])
    .flatMap((p) => p.items)
    .reverse();

  const handleSend = useCallback(async (body: string) => {
    await sendMutation.mutateAsync({ conversationId: conversation.id, body });
  }, [conversation.id, sendMutation]);

  const handleRetry = useCallback((messageId: string) => {
    retryMutation.mutate({ messageId });
  }, [retryMutation]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold text-sm flex-shrink-0">
            {conversation.contact.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">{conversation.contact.displayName}</p>
            <p className="text-xs text-gray-400">{conversation.remotePhone}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Link href={`/kontakte/${conversation.contact.id}`} target="_blank">
            <Button variant="ghost" size="sm" title="CRM-Kontakt öffnen">
              <User className="w-4 h-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            title="Konversation archivieren"
            onClick={() => archiveMutation.mutate({ conversationId: conversation.id })}
            disabled={archiveMutation.isPending}
          >
            <Archive className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 bg-gray-50">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className={`h-12 w-2/3 ${i % 2 === 0 ? "" : "ml-auto"}`} />
            ))}
          </div>
        ) : (
          <>
            {hasNextPage && (
              <div className="text-center mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  <ChevronDown className="w-3 h-3 mr-1" />
                  Ältere Nachrichten laden
                </Button>
              </div>
            )}

            {allMessages.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">Noch keine Nachrichten.</p>
            )}

            {allMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onRetry={handleRetry}
              />
            ))}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Reply window warning */}
      <ReplyWindowBanner expiresAt={conversation.replyWindowExpires} />

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        disabled={!conversation.replyWindowOpen}
      />
    </div>
  );
}
