"use client";

import { use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, User, Car, CreditCard, Clock } from "lucide-react";
import { api } from "@/shared/lib/trpc/client";
import { DealStageBadge } from "@/modules/sales/components/deal-stage-badge";
import { DealPriorityBadge } from "@/modules/sales/components/deal-priority-badge";
import { StageHistory } from "@/modules/sales/components/stage-history";
import { STAGE_TRANSITIONS, DEAL_STAGE_LABELS } from "@/modules/sales/domain/constants";
import type { DealStage } from "@/modules/sales/domain/types";

function formatPrice(price: string | null): string {
  if (!price) return "—";
  return `${parseFloat(price).toLocaleString("de-DE")} €`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function VerkaufDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: deal, isLoading } = api.sales.getById.useQuery({ id });
  const utils = api.useUtils();

  const moveToStageMutation = api.sales.moveToStage.useMutation({
    onSuccess: () => utils.sales.getById.invalidate({ id }),
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!deal) {
    return <div className="p-4 md:p-6 text-center py-16"><p className="text-gray-500">Vorgang nicht gefunden.</p></div>;
  }

  const allowedTransitions = STAGE_TRANSITIONS[deal.stage] ?? [];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/verkauf" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{deal.contact.displayName}</h1>
              <DealStageBadge stage={deal.stage} />
              <DealPriorityBadge priority={deal.priority} />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {deal.vehicle.make} {deal.vehicle.model} · Erstellt {formatDate(deal.createdAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-4">
          {/* Stage actions */}
          {allowedTransitions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Nächste Phase</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {allowedTransitions.map((stage) => (
                    <Button
                      key={stage}
                      variant={stage === "won" ? "default" : stage === "lost" ? "outline" : "secondary"}
                      size="sm"
                      disabled={moveToStageMutation.isPending}
                      onClick={() => {
                        if (stage === "won") {
                          const price = prompt("Abschlusspreis (€):");
                          if (price) moveToStageMutation.mutate({ id, stage, finalPrice: parseFloat(price) });
                        } else if (stage === "lost") {
                          const reason = prompt("Verlustgrund:");
                          if (reason) moveToStageMutation.mutate({ id, stage, lostReason: reason });
                        } else if (deal.stage === "lost" && stage === "inquiry") {
                          const notes = prompt("Begründung für Wiederbelebung:");
                          if (notes) moveToStageMutation.mutate({ id, stage, notes });
                        } else {
                          moveToStageMutation.mutate({ id, stage });
                        }
                      }}
                    >
                      {DEAL_STAGE_LABELS[stage]}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conditions */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Konditionen</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              {"offeredPrice" in deal && <div><span className="text-gray-500">Angebotspreis:</span> <span className="font-medium">{formatPrice(deal.offeredPrice)}</span></div>}
              {"finalPrice" in deal && <div><span className="text-gray-500">Abschlusspreis:</span> <span className="font-medium">{formatPrice(deal.finalPrice)}</span></div>}
              <div><span className="text-gray-500">Inzahlungnahme:</span> <span>{deal.tradeInVehicle ?? "—"}</span></div>
              {"tradeInValue" in deal && <div><span className="text-gray-500">Inzahlungnahme-Wert:</span> <span>{formatPrice(deal.tradeInValue)}</span></div>}
              <div><span className="text-gray-500">Finanzierung:</span> <span>{deal.financingRequested ? "Ja" : "Nein"}</span></div>
              {deal.lostReason && <div className="col-span-2"><span className="text-gray-500">Verlustgrund:</span> <span className="text-red-600">{deal.lostReason}</span></div>}
            </CardContent>
          </Card>

          {/* Stage history */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Phasen-Verlauf</CardTitle></CardHeader>
            <CardContent>
              <StageHistory entries={deal.stageHistory} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Contact */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Kontakt</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Link href={`/kontakte/${deal.contact.id}`} className="flex items-center gap-2 text-blue-600 hover:underline font-medium">
                <User className="h-4 w-4" /> {deal.contact.displayName}
              </Link>
              {deal.contact.phone && <p className="text-gray-600">{deal.contact.phone}</p>}
              {deal.contact.email && <p className="text-gray-600">{deal.contact.email}</p>}
            </CardContent>
          </Card>

          {/* Vehicle */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Fahrzeug</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Link href={`/fahrzeuge/${deal.vehicle.id}`} className="flex items-center gap-2 text-blue-600 hover:underline font-medium">
                <Car className="h-4 w-4" /> {deal.vehicle.make} {deal.vehicle.model} {deal.vehicle.variant ?? ""}
              </Link>
              <p className="text-gray-600">Listenpreis: {formatPrice(deal.vehicle.askingPriceGross)}</p>
              {deal.vehicle.mainPhotoUrl && (
                <img src={deal.vehicle.mainPhotoUrl} alt="" className="w-full rounded-lg" />
              )}
            </CardContent>
          </Card>

          {/* Meta */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-gray-400" /> {deal.daysInCurrentStage} Tage in aktueller Phase</div>
              <div className="flex items-center gap-2"><User className="h-4 w-4 text-gray-400" /> {deal.assignedToUser?.name ?? "Nicht zugewiesen"}</div>
              <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-gray-400" /> Quelle: {deal.source}</div>
              {"internalNotes" in deal && deal.internalNotes && <div className="pt-2 border-t"><p className="text-xs text-gray-500">Notizen:</p><p>{deal.internalNotes}</p></div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
