"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/shared/lib/trpc/client";
import { ListingRow } from "@/modules/listings/components/listing-row";
import type { Platform, SyncStatus } from "@/modules/listings/domain/types";

type PlatformFilter = Platform | "all";

export default function InseratePage() {
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.listings.listListings.useInfiniteQuery(
      {
        limit: 20,
        platform: platformFilter !== "all" ? platformFilter : undefined,
        sortBy: "created_at",
        sortOrder: "desc",
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }
    );

  const utils = api.useUtils();

  const syncNowMutation = api.listings.syncNow.useMutation({
    onSuccess: () => void utils.listings.listListings.invalidate(),
  });

  const deactivateMutation = api.listings.deactivateListing.useMutation({
    onSuccess: () => void utils.listings.listListings.invalidate(),
  });

  const allItems = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-gray-900">Inserate</h1>
      </div>

      {/* Platform filter tabs */}
      <Tabs value={platformFilter} onValueChange={(v) => setPlatformFilter(v as PlatformFilter)}>
        <TabsList>
          <TabsTrigger value="all">Alle Börsen</TabsTrigger>
          <TabsTrigger value="mobile_de">mobile.de</TabsTrigger>
          <TabsTrigger value="autoscout24">AutoScout24</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fahrzeug</TableHead>
              <TableHead>Börse</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Performance</TableHead>
              <TableHead>Letzter Sync</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableHead key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableHead>
                  ))}
                </TableRow>
              ))
            ) : allItems.length === 0 ? (
              <TableRow>
                <TableHead colSpan={6} className="text-center text-gray-400 py-12">
                  Keine Inserate gefunden.
                </TableHead>
              </TableRow>
            ) : (
              allItems.map((listing) => (
                <ListingRow
                  key={listing.id}
                  listing={listing}
                  onSyncNow={(id) => syncNowMutation.mutate({ listingId: id })}
                  onDeactivate={(id) => deactivateMutation.mutate({ listingId: id })}
                  isSyncing={
                    syncNowMutation.isPending &&
                    syncNowMutation.variables?.listingId === listing.id
                  }
                  isDeactivating={
                    deactivateMutation.isPending &&
                    deactivateMutation.variables?.listingId === listing.id
                  }
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Lädt…" : "Mehr laden"}
          </Button>
        </div>
      )}
    </div>
  );
}
