/**
 * DNA-Engine — Color Palette Generation
 *
 * Pure functions with no side effects. Client + server safe.
 * Generates an 11-shade palette (Tailwind scale) from a single hex color
 * using HSL interpolation.
 *
 * Spec reference: MOD_34 Section 11
 */

import type { ColorPalette, ColorShades, TenantBrandingView } from "./types";
import { BORDER_RADIUS_REM } from "./constants";

// ---------------------------------------------------------------------------
// Hex ↔ RGB ↔ HSL conversion
// ---------------------------------------------------------------------------

interface RGB {
  r: number; // 0-255
  g: number;
  b: number;
}

interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        break;
      case gn:
        h = ((bn - rn) / d + 2) / 6;
        break;
      case bn:
        h = ((rn - gn) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0, g = 0, b = 0;

  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function rgbToHex({ r, g, b }: RGB): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
      .join("")
  ).toUpperCase();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Shade generation — HSL interpolation per spec Section 11
// ---------------------------------------------------------------------------

// Shade definitions: [shade, lightness%, saturation_offset]
const SHADE_DEFINITIONS: [keyof ColorShades, number, number][] = [
  [50,  97, -40],
  [100, 93, -30],
  [200, 86, -20],
  [300, 72, -10],
  [400, 62,  -5],
  [500, 53,   0], // This is the primary color itself
  [600, 44,   0],
  [700, 36,   0],
  [800, 28,  -5],
  [900, 20, -10],
  [950, 14, -15],
];

function generateShades(hex: string): ColorShades {
  const rgb = hexToRgb(hex);
  const { h, s } = rgbToHsl(rgb);

  const shades = {} as ColorShades;

  for (const [shade, targetL, sOffset] of SHADE_DEFINITIONS) {
    const newHsl: HSL = {
      h,
      s: clamp(s + sOffset, 0, 100),
      l: targetL,
    };
    shades[shade] = rgbToHex(hslToRgb(newHsl));
  }

  return shades;
}

// ---------------------------------------------------------------------------
// WCAG contrast — relative luminance
// ---------------------------------------------------------------------------

function relativeLuminance({ r, g, b }: RGB): number {
  const channel = (c: number) => {
    const sRGB = c / 255;
    return sRGB <= 0.04045 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Returns the text color (white or near-black) with WCAG AA contrast (≥4.5:1)
 * against the given background color.
 */
function getOnColor(backgroundHex: string): string {
  const { l } = rgbToHsl(hexToRgb(backgroundHex));
  // L < 55% → background is dark → use white text
  const candidate = l < 55 ? "#FFFFFF" : "#1A1A1A";
  // Validate WCAG AA
  const ratio = contrastRatio(backgroundHex, candidate);
  if (ratio >= 4.5) return candidate;
  // Fallback: try the other color
  return l < 55 ? "#1A1A1A" : "#FFFFFF";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates a full 11-shade color palette from primary (and optionally secondary) hex.
 * Pure function — no side effects, no network calls.
 */
export function generateColorPalette(
  primaryHex: string,
  secondaryHex?: string
): ColorPalette {
  const primary = generateShades(primaryHex);
  const secondary = generateShades(secondaryHex ?? primaryHex);

  return {
    primary,
    secondary,
    onPrimary: getOnColor(primaryHex),
    onSecondary: getOnColor(secondaryHex ?? primaryHex),
  };
}

/**
 * Generates CSS custom properties for the Website Builder.
 * Returns a string to inject as :root { ... }.
 */
export function generateTailwindCssVars(branding: TenantBrandingView): string {
  const palette = branding.colorPalette as ColorPalette;
  const borderRadiusValue =
    BORDER_RADIUS_REM[branding.borderRadius] ?? "0.375rem";

  const shadeKeys: (keyof ColorShades)[] = [
    50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
  ];

  const primaryVars = palette?.primary
    ? shadeKeys
        .map((k) => `  --brand-primary-${k}: ${palette.primary[k]};`)
        .join("\n")
    : `  --brand-primary-500: ${branding.primaryColor};`;

  const secondaryVars = palette?.secondary
    ? shadeKeys
        .map((k) => `  --brand-secondary-${k}: ${palette.secondary[k]};`)
        .join("\n")
    : `  --brand-secondary-500: ${branding.secondaryColor};`;

  return `:root {
  --brand-primary: ${branding.primaryColor};
${primaryVars}
  --brand-secondary: ${branding.secondaryColor};
${secondaryVars}
  --brand-accent: ${branding.accentColor ?? branding.secondaryColor};
  --brand-bg: ${branding.backgroundColor};
  --brand-text: ${branding.textColor};
  --brand-on-primary: ${palette?.onPrimary ?? "#FFFFFF"};
  --brand-on-secondary: ${palette?.onSecondary ?? "#FFFFFF"};
  --brand-radius: ${borderRadiusValue};
  --font-heading: '${branding.fontHeading}', sans-serif;
  --font-body: '${branding.fontBody}', sans-serif;
}`;
}
