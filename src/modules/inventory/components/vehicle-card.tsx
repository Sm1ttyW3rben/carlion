"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Fuel, Gauge, Calendar } from "lucide-react";
import { VehicleStatusBadge, VehiclePublishBadge } from "./vehicle-status-badge";
import { DaysInStockBadge } from "./price-display";
import type { VehicleListItem } from "../domain/types";

interface VehicleCardProps {
  vehicle: VehicleListItem;
  className?: string;
}

function formatPrice(price: string | null): string {
  if (!price) return "Preis auf Anfrage";
  const num = parseFloat(price);
  if (isNaN(num)) return "Preis auf Anfrage";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function formatKm(km: number | null): string {
  if (km === null) return "–";
  return new Intl.NumberFormat("de-DE").format(km) + " km";
}

function formatYear(dateStr: string | null): string {
  if (!dateStr) return "–";
  return new Date(dateStr).getFullYear().toString();
}

export function VehicleCard({ vehicle, className }: VehicleCardProps) {
  return (
    <Link
      href={`/fahrzeuge/${vehicle.id}`}
      className={cn(
        "group block rounded-xl border border-gray-200 bg-white overflow-hidden",
        "hover:border-gray-300 hover:shadow-md transition-all duration-200",
        vehicle.featured && "ring-2 ring-blue-500 ring-offset-1",
        className
      )}
    >
      {/* Photo */}
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
        {vehicle.mainPhotoUrl ? (
          <Image
            src={vehicle.mainPhotoUrl}
            alt={`${vehicle.make} ${vehicle.model}`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <span className="text-4xl">🚗</span>
          </div>
        )}

        {/* Badges overlay */}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          <VehicleStatusBadge status={vehicle.status} />
          <VehiclePublishBadge published={vehicle.published} />
          {vehicle.featured && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-white">
              ⭐ Highlight
            </span>
          )}
        </div>

        {/* Standzeit */}
        <div className="absolute top-2 right-2">
          <DaysInStockBadge daysInStock={vehicle.daysInStock} />
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-sm leading-tight">
          {vehicle.make} {vehicle.model}
          {vehicle.variant && <span className="text-gray-500 font-normal"> {vehicle.variant}</span>}
        </h3>

        {/* Key specs */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
          {vehicle.firstRegistration && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatYear(vehicle.firstRegistration)}
            </span>
          )}
          {vehicle.mileageKm !== null && (
            <span className="flex items-center gap-1">
              <Gauge className="h-3 w-3" />
              {formatKm(vehicle.mileageKm)}
            </span>
          )}
          {vehicle.fuelType && (
            <span className="flex items-center gap-1">
              <Fuel className="h-3 w-3" />
              {vehicle.fuelType}
            </span>
          )}
        </div>

        {/* Price */}
        <div className="mt-3 font-bold text-lg text-gray-900">
          {formatPrice(vehicle.askingPriceGross)}
        </div>
      </div>
    </Link>
  );
}
