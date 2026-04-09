"use client";

/**
 * Unified Inbox — Zwei-Panel WhatsApp-Chat-Interface.
 * Desktop: Konversationsliste links + Chat rechts.
 * Mobile: Liste und Chat als separate Views.
 * Spec: MOD_17 Section 11
 */

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { ConversationList } from "@/modules/whatsapp/components/conversation-list";
import { ChatWindow } from "@/modules/whatsapp/components/chat-window";
import type { ConversationView } from "@/modules/whatsapp/domain/types";

export default function NachrichtenPage() {
  const [activeConversation, setActiveConversation] = useState<ConversationView | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  function handleSelectConversation(conv: ConversationView) {
    setActiveConversation(conv);
    setMobileView("chat");
  }

  function handleArchived() {
    setActiveConversation(null);
    setMobileView("list");
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left panel: Conversation list */}
      <div className={`
        flex-shrink-0 w-full md:w-80 lg:w-96 border-r
        ${mobileView === "chat" ? "hidden md:flex flex-col" : "flex flex-col"}
      `}>
        <div className="px-4 py-3 border-b bg-white flex-shrink-0">
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-green-500" />
            Nachrichten
          </h1>
        </div>
        <ConversationList
          activeConversationId={activeConversation?.id ?? null}
          onSelect={handleSelectConversation}
        />
      </div>

      {/* Right panel: Chat window */}
      <div className={`
        flex-1 flex flex-col
        ${mobileView === "list" ? "hidden md:flex" : "flex"}
      `}>
        {activeConversation ? (
          <ChatWindow
            conversation={activeConversation}
            onArchive={handleArchived}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Konversation auswählen</p>
          </div>
        )}
      </div>
    </div>
  );
}
