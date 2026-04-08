import { Card, CardContent } from "@/components/ui/card";
import type { CrmStats } from "../domain/types";

export function CrmStatsBar({ stats }: { stats: CrmStats }) {
  const items = [
    { label: "Gesamt", value: stats.totalContacts },
    { label: "Interessenten", value: stats.byType.prospect },
    { label: "Kunden", value: stats.byType.customer },
    { label: "Neu (Monat)", value: stats.newThisMonth },
    { label: "Unzugewiesen", value: stats.unassigned },
    { label: "Inaktiv", value: stats.inactiveCount },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{item.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
