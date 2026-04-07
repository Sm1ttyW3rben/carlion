"use client";

import { cn } from "@/lib/utils";
import { Clock, TrendingUp } from "lucide-react";
import { LANGSTEHER_THRESHOLD_DAYS, WARNING_THRESHOLD_DAYS } from "../domain/constants";

// ---------------------------------------------------------------------------
// DaysInStockBadge
// ---------------------------------------------------------------------------

interface DaysInStockBadgeProps {
  daysInStock: number | null;
  className?: string;
}

export function DaysInStockBadge({ daysInStock, className }: DaysInStockBadgeProps) {
  if (daysInStock === null) return null;

  const isLangsteher = daysInStock > LANGSTEHER_THRESHOLD_DAYS;
  const isWarning = daysInStock > WARNING_THRESHOLD_DAYS && !isLangsteher;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
        isLangsteher && "bg-red-100 text-red-700",
        isWarning && "bg-amber-100 text-amber-700",
        !isLangsteher && !isWarning && "bg-gray-100 text-gray-600",
        className
      )}
      title={`${daysInStock} Tage im Bestand`}
    >
      <Clock className="h-3 w-3" />
      {daysInStock}d
    </span>
  );
}

// ---------------------------------------------------------------------------
// PriceDisplay — public-facing asking price with MwSt hint
// ---------------------------------------------------------------------------

interface PriceDisplayProps {
  askingPriceGross: string | null;
  taxType: "margin" | "regular";
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

export function PriceDisplay({ askingPriceGross, taxType, className }: PriceDisplayProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <span className="text-2xl font-bold text-gray-900">
        {formatPrice(askingPriceGross)}
      </span>
      <span className="text-xs text-gray-500 mt-0.5">
        {taxType === "regular"
          ? "inkl. 19% MwSt."
          : "Differenzbesteuerung gem. §25a UStG – keine MwSt. ausweisbar"}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PriceSection — internal view with purchase price + margin (restricted roles)
// ---------------------------------------------------------------------------

interface PriceSectionProps {
  askingPriceGross: string | null;
  purchasePriceNet: string | null;
  minimumPriceGross: string | null;
  margin: string | null;
  taxType: "margin" | "regular";
  className?: string;
}

export function PriceSection({
  askingPriceGross,
  purchasePriceNet,
  minimumPriceGross,
  margin,
  taxType,
  className,
}: PriceSectionProps) {
  return (
    <div className={cn("rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 space-y-3", className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <TrendingUp className="h-4 w-4" />
        Preisübersicht (intern)
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-gray-500">Verkaufspreis</dt>
        <dd className="font-semibold text-right">{formatPrice(askingPriceGross)}</dd>

        <dt className="text-gray-500">Einkaufspreis (netto)</dt>
        <dd className="text-right">{formatPrice(purchasePriceNet)}</dd>

        {minimumPriceGross && (
          <>
            <dt className="text-gray-500">Mindestpreis</dt>
            <dd className="text-right">{formatPrice(minimumPriceGross)}</dd>
          </>
        )}

        {margin !== null && (
          <>
            <dt className="text-gray-500">
              Marge{taxType === "regular" ? " (netto)" : ""}
            </dt>
            <dd
              className={cn(
                "font-semibold text-right",
                parseFloat(margin) >= 0 ? "text-green-700" : "text-red-700"
              )}
            >
              {formatPrice(margin)}
            </dd>
          </>
        )}

        <dt className="text-gray-500 col-span-2 text-xs pt-1">
          Besteuerung: {taxType === "regular" ? "Regelbesteuerung (19% MwSt.)" : "Differenzbesteuerung (§25a UStG)"}
        </dt>
      </dl>
    </div>
  );
}
