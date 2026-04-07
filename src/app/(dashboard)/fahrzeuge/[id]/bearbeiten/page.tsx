"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { ChevronLeft, Loader2 } from "lucide-react";
import { api } from "@/shared/lib/trpc/client";
import { updateVehicleSchema, type UpdateVehicleInput } from "@/modules/inventory/domain/validators";

const FUEL_TYPES = ["Benzin", "Diesel", "Elektro", "Hybrid", "Plug-in-Hybrid", "Erdgas", "Autogas"];
const TRANSMISSIONS = ["Schaltgetriebe", "Automatik", "Halbautomatik"];
const BODY_TYPES = ["Limousine", "Kombi", "SUV", "Cabrio", "Coupé", "Van", "Kleintransporter", "Andere"];
const CONDITIONS = ["Neuwagen", "Jahreswagen", "Vorführwagen", "Gebrauchtwagen"];

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function FahrzeugBearbeitenPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const { data: vehicle, isLoading } = api.inventory.getById.useQuery({ id });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<UpdateVehicleInput, any, any>({
    resolver: zodResolver(updateVehicleSchema) as any,
    defaultValues: { id },
  });

  // Populate form when vehicle data arrives
  useEffect(() => {
    if (vehicle) {
      form.reset({
        id: vehicle.id,
        make: vehicle.make,
        model: vehicle.model,
        variant: vehicle.variant ?? undefined,
        firstRegistration: vehicle.firstRegistration ?? undefined,
        fuelType: vehicle.fuelType ?? undefined,
        transmission: vehicle.transmission ?? undefined,
        bodyType: vehicle.bodyType ?? undefined,
        mileageKm: vehicle.mileageKm ?? undefined,
        powerKw: vehicle.powerKw ?? undefined,
        powerPs: vehicle.powerPs ?? undefined,
        condition: vehicle.condition ?? undefined,
        colorExterior: vehicle.colorExterior ?? undefined,
        colorInterior: vehicle.colorInterior ?? undefined,
        huValidUntil: vehicle.huValidUntil ?? undefined,
        accidentFree: vehicle.accidentFree ?? undefined,
        nonSmoker: vehicle.nonSmoker ?? undefined,
        askingPriceGross: vehicle.askingPriceGross ?? undefined,
        purchasePriceNet: ("purchasePriceNet" in vehicle ? (vehicle as { purchasePriceNet?: string | null }).purchasePriceNet : undefined) ?? undefined,
        taxType: vehicle.taxType,
        title: vehicle.title ?? undefined,
        description: vehicle.description ?? undefined,
        internalNotes: ("internalNotes" in vehicle ? (vehicle as { internalNotes?: string | null }).internalNotes : undefined) ?? undefined,
        featured: vehicle.featured,
        equipment: vehicle.equipment ?? [],
      });
    }
  }, [vehicle, form]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctrl = form.control as any;

  const updateMutation = api.inventory.update.useMutation({
    onSuccess: () => router.push(`/fahrzeuge/${id}`),
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>Fahrzeug nicht gefunden.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const hasPrices = "purchasePriceNet" in vehicle;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <Link
        href={`/fahrzeuge/${id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6"
      >
        <ChevronLeft className="h-4 w-4" />
        Zurück zur Übersicht
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {vehicle.make} {vehicle.model} bearbeiten
      </h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-8">

          {/* Master data */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Stammdaten</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={ctrl} name="make" render={({ field }) => (
                <FormItem>
                  <FormLabel>Marke *</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={ctrl} name="model" render={({ field }) => (
                <FormItem>
                  <FormLabel>Modell *</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={ctrl} name="variant" render={({ field }) => (
                <FormItem>
                  <FormLabel>Variante</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={ctrl} name="firstRegistration" render={({ field }) => (
                <FormItem>
                  <FormLabel>Erstzulassung</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </section>

          <Separator />

          {/* Technical */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Technische Daten</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={ctrl} name="fuelType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Kraftstoff</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {FUEL_TYPES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={ctrl} name="transmission" render={({ field }) => (
                <FormItem>
                  <FormLabel>Getriebe</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {TRANSMISSIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={ctrl} name="mileageKm" render={({ field }) => (
                <FormItem>
                  <FormLabel>Kilometerstand</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={ctrl} name="powerKw" render={({ field }) => (
                <FormItem>
                  <FormLabel>Leistung (kW)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={ctrl} name="condition" render={({ field }) => (
                <FormItem>
                  <FormLabel>Zustand</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={ctrl} name="colorExterior" render={({ field }) => (
                <FormItem>
                  <FormLabel>Außenfarbe</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </section>

          <Separator />

          {/* Prices */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Preis</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={ctrl} name="askingPriceGross" render={({ field }) => (
                <FormItem>
                  <FormLabel>Verkaufspreis (brutto) €</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {hasPrices && (
                <FormField control={ctrl} name="purchasePriceNet" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Einkaufspreis (netto) €</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              <FormField control={ctrl} name="taxType" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Besteuerungsart</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? "margin"}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="margin">Differenzbesteuerung (§25a UStG)</SelectItem>
                      <SelectItem value="regular">Regelbesteuerung (19% MwSt.)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </section>

          <Separator />

          {/* Description */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Beschreibung</h2>
            <FormField control={ctrl} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Inserat-Titel</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={ctrl} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Beschreibungstext</FormLabel>
                <FormControl>
                  <Textarea className="min-h-32" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {hasPrices && (
              <FormField control={ctrl} name="internalNotes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Interne Notizen</FormLabel>
                  <FormControl>
                    <Textarea className="min-h-20" placeholder="Interne Notizen (nicht öffentlich)" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}
          </section>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Speichern
            </Button>
            <Link href={`/fahrzeuge/${id}`} className={cn(buttonVariants({ variant: "outline" }))}>Abbrechen</Link>
          </div>

          {updateMutation.error && (
            <Alert variant="destructive">
              <AlertDescription>{updateMutation.error.message}</AlertDescription>
            </Alert>
          )}
        </form>
      </Form>
    </div>
  );
}
