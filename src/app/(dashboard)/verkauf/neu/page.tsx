"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { api } from "@/shared/lib/trpc/client";

export default function VerkaufNeuPage() {
  const router = useRouter();
  const [contactId, setContactId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [offeredPrice, setOfferedPrice] = useState("");
  const [tradeInVehicle, setTradeInVehicle] = useState("");
  const [tradeInValue, setTradeInValue] = useState("");
  const [financingRequested, setFinancingRequested] = useState(false);
  const [notes, setNotes] = useState("");

  const mutation = api.sales.create.useMutation({
    onSuccess: (data) => router.push(`/verkauf/${data.id}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      contactId,
      vehicleId,
      offeredPrice: offeredPrice ? parseFloat(offeredPrice) : undefined,
      tradeInVehicle: tradeInVehicle || undefined,
      tradeInValue: tradeInValue ? parseFloat(tradeInValue) : undefined,
      financingRequested,
      internalNotes: notes || undefined,
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/verkauf" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vorgang anlegen</h1>
          <p className="text-sm text-gray-500 mt-0.5">Neuen Verkaufsvorgang erstellen</p>
        </div>
      </div>

      {mutation.error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{mutation.error.message}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Contact + Vehicle IDs (in production: typeahead pickers) */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium text-gray-700">Verknüpfungen</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contactId">Kontakt-ID</Label>
              <Input id="contactId" placeholder="UUID des Kontakts" value={contactId} onChange={(e) => setContactId(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="vehicleId">Fahrzeug-ID</Label>
              <Input id="vehicleId" placeholder="UUID des Fahrzeugs" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} required />
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-medium text-gray-700">Konditionen</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="offeredPrice">Angebotspreis (€)</Label>
              <Input id="offeredPrice" type="number" min="0" step="0.01" value={offeredPrice} onChange={(e) => setOfferedPrice(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="tradeInVehicle">Inzahlungnahme (Fahrzeug)</Label>
              <Input id="tradeInVehicle" value={tradeInVehicle} onChange={(e) => setTradeInVehicle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="tradeInValue">Inzahlungnahme-Wert (€)</Label>
              <Input id="tradeInValue" type="number" min="0" step="0.01" value={tradeInValue} onChange={(e) => setTradeInValue(e.target.value)} />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch id="financing" checked={financingRequested} onCheckedChange={setFinancingRequested} />
              <Label htmlFor="financing">Finanzierung gewünscht</Label>
            </div>
          </div>
        </fieldset>

        <div>
          <Label htmlFor="notes">Interne Notizen</Label>
          <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <Button type="submit" disabled={!contactId || !vehicleId || mutation.isPending}>
          {mutation.isPending ? "Wird erstellt..." : "Vorgang anlegen"}
        </Button>
      </form>
    </div>
  );
}
