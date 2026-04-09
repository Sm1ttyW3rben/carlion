/**
 * SendStatusIcon — WhatsApp-style delivery status icons.
 * ✓ sent, ✓✓ delivered, ✓✓ (blue) read, ❌ failed
 */

import type { SendStatus } from "../domain/types";

interface SendStatusIconProps {
  status: SendStatus | null;
}

export function SendStatusIcon({ status }: SendStatusIconProps) {
  if (!status) return null;

  switch (status) {
    case "sending":
      return <span className="text-gray-300 text-xs ml-1">○</span>;
    case "sent":
      return <span className="text-gray-400 text-xs ml-1" title="Gesendet">✓</span>;
    case "delivered":
      return <span className="text-gray-400 text-xs ml-1" title="Zugestellt">✓✓</span>;
    case "read":
      return <span className="text-blue-500 text-xs ml-1" title="Gelesen">✓✓</span>;
    case "failed":
      return <span className="text-red-500 text-xs ml-1" title="Fehler">❌</span>;
    default:
      return null;
  }
}
