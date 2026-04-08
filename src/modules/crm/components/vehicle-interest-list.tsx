import Link from "next/link";
import { Car } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { INTEREST_TYPE_LABELS } from "../domain/constants";
import type { VehicleInterestView } from "../domain/types";

export function VehicleInterestList({
  interests,
}: {
  interests: VehicleInterestView[];
}) {
  if (interests.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-2">Keine Fahrzeug-Interessen.</p>
    );
  }

  return (
    <div className="space-y-2">
      {interests.map((interest) => (
        <Link
          key={interest.id}
          href={`/fahrzeuge/${interest.vehicleId}`}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="flex-shrink-0 w-8 h-8 rounded bg-blue-50 flex items-center justify-center">
            <Car className="h-4 w-4 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">
              {interest.vehicleLabel}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="secondary" className="text-xs">
                {INTEREST_TYPE_LABELS[interest.interestType]}
              </Badge>
              {interest.notes && (
                <span className="text-xs text-gray-400 truncate">
                  {interest.notes}
                </span>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
