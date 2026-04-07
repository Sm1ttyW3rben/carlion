"use client";

import type { TenantBrandingView } from "../domain/types";

interface CompletenessChecklistProps {
  branding: Pick<
    TenantBrandingView,
    | "completeness"
    | "primaryColor"
    | "tone"
    | "formality"
    | "address"
    | "phone"
    | "email"
    | "openingHours"
    | "imprintData"
    | "logoUrl"
  >;
}

interface CheckItem {
  label: string;
  done: boolean;
  level: "branding_complete" | "publish_ready";
}

export function CompletenessChecklist({ branding }: CompletenessChecklistProps) {
  const items: CheckItem[] = [
    // branding_complete
    { label: "Primärfarbe festgelegt", done: !!branding.primaryColor, level: "branding_complete" },
    { label: "Tonalität gewählt", done: !!branding.tone, level: "branding_complete" },
    { label: "Anredeform gewählt", done: !!branding.formality, level: "branding_complete" },
    { label: "Adresse eingetragen", done: !!branding.address, level: "branding_complete" },
    { label: "Telefonnummer eingetragen", done: !!branding.phone, level: "branding_complete" },
    { label: "E-Mail eingetragen", done: !!branding.email, level: "branding_complete" },
    // publish_ready
    { label: "Logo hochgeladen", done: !!branding.logoUrl, level: "publish_ready" },
    { label: "Öffnungszeiten eingetragen", done: !!branding.openingHours, level: "publish_ready" },
    { label: "Impressum-Daten eingetragen", done: !!branding.imprintData, level: "publish_ready" },
  ];

  const completenessLabels = {
    draft: { label: "Entwurf", color: "text-gray-500", bg: "bg-gray-100" },
    branding_complete: { label: "Branding komplett", color: "text-blue-700", bg: "bg-blue-100" },
    publish_ready: { label: "Bereit zur Veröffentlichung", color: "text-green-700", bg: "bg-green-100" },
  };

  const current = completenessLabels[branding.completeness];

  const brandingCompleteItems = items.filter((i) => i.level === "branding_complete");
  const publishReadyItems = items.filter((i) => i.level === "publish_ready");

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      {/* Status badge */}
      <div className="flex items-center gap-2">
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${current.bg} ${current.color}`}
        >
          {current.label}
        </span>
      </div>

      {/* Section: Branding komplett */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Für Branding komplett
        </p>
        {brandingCompleteItems.map((item) => (
          <CheckRow key={item.label} item={item} />
        ))}
      </div>

      {/* Section: Veröffentlichung */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Für Veröffentlichung
        </p>
        {publishReadyItems.map((item) => (
          <CheckRow key={item.label} item={item} />
        ))}
      </div>
    </div>
  );
}

function CheckRow({ item }: { item: CheckItem }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-4 h-4 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
          item.done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
        }`}
      >
        {item.done ? "✓" : "·"}
      </span>
      <span
        className={`text-sm ${item.done ? "text-gray-700" : "text-gray-400"}`}
      >
        {item.label}
      </span>
    </div>
  );
}
