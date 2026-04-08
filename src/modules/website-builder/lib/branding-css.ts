/**
 * Generates CSS Custom Properties from PublicBranding.
 *
 * Used in portal page server components to inject theming into the <head>.
 * Spec: MOD_11 Section 5.3
 */

import type { PublicBranding } from "@/modules/dna-engine";

const BORDER_RADIUS: Record<string, string> = {
  none: "0",
  sm: "0.25rem",
  md: "0.375rem",
  lg: "0.5rem",
  full: "9999px",
};

export function generatePublicCssVars(branding: PublicBranding): string {
  const palette = branding.colorPalette as Record<string, Record<number, string>> | null;
  const radius = BORDER_RADIUS[branding.borderRadius] ?? "0.375rem";

  const primaryVars = palette?.primary
    ? Object.entries(palette.primary).map(([k, v]) => `  --brand-primary-${k}: ${v};`).join("\n")
    : `  --brand-primary-500: ${branding.primaryColor};`;

  const secondaryVars = palette?.secondary
    ? Object.entries(palette.secondary).map(([k, v]) => `  --brand-secondary-${k}: ${v};`).join("\n")
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
  --brand-radius: ${radius};
  --font-heading: '${branding.fontHeading}', sans-serif;
  --font-body: '${branding.fontBody}', sans-serif;
}`;
}
