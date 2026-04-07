"use client";

import { use } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ChevronLeft, Edit, Globe, GlobeLock, Archive, Gauge,
  Calendar, Fuel, Settings, FileText, Loader2
} from "lucide-react";
import { api } from "@/shared/lib/trpc/client";
import { VehicleStatusBadge, VehiclePublishBadge } from "@/modules/inventory/components/vehicle-status-badge";
import { DaysInStockBadge, PriceDisplay, PriceSection } from "@/modules/inventory/components/price-display";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function FahrzeugDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const { data: vehicle, isLoading, error } = api.inventory.getById.useQuery({ id });
  const utils = api.useUtils();

  const publishMutation = api.inventory.publish.useMutation({
    onSuccess: () => utils.inventory.getById.invalidate({ id }),
  });

  const unpublishMutation = api.inventory.unpublish.useMutation({
    onSuccess: () => utils.inventory.getById.invalidate({ id }),
  });

  const archiveMutation = api.inventory.archive.useMutation({
    onSuccess: () => router.push("/fahrzeuge"),
  });

  const generateDescMutation = api.inventory.generateDescription.useMutation();

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="aspect-[16/9] w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>Fahrzeug nicht gefunden.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const hasPrices = "purchasePriceNet" in vehicle;
  const photos = vehicle.photos ?? [];
  const mainPhoto = photos.find((p) => p.position === 1 || p.kind === "photo") ?? photos[0];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <Link
        href="/fahrzeuge"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Zurück zum Bestand
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {vehicle.make} {vehicle.model}
            {vehicle.variant && <span className="text-gray-500 font-normal"> {vehicle.variant}</span>}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <VehicleStatusBadge status={vehicle.status} />
            <VehiclePublishBadge published={vehicle.published} />
            {vehicle.featured && <Badge variant="outline" className="text-blue-600 border-blue-200">⭐ Highlight</Badge>}
            <DaysInStockBadge daysInStock={vehicle.daysInStock} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Link href={`/fahrzeuge/${id}/bearbeiten`} className={cn(buttonVariants({ variant: "outline" }))}>
            <Edit className="h-4 w-4 mr-2" />
            Bearbeiten
          </Link>

          {vehicle.published ? (
            <Button
              variant="outline"
              className="text-amber-700 border-amber-200"
              onClick={() => unpublishMutation.mutate({ id })}
              disabled={unpublishMutation.isPending}
            >
              {unpublishMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : <GlobeLock className="h-4 w-4 mr-2" />
              }
              Offline nehmen
            </Button>
          ) : (
            <Button
              onClick={() => publishMutation.mutate({ id })}
              disabled={publishMutation.isPending}
            >
              {publishMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : <Globe className="h-4 w-4 mr-2" />
              }
              Veröffentlichen
            </Button>
          )}

          <Button
            variant="outline"
            className="text-red-600 border-red-200"
            onClick={() => {
              if (confirm("Fahrzeug archivieren?")) {
                archiveMutation.mutate({ id });
              }
            }}
            disabled={archiveMutation.isPending}
          >
            <Archive className="h-4 w-4 mr-2" />
            Archivieren
          </Button>
        </div>
      </div>

      {/* Main photo */}
      {mainPhoto && (
        <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-gray-100">
          <Image
            src={mainPhoto.url}
            alt={mainPhoto.altText ?? `${vehicle.make} ${vehicle.model}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 896px"
            priority
          />
        </div>
      )}

      {/* Photo gallery thumbnails */}
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {photos.filter((p) => p.kind === "photo").slice(0, 10).map((photo) => (
            <div key={photo.id} className="relative w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
              <Image
                src={photo.url}
                alt={photo.altText ?? ""}
                fill
                className="object-cover"
                sizes="80px"
              />
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">

          {/* Specs grid */}
          <div className="rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Fahrzeugdaten
            </h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {vehicle.firstRegistration && (
                <>
                  <dt className="flex items-center gap-1.5 text-gray-500">
                    <Calendar className="h-3.5 w-3.5" />
                    Erstzulassung
                  </dt>
                  <dd>{new Date(vehicle.firstRegistration).toLocaleDateString("de-DE", { year: "numeric", month: "2-digit" })}</dd>
                </>
              )}
              {vehicle.mileageKm !== null && (
                <>
                  <dt className="flex items-center gap-1.5 text-gray-500">
                    <Gauge className="h-3.5 w-3.5" />
                    Kilometerstand
                  </dt>
                  <dd>{new Intl.NumberFormat("de-DE").format(vehicle.mileageKm)} km</dd>
                </>
              )}
              {vehicle.fuelType && (
                <>
                  <dt className="flex items-center gap-1.5 text-gray-500">
                    <Fuel className="h-3.5 w-3.5" />
                    Kraftstoff
                  </dt>
                  <dd>{vehicle.fuelType}</dd>
                </>
              )}
              {vehicle.transmission && (
                <>
                  <dt className="text-gray-500">Getriebe</dt>
                  <dd>{vehicle.transmission}</dd>
                </>
              )}
              {vehicle.powerKw && (
                <>
                  <dt className="text-gray-500">Leistung</dt>
                  <dd>{vehicle.powerKw} kW {vehicle.powerPs ? `/ ${vehicle.powerPs} PS` : ""}</dd>
                </>
              )}
              {vehicle.bodyType && (
                <>
                  <dt className="text-gray-500">Karosserie</dt>
                  <dd>{vehicle.bodyType}</dd>
                </>
              )}
              {vehicle.colorExterior && (
                <>
                  <dt className="text-gray-500">Farbe</dt>
                  <dd>{vehicle.colorExterior}</dd>
                </>
              )}
              {vehicle.condition && (
                <>
                  <dt className="text-gray-500">Zustand</dt>
                  <dd>{vehicle.condition}</dd>
                </>
              )}
              {vehicle.huValidUntil && (
                <>
                  <dt className="text-gray-500">TÜV/HU bis</dt>
                  <dd>{new Date(vehicle.huValidUntil).toLocaleDateString("de-DE", { year: "numeric", month: "2-digit" })}</dd>
                </>
              )}
              {vehicle.accidentFree !== null && (
                <>
                  <dt className="text-gray-500">Unfallfreiheit</dt>
                  <dd>{vehicle.accidentFree ? "Unfallfrei" : "Unfall/Schaden"}</dd>
                </>
              )}
              {vehicle.vin && (
                <>
                  <dt className="text-gray-500">FIN</dt>
                  <dd className="font-mono text-xs">{vehicle.vin}</dd>
                </>
              )}
            </dl>
          </div>

          {/* Description */}
          {(vehicle.title ?? vehicle.description) && (
            <div className="rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Beschreibung
              </h2>
              {vehicle.title && <p className="font-medium text-gray-800 mb-2">{vehicle.title}</p>}
              {vehicle.description && (
                <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                  {vehicle.description}
                </p>
              )}
            </div>
          )}

          {/* Equipment */}
          {vehicle.equipment && vehicle.equipment.length > 0 && (
            <div className="rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Ausstattung</h2>
              <div className="flex flex-wrap gap-2">
                {vehicle.equipment.map((item, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{item}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: price */}
        <div className="space-y-4">
          <PriceDisplay
            askingPriceGross={vehicle.askingPriceGross}
            taxType={vehicle.taxType}
          />

          {hasPrices && (
            <PriceSection
              askingPriceGross={vehicle.askingPriceGross}
              purchasePriceNet={(vehicle as { purchasePriceNet?: string | null }).purchasePriceNet ?? null}
              minimumPriceGross={(vehicle as { minimumPriceGross?: string | null }).minimumPriceGross ?? null}
              margin={(vehicle as { margin?: string | null }).margin ?? null}
              taxType={vehicle.taxType}
            />
          )}

          <Separator />

          {/* AI description generator */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">KI-Beschreibung generieren</p>
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                const result = await generateDescMutation.mutateAsync({ vehicleId: id });
                alert(`Titel: ${result.title}\n\nBeschreibung: ${result.description}`);
              }}
              disabled={generateDescMutation.isPending}
            >
              {generateDescMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : "✨ "}
              KI-Beschreibung generieren
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
