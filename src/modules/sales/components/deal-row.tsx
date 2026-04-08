import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/table";
import { DealStageBadge } from "./deal-stage-badge";
import { DealPriorityBadge } from "./deal-priority-badge";
import type { DealListItem } from "../domain/types";

function formatPrice(price: string | null): string {
  if (!price) return "—";
  return `${parseFloat(price).toLocaleString("de-DE")} €`;
}

export function DealRow({ deal }: { deal: DealListItem }) {
  return (
    <TableRow className="hover:bg-gray-50">
      <TableCell>
        <Link href={`/verkauf/${deal.id}`} className="font-medium text-gray-900 hover:underline">
          {deal.contactName}
        </Link>
      </TableCell>
      <TableCell className="text-gray-600 text-sm">{deal.vehicleTitle}</TableCell>
      <TableCell><DealStageBadge stage={deal.stage} /></TableCell>
      <TableCell className="text-right">{formatPrice(deal.offeredPrice)}</TableCell>
      <TableCell className="text-center">{deal.daysInCurrentStage}d</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <DealPriorityBadge priority={deal.priority} />
          <span className="text-sm text-gray-500">{deal.assignedToUser?.name ?? "—"}</span>
        </div>
      </TableCell>
    </TableRow>
  );
}
