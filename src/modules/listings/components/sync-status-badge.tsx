"use client";

import { cn } from "@/lib/utils";
import type { SyncStatus } from "../domain/types";

const LABELS: Record<SyncStatus, string> = {
  pending: "Ausstehend",
  synced: "Synchronisiert",
  error: "Fehler",
  deactivated: "Deaktiviert",
};

const STYLES: Record<SyncStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  synced: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
  deactivated: "bg-gray-100 text-gray-600",
};

interface SyncStatusBadgeProps {
  status: SyncStatus;
  className?: string;
}

export function SyncStatusBadge({ status, className }: SyncStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STYLES[status],
        className
      )}
    >
      {LABELS[status]}
    </span>
  );
}
