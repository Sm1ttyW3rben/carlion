"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/shared/lib/trpc/client";
import { BrandingPreview } from "@/modules/dna-engine/components/branding-preview";
import { ColorPicker } from "@/modules/dna-engine/components/color-picker";
import { ToneSelector } from "@/modules/dna-engine/components/tone-selector";
import { FormalityToggle } from "@/modules/dna-engine/components/formality-toggle";
import type { TenantBrandingView, ToneEnum, FormalityEnum } from "@/modules/dna-engine/domain/types";

export default function OnboardingBrandingReviewPage() {
  const router = useRouter();
  const { data: branding, isLoading } = api.dna.getBranding.useQuery();
  const utils = api.useUtils();

  const [localBranding, setLocalBranding] = useState<TenantBrandingView | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const updateVisual = api.dna.updateVisualIdentity.useMutation();
  const updateComm = api.dna.updateCommunicationIdentity.useMutation();

  const current = localBranding ?? branding;

  if (isLoading || !current) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  function updateLocal<K extends keyof TenantBrandingView>(
    key: K,
    value: TenantBrandingView[K]
  ) {
    setLocalBranding((prev) => ({ ...(prev ?? current!), [key]: value }));
  }

  async function handleSave() {
    if (!localBranding) {
      router.push("/dashboard");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    try {
      await updateVisual.mutateAsync({
        primaryColor: localBranding.primaryColor,
        secondaryColor: localBranding.secondaryColor,
        accentColor: localBranding.accentColor,
        fontHeading: localBranding.fontHeading,
        fontBody: localBranding.fontBody,
        borderRadius: localBranding.borderRadius,
        buttonStyle: localBranding.buttonStyle,
      });
      await updateComm.mutateAsync({
        tone: localBranding.tone,
        formality: localBranding.formality,
        tagline: localBranding.tagline,
        welcomeMessage: localBranding.welcomeMessage,
      });
      await utils.dna.getBranding.invalidate();
      router.push("/dashboard");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Ihr Branding</h1>
          <p className="text-gray-500 text-sm">
            Sieht gut aus? Passen Sie alles nach Ihren Wünschen an.
          </p>
        </div>

        {/* Live Preview */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Vorschau
          </p>
          <BrandingPreview branding={current} />
        </div>

        {/* Edit sections */}
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
          {/* Colors */}
          <div className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Farben</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ColorPicker
                label="Primärfarbe"
                value={current.primaryColor}
                onChange={(v) => updateLocal("primaryColor", v)}
              />
              <ColorPicker
                label="Sekundärfarbe"
                value={current.secondaryColor}
                onChange={(v) => updateLocal("secondaryColor", v)}
              />
            </div>
          </div>

          {/* Tone */}
          <div className="p-5">
            <ToneSelector
              value={current.tone}
              onChange={(v) => {
                updateLocal("tone", v as ToneEnum);
              }}
            />
          </div>

          {/* Formality */}
          <div className="p-5">
            <FormalityToggle
              value={current.formality}
              onChange={(v) => updateLocal("formality", v as FormalityEnum)}
            />
          </div>

          {/* Tagline */}
          <div className="p-5 space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Slogan <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={current.tagline ?? ""}
              onChange={(e) => updateLocal("tagline", e.target.value || null)}
              placeholder="z.B. Ihr zuverlässiger Partner"
              maxLength={100}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {errorMessage && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
            {errorMessage}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-3 border border-gray-300 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
          >
            Zurück
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-2 flex-1 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? "Wird gespeichert…" : "Sieht gut aus →"}
          </button>
        </div>
      </div>
    </main>
  );
}
