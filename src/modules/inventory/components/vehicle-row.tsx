"use client";

import Link from "next/link";
import Image from "next/image";
import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Edit, Globe, GlobeLock, Archive } from "lucide-react";
import { VehicleStatusBadge, VehiclePublishBadge } from "./vehicle-status-badge";
import { DaysInStockBadge } from "./price-display";
import type { VehicleListItem } from "../domain/types";

interface VehicleRowProps {
  vehicle: VehicleListItem;
  onPublish?: (id: string) => void;
  onUnpublish?: (id: string) => void;
  onArchive?: (id: string) => void;
}

function formatPrice(price: string | null): string {
  if (!price) return "–";
  const num = parseFloat(price);
  if (isNaN(num)) return "–";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function VehicleRow({ vehicle, onPublish, onUnpublish, onArchive }: VehicleRowProps) {
  return (
    <TableRow className="hover:bg-gray-50">
      {/* Photo */}
      <TableCell className="w-16 py-2">
        <div className="relative w-14 h-10 rounded overflow-hidden bg-gray-100 flex-shrink-0">
          {vehicle.mainPhotoUrl ? (
            <Image
              src={vehicle.mainPhotoUrl}
              alt={`${vehicle.make} ${vehicle.model}`}
              fill
              className="object-cover"
              sizes="56px"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-lg">🚗</div>
          )}
        </div>
      </TableCell>

      {/* Vehicle name */}
      <TableCell>
        <Link
          href={`/fahrzeuge/${vehicle.id}`}
          className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
        >
          {vehicle.make} {vehicle.model}
          {vehicle.variant && <span className="text-gray-500 font-normal"> {vehicle.variant}</span>}
        </Link>
        {vehicle.colorExterior && (
          <p className="text-xs text-gray-400 mt-0.5">{vehicle.colorExterior}</p>
        )}
      </TableCell>

      {/* Status */}
      <TableCell>
        <div className="flex flex-col gap-1">
          <VehicleStatusBadge status={vehicle.status} />
          <VehiclePublishBadge published={vehicle.published} />
        </div>
      </TableCell>

      {/* Price */}
      <TableCell className="text-right font-semibold">
        {formatPrice(vehicle.askingPriceGross)}
      </TableCell>

      {/* Mileage */}
      <TableCell className="text-right text-sm text-gray-600">
        {vehicle.mileageKm !== null
          ? new Intl.NumberFormat("de-DE").format(vehicle.mileageKm) + " km"
          : "–"}
      </TableCell>

      {/* Standzeit */}
      <TableCell className="text-center">
        <DaysInStockBadge daysInStock={vehicle.daysInStock} />
      </TableCell>

      {/* Actions */}
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger render={
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Aktionen</span>
            </Button>
          } />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => { window.location.href = `/fahrzeuge/${vehicle.id}`; }} className="flex items-center gap-2">
              <Eye className="h-4 w-4" /> Anzeigen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { window.location.href = `/fahrzeuge/${vehicle.id}/bearbeiten`; }} className="flex items-center gap-2">
              <Edit className="h-4 w-4" /> Bearbeiten
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {vehicle.published ? (
              <DropdownMenuItem
                className="flex items-center gap-2 text-amber-700"
                onClick={() => onUnpublish?.(vehicle.id)}
              >
                <GlobeLock className="h-4 w-4" /> Depublizieren
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="flex items-center gap-2 text-green-700"
                onClick={() => onPublish?.(vehicle.id)}
              >
                <Globe className="h-4 w-4" /> Veröffentlichen
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex items-center gap-2 text-red-600"
              onClick={() => onArchive?.(vehicle.id)}
            >
              <Archive className="h-4 w-4" /> Archivieren
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
