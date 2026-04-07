"use client";

import type { FontHeadingEnum, FontBodyEnum } from "../domain/types";

interface FontPreviewProps {
  fontHeading: FontHeadingEnum;
  fontBody: FontBodyEnum;
  dealerName?: string;
}

export function FontPreview({
  fontHeading,
  fontBody,
  dealerName = "Autohaus Beispiel",
}: FontPreviewProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
      <p className="text-xs text-gray-400 mb-2">Schriften-Vorschau</p>
      <h3
        className="text-xl font-bold text-gray-900 leading-tight"
        style={{ fontFamily: `'${fontHeading}', sans-serif` }}
      >
        {dealerName}
      </h3>
      <p
        className="text-sm text-gray-600 leading-relaxed"
        style={{ fontFamily: `'${fontBody}', sans-serif` }}
      >
        Ihr zuverlässiger Partner für Fahrzeuge aller Art. Wir bieten eine
        große Auswahl und persönliche Beratung.
      </p>
      <div className="flex gap-4 pt-1">
        <div className="text-xs text-gray-400">
          Überschrift: <span className="font-medium text-gray-600">{fontHeading}</span>
        </div>
        <div className="text-xs text-gray-400">
          Text: <span className="font-medium text-gray-600">{fontBody}</span>
        </div>
      </div>
    </div>
  );
}
