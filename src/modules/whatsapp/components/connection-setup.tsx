"use client";

/**
 * ConnectionSetup — WhatsApp 360dialog connection form.
 * Spec: MOD_17 Section 11
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Wifi, WifiOff } from "lucide-react";
import { api } from "@/shared/lib/trpc/client";

export function ConnectionSetup() {
  const utils = api.useUtils();
  const { data: connection, isLoading } = api.whatsapp.getConnection.useQuery();

  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [displayPhone, setDisplayPhone] = useState("");

  const setupMutation = api.whatsapp.setupConnection.useMutation({
    onSuccess: () => void utils.whatsapp.getConnection.invalidate(),
  });

  const removeMutation = api.whatsapp.removeConnection.useMutation({
    onSuccess: () => void utils.whatsapp.getConnection.invalidate(),
  });

  function handleSetup() {
    if (!phoneNumberId || !wabaId || !displayPhone) return;
    setupMutation.mutate({ phoneNumberId, wabaId, displayPhone });
  }

  if (isLoading) {
    return <div className="animate-pulse h-32 bg-gray-100 rounded-lg" />;
  }

  const isConnected = connection?.connectionStatus === "connected";
  const isError = connection?.connectionStatus === "error";

  return (
    <div className="space-y-6">
      {/* Status card */}
      {connection ? (
        <div className="border rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {isConnected ? (
                <Wifi className="w-5 h-5 text-green-500" />
              ) : (
                <WifiOff className="w-5 h-5 text-gray-400" />
              )}
              <div>
                <p className="font-semibold text-gray-900">{connection.displayPhone}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant={isConnected ? "default" : isError ? "destructive" : "secondary"}>
                    {isConnected ? "Verbunden" : isError ? "Fehler" : "Getrennt"}
                  </Badge>
                  {connection.webhookVerified && (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle className="w-3 h-3" />
                      Webhook aktiv
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => removeMutation.mutate()}
              disabled={removeMutation.isPending}
            >
              Verbindung trennen
            </Button>
          </div>

          {isError && connection.lastError && (
            <div className="mt-3 flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-md p-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{connection.lastError}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="border rounded-lg p-4 bg-gray-50 text-sm text-gray-500">
          Noch keine WhatsApp-Verbindung eingerichtet.
        </div>
      )}

      {/* Setup form */}
      {(!connection || isError) && (
        <div className="border rounded-lg p-4 bg-white space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">WhatsApp Verbindung einrichten</h3>
            <p className="text-sm text-gray-500">
              Geben Sie Ihre 360dialog API-Daten ein. Diese finden Sie im 360dialog Partner Hub.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Phone Number ID</label>
            <Input
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="123456789012345"
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">WhatsApp Business Account ID (WABA)</label>
            <Input
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
              placeholder="123456789012345"
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Anzeigenummer</label>
            <Input
              value={displayPhone}
              onChange={(e) => setDisplayPhone(e.target.value)}
              placeholder="+49 170 1234567"
            />
          </div>

          {setupMutation.error && (
            <p className="text-sm text-red-600">{setupMutation.error.message}</p>
          )}

          <Button
            onClick={handleSetup}
            disabled={!phoneNumberId || !wabaId || !displayPhone || setupMutation.isPending}
          >
            {setupMutation.isPending ? "Verbinde…" : "Verbindung herstellen"}
          </Button>
        </div>
      )}

      {/* Help */}
      <div className="text-sm text-gray-500 space-y-1">
        <p className="font-medium text-gray-700">So richten Sie 360dialog ein:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Registrieren Sie sich bei 360dialog und erstellen Sie einen Channel.</li>
          <li>Notieren Sie die Phone Number ID und WABA ID aus dem Partner Hub.</li>
          <li>Der Webhook wird automatisch registriert.</li>
        </ol>
      </div>
    </div>
  );
}
