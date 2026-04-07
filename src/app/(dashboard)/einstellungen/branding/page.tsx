"use client";

import { useState } from "react";
import { api } from "@/shared/lib/trpc/client";
import { BrandingPreview } from "@/modules/dna-engine/components/branding-preview";
import { ColorPicker } from "@/modules/dna-engine/components/color-picker";
import { ToneSelector } from "@/modules/dna-engine/components/tone-selector";
import { FormalityToggle } from "@/modules/dna-engine/components/formality-toggle";
import { FontPreview } from "@/modules/dna-engine/components/font-preview";
import { LogoUploader } from "@/modules/dna-engine/components/logo-uploader";
import { CompletenessChecklist } from "@/modules/dna-engine/components/completeness-checklist";
import {
  FONT_HEADING_VALUES,
  FONT_BODY_VALUES,
  BORDER_RADIUS_VALUES,
  BUTTON_STYLE_VALUES,
} from "@/modules/dna-engine/domain/constants";
import type {
  TenantBrandingView,
  ToneEnum,
  FormalityEnum,
  FontHeadingEnum,
  FontBodyEnum,
  BorderRadiusEnum,
  ButtonStyleEnum,
} from "@/modules/dna-engine/domain/types";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function BrandingSettingsPage() {
  const { data: branding, isLoading } = api.dna.getBranding.useQuery();
  const utils = api.useUtils();

  const [localBranding, setLocalBranding] = useState<TenantBrandingView | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [regeneratingField, setRegeneratingField] = useState<string | null>(null);

  const updateVisual = api.dna.updateVisualIdentity.useMutation();
  const updateComm = api.dna.updateCommunicationIdentity.useMutation();
  const updateBusiness = api.dna.updateBusinessData.useMutation();
  const regenerateTexts = api.dna.regenerateTexts.useMutation();

  const current = localBranding ?? branding;

  if (isLoading || !current) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  function updateLocal<K extends keyof TenantBrandingView>(
    key: K,
    value: TenantBrandingView[K]
  ) {
    setLocalBranding((prev) => ({ ...(prev ?? current!), [key]: value }));
    setSaveState("idle");
  }

  async function saveSection(section: "visual" | "communication" | "business") {
    if (!current) return;
    setSaveState("saving");
    setErrorMessage("");
    try {
      if (section === "visual") {
        await updateVisual.mutateAsync({
          primaryColor: current.primaryColor,
          secondaryColor: current.secondaryColor,
          accentColor: current.accentColor,
          backgroundColor: current.backgroundColor,
          textColor: current.textColor,
          fontHeading: current.fontHeading,
          fontBody: current.fontBody,
          borderRadius: current.borderRadius,
          buttonStyle: current.buttonStyle,
        });
      } else if (section === "communication") {
        await updateComm.mutateAsync({
          tone: current.tone,
          formality: current.formality,
          dealershipType: current.dealershipType,
          descriptionStyle: current.descriptionStyle,
          tagline: current.tagline,
          welcomeMessage: current.welcomeMessage,
          emailSignature: current.emailSignature,
        });
      } else {
        await updateBusiness.mutateAsync({
          phone: current.phone ?? undefined,
          email: current.email ?? undefined,
          address: current.address ?? undefined,
          openingHours: current.openingHours ?? undefined,
          googleMapsUrl: current.googleMapsUrl ?? undefined,
          imprintData: current.imprintData ?? undefined,
        });
      }
      await utils.dna.getBranding.invalidate();
      setLocalBranding(null);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (err) {
      setSaveState("error");
      setErrorMessage(err instanceof Error ? err.message : "Fehler beim Speichern");
    }
  }

  async function handleRegenerateText(field: "welcome_message" | "email_signature" | "tagline") {
    setRegeneratingField(field);
    try {
      const result = await regenerateTexts.mutateAsync({ fields: [field] });
      const text = result[field];
      if (text) {
        const key = field === "welcome_message"
          ? "welcomeMessage"
          : field === "email_signature"
          ? "emailSignature"
          : "tagline";
        updateLocal(key as keyof TenantBrandingView, text as never);
      }
    } finally {
      setRegeneratingField(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Branding</h1>
        {saveState === "saved" && (
          <span className="text-sm text-green-600 font-medium">✓ Gespeichert</span>
        )}
        {saveState === "error" && (
          <span className="text-sm text-red-500">{errorMessage}</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Settings */}
        <div className="lg:col-span-2 space-y-4">

          {/* Logo */}
          <Section title="Logo">
            <LogoUploader
              currentLogoUrl={current.logoUrl}
              onUploadSuccess={async () => {
                await utils.dna.getBranding.invalidate();
              }}
              onError={(msg) => setErrorMessage(msg)}
            />
          </Section>

          {/* Visual Identity */}
          <Section
            title="Farben & Stil"
            onSave={() => saveSection("visual")}
            isSaving={saveState === "saving" && updateVisual.isPending}
          >
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
              <ColorPicker
                label="Akzentfarbe (optional)"
                value={current.accentColor ?? "#3B82F6"}
                onChange={(v) => updateLocal("accentColor", v)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <SelectField
                label="Ecken"
                value={current.borderRadius}
                options={BORDER_RADIUS_VALUES.map((v) => ({
                  value: v,
                  label: { none: "Keine", sm: "Klein", md: "Mittel", lg: "Groß", full: "Rund" }[v] ?? v,
                }))}
                onChange={(v) => updateLocal("borderRadius", v as BorderRadiusEnum)}
              />
              <SelectField
                label="Button-Stil"
                value={current.buttonStyle}
                options={BUTTON_STYLE_VALUES.map((v) => ({
                  value: v,
                  label: { solid: "Gefüllt", outline: "Umriss", ghost: "Geisterhaft" }[v] ?? v,
                }))}
                onChange={(v) => updateLocal("buttonStyle", v as ButtonStyleEnum)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <SelectField
                label="Überschriften-Schrift"
                value={current.fontHeading}
                options={FONT_HEADING_VALUES.map((v) => ({ value: v, label: v }))}
                onChange={(v) => updateLocal("fontHeading", v as FontHeadingEnum)}
              />
              <SelectField
                label="Text-Schrift"
                value={current.fontBody}
                options={FONT_BODY_VALUES.map((v) => ({ value: v, label: v }))}
                onChange={(v) => updateLocal("fontBody", v as FontBodyEnum)}
              />
            </div>

            <FontPreview
              fontHeading={current.fontHeading}
              fontBody={current.fontBody}
              dealerName={current.tenantName}
            />
          </Section>

          {/* Communication Identity */}
          <Section
            title="Tonalität & Sprache"
            onSave={() => saveSection("communication")}
            isSaving={saveState === "saving" && updateComm.isPending}
          >
            <ToneSelector
              value={current.tone}
              onChange={(v) => updateLocal("tone", v as ToneEnum)}
            />
            <FormalityToggle
              value={current.formality}
              onChange={(v) => updateLocal("formality", v as FormalityEnum)}
            />

            <TextAreaFieldWithAI
              label="Slogan"
              value={current.tagline ?? ""}
              onChange={(v) => updateLocal("tagline", v || null)}
              placeholder="z.B. Ihr zuverlässiger Partner im Autohandel"
              maxLength={100}
              onRegenerate={() => handleRegenerateText("tagline")}
              isRegenerating={regeneratingField === "tagline"}
            />

            <TextAreaFieldWithAI
              label="Willkommensnachricht"
              value={current.welcomeMessage ?? ""}
              onChange={(v) => updateLocal("welcomeMessage", v || null)}
              placeholder="Kurze Begrüßung für Ihre Website…"
              rows={4}
              onRegenerate={() => handleRegenerateText("welcome_message")}
              isRegenerating={regeneratingField === "welcome_message"}
            />

            <TextAreaFieldWithAI
              label="E-Mail-Signatur"
              value={current.emailSignature ?? ""}
              onChange={(v) => updateLocal("emailSignature", v || null)}
              placeholder="Ihre Signatur für ausgehende E-Mails…"
              rows={4}
              onRegenerate={() => handleRegenerateText("email_signature")}
              isRegenerating={regeneratingField === "email_signature"}
            />
          </Section>

          {/* Business Data */}
          <Section
            title="Kontakt & Geschäftsdaten"
            onSave={() => saveSection("business")}
            isSaving={saveState === "saving" && updateBusiness.isPending}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InputField
                label="Telefon"
                value={current.phone ?? ""}
                onChange={(v) => updateLocal("phone", v || null)}
                placeholder="030 12345678"
              />
              <InputField
                label="E-Mail"
                type="email"
                value={current.email ?? ""}
                onChange={(v) => updateLocal("email", v || null)}
                placeholder="info@autohaus.de"
              />
            </div>
            <InputField
              label="Straße und Hausnummer"
              value={current.address?.street ?? ""}
              onChange={(v) =>
                updateLocal("address", v ? { ...(current.address ?? { zip: "", city: "" }), street: v } : null)
              }
              placeholder="Musterstraße 1"
            />
            <div className="grid grid-cols-3 gap-3">
              <InputField
                label="PLZ"
                value={current.address?.zip ?? ""}
                onChange={(v) =>
                  updateLocal("address", current.address ? { ...current.address, zip: v } : null)
                }
                placeholder="10115"
              />
              <div className="col-span-2">
                <InputField
                  label="Ort"
                  value={current.address?.city ?? ""}
                  onChange={(v) =>
                    updateLocal("address", current.address ? { ...current.address, city: v } : null)
                  }
                  placeholder="Berlin"
                />
              </div>
            </div>
            <InputField
              label="Google Maps URL (optional)"
              value={current.googleMapsUrl ?? ""}
              onChange={(v) => updateLocal("googleMapsUrl", v || null)}
              placeholder="https://maps.google.com/…"
            />
          </Section>
        </div>

        {/* Right: Preview + Completeness */}
        <div className="space-y-4">
          <div className="sticky top-6 space-y-4">
            <BrandingPreview branding={current} />
            <CompletenessChecklist branding={current} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helper components (local only)
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
  onSave,
  isSaving,
}: {
  title: string;
  children: React.ReactNode;
  onSave?: () => void;
  isSaving?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
          >
            {isSaving ? "Speichert…" : "Speichern"}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextAreaFieldWithAI({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 3,
  onRegenerate,
  isRegenerating,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  onRegenerate: () => void;
  isRegenerating: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600">{label}</label>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
        >
          {isRegenerating ? "Generiert…" : "✨ KI-Vorschlag"}
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
    </div>
  );
}
