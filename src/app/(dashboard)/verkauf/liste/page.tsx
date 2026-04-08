"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, LayoutGrid } from "lucide-react";
import { api } from "@/shared/lib/trpc/client";
import { DealRow } from "@/modules/sales/components/deal-row";
import { SalesStatsBar } from "@/modules/sales/components/sales-stats-bar";

export default function VerkaufListePage() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("open");

  const { data: stats } = api.sales.getStats.useQuery({ period: "month" });

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.sales.list.useInfiniteQuery(
      {
        limit: 20,
        search: search || undefined,
        isOpen: stageFilter === "open" ? true : stageFilter === "closed" ? false : undefined,
        sortBy: "created_at",
        sortOrder: "desc",
      },
      { getNextPageParam: (lastPage) => lastPage.nextCursor }
    );

  const deals = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Verkaufsvorgänge</h1>
          <p className="text-sm text-gray-500 mt-1">Alle Vorgänge</p>
        </div>
        <div className="flex gap-2">
          <Link href="/verkauf" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <LayoutGrid className="h-4 w-4 mr-1" /> Board
          </Link>
          <Link href="/verkauf/neu" className={buttonVariants({ size: "sm" })}>
            <Plus className="h-4 w-4 mr-1" /> Vorgang anlegen
          </Link>
        </div>
      </div>

      {stats && <SalesStatsBar stats={stats} />}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Suchen (Kontakt, Fahrzeug...)" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Tabs value={stageFilter} onValueChange={setStageFilter}>
          <TabsList>
            <TabsTrigger value="all">Alle</TabsTrigger>
            <TabsTrigger value="open">Offen</TabsTrigger>
            <TabsTrigger value="closed">Abgeschlossen</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading && <Skeleton className="h-64 w-full" />}

      {!isLoading && deals.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <h3 className="font-semibold text-gray-900">Keine Vorgänge</h3>
          <p className="text-sm text-gray-500 mt-1">{search ? "Keine Ergebnisse." : "Erstelle deinen ersten Verkaufsvorgang."}</p>
        </div>
      )}

      {deals.length > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Kontakt</TableHead>
                <TableHead>Fahrzeug</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead className="text-right">Preis</TableHead>
                <TableHead className="text-center">Tage</TableHead>
                <TableHead>Zuständig</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((deal) => <DealRow key={deal.id} deal={deal} />)}
            </TableBody>
          </Table>
        </div>
      )}

      {hasNextPage && (
        <div className="text-center pt-4">
          <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? "Lädt..." : "Weitere laden"}
          </Button>
        </div>
      )}
    </div>
  );
}
