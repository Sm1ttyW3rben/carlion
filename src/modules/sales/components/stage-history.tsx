import { DEAL_STAGE_LABELS } from "../domain/constants";
import type { StageHistoryEntry, DealStage } from "../domain/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatDuration(hours: number | null): string {
  if (hours === null) return "";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function StageHistory({ entries }: { entries: StageHistoryEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-gray-500">Keine Historie.</p>;

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.id} className="flex gap-3 text-sm">
          <div className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-gray-400" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-medium text-gray-900">
                {entry.fromStage
                  ? `${DEAL_STAGE_LABELS[entry.fromStage as DealStage] ?? entry.fromStage} → ${DEAL_STAGE_LABELS[entry.toStage as DealStage] ?? entry.toStage}`
                  : `Erstellt: ${DEAL_STAGE_LABELS[entry.toStage as DealStage] ?? entry.toStage}`}
              </p>
              <time className="text-xs text-gray-400 whitespace-nowrap">
                {formatDate(entry.changedAt)}
              </time>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {entry.changedBy && <span>{entry.changedBy.name}</span>}
              {entry.durationInStageHours !== null && (
                <span className="text-gray-400">({formatDuration(entry.durationInStageHours)})</span>
              )}
            </div>
            {entry.notes && <p className="text-xs text-gray-600 mt-0.5">{entry.notes}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
