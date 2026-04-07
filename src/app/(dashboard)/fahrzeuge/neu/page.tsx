"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ChevronLeft, Loader2, Wand2 } from "lucide-react";
import Link from "next/link";
import { api } from "@/shared/lib/trpc/client";
import { createVehicleSchema, type CreateVehicleInput } from "@/modules/inventory/domain/validators";

const CONDITIONS = ["Neuwagen", "Jahreswagen", "Vorführwagen", "Gebrauchtwagen"];
const FUEL_TYPES = ["Benzin", "Diesel", "Elektro", "Hybrid", "Plug-in-Hybrid", "Erdgas", "Autogas"];
const TRANSMISSIONS = ["Schaltgetriebe", "Automatik", "Halbautomatik"];
const BODY_TYPES = ["Limousine", "Kombi", "SUV", "Cabrio", "Coupé", "Van", "Kleintransporter", "Andere"];

export default function NeuesFahrzeugPage() {
  const router = useRouter();
  const [vinLoading, setVinLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<CreateVehicleInput, any, any>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createVehicleSchema) as any,
    defaultValues: {
      taxType: "margin",
      source: "manual",
      equipment: [],
      equipmentCodes: [],
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctrl = form.control as any;

  const decodeVinMutation = api.inventory.decodeVin.useMutation();
  const createMutation = api.inventory.create.useMutation({
    onSuccess: (vehicle) => {
      router.push(`/fahrzeuge/${vehicle.id}`);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const onVinDecode = async () => {
    const vin = form.getValues("vin");
    if (!vin || vin.length !== 17) return;

    setVinLoading(true);
    try {
      const result = await decodeVinMutation.mutateAsync({ vin });
      if (result) {
        if (result.make) form.setValue("make", result.make);
        if (result.model) form.setValue("model", result.model);
        if (result.variant) form.setValue("variant", result.variant);
        if (result.bodyType) form.setValue("bodyType", result.bodyType);
        if (result.fuelType) form.setValue("fuelType", result.fuelType);
        if (result.transmission) form.setValue("transmission", result.transmission);
        if (result.powerKw) form.setValue("powerKw", result.powerKw);
        if (result.powerPs) form.setValue("powerPs", result.powerPs);
        if (result.doors) form.setValue("doors", result.doors);
        if (result.seats) form.setValue("seats", result.seats);
      }
    } finally {
      setVinLoading(false);
    }
  };

  const onSubmit = (data: CreateVehicleInput) => {
    setError(null);
    createMutation.mutate(data);
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Back */}
      <Link
        href="/fahrzeuge"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6"
      >
        <ChevronLeft className="h-4 w-4" />
        Zurück zum Bestand
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Fahrzeug anlegen</h1>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

          {/* VIN */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Fahrgestellnummer (optional)</h2>
            <div className="flex gap-2">
              <FormField
                control={ctrl}
                name="vin"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input
                        placeholder="z.B. WBA3A5G59ENP26705"
                        className="font-mono uppercase"
                        maxLength={17}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="outline"
                onClick={onVinDecode}
                disabled={vinLoading}
              >
                {vinLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                <span className="ml-2 hidden sm:inline">Dekodieren</span>
              </Button>
            </div>
          </section>

          <Separator />

          {/* Master data */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Stammdaten</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={ctrl}
                name="make"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marke *</FormLabel>
                    <FormControl>
                      <Input placeholder="BMW" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={ctrl}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modell *</FormLabel>
                    <FormControl>
                      <Input placeholder="320d" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={ctrl}
                name="variant"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Variante</FormLabel>
                    <FormControl>
                      <Input placeholder="Sport Line" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={ctrl}
                name="firstRegistration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Erstzulassung</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <Separator />

          {/* Technical */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Technische Daten</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={ctrl}
                name="fuelType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kraftstoff</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Kraftstoff wählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FUEL_TYPES.map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={ctrl}
                name="transmission"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Getriebe</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Getriebe wählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TRANSMISSIONS.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={ctrl}
                name="bodyType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Karosserie</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Karosserie wählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BODY_TYPES.map((b) => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={ctrl}
                name="mileageKm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kilometerstand</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="50000"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={ctrl}
                name="powerKw"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Leistung (kW)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="140"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={ctrl}
                name="condition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zustand</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Zustand wählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CONDITIONS.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <Separator />

          {/* Prices */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Preis</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={ctrl}
                name="askingPriceGross"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verkaufspreis (brutto) €</FormLabel>
                    <FormControl>
                      <Input placeholder="14900" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={ctrl}
                name="purchasePriceNet"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Einkaufspreis (netto) €</FormLabel>
                    <FormControl>
                      <Input placeholder="10000" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={ctrl}
                name="taxType"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Besteuerungsart</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="margin">Differenzbesteuerung (§25a UStG)</SelectItem>
                        <SelectItem value="regular">Regelbesteuerung (19% MwSt.)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <Separator />

          {/* Description */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Beschreibung</h2>
            <FormField
              control={ctrl}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Inserat-Titel</FormLabel>
                  <FormControl>
                    <Input placeholder="BMW 320d Sport Line | Automatik | Navi" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={ctrl}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschreibungstext</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Fahrzeugbeschreibung..."
                      className="min-h-32"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Als Entwurf speichern
            </Button>
            <Link href="/fahrzeuge" className={cn(buttonVariants({ variant: "outline" }))}>Abbrechen</Link>
          </div>
        </form>
      </Form>
    </div>
  );
}
