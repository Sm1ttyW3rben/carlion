"use client";

import Image from "next/image";
import { ExternalLink, RefreshCw, XCircle, Eye, MessageSquare, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { SyncStatusBadge } from "./sync-status-badge";
import { PlatformBadge } from "./platform-badge";
import type { ListingView } from "../domain/types";

interface ListingRowProps {
  listing: ListingView;
  onSyncNow: (listingId: string) => void;
  onDeactivate: (listingId: string) => void;
  isSyncing?: boolean;
  isDeactivating?: boolean;
}

export function ListingRow({
  listing,
  onSyncNow,
  onDeactivate,
  isSyncing,
  isDeactivating,
}: ListingRowProps) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          {listing.vehicle.mainPhotoUrl ? (
            <Image
              src={listing.vehicle.mainPhotoUrl}
              alt={`${listing.vehicle.make} ${listing.vehicle.model}`}
              width={56}
              height={42}
              className="rounded object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-14 h-10 rounded bg-gray-100 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">
              {listing.vehicle.make} {listing.vehicle.model}
            </p>
            {listing.vehicle.askingPrice && (
              <p className="text-xs text-gray-500">
                {parseFloat(listing.vehicle.askingPrice).toLocaleString("de-DE", {
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 0,
                })}
              </p>
            )}
          </div>
        </div>
      </TableCell>

      <TableCell>
        <PlatformBadge platform={listing.platform} />
      </TableCell>

      <TableCell>
        <SyncStatusBadge status={listing.syncStatus} />
        {listing.lastSyncError && (
          <p className="text-xs text-red-600 mt-1 max-w-48 truncate" title={listing.lastSyncError}>
            {listing.lastSyncError}
          </p>
        )}
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            {listing.viewsTotal.toLocaleString("de-DE")}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            {listing.inquiriesTotal}
          </span>
        </div>
      </TableCell>

      <TableCell>
        {listing.lastSyncedAt ? (
          <span className="text-xs text-gray-500">
            {new Date(listing.lastSyncedAt).toLocaleDateString("de-DE")}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-1 justify-end">
          {listing.externalUrl && (
            <a
              href={listing.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-8 w-8 rounded hover:bg-gray-100 text-gray-500"
              title="Inserat öffnen"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          {listing.syncStatus !== "deactivated" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSyncNow(listing.id)}
                disabled={isSyncing}
                title="Jetzt synchronisieren"
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDeactivate(listing.id)}
                disabled={isDeactivating}
                title="Inserat deaktivieren"
                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
