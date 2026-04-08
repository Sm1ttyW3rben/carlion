"use client";

/**
 * PhotoGallery — vehicle photo gallery with thumbnail navigation.
 * Spec: MOD_11 Section 10
 */

import { useState } from "react";

interface Photo {
  url: string;
  altText: string | null;
  position: number;
}

interface PhotoGalleryProps {
  photos: Photo[];
  vehicleLabel: string;
}

export function PhotoGallery({ photos, vehicleLabel }: PhotoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (photos.length === 0) {
    return (
      <div style={{ aspectRatio: "4/3", background: "#f3f4f6", borderRadius: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
        Keine Fotos vorhanden
      </div>
    );
  }

  const activePhoto = photos[activeIndex]!;

  return (
    <div>
      {/* Main photo */}
      <div style={{ aspectRatio: "4/3", overflow: "hidden", borderRadius: "0.5rem", background: "#f3f4f6", marginBottom: "0.75rem" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activePhoto.url}
          alt={activePhoto.altText ?? vehicleLabel}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>

      {/* Thumbnails */}
      {photos.length > 1 && (
        <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
          {photos.map((photo, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              style={{
                flexShrink: 0,
                width: "5rem",
                height: "3.75rem",
                border: i === activeIndex ? "2px solid var(--brand-primary, #2563eb)" : "2px solid transparent",
                borderRadius: "0.375rem",
                overflow: "hidden",
                cursor: "pointer",
                padding: 0,
                background: "none",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.altText ?? `Foto ${i + 1}`}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
