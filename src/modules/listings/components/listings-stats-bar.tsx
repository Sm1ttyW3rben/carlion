"use client";

import { cn } from "@/lib/utils";
import { BarChart2, MessageSquare, Eye, AlertCircle } from "lucide-react";
import type { ListingsStats } from "../domain/types";

interface ListingsStatsBarProps {
  stats: ListingsStats;
  className?: string;
}

export function ListingsStatsBar({ stats, className }: ListingsStatsBarProps) {
  const activeListings =
    (stats.bySyncStatus.synced ?? 0) + (stats.bySyncStatus.pending ?? 0);
  const errorListings = stats.bySyncStatus.error ?? 0;

  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-3", className)}>
      <StatCard
        icon={<BarChart2 className="h-5 w-5 text-blue-600" />}
        label="Aktive Inserate"
        value={`${activeListings}`}
        sub={`${stats.byPlatform.mobile_de ?? 0} mobile.de · ${stats.byPlatform.autoscout24 ?? 0} AutoScout`}
        bg="bg-blue-50"
      />
      <StatCard
        icon={<Eye className="h-5 w-5 text-purple-600" />}
        label="Views (gesamt)"
        value={stats.totalViews.toLocaleString("de-DE")}
        sub="alle Börsen kombiniert"
        bg="bg-purple-50"
      />
      <StatCard
        icon={<MessageSquare className="h-5 w-5 text-green-600" />}
        label="Anfragen"
        value={`${stats.totalInquiries}`}
        sub={`${stats.unprocessedInquiries} offen`}
        bg="bg-green-50"
        highlight={stats.unprocessedInquiries > 0}
      />
      <StatCard
        icon={<AlertCircle className="h-5 w-5 text-red-600" />}
        label="Sync-Fehler"
        value={`${errorListings}`}
        sub="Inserate mit Fehler"
        bg="bg-red-50"
        highlight={errorListings > 0}
      />
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  bg: string;
  highlight?: boolean;
}

function StatCard({ icon, label, value, sub, bg, highlight }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl p-4 flex items-start gap-3",
        bg,
        highlight && "ring-1 ring-red-200"
      )}
    >
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5 truncate">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}
