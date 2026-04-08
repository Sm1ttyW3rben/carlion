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
import { ContactCard } from "@/modules/crm/components/contact-card";
import { ContactRow } from "@/modules/crm/components/contact-row";
import { CrmStatsBar } from "@/modules/crm/components/crm-stats-bar";
import type { ContactType } from "@/modules/crm/domain/types";

type ViewMode = "grid" | "table";

export default function KontaktePage() {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [typeFilter, setTypeFilter] = useState<ContactType | "all">("all");

  const { data: stats } = api.crm.getStats.useQuery();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.crm.list.useInfiniteQuery(
      {
        limit: 20,
        search: search || undefined,
        contactType: typeFilter !== "all" ? typeFilter : undefined,
        sortBy: "created_at",
        sortOrder: "desc",
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }
    );

  const contacts = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kontakte</h1>
          <p className="text-sm text-gray-500 mt-1">Deine Kontaktdatenbank</p>
        </div>
        <Link href="/kontakte/neu" className={buttonVariants()}>
          <Plus className="h-4 w-4 mr-2" />
          Kontakt anlegen
        </Link>
      </div>

      {/* Stats */}
      {stats && <CrmStatsBar stats={stats} />}

      {/* Filters & View toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Suchen (Name, E-Mail, Telefon, Firma...)"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Type filter */}
        <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as ContactType | "all")}>
          <TabsList>
            <TabsTrigger value="all">Alle</TabsTrigger>
            <TabsTrigger value="prospect">Interessenten</TabsTrigger>
            <TabsTrigger value="customer">Kunden</TabsTrigger>
            <TabsTrigger value="seller">Verkäufer</TabsTrigger>
            <TabsTrigger value="partner">Partner</TabsTrigger>
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

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 p-4 space-y-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && contacts.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <span className="text-5xl">👤</span>
          <h3 className="mt-4 font-semibold text-gray-900">Noch keine Kontakte</h3>
          <p className="mt-1 text-sm text-gray-500">
            {search ? "Keine Kontakte gefunden." : "Lege deinen ersten Kontakt an."}
          </p>
          {!search && (
            <Link href="/kontakte/neu" className={cn(buttonVariants(), "mt-4 inline-flex")}>
              <Plus className="h-4 w-4 mr-2" />
              Kontakt anlegen
            </Link>
          )}
        </div>
      )}

      {/* Grid */}
      {!isLoading && contacts.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {contacts.map((c) => (
            <ContactCard key={c.id} contact={c} />
          ))}
        </div>
      )}

      {/* Table */}
      {!isLoading && contacts.length > 0 && viewMode === "table" && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Name</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Zuständig</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c) => (
                <ContactRow key={c.id} contact={c} />
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
