/**
 * ReplyWindowBanner — shown when the 24h reply window is closed.
 * Spec: MOD_17 Section 11.2
 */

import { AlertCircle } from "lucide-react";

interface ReplyWindowBannerProps {
  expiresAt: string | null;
}

export function ReplyWindowBanner({ expiresAt }: ReplyWindowBannerProps) {
  if (!expiresAt) return null;

  const expired = new Date(expiresAt) <= new Date();
  if (!expired) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-t border-amber-200 text-amber-800 text-sm">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <p>
        Das 24-Stunden-Antwortfenster ist abgelaufen. Eine Antwort ist nicht mehr möglich.
      </p>
    </div>
  );
}
