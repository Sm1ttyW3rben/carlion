/**
 * ContactBox — phone, email, address, opening hours.
 * Spec: MOD_11 Section 10
 */

import type { PublicBranding, OpeningHours } from "@/modules/dna-engine";

interface ContactBoxProps {
  branding: PublicBranding;
}

const DAY_LABELS: Record<string, string> = {
  monday: "Montag",
  tuesday: "Dienstag",
  wednesday: "Mittwoch",
  thursday: "Donnerstag",
  friday: "Freitag",
  saturday: "Samstag",
  sunday: "Sonntag",
};

export function ContactBox({ branding }: ContactBoxProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem" }}>
      {/* Contact info */}
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: "0.75rem", fontSize: "1rem" }}>Kontakt</h3>
        <div style={{ fontSize: "0.9375rem", lineHeight: 1.8, color: "#374151" }}>
          {branding.address && (
            <address style={{ fontStyle: "normal" }}>
              {branding.address.street}<br />
              {branding.address.zip} {branding.address.city}
            </address>
          )}
          {branding.phone && (
            <p><a href={`tel:${branding.phone}`} style={{ color: "var(--brand-primary, #2563eb)", textDecoration: "none" }}>{branding.phone}</a></p>
          )}
          {branding.email && (
            <p><a href={`mailto:${branding.email}`} style={{ color: "var(--brand-primary, #2563eb)", textDecoration: "none" }}>{branding.email}</a></p>
          )}
        </div>
      </div>

      {/* Opening hours */}
      {branding.openingHours && (
        <div>
          <h3 style={{ fontWeight: 700, marginBottom: "0.75rem", fontSize: "1rem" }}>Öffnungszeiten</h3>
          <OpeningHoursDisplay hours={branding.openingHours} />
        </div>
      )}
    </div>
  );
}

function OpeningHoursDisplay({ hours }: { hours: OpeningHours }) {
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

  return (
    <table style={{ fontSize: "0.875rem", borderCollapse: "collapse", width: "100%" }}>
      <tbody>
        {days.map((day) => {
          const h = hours[day];
          if (!h) return null;
          return (
            <tr key={day}>
              <td style={{ paddingRight: "1rem", paddingBottom: "0.25rem", color: "#6b7280", whiteSpace: "nowrap" }}>
                {DAY_LABELS[day]}
              </td>
              <td style={{ paddingBottom: "0.25rem", fontWeight: 500 }}>
                {h.closed ? "Geschlossen" : `${h.open} – ${h.close} Uhr`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
