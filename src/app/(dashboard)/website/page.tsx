"use client";

/**
 * Website Builder Dashboard — Übersicht & Einstellungen
 *
 * Zeigt Publish-Status, Hero-Texte, SEO, Kontaktformular-Einstellungen.
 * Spec: MOD_11 Section 7
 */

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, MessageSquare, Eye, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { api } from "@/shared/lib/trpc/client";

export default function WebsitePage() {
  const utils = api.useUtils();

  const { data: settings, isLoading } = api.website.getSettings.useQuery();
  const { data: gate } = api.website.checkPublishGate.useQuery();
  const { data: previewUrl } = api.website.getPreviewUrl.useQuery();

  const [heroHeadline, setHeroHeadline] = useState<string | undefined>();
  const [heroSubheadline, setHeroSubheadline] = useState<string | undefined>();
  const [heroCtatext, setHeroCtatext] = useState<string | undefined>();
  const [aboutText, setAboutText] = useState<string | undefined>();
  const [metaTitle, setMetaTitle] = useState<string | undefined>();
  const [metaDescription, setMetaDescription] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const updateMutation = api.website.updateSettings.useMutation({
    onSuccess: () => {
      void utils.website.getSettings.invalidate();
      setSaving(false);
    },
    onError: () => setSaving(false),
  });

  const publishMutation = api.website.publish.useMutation({
    onSuccess: () => {
      void utils.website.getSettings.invalidate();
      void utils.website.checkPublishGate.invalidate();
    },
  });

  const unpublishMutation = api.website.unpublish.useMutation({
    onSuccess: () => void utils.website.getSettings.invalidate(),
  });

  function handleSave() {
    if (!settings) return;
    setSaving(true);
    updateMutation.mutate({
      heroHeadline: heroHeadline ?? settings.heroHeadline ?? undefined,
      heroSubheadline: heroSubheadline ?? settings.heroSubheadline ?? undefined,
      heroCtatext: heroCtatext ?? settings.heroCtatext ?? undefined,
      aboutText: aboutText ?? settings.aboutText ?? undefined,
      metaTitle: metaTitle ?? settings.metaTitle ?? undefined,
      metaDescription: metaDescription ?? settings.metaDescription ?? undefined,
    });
  }

  // Use server values as initial for controlled inputs
  const headline = heroHeadline !== undefined ? heroHeadline : (settings?.heroHeadline ?? "");
  const subheadline = heroSubheadline !== undefined ? heroSubheadline : (settings?.heroSubheadline ?? "");
  const ctaText = heroCtatext !== undefined ? heroCtatext : (settings?.heroCtatext ?? "");
  const about = aboutText !== undefined ? aboutText : (settings?.aboutText ?? "");
  const mTitle = metaTitle !== undefined ? metaTitle : (settings?.metaTitle ?? "");
  const mDesc = metaDescription !== undefined ? metaDescription : (settings?.metaDescription ?? "");

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Website</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Öffentliche Händler-Website verwalten und veröffentlichen
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/website/anfragen">
            <Button variant="outline" size="sm">
              <MessageSquare className="w-4 h-4 mr-2" />
              Anfragen
            </Button>
          </Link>
          {previewUrl?.url && (
            <a href={previewUrl.url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <Eye className="w-4 h-4 mr-2" />
                Vorschau
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Publish status card */}
      <div className="border rounded-lg p-4 bg-white">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-gray-400" />
            <div>
              <p className="font-semibold text-gray-900">
                {settings?.isPublished ? "Website ist veröffentlicht" : "Website ist nicht veröffentlicht"}
              </p>
              {settings?.publishedAt && settings.isPublished && (
                <p className="text-xs text-gray-500">
                  Seit {new Date(settings.publishedAt).toLocaleDateString("de-DE")}
                </p>
              )}
            </div>
            <Badge variant={settings?.isPublished ? "default" : "secondary"}>
              {settings?.isPublished ? "Aktiv" : "Inaktiv"}
            </Badge>
          </div>

          <div className="flex gap-2">
            {settings?.isPublished ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => unpublishMutation.mutate()}
                disabled={unpublishMutation.isPending}
              >
                Offline nehmen
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending || !gate?.canPublish}
              >
                Veröffentlichen
              </Button>
            )}
          </div>
        </div>

        {/* Publish gate checks */}
        {!settings?.isPublished && gate && (
          <div className="mt-4 pt-4 border-t space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Voraussetzungen</p>
            <div className="flex items-center gap-2 text-sm">
              {gate.checks.brandingComplete
                ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                : <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              }
              <span className={gate.checks.brandingComplete ? "text-green-700" : "text-amber-700"}>
                Branding-Profil vollständig
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {gate.checks.hasPublishedVehicle
                ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                : <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              }
              <span className={gate.checks.hasPublishedVehicle ? "text-green-700" : "text-amber-700"}>
                Mindestens ein veröffentlichtes Fahrzeug
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Hero-Texte */}
      <div className="border rounded-lg p-4 bg-white space-y-4">
        <h2 className="font-semibold text-gray-900">Startseite — Hero-Bereich</h2>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Überschrift</label>
          <Input
            value={headline}
            onChange={(e) => setHeroHeadline(e.target.value)}
            placeholder="Willkommen bei uns"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Unterüberschrift</label>
          <Input
            value={subheadline}
            onChange={(e) => setHeroSubheadline(e.target.value)}
            placeholder="Ihr Fahrzeug wartet auf Sie"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Button-Text</label>
          <Input
            value={ctaText}
            onChange={(e) => setHeroCtatext(e.target.value)}
            placeholder="Bestand ansehen"
          />
        </div>
      </div>

      {/* Über uns */}
      <div className="border rounded-lg p-4 bg-white space-y-4">
        <h2 className="font-semibold text-gray-900">Über-uns-Text</h2>
        <Textarea
          value={about}
          onChange={(e) => setAboutText(e.target.value)}
          placeholder="Erzählen Sie Ihren Kunden etwas über Ihr Autohaus..."
          rows={6}
        />
      </div>

      {/* SEO */}
      <div className="border rounded-lg p-4 bg-white space-y-4">
        <h2 className="font-semibold text-gray-900">SEO-Einstellungen</h2>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Meta-Titel (optional)</label>
          <Input
            value={mTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            placeholder="Autohaus Muster — Gebrauchtwagen in München"
            maxLength={70}
          />
          <p className="text-xs text-gray-400">{mTitle.length}/70 Zeichen</p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Meta-Beschreibung (optional)</label>
          <Textarea
            value={mDesc}
            onChange={(e) => setMetaDescription(e.target.value)}
            placeholder="Gebrauchtwagen kaufen beim Autohaus Muster in München. Große Auswahl, faire Preise."
            rows={3}
            maxLength={160}
          />
          <p className="text-xs text-gray-400">{mDesc.length}/160 Zeichen</p>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || updateMutation.isPending}>
          {saving ? "Wird gespeichert…" : "Änderungen speichern"}
        </Button>
      </div>

      {updateMutation.error && (
        <p className="text-sm text-red-600 text-right">{updateMutation.error.message}</p>
      )}
    </div>
  );
}
