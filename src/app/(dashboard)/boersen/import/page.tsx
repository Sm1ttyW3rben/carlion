"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, Car, ChevronRight } from "lucide-react";
import { api } from "@/shared/lib/trpc/client";
import { ImportUploadForm } from "@/modules/listings/components/import-upload-form";
import type { Platform } from "@/modules/listings/domain/types";

interface UploadResult {
  importSessionId: string;
  platform: string;
  vehicleCount: number;
  errorCount: number;
  warningCount: number;
  errors: { row: number; message: string }[];
  warnings: { row: number; message: string }[];
}

export default function ImportPage() {
  const [platform, setPlatform] = useState<Platform>("mobile_de");
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [importDone, setImportDone] = useState(false);

  const utils = api.useUtils();

  const { data: sessionData } = api.listings.getImportSession.useQuery(
    { importSessionId: uploadResult?.importSessionId ?? "" },
    { enabled: !!uploadResult?.importSessionId }
  );

  const confirmMutation = api.listings.confirmImport.useMutation({
    onSuccess: () => {
      setImportDone(true);
      void utils.listings.listListings.invalidate();
    },
  });

  function handleUploadSuccess(result: UploadResult) {
    setUploadResult(result);
    setImportDone(false);
  }

  function handleReset() {
    setUploadResult(null);
    setImportDone(false);
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Bestand importieren</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Lade eine Export-Datei von mobile.de oder AutoScout24 hoch um Fahrzeuge zu importieren.
        </p>
      </div>

      {/* Platform selector */}
      {!uploadResult && (
        <div className="space-y-3">
          <Tabs value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
            <TabsList className="w-full">
              <TabsTrigger value="mobile_de" className="flex-1">mobile.de</TabsTrigger>
              <TabsTrigger value="autoscout24" className="flex-1">AutoScout24</TabsTrigger>
            </TabsList>
          </Tabs>

          <ImportUploadForm platform={platform} onSuccess={handleUploadSuccess} />
        </div>
      )}

      {/* Preview step */}
      {uploadResult && !importDone && (
        <div className="space-y-4">
          <div className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Car className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {uploadResult.vehicleCount} Fahrzeuge erkannt
                </p>
                <p className="text-sm text-gray-500">
                  {uploadResult.errorCount > 0
                    ? `${uploadResult.errorCount} Zeilen übersprungen`
                    : "Alle Zeilen erfolgreich geparst"}
                </p>
              </div>
            </div>

            {uploadResult.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-red-700 uppercase tracking-wide">Fehler</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {uploadResult.errors.map((e, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-red-600">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      {e.row > 0 && <span className="text-gray-400">Zeile {e.row}:</span>}
                      {e.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {uploadResult.warnings.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Hinweise</p>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {uploadResult.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700">
                      {w.row > 0 && <span className="text-gray-400">Zeile {w.row}: </span>}
                      {w.message}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {uploadResult.vehicleCount > 0 && (
            <p className="text-sm text-gray-600">
              Durch Bestätigen werden {uploadResult.vehicleCount} Fahrzeuge in den Bestand
              übernommen. Bereits vorhandene Fahrzeuge (gleiche Quelle) werden aktualisiert.
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} disabled={confirmMutation.isPending}>
              Abbrechen
            </Button>
            {uploadResult.vehicleCount > 0 && (
              <Button
                onClick={() =>
                  confirmMutation.mutate({ importSessionId: uploadResult.importSessionId })
                }
                disabled={confirmMutation.isPending}
                className="flex-1"
              >
                {confirmMutation.isPending
                  ? "Wird importiert…"
                  : `${uploadResult.vehicleCount} Fahrzeuge importieren`}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>

          {confirmMutation.isError && (
            <p className="text-sm text-red-600">
              Fehler: {confirmMutation.error.message}
            </p>
          )}
        </div>
      )}

      {/* Success state */}
      {importDone && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
          <p className="font-semibold text-gray-900">Import abgeschlossen</p>
          <p className="text-sm text-gray-600">
            Die Fahrzeuge wurden erfolgreich in den Bestand übernommen.
          </p>
          <Button variant="outline" onClick={handleReset}>
            Weiteren Import starten
          </Button>
        </div>
      )}
    </div>
  );
}
