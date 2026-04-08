"use client";

import { cn } from "@/lib/utils";
import type { Platform } from "../domain/types";

const LABELS: Record<Platform, string> = {
  mobile_de: "mobile.de",
  autoscout24: "AutoScout24",
};

const STYLES: Record<Platform, string> = {
  mobile_de: "bg-orange-100 text-orange-800",
  autoscout24: "bg-blue-100 text-blue-800",
};

interface PlatformBadgeProps {
  platform: Platform;
  className?: string;
}

export function PlatformBadge({ platform, className }: PlatformBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STYLES[platform],
        className
      )}
    >
      {LABELS[platform]}
    </span>
  );
}
