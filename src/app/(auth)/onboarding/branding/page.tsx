"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/shared/lib/trpc/client";
import { CrawlProgressAnimation } from "@/modules/dna-engine/components/crawl-progress-animation";
import { LogoUploader } from "@/modules/dna-engine/components/logo-uploader";
import { ColorPicker } from "@/modules/dna-engine/components/color-picker";
import { FormalityToggle } from "@/modules/dna-engine/components/formality-toggle";
import type { DnaCrawlResult } from "@/modules/dna-engine/domain/types";

type Step = "url_input" | "crawling" | "manual" | "done";

export default function OnboardingBrandingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("url_input");
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState("");
  const [crawlResult, setCrawlResult] = useState<DnaCrawlResult | null>(null);
  const [crawlStatus, setCrawlStatus] = useState<"crawling" | "analyzing" | "completed" | "failed">("crawling");

  // Manual fallback form state
  const [primaryColor, setPrimaryColor] = useState("#2563EB");
  const [formality, setFormality] = useState<"du" | "sie">("sie");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [street, setStreet] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const applyCrawlResult = api.dna.applyCrawlResult.useMutation();

  const startCrawl = api.dna.startCrawl.useMutation({
    onSuccess: async (result) => {
      setCrawlResult(result);
      if (result.status === "completed") {
        setCrawlStatus("completed");
        try {
          await applyCrawlResult.mutateAsync({ crawlId: result.id });
        } catch {
          // Apply failed — review page will still show current branding
        }
        setTimeout(() => router.push("/onboarding/branding/review"), 800);
      } else {
        setCrawlStatus("failed");
        setStep("manual");
      }
    },
    onError: () => {
      setCrawlStatus("failed");
      setStep("manual");
    },
  });

  const updateVisual = api.dna.updateVisualIdentity.useMutation();
  const updateComm = api.dna.updateCommunicationIdentity.useMutation();
  const updateBusiness = api.dna.updateBusinessData.useMutation();

  function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUrlError("");

    const trimmed = urlInput.trim();
    if (!trimmed) {
      setUrlError("Bitte eine URL eingeben");
      return;
    }

    setStep("crawling");
    setCrawlStatus("crawling");
    // Switch to analyzing after a short delay to show progress
    setTimeout(() => setCrawlStatus("analyzing"), 3000);

    startCrawl.mutate({ url: trimmed });
  }

  async function handleManualSave(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    try {
      await updateVisual.mutateAsync({ primaryColor });
      await updateComm.mutateAsync({ formality });
      if (phone || email || street) {
        await updateBusiness.mutateAsync({
          phone: phone || undefined,
          email: email || undefined,
          address: street
            ? { street, zip, city }
            : undefined,
        });
      }
      router.push("/onboarding/branding/review");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Fehler beim Speichern");
    }
  }

  // --- Step: URL input ---
  if (step === "url_input") {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">
              Ihr Branding importieren
            </h1>
            <p className="text-gray-500 text-sm">
              Geben Sie Ihre Website-URL ein — wir importieren automatisch Logo, Farben und Stil.
            </p>
          </div>

          <form onSubmit={handleUrlSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="url" className="text-sm font-medium text-gray-700">
                Website-URL
              </label>
              <input
                id="url"
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="www.autohaus-mustermann.de"
                className={[
                  "w-full px-4 py-3 rounded-xl border text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500",
                  urlError ? "border-red-400 bg-red-50" : "border-gray-300",
                ].join(" ")}
              />
              {urlError && <p className="text-xs text-red-500">{urlError}</p>}
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Branding importieren
            </button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setStep("manual")}
              className="text-sm text-gray-400 hover:text-gray-600 underline"
            >
              Kein Website? Manuell einrichten
            </button>
          </div>
        </div>
      </main>
    );
  }

  // --- Step: Crawling ---
  if (step === "crawling") {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="w-full max-w-sm">
          <CrawlProgressAnimation
            url={urlInput}
            status={crawlStatus}
          />
        </div>
      </main>
    );
  }

  // --- Step: Manual input ---
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Branding einrichten</h1>
          <p className="text-gray-500 text-sm">
            {crawlResult?.status === "failed"
              ? "Die Website konnte nicht geladen werden. Richten Sie Ihr Branding manuell ein."
              : "Richten Sie Ihr Branding manuell ein."}
          </p>
        </div>

        <form onSubmit={handleManualSave} className="space-y-6">
          <LogoUploader
            onUploadSuccess={() => {/* Logo saved server-side */}}
            onError={(msg) => setErrorMessage(msg)}
          />

          <ColorPicker
            label="Primärfarbe"
            value={primaryColor}
            onChange={setPrimaryColor}
          />

          <FormalityToggle value={formality} onChange={setFormality} />

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-gray-700">Kontaktdaten</legend>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Telefon (z.B. 030 12345678)"
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-Mail (z.B. info@autohaus.de)"
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="Straße und Hausnummer"
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="PLZ"
                className="w-28 px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ort"
                className="flex-1 px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </fieldset>

          {errorMessage && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={updateVisual.isPending || updateComm.isPending || updateBusiness.isPending}
            className="w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {updateVisual.isPending || updateComm.isPending ? "Wird gespeichert…" : "Weiter"}
          </button>
        </form>
      </div>
    </main>
  );
}
