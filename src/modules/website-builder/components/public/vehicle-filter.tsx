"use client";

/**
 * VehicleFilter — client-side filter + grid for the public Fahrzeugliste.
 * Filters make/fuelType/priceMax client-side from the pre-fetched vehicles array.
 * Spec: MOD_11 Section 3
 */

import { useState, useMemo } from "react";
import type { PublicVehicle } from "@/modules/inventory";
import { VehicleCard } from "./vehicle-card";

interface VehicleFilterProps {
  vehicles: PublicVehicle[];
  tenantSlug: string;
}

const FUEL_LABELS: Record<string, string> = {
  petrol: "Benzin", diesel: "Diesel", electric: "Elektro",
  hybrid_petrol: "Hybrid (Benzin)", hybrid_diesel: "Hybrid (Diesel)",
  lpg: "LPG", cng: "CNG", other: "Sonstige",
};

const PRICE_STEPS = [5000, 10000, 15000, 20000, 30000, 50000, 75000, 100000];

export function VehicleFilter({ vehicles, tenantSlug }: VehicleFilterProps) {
  const [makeFilter, setMakeFilter] = useState("");
  const [fuelFilter, setFuelFilter] = useState("");
  const [priceMax, setPriceMax] = useState(0);

  const makes = useMemo(() => {
    const set = new Set(vehicles.map((v) => v.make));
    return Array.from(set).sort();
  }, [vehicles]);

  const fuelTypes = useMemo(() => {
    const set = new Set(vehicles.flatMap((v) => v.fuelType ? [v.fuelType] : []));
    return Array.from(set).sort();
  }, [vehicles]);

  const filtered = useMemo(() => {
    return vehicles.filter((v) => {
      if (makeFilter && v.make !== makeFilter) return false;
      if (fuelFilter && v.fuelType !== fuelFilter) return false;
      if (priceMax > 0 && v.askingPriceGross) {
        const price = parseFloat(v.askingPriceGross);
        if (!isNaN(price) && price > priceMax) return false;
      }
      return true;
    });
  }, [vehicles, makeFilter, fuelFilter, priceMax]);

  const selectStyle: React.CSSProperties = {
    padding: "0.5rem 0.75rem",
    border: "1px solid #d1d5db",
    borderRadius: "var(--brand-radius, 0.375rem)",
    fontSize: "0.875rem",
    background: "white",
    cursor: "pointer",
    color: "#374151",
  };

  const hasFilter = makeFilter || fuelFilter || priceMax > 0;

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "2rem", alignItems: "center" }}>
        {makes.length > 1 && (
          <select value={makeFilter} onChange={(e) => setMakeFilter(e.target.value)} style={selectStyle}>
            <option value="">Alle Marken</option>
            {makes.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}

        {fuelTypes.length > 1 && (
          <select value={fuelFilter} onChange={(e) => setFuelFilter(e.target.value)} style={selectStyle}>
            <option value="">Alle Kraftstoffe</option>
            {fuelTypes.map((f) => (
              <option key={f} value={f}>{FUEL_LABELS[f] ?? f}</option>
            ))}
          </select>
        )}

        <select value={priceMax} onChange={(e) => setPriceMax(Number(e.target.value))} style={selectStyle}>
          <option value={0}>Alle Preise</option>
          {PRICE_STEPS.map((p) => (
            <option key={p} value={p}>
              bis {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(p)}
            </option>
          ))}
        </select>

        {hasFilter && (
          <button
            onClick={() => { setMakeFilter(""); setFuelFilter(""); setPriceMax(0); }}
            style={{ ...selectStyle, border: "none", background: "none", color: "var(--brand-primary, #2563eb)", fontWeight: 600, cursor: "pointer", padding: "0.5rem" }}
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      {/* Results count */}
      {hasFilter && (
        <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "1rem" }}>
          {filtered.length} {filtered.length === 1 ? "Fahrzeug" : "Fahrzeuge"} gefunden
        </p>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 2rem", color: "#6b7280" }}>
          <p style={{ fontSize: "1.125rem", marginBottom: "0.5rem" }}>Keine Fahrzeuge gefunden.</p>
          <p style={{ fontSize: "0.875rem" }}>Bitte passen Sie Ihre Filtereinstellungen an.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.5rem" }}>
          {filtered.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              href={`/${tenantSlug}/fahrzeuge/${v.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
