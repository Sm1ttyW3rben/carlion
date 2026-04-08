"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/shared/lib/trpc/client";
import { ConnectionCard } from "@/modules/listings/components/connection-card";
import { SetupConnectionDialog } from "@/modules/listings/components/setup-connection-dialog";
import type { Platform } from "@/modules/listings/domain/types";

const PLATFORMS: Platform[] = ["mobile_de", "autoscout24"];

export default function VerbindungPage() {
  const [dialogPlatform, setDialogPlatform] = useState<Platform | null>(null);

  const { data: connections, isLoading } = api.listings.getConnections.useQuery();
  const utils = api.useUtils();

  const setupMutation = api.listings.setupConnection.useMutation({
    onSuccess: () => void utils.listings.getConnections.invalidate(),
  });

  const removeMutation = api.listings.removeConnection.useMutation({
    onSuccess: () => void utils.listings.getConnections.invalidate(),
  });

  const connectionByPlatform = (platform: Platform) =>
    connections?.find((c) => c.platform === platform) ?? null;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Börsen-Verbindungen</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          API-Zugangsdaten für mobile.de und AutoScout24 verwalten.
          Zugangsdaten werden verschlüsselt gespeichert.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLATFORMS.map((platform) =>
          isLoading ? (
            <Skeleton key={platform} className="h-48 rounded-xl" />
          ) : (
            <ConnectionCard
              key={platform}
              platform={platform}
              connection={connectionByPlatform(platform)}
              onSetup={() => setDialogPlatform(platform)}
              onRemove={() => {
                const conn = connectionByPlatform(platform);
                if (conn) {
                  removeMutation.mutate({ connectionId: conn.id });
                }
              }}
              isRemoving={
                removeMutation.isPending &&
                connectionByPlatform(platform)?.id === removeMutation.variables?.connectionId
              }
            />
          )
        )}
      </div>

      {dialogPlatform && (
        <SetupConnectionDialog
          open={!!dialogPlatform}
          platform={dialogPlatform}
          onOpenChange={(open) => !open && setDialogPlatform(null)}
          onSubmit={async (data) => {
            await setupMutation.mutateAsync(data);
          }}
          isLoading={setupMutation.isPending}
        />
      )}

      {removeMutation.isError && (
        <p className="text-sm text-red-600">
          Fehler beim Trennen: {removeMutation.error.message}
        </p>
      )}
    </div>
  );
}
