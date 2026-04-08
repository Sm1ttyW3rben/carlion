"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, List } from "lucide-react";
import { api } from "@/shared/lib/trpc/client";
import { PipelineColumn } from "@/modules/sales/components/pipeline-column";

export default function VerkaufPage() {
  const { data: board, isLoading } = api.sales.getPipelineBoard.useQuery({ limitPerStage: 20 });
  const { data: stats } = api.sales.getStats.useQuery({ period: "month" });

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Verkauf</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Pipeline
            {stats ? ` · ${stats.openDeals} offen · ${stats.wonThisPeriod} gewonnen · ${stats.lostThisPeriod} verloren` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/verkauf/liste" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <List className="h-4 w-4 mr-1" /> Liste
          </Link>
          <Link href="/verkauf/neu" className={buttonVariants({ size: "sm" })}>
            <Plus className="h-4 w-4 mr-1" /> Vorgang anlegen
          </Link>
        </div>
      </div>

      {/* Board */}
      {isLoading && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="min-w-[280px]">
              <Skeleton className="h-10 w-full rounded-t-lg" />
              <Skeleton className="h-64 w-full rounded-b-lg" />
            </div>
          ))}
        </div>
      )}

      {board && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {board.stages.map((stage) => (
            <PipelineColumn key={stage.stage} stage={stage} />
          ))}
        </div>
      )}
    </div>
  );
}
