/**
 * VehicleCard — public website vehicle card.
 * No auth, no sensitive data. Uses PublicVehicle type.
 * Spec: MOD_11 Section 10
 */

import Link from "next/link";
import type { PublicVehicle } from "@/modules/inventory";

interface VehicleCardProps {
  vehicle: PublicVehicle;
  href: string;
}

function formatPrice(price: string | null): string {
  if (!price) return "Preis auf Anfrage";
  const num = parseFloat(price);
  if (isNaN(num)) return "Preis auf Anfrage";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(num);
}

export function VehicleCard({ vehicle, href }: VehicleCardProps) {
  const mainPhoto = vehicle.photos.find((p) => p.position === 0) ?? vehicle.photos[0];

  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <div style={{
        borderRadius: "var(--brand-radius, 0.5rem)",
        overflow: "hidden",
        border: "1px solid #e5e7eb",
        background: "#ffffff",
        transition: "box-shadow 0.2s",
        cursor: "pointer",
      }}>
        {/* Photo */}
        <div style={{ aspectRatio: "4/3", overflow: "hidden", background: "#f3f4f6" }}>
          {mainPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mainPhoto.url}
              alt={mainPhoto.altText ?? `${vehicle.make} ${vehicle.model}`}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              loading="lazy"
            />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: "0.875rem" }}>
              Kein Foto
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ padding: "1rem" }}>
          <p style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.25rem" }}>
            {vehicle.make} {vehicle.model}
          </p>
          {vehicle.variant && (
            <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "0.5rem" }}>{vehicle.variant}</p>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginBottom: "0.75rem" }}>
            {vehicle.mileageKm != null && (
              <Chip>{vehicle.mileageKm.toLocaleString("de-DE")} km</Chip>
            )}
            {vehicle.firstRegistration && (
              <Chip>{vehicle.firstRegistration}</Chip>
            )}
            {vehicle.fuelType && (
              <Chip>{vehicle.fuelType}</Chip>
            )}
          </div>

          <p style={{ fontWeight: 800, fontSize: "1.125rem", color: "var(--brand-primary, #2563eb)" }}>
            {formatPrice(vehicle.askingPriceGross)}
          </p>
        </div>
      </div>
    </Link>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: "0.75rem",
      padding: "0.2rem 0.5rem",
      background: "#f3f4f6",
      borderRadius: "0.25rem",
      color: "#374151",
    }}>
      {children}
    </span>
  );
}
