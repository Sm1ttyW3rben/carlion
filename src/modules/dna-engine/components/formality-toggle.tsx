"use client";

import type { FormalityEnum } from "../domain/types";

interface FormalityToggleProps {
  value: FormalityEnum;
  onChange: (formality: FormalityEnum) => void;
  disabled?: boolean;
}

const EXAMPLES: Record<FormalityEnum, string> = {
  sie: "Herzlich willkommen! Wie können wir Ihnen helfen?",
  du: "Herzlich willkommen! Wie können wir dir helfen?",
};

export function FormalityToggle({ value, onChange, disabled }: FormalityToggleProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">Anredeform</label>
      <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white">
        {(["sie", "du"] as FormalityEnum[]).map((formality) => (
          <button
            key={formality}
            type="button"
            disabled={disabled}
            onClick={() => onChange(formality)}
            className={[
              "flex-1 py-2.5 text-sm font-medium transition-all",
              "focus:outline-none focus:ring-inset focus:ring-2 focus:ring-blue-500",
              "disabled:cursor-not-allowed disabled:opacity-50",
              value === formality
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-50",
            ].join(" ")}
          >
            {formality === "sie" ? "Sie-Form" : "Du-Form"}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 italic">
        Beispiel: „{EXAMPLES[value]}"
      </p>
    </div>
  );
}
