"use client";

import type { TenantBrandingView } from "../domain/types";

interface BrandingPreviewProps {
  branding: Pick<
    TenantBrandingView,
    | "primaryColor"
    | "secondaryColor"
    | "backgroundColor"
    | "textColor"
    | "fontHeading"
    | "fontBody"
    | "borderRadius"
    | "buttonStyle"
    | "logoUrl"
    | "tenantName"
    | "accentColor"
  >;
}

const RADIUS_MAP: Record<string, string> = {
  none: "0",
  sm: "4px",
  md: "8px",
  lg: "12px",
  full: "9999px",
};

export function BrandingPreview({ branding }: BrandingPreviewProps) {
  const radius = RADIUS_MAP[branding.borderRadius] ?? "8px";

  const buttonBase =
    "px-4 py-2 text-sm font-medium transition-colors cursor-default";

  const buttonStyle =
    branding.buttonStyle === "outline"
      ? {
          backgroundColor: "transparent",
          color: branding.primaryColor,
          border: `2px solid ${branding.primaryColor}`,
        }
      : branding.buttonStyle === "ghost"
      ? {
          backgroundColor: "transparent",
          color: branding.primaryColor,
        }
      : {
          backgroundColor: branding.primaryColor,
          color: "#FFFFFF",
        };

  return (
    <div
      className="rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
      style={{ backgroundColor: branding.backgroundColor }}
    >
      {/* Header strip */}
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{ backgroundColor: branding.primaryColor }}
      >
        {branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
        ) : (
          <div className="w-8 h-8 rounded bg-white/20" />
        )}
        <span
          className="text-white text-sm font-semibold"
          style={{ fontFamily: `'${branding.fontHeading}', sans-serif` }}
        >
          {branding.tenantName}
        </span>
      </div>

      {/* Card body — example vehicle listing */}
      <div className="p-4 space-y-3">
        <div
          className="border border-gray-100 p-3 space-y-2"
          style={{ borderRadius: radius, backgroundColor: "white" }}
        >
          {/* Placeholder image */}
          <div
            className="h-24 w-full rounded"
            style={{
              backgroundColor: branding.secondaryColor + "22",
              borderRadius: `calc(${radius} - 2px)`,
            }}
          />
          <h4
            className="text-sm font-bold"
            style={{
              fontFamily: `'${branding.fontHeading}', sans-serif`,
              color: branding.textColor,
            }}
          >
            VW Golf 8 GTI
          </h4>
          <p
            className="text-xs text-gray-500"
            style={{ fontFamily: `'${branding.fontBody}', sans-serif` }}
          >
            2023 · 50.000 km · 245 PS
          </p>
          <div className="flex items-center justify-between">
            <span
              className="text-sm font-bold"
              style={{ color: branding.primaryColor }}
            >
              32.900 €
            </span>
            <button
              className={buttonBase}
              style={{ ...buttonStyle, borderRadius: radius }}
            >
              Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
