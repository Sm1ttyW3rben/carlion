"use client";

import { cn } from "@/lib/utils";
import { Car, Clock, TrendingUp, AlertTriangle } from "lucide-react";
import type { InventoryStats } from "../domain/types";

interface InventoryStatsBarProps {
  stats: InventoryStats;
  className?: string;
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function InventoryStatsBar({ stats, className }: InventoryStatsBarProps) {
  const activeCount = (stats.byStatus.available ?? 0) + (stats.byStatus.reserved ?? 0);

  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-3", className)}>
      <StatCard
        icon={<Car className="h-5 w-5 text-blue-600" />}
        label="Im Bestand"
        value={`${activeCount} Fahrzeuge`}
        sub={`davon ${stats.byStatus.available ?? 0} verfügbar`}
        bg="bg-blue-50"
      />
      <StatCard
        icon={<Clock className="h-5 w-5 text-amber-600" />}
        label="Ø Standzeit"
        value={`${Math.round(stats.avgDaysInStock)} Tage`}
        sub="aktiver Bestand"
        bg="bg-amber-50"
      />
      <StatCard
        icon={<TrendingUp className="h-5 w-5 text-green-600" />}
        label="Bestandswert"
        value={formatPrice(stats.totalStockValue)}
        sub={`Ø ${formatPrice(stats.avgAskingPrice)} pro Fahrzeug`}
        bg="bg-green-50"
      />
      <StatCard
        icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
        label="Langsteher"
        value={`${stats.langsteherCount} Fahrzeuge`}
        sub="über 90 Tage im Bestand"
        bg="bg-red-50"
        highlight={stats.langsteherCount > 0}
      />
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  bg: string;
  highlight?: boolean;
}

function StatCard({ icon, label, value, sub, bg, highlight }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl p-4 flex items-start gap-3",
        bg,
        highlight && "ring-1 ring-red-200"
      )}
    >
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5 truncate">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}
