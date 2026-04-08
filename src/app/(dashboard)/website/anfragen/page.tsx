"use client";

/**
 * Website-Anfragen — Übersicht aller Kontaktformular-Submissions.
 *
 * Compound-Cursor-Pagination. Bearbeiten = CRM-Kontakt anlegen.
 * Spec: MOD_11 Section 7
 */

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, User, Car, CheckCircle } from "lucide-react";
import { api } from "@/shared/lib/trpc/client";

export default function WebsiteAnfragenPage() {
  const utils = api.useUtils();
  const [activeTab, setActiveTab] = useState<"unprocessed" | "all">("unprocessed");

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.website.listSubmissions.useInfiniteQuery(
      {
        limit: 20,
        processed: activeTab === "unprocessed" ? false : undefined,
      },
      { getNextPageParam: (lastPage) => lastPage.nextCursor }
    );

  const processMutation = api.website.processSubmission.useMutation({
    onSuccess: () => {
      void utils.website.listSubmissions.invalidate();
    },
  });

  const submissions = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/website">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Website
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Website-Anfragen</h1>
          <p className="text-sm text-gray-500 mt-0.5">Eingehende Kontaktanfragen von der öffentlichen Website</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "unprocessed" | "all")}>
        <TabsList>
          <TabsTrigger value="unprocessed">Unbearbeitet</TabsTrigger>
          <TabsTrigger value="all">Alle</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg font-medium">Keine Anfragen vorhanden</p>
          <p className="text-sm mt-1">
            {activeTab === "unprocessed"
              ? "Alle Anfragen wurden bereits bearbeitet."
              : "Es sind noch keine Anfragen eingegangen."}
          </p>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name / E-Mail</TableHead>
                  <TableHead>Fahrzeug</TableHead>
                  <TableHead>Nachricht</TableHead>
                  <TableHead>Eingang</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((s) => (
                  <TableRow key={s.id} className={s.processed ? "opacity-60" : ""}>
                    <TableCell>
                      <div className="font-medium text-sm">{s.name}</div>
                      <div className="text-xs text-gray-500">{s.email}</div>
                      {s.phone && <div className="text-xs text-gray-400">{s.phone}</div>}
                    </TableCell>
                    <TableCell>
                      {s.vehicle ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Car className="w-3.5 h-3.5 text-gray-400" />
                          <span>{s.vehicle.make} {s.vehicle.model}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-gray-600 line-clamp-2 max-w-xs">
                        {s.message}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-gray-500">
                        {new Date(s.submittedAt).toLocaleDateString("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </TableCell>
                    <TableCell>
                      {s.processed ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Bearbeitet
                        </Badge>
                      ) : (
                        <Badge variant="outline">Neu</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!s.processed ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => processMutation.mutate({ submissionId: s.id })}
                          disabled={processMutation.isPending}
                        >
                          <User className="w-3.5 h-3.5 mr-1" />
                          Kontakt anlegen
                        </Button>
                      ) : s.contactId ? (
                        <Link href={`/kontakte/${s.contactId}`}>
                          <Button size="sm" variant="ghost">
                            <User className="w-3.5 h-3.5 mr-1" />
                            Kontakt
                          </Button>
                        </Link>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {hasNextPage && (
            <div className="text-center">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "Wird geladen…" : "Weitere laden"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
