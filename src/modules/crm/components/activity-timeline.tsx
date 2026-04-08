"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/shared/lib/trpc/client";
import { ActivityItem } from "./activity-item";

export function ActivityTimeline({ contactId }: { contactId: string }) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.crm.getActivities.useInfiniteQuery(
      { contactId, limit: 20 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor }
    );

  const activities = data?.pages.flatMap((p) => p.items) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4 text-center">
        Noch keine Aktivitäten.
      </p>
    );
  }

  return (
    <div>
      {activities.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
      {hasNextPage && (
        <div className="text-center pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Lädt..." : "Mehr laden"}
          </Button>
        </div>
      )}
    </div>
  );
}
