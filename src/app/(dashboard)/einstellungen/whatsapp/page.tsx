"use client";

/**
 * WhatsApp-Einstellungen — Verbindung einrichten + Statistiken.
 * Spec: MOD_17 Section 11
 */

import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare } from "lucide-react";
import { api } from "@/shared/lib/trpc/client";
import { ConnectionSetup } from "@/modules/whatsapp/components/connection-setup";

export default function WhatsAppSettingsPage() {
  const { data: stats, isLoading: statsLoading } = api.whatsapp.getStats.useQuery();

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-green-500" />
          WhatsApp Business
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          360dialog-Verbindung für die Unified Inbox einrichten
        </p>
      </div>

      {/* Stats */}
      {(stats || statsLoading) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Konversationen", value: stats?.totalConversations },
            { label: "Ungelesen", value: stats?.unreadConversations },
            { label: "Heute", value: stats?.messagesToday },
            { label: "Diese Woche", value: stats?.messagesThisWeek },
          ].map(({ label, value }) => (
            <div key={label} className="border rounded-lg p-3 bg-white text-center">
              {statsLoading ? (
                <Skeleton className="h-6 w-10 mx-auto mb-1" />
              ) : (
                <p className="text-2xl font-bold text-gray-900">{value ?? 0}</p>
              )}
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Connection */}
      <ConnectionSetup />
    </div>
  );
}
