"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/shared/lib/trpc/client";
import { InquiryRow } from "@/modules/listings/components/inquiry-row";
import type { Platform } from "@/modules/listings/domain/types";

type ProcessedFilter = "open" | "processed" | "all";

export default function AnfragenPage() {
  const [processedFilter, setProcessedFilter] = useState<ProcessedFilter>("open");

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.listings.listInquiries.useInfiniteQuery(
      {
        limit: 20,
        processed:
          processedFilter === "open" ? false : processedFilter === "processed" ? true : undefined,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }
    );

  const utils = api.useUtils();

  const processMutation = api.listings.processInquiry.useMutation({
    onSuccess: () => {
      void utils.listings.listInquiries.invalidate();
      void utils.listings.getStats.invalidate();
    },
  });

  const allItems = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-gray-900">Anfragen</h1>
      </div>

      {/* Filter tabs */}
      <Tabs value={processedFilter} onValueChange={(v) => setProcessedFilter(v as ProcessedFilter)}>
        <TabsList>
          <TabsTrigger value="open">Offen</TabsTrigger>
          <TabsTrigger value="processed">Bearbeitet</TabsTrigger>
          <TabsTrigger value="all">Alle</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fahrzeug</TableHead>
              <TableHead>Interessent</TableHead>
              <TableHead>Nachricht</TableHead>
              <TableHead>Eingang</TableHead>
              <TableHead>Kontakt</TableHead>
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
                  {processedFilter === "open"
                    ? "Keine offenen Anfragen."
                    : "Keine Anfragen gefunden."}
                </TableHead>
              </TableRow>
            ) : (
              allItems.map((inquiry) => (
                <InquiryRow
                  key={inquiry.id}
                  inquiry={inquiry}
                  onProcess={(id) => processMutation.mutate({ inquiryId: id })}
                  isProcessing={
                    processMutation.isPending &&
                    processMutation.variables?.inquiryId === inquiry.id
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
