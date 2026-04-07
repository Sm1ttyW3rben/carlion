"use client";

import { useRef, useState, useEffect } from "react";

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
  disabled?: boolean;
}

const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

export function ColorPicker({ value, onChange, label, disabled }: ColorPickerProps) {
  const [inputValue, setInputValue] = useState(value);
  const nativeRef = useRef<HTMLInputElement>(null);

  // Keep input in sync when value prop changes externally
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  function handleNativeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const hex = e.target.value.toUpperCase();
    setInputValue(hex);
    onChange(hex);
  }

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const withHash = raw.startsWith("#") ? raw : "#" + raw;
    setInputValue(withHash);
    if (HEX_REGEX.test(withHash)) {
      onChange(withHash.toUpperCase());
    }
  }

  function handleTextBlur() {
    if (!HEX_REGEX.test(inputValue)) {
      setInputValue(value); // Reset to last valid value
    }
  }

  const isValid = HEX_REGEX.test(inputValue);
  const displayColor = isValid ? inputValue : value;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-gray-700">{label}</label>
      )}
      <div className="flex items-center gap-2">
        {/* Color swatch — opens native color picker on click */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => nativeRef.current?.click()}
          className="w-10 h-10 rounded-lg border border-gray-300 shadow-inner flex-shrink-0 cursor-pointer disabled:cursor-not-allowed"
          style={{ backgroundColor: displayColor }}
          aria-label={`Farbe wählen: ${displayColor}`}
        />
        {/* Native color input (visually hidden, triggered by swatch) */}
        <input
          ref={nativeRef}
          type="color"
          value={displayColor}
          onChange={handleNativeChange}
          disabled={disabled}
          className="sr-only"
          tabIndex={-1}
        />
        {/* Hex text input */}
        <input
          type="text"
          value={inputValue}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          disabled={disabled}
          maxLength={7}
          placeholder="#2563EB"
          className={[
            "flex-1 px-3 py-2 text-sm font-mono rounded-lg border",
            "focus:outline-none focus:ring-2 focus:ring-blue-500",
            "disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed",
            isValid ? "border-gray-300" : "border-red-400 bg-red-50",
          ].join(" ")}
        />
      </div>
      {!isValid && inputValue !== value && (
        <p className="text-xs text-red-500">Ungültige Hex-Farbe (z.B. #2563EB)</p>
      )}
    </div>
  );
}
