/**
 * ConversationItem — single row in the conversation list.
 * Shows contact name, preview, time, unread badge.
 * Spec: MOD_17 Section 11.2
 */

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ConversationView } from "../domain/types";

interface ConversationItemProps {
  conversation: ConversationView;
  isActive: boolean;
  onClick: () => void;
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

export function ConversationItem({ conversation: conv, isActive, onClick }: ConversationItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 px-3 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0",
        isActive && "bg-green-50 hover:bg-green-50 border-l-2 border-l-green-500"
      )}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold text-sm">
        {conv.contact.displayName.charAt(0).toUpperCase()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={cn("text-sm font-medium truncate", conv.unreadCount > 0 && "font-semibold")}>
            {conv.contact.displayName}
          </p>
          <span className="text-xs text-gray-400 flex-shrink-0">
            {formatTime(conv.lastMessageAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={cn(
            "text-xs truncate",
            conv.unreadCount > 0 ? "text-gray-800 font-medium" : "text-gray-400"
          )}>
            {conv.lastMessagePreview ?? conv.remotePhone}
          </p>
          {conv.unreadCount > 0 && (
            <Badge className="flex-shrink-0 h-5 min-w-[1.25rem] bg-green-500 text-white text-xs px-1.5 rounded-full">
              {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
            </Badge>
          )}
        </div>
        {!conv.replyWindowOpen && (
          <p className="text-xs text-amber-600 mt-0.5">Fenster abgelaufen</p>
        )}
      </div>
    </button>
  );
}
