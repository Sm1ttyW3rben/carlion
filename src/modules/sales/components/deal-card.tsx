import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { User, Clock, CreditCard } from "lucide-react";
import { DealPriorityBadge } from "./deal-priority-badge";
import type { DealListItem } from "../domain/types";

function formatPrice(price: string | null): string {
  if (!price) return "—";
  return `${parseFloat(price).toLocaleString("de-DE")} €`;
}

export function DealCard({ deal }: { deal: DealListItem }) {
  return (
    <Link href={`/verkauf/${deal.id}`}>
      <Card className={`hover:shadow-md transition-shadow cursor-pointer ${!deal.assignedToUser ? "border-red-300" : ""}`}>
        <CardContent className="p-3 space-y-2">
          {/* Contact + Priority */}
          <div className="flex items-start justify-between gap-1">
            <p className="font-medium text-sm text-gray-900 truncate">{deal.contactName}</p>
            <DealPriorityBadge priority={deal.priority} />
          </div>

          {/* Vehicle */}
          <div className="flex items-center gap-2">
            {deal.vehicleMainPhotoUrl ? (
              <img src={deal.vehicleMainPhotoUrl} alt="" className="w-10 h-8 rounded object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-8 rounded bg-gray-100 flex-shrink-0" />
            )}
            <p className="text-xs text-gray-600 truncate">{deal.vehicleTitle}</p>
          </div>

          {/* Price + Days */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <CreditCard className="h-3 w-3" />
              <span>{formatPrice(deal.offeredPrice ?? deal.askingPrice)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{deal.daysInCurrentStage}d</span>
            </div>
          </div>

          {/* Assigned */}
          <div className="flex items-center gap-1 text-xs">
            <User className="h-3 w-3 text-gray-400" />
            <span className={deal.assignedToUser ? "text-gray-500" : "text-red-500 font-medium"}>
              {deal.assignedToUser?.name ?? "Nicht zugewiesen"}
            </span>
          </div>

          {deal.financingRequested && (
            <span className="text-xs text-purple-600 font-medium">💳 Finanzierung</span>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
