/**
 * HeroBanner — Startseite Hero.
 * Spec: MOD_11 Section 10
 */

import Link from "next/link";

interface HeroBannerProps {
  headline: string;
  subheadline?: string | null;
  ctaText?: string | null;
  ctaHref: string;
}

export function HeroBanner({ headline, subheadline, ctaText, ctaHref }: HeroBannerProps) {
  return (
    <section style={{
      background: "linear-gradient(135deg, var(--brand-primary, #2563eb) 0%, var(--brand-primary-700, #1d4ed8) 100%)",
      color: "var(--brand-on-primary, #ffffff)",
      padding: "5rem 1.5rem",
      textAlign: "center",
    }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <h1 style={{
          fontFamily: "var(--font-heading, sans-serif)",
          fontSize: "clamp(2rem, 5vw, 3.5rem)",
          fontWeight: 800,
          lineHeight: 1.15,
          marginBottom: "1rem",
        }}>
          {headline}
        </h1>
        {subheadline && (
          <p style={{ fontSize: "clamp(1rem, 2.5vw, 1.25rem)", opacity: 0.9, marginBottom: "2rem", lineHeight: 1.6 }}>
            {subheadline}
          </p>
        )}
        <Link
          href={ctaHref}
          style={{
            display: "inline-block",
            background: "var(--brand-bg, #ffffff)",
            color: "var(--brand-primary, #2563eb)",
            fontWeight: 700,
            fontSize: "1rem",
            padding: "0.875rem 2rem",
            borderRadius: "var(--brand-radius, 0.375rem)",
            textDecoration: "none",
            boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
          }}
        >
          {ctaText ?? "Bestand ansehen"}
        </Link>
      </div>
    </section>
  );
}
