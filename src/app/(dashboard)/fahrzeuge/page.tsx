"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/shared/lib/trpc/client";
import { VehicleCard } from "@/modules/inventory/components/vehicle-card";
import { VehicleRow } from "@/modules/inventory/components/vehicle-row";
import { InventoryStatsBar } from "@/modules/inventory/components/inventory-stats-bar";
import type { VehicleStatus } from "@/modules/inventory/domain/types";

type ViewMode = "grid" | "table";

export default function FahrzeugePage() {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | "all">("all");

  const { data: stats } = api.inventory.getStats.useQuery();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.inventory.list.useInfiniteQuery(
      {
        limit: 20,
        search: search || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        sortBy: "created_at",
        sortOrder: "desc",
        includeArchived: false,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }
    );

  const utils = api.useUtils();

  const publishMutation = api.inventory.publish.useMutation({
    onSuccess: () => utils.inventory.list.invalidate(),
  });

  const unpublishMutation = api.inventory.unpublish.useMutation({
    onSuccess: () => utils.inventory.list.invalidate(),
  });

  const archiveMutation = api.inventory.archive.useMutation({
    onSuccess: () => utils.inventory.list.invalidate(),
  });

  const vehicles = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fahrzeuge</h1>
          <p className="text-sm text-gray-500 mt-1">Dein Fahrzeugbestand</p>
        </div>
        <Link href="/fahrzeuge/neu" className={buttonVariants()}>
          <Plus className="h-4 w-4 mr-2" />
          Fahrzeug anlegen
        </Link>
      </div>

      {/* Stats */}
      {stats && <InventoryStatsBar stats={stats} />}

      {/* Filters & View toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Suchen (Marke, Modell, VIN, Kennzeichen...)"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Status filter */}
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as VehicleStatus | "all")}>
          <TabsList>
            <TabsTrigger value="all">Alle</TabsTrigger>
            <TabsTrigger value="available">Verfügbar</TabsTrigger>
            <TabsTrigger value="reserved">Reserviert</TabsTrigger>
            <TabsTrigger value="draft">Entwurf</TabsTrigger>
            <TabsTrigger value="sold">Verkauft</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* View toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            className={`p-2 ${viewMode === "grid" ? "bg-gray-100" : "hover:bg-gray-50"}`}
            onClick={() => setViewMode("grid")}
            title="Karten-Ansicht"
          >
            <LayoutGrid className="h-4 w-4 text-gray-600" />
          </button>
          <button
            className={`p-2 ${viewMode === "table" ? "bg-gray-100" : "hover:bg-gray-50"}`}
            onClick={() => setViewMode("table")}
            title="Tabellen-Ansicht"
          >
            <List className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 overflow-hidden">
              <Skeleton className="aspect-[4/3] w-full" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-6 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && vehicles.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <span className="text-5xl">🚗</span>
          <h3 className="mt-4 font-semibold text-gray-900">Noch keine Fahrzeuge</h3>
          <p className="mt-1 text-sm text-gray-500">
            {search ? "Keine Fahrzeuge gefunden." : "Lege dein erstes Fahrzeug an."}
          </p>
          {!search && (
            <Link href="/fahrzeuge/neu" className={cn(buttonVariants(), "mt-4 inline-flex")}>
              <Plus className="h-4 w-4 mr-2" />
              Fahrzeug anlegen
            </Link>
          )}
        </div>
      )}

      {/* Grid view */}
      {!isLoading && vehicles.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {vehicles.map((vehicle) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </div>
      )}

      {/* Table view */}
      {!isLoading && vehicles.length > 0 && viewMode === "table" && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-16" />
                <TableHead>Fahrzeug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Preis</TableHead>
                <TableHead className="text-right">km-Stand</TableHead>
                <TableHead className="text-center">Standzeit</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((vehicle) => (
                <VehicleRow
                  key={vehicle.id}
                  vehicle={vehicle}
                  onPublish={(id) => publishMutation.mutate({ id })}
                  onUnpublish={(id) => unpublishMutation.mutate({ id })}
                  onArchive={(id) => archiveMutation.mutate({ id })}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Load more */}
      {hasNextPage && (
        <div className="text-center pt-4">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Lädt..." : "Weitere laden"}
          </Button>
        </div>
      )}
    </div>
  );
}
