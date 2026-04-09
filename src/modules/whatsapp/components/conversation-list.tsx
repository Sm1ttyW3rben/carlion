"use client";

/**
 * ConversationList — filterable, searchable list of WhatsApp conversations.
 * Spec: MOD_17 Section 11.2
 */

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { api } from "@/shared/lib/trpc/client";
import { ConversationItem } from "./conversation-item";
import type { ConversationView } from "../domain/types";

interface ConversationListProps {
  activeConversationId: string | null;
  onSelect: (conv: ConversationView) => void;
}

type FilterMode = "all" | "unread" | "archived";

export function ConversationList({ activeConversationId, onSelect }: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.whatsapp.listConversations.useInfiniteQuery(
      {
        limit: 30,
        status: filter === "archived" ? "archived" : "active",
        unreadOnly: filter === "unread",
        search: search || undefined,
      },
      { getNextPageParam: (p) => p.nextCursor }
    );

  const conversations = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col h-full border-r bg-white">
      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suchen…"
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-3 py-2 border-b">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterMode)}>
          <TabsList className="h-8 w-full">
            <TabsTrigger value="all" className="flex-1 text-xs">Alle</TabsTrigger>
            <TabsTrigger value="unread" className="flex-1 text-xs">Ungelesen</TabsTrigger>
            <TabsTrigger value="archived" className="flex-1 text-xs">Archiv</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-0 divide-y divide-gray-100">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-3 p-3">
                <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            <p>Keine Konversationen.</p>
          </div>
        ) : (
          <>
            {conversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
                onClick={() => onSelect(conv)}
              />
            ))}
            {hasNextPage && (
              <div className="p-3 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  Mehr laden
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
