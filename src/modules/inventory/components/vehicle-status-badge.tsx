"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "../domain/constants";
import type { VehicleStatus } from "../domain/types";

const STATUS_STYLES: Record<VehicleStatus, string> = {
  draft:          "bg-gray-100 text-gray-700 border-gray-200",
  in_preparation: "bg-yellow-100 text-yellow-800 border-yellow-200",
  available:      "bg-green-100 text-green-800 border-green-200",
  reserved:       "bg-blue-100 text-blue-800 border-blue-200",
  sold:           "bg-purple-100 text-purple-800 border-purple-200",
  delivered:      "bg-indigo-100 text-indigo-800 border-indigo-200",
  archived:       "bg-gray-100 text-gray-400 border-gray-200",
};

interface VehicleStatusBadgeProps {
  status: VehicleStatus;
  className?: string;
}

export function VehicleStatusBadge({ status, className }: VehicleStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(STATUS_STYLES[status], "font-medium text-xs", className)}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}

interface VehiclePublishBadgeProps {
  published: boolean;
  className?: string;
}

export function VehiclePublishBadge({ published, className }: VehiclePublishBadgeProps) {
  if (published) {
    return (
      <Badge variant="outline" className={cn("bg-emerald-50 text-emerald-700 border-emerald-200 text-xs", className)}>
        Online
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn("bg-gray-50 text-gray-500 border-gray-200 text-xs", className)}>
      Entwurf
    </Badge>
  );
}
