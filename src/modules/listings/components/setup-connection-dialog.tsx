"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PlatformBadge } from "./platform-badge";
import type { Platform } from "../domain/types";

const PLATFORM_NAMES: Record<Platform, string> = {
  mobile_de: "mobile.de",
  autoscout24: "AutoScout24",
};

interface SetupConnectionDialogProps {
  open: boolean;
  platform: Platform;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { platform: Platform; apiKey: string; dealerId: string }) => Promise<void>;
  isLoading?: boolean;
}

export function SetupConnectionDialog({
  open,
  platform,
  onOpenChange,
  onSubmit,
  isLoading,
}: SetupConnectionDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [dealerId, setDealerId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!apiKey.trim() || !dealerId.trim()) {
      setError("Alle Felder sind Pflicht.");
      return;
    }
    try {
      await onSubmit({ platform, apiKey: apiKey.trim(), dealerId: dealerId.trim() });
      setApiKey("");
      setDealerId("");
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlatformBadge platform={platform} />
            Verbindung einrichten
          </DialogTitle>
          <DialogDescription>
            Gib deinen {PLATFORM_NAMES[platform]} API-Key und deine Händler-ID ein.
            Die Verbindung wird sofort getestet.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="apiKey">API-Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Dein API-Key"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dealerId">Händler-ID</Label>
            <Input
              id="dealerId"
              value={dealerId}
              onChange={(e) => setDealerId(e.target.value)}
              placeholder="Deine Händler-ID"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Wird verbunden…" : "Verbinden"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
