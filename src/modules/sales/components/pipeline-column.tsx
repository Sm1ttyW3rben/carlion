import { Badge } from "@/components/ui/badge";
import { DealCard } from "./deal-card";
import type { PipelineBoardStage } from "../domain/types";

function formatPrice(value: number): string {
  return value > 0 ? `${Math.round(value).toLocaleString("de-DE")} €` : "—";
}

export function PipelineColumn({ stage }: { stage: PipelineBoardStage }) {
  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px]">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-t-lg border border-b-0 border-gray-200">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700">{stage.label}</h3>
          <Badge variant="secondary" className="text-xs">{stage.totalCount}</Badge>
        </div>
        <span className="text-xs text-gray-500">{formatPrice(stage.totalValue)}</span>
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-2 p-2 border border-gray-200 rounded-b-lg bg-gray-50/50 min-h-[200px] overflow-y-auto max-h-[calc(100vh-300px)]">
        {stage.deals.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">Keine Vorgänge</p>
        )}
        {stage.deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
        {stage.totalCount > stage.deals.length && (
          <p className="text-xs text-center text-blue-600 py-2 cursor-pointer hover:underline">
            +{stage.totalCount - stage.deals.length} weitere
          </p>
        )}
      </div>
    </div>
  );
}
