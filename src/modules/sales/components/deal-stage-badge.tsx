import { Badge } from "@/components/ui/badge";
import { DEAL_STAGE_LABELS } from "../domain/constants";
import type { DealStage } from "../domain/types";

const STAGE_COLORS: Record<DealStage, string> = {
  inquiry: "bg-blue-100 text-blue-800 border-blue-200",
  contacted: "bg-cyan-100 text-cyan-800 border-cyan-200",
  viewing: "bg-indigo-100 text-indigo-800 border-indigo-200",
  offer: "bg-amber-100 text-amber-800 border-amber-200",
  negotiation: "bg-orange-100 text-orange-800 border-orange-200",
  won: "bg-green-100 text-green-800 border-green-200",
  lost: "bg-red-100 text-red-800 border-red-200",
};

export function DealStageBadge({ stage }: { stage: DealStage }) {
  return (
    <Badge variant="outline" className={STAGE_COLORS[stage]}>
      {DEAL_STAGE_LABELS[stage]}
    </Badge>
  );
}
