import { Badge } from "@/components/ui/badge";
import { DEAL_PRIORITY_LABELS } from "../domain/constants";
import type { DealPriority } from "../domain/types";

const PRIORITY_COLORS: Record<DealPriority, string> = {
  low: "bg-gray-100 text-gray-600 border-gray-200",
  normal: "bg-blue-50 text-blue-600 border-blue-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  urgent: "bg-red-100 text-red-700 border-red-200",
};

export function DealPriorityBadge({ priority }: { priority: DealPriority }) {
  if (priority === "normal") return null; // Don't show badge for normal
  return (
    <Badge variant="outline" className={PRIORITY_COLORS[priority]}>
      {DEAL_PRIORITY_LABELS[priority]}
    </Badge>
  );
}
