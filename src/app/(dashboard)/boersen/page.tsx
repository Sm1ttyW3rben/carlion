"use client";

import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Settings, List, MessageSquare, Upload } from "lucide-react";
import { api } from "@/shared/lib/trpc/client";
import { ListingsStatsBar } from "@/modules/listings/components/listings-stats-bar";
import { InquiryRow } from "@/modules/listings/components/inquiry-row";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function BoesenPage() {
  const { data: stats, isLoading: statsLoading } = api.listings.getStats.useQuery({});

  const { data: inquiriesData, isLoading: inquiriesLoading } =
    api.listings.listInquiries.useQuery({ limit: 5, processed: false });

  const utils = api.useUtils();

  const processMutation = api.listings.processInquiry.useMutation({
    onSuccess: () => {
      void utils.listings.listInquiries.invalidate();
      void utils.listings.getStats.invalidate();
    },
  });

  const unprocessedInquiries = inquiriesData?.items ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Börsen-Hub</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Inserate auf mobile.de und AutoScout24 verwalten
          </p>
        </div>
        <Link href="/boersen/verbindung">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-1.5" />
            Verbindungen
          </Button>
        </Link>
      </div>

      {/* Stats */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : stats ? (
        <ListingsStatsBar stats={stats} />
      ) : null}

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link href="/boersen/inserate">
          <div className="border rounded-xl p-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <List className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <p className="font-medium text-sm">Inserate</p>
              <p className="text-xs text-gray-500">
                {stats
                  ? (stats.bySyncStatus.synced ?? 0) + (stats.bySyncStatus.pending ?? 0)
                  : "—"}{" "}
                aktive Inserate
              </p>
            </div>
          </div>
        </Link>

        <Link href="/boersen/anfragen">
          <div className="border rounded-xl p-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <p className="font-medium text-sm">Anfragen</p>
              <p className="text-xs text-gray-500">
                {stats?.unprocessedInquiries ?? "—"} offen
              </p>
            </div>
          </div>
        </Link>

        <Link href="/boersen/import">
          <div className="border rounded-xl p-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Upload className="h-5 w-5 text-purple-700" />
            </div>
            <div>
              <p className="font-medium text-sm">Import</p>
              <p className="text-xs text-gray-500">Börsen-Export importieren</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent unprocessed inquiries */}
      {unprocessedInquiries.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">Offene Anfragen</h2>
            <Link href="/boersen/anfragen" className="text-sm text-blue-600 hover:underline">
              Alle anzeigen
            </Link>
          </div>

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
                {inquiriesLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  unprocessedInquiries.map((inquiry) => (
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
        </div>
      )}
    </div>
  );
}
