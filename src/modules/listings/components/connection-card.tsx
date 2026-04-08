"use client";

import { CheckCircle2, XCircle, AlertCircle, Loader2, Plug, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformBadge } from "./platform-badge";
import type { ConnectionView, Platform } from "../domain/types";

interface ConnectionCardProps {
  platform: Platform;
  connection: ConnectionView | null;
  onSetup: () => void;
  onRemove: () => void;
  isRemoving?: boolean;
}

const PLATFORM_NAMES: Record<Platform, string> = {
  mobile_de: "mobile.de",
  autoscout24: "AutoScout24",
};

export function ConnectionCard({
  platform,
  connection,
  onSetup,
  onRemove,
  isRemoving,
}: ConnectionCardProps) {
  const isConnected = connection?.connectionStatus === "connected";
  const isDraining = connection?.connectionStatus === "draining";
  const isError = connection?.connectionStatus === "error";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {isConnected ? (
              <PlugZap className="h-4 w-4 text-green-600" />
            ) : (
              <Plug className="h-4 w-4 text-gray-400" />
            )}
            {PLATFORM_NAMES[platform]}
          </CardTitle>
          <PlatformBadge platform={platform} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {connection ? (
          <>
            {/* Status indicator */}
            <div className="flex items-center gap-2">
              {isConnected && (
                <span className="flex items-center gap-1.5 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Verbunden
                </span>
              )}
              {isDraining && (
                <span className="flex items-center gap-1.5 text-sm text-amber-700">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Wird getrennt…
                </span>
              )}
              {isError && (
                <span className="flex items-center gap-1.5 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  Verbindungsfehler
                </span>
              )}
              {connection.connectionStatus === "disconnected" && (
                <span className="flex items-center gap-1.5 text-sm text-gray-500">
                  <XCircle className="h-4 w-4" />
                  Nicht verbunden
                </span>
              )}
            </div>

            {connection.lastError && (
              <p className="text-xs text-red-600 bg-red-50 rounded p-2">
                {connection.lastError}
              </p>
            )}

            {isConnected && (
              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  <span className="text-gray-400">Aktive Inserate:</span>{" "}
                  <span className="font-medium">{connection.listingsCount}</span>
                </p>
                {connection.lastSyncAt && (
                  <p>
                    <span className="text-gray-400">Letzter Sync:</span>{" "}
                    <span className="font-medium">
                      {new Date(connection.lastSyncAt).toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={onSetup} className="flex-1">
                API-Key aktualisieren
              </Button>
              {!isDraining && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRemove}
                  disabled={isRemoving}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Trennen
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500">
              Keine Verbindung konfiguriert. API-Key und Händler-ID eingeben um zu verbinden.
            </p>
            <Button size="sm" onClick={onSetup} className="w-full">
              Verbinden
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
