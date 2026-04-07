"use client";

import { FONT_PAIRINGS } from "../domain/constants";
import type { ToneEnum } from "../domain/types";

interface ToneSelectorProps {
  value: ToneEnum;
  onChange: (tone: ToneEnum) => void;
  disabled?: boolean;
}

const TONE_CONFIG: Record<
  ToneEnum,
  { label: string; description: string; example: string }
> = {
  professional: {
    label: "Professionell",
    description: "Seriös, vertrauenswürdig, kompetent",
    example: "Wir beraten Sie professionell und finden das passende Fahrzeug für Ihre Bedürfnisse.",
  },
  friendly: {
    label: "Freundlich",
    description: "Herzlich, zugänglich, persönlich",
    example: "Schön, dass Sie da sind! Wir helfen Ihnen gerne dabei, Ihr Traumauto zu finden.",
  },
  premium: {
    label: "Premium",
    description: "Exklusiv, hochwertig, distinktiv",
    example: "Erleben Sie außergewöhnliche Fahrzeuge — handverlesen für höchste Ansprüche.",
  },
  casual: {
    label: "Locker",
    description: "Entspannt, direkt, unkompliziert",
    example: "Hey! Wir machen den Autokauf easy — ohne Stress, dafür mit viel Auswahl.",
  },
};

export function ToneSelector({ value, onChange, disabled }: ToneSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">Tonalität</label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(Object.entries(TONE_CONFIG) as [ToneEnum, typeof TONE_CONFIG[ToneEnum]][]).map(
          ([tone, config]) => {
            const fonts = FONT_PAIRINGS[tone];
            const isSelected = value === tone;
            return (
              <button
                key={tone}
                type="button"
                disabled={disabled}
                onClick={() => onChange(tone)}
                className={[
                  "text-left p-3 rounded-xl border-2 transition-all",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  isSelected
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-gray-300",
                ].join(" ")}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-sm font-semibold text-gray-900"
                    style={{ fontFamily: `'${fonts.heading}', sans-serif` }}
                  >
                    {config.label}
                  </span>
                  {isSelected && (
                    <span className="text-blue-600" aria-hidden>✓</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-2">{config.description}</p>
                <p
                  className="text-xs text-gray-700 italic leading-relaxed"
                  style={{ fontFamily: `'${fonts.body}', sans-serif` }}
                >
                  „{config.example}"
                </p>
              </button>
            );
          }
        )}
      </div>
    </div>
  );
}
