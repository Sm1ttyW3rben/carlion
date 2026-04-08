"use client";

import { CheckCircle2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { PlatformBadge } from "./platform-badge";
import type { InquiryView } from "../domain/types";

interface InquiryRowProps {
  inquiry: InquiryView;
  onProcess: (inquiryId: string) => void;
  isProcessing?: boolean;
}

export function InquiryRow({ inquiry, onProcess, isProcessing }: InquiryRowProps) {
  return (
    <TableRow className={inquiry.processed ? "opacity-60" : undefined}>
      <TableCell>
        <div className="min-w-0">
          <p className="font-medium text-sm">
            {inquiry.vehicle.make} {inquiry.vehicle.model}
          </p>
          <PlatformBadge platform={inquiry.platform} className="mt-1" />
        </div>
      </TableCell>

      <TableCell>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {inquiry.inquirerName ?? "Unbekannt"}
          </p>
          {inquiry.inquirerEmail && (
            <a
              href={`mailto:${inquiry.inquirerEmail}`}
              className="text-xs text-blue-600 hover:underline truncate block"
            >
              {inquiry.inquirerEmail}
            </a>
          )}
          {inquiry.inquirerPhone && (
            <p className="text-xs text-gray-500">{inquiry.inquirerPhone}</p>
          )}
        </div>
      </TableCell>

      <TableCell>
        <p className="text-sm text-gray-700 line-clamp-2 max-w-64">
          {inquiry.message ?? <span className="text-gray-400">Keine Nachricht</span>}
        </p>
      </TableCell>

      <TableCell>
        <p className="text-xs text-gray-500">
          {new Date(inquiry.receivedAt).toLocaleString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </TableCell>

      <TableCell>
        {inquiry.contact ? (
          <div className="flex items-center gap-1 text-sm text-gray-700">
            <User className="h-3.5 w-3.5 text-gray-400" />
            {inquiry.contact.displayName}
          </div>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </TableCell>

      <TableCell>
        {inquiry.processed ? (
          <span className="flex items-center gap-1 text-xs text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Bearbeitet
          </span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onProcess(inquiry.id)}
            disabled={isProcessing}
          >
            Bearbeiten
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
