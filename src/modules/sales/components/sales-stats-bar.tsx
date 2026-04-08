import { Card, CardContent } from "@/components/ui/card";
import type { SalesStats } from "../domain/types";

function fmtPrice(v: number): string {
  return v > 0 ? `${Math.round(v).toLocaleString("de-DE")} €` : "—";
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

export function SalesStatsBar({ stats }: { stats: SalesStats }) {
  const items = [
    { label: "Offen", value: String(stats.openDeals) },
    { label: "Gewonnen", value: String(stats.wonThisPeriod) },
    { label: "Verloren", value: String(stats.lostThisPeriod) },
    { label: "Abschlussrate", value: fmtPct(stats.conversionRate) },
    { label: "Ø Tage", value: stats.avgDaysToClose > 0 ? `${Math.round(stats.avgDaysToClose)}` : "—" },
    { label: "Umsatz", value: fmtPrice(stats.totalRevenueThisPeriod) },
    { label: "Pipeline", value: fmtPrice(stats.pipelineValue) },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-gray-900">{item.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
