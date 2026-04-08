"use client";

import { use } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Pencil, Mail, Phone, MapPin, Calendar, Archive,
} from "lucide-react";
import { api } from "@/shared/lib/trpc/client";
import { ContactTypeBadge } from "@/modules/crm/components/contact-type-badge";
import { ActivityTimeline } from "@/modules/crm/components/activity-timeline";
import { QuickNoteInput } from "@/modules/crm/components/quick-note-input";
import { VehicleInterestList } from "@/modules/crm/components/vehicle-interest-list";
import { CONTACT_SOURCE_LABELS } from "@/modules/crm/domain/constants";
import type { ContactType, ContactSource } from "@/modules/crm/domain/types";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function KontaktDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: contact, isLoading } = api.crm.getById.useQuery({ id });
  const utils = api.useUtils();

  const archiveMutation = api.crm.archive.useMutation({
    onSuccess: () => utils.crm.getById.invalidate({ id }),
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="p-4 md:p-6 text-center py-16">
        <p className="text-gray-500">Kontakt nicht gefunden.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/kontakte"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {contact.displayName}
              </h1>
              <ContactTypeBadge type={contact.contactType as ContactType} />
              {contact.isInactive && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  Inaktiv
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {CONTACT_SOURCE_LABELS[contact.source as ContactSource] ?? contact.source}
              {" · "}Erstellt {formatDate(contact.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/kontakte/${id}/bearbeiten`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Pencil className="h-4 w-4 mr-1" />
            Bearbeiten
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => archiveMutation.mutate({ id })}
            disabled={archiveMutation.isPending}
          >
            <Archive className="h-4 w-4 mr-1" />
            Archivieren
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main: Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Aktivitäten</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <QuickNoteInput contactId={id} />
              <ActivityTimeline contactId={id} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Contact info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Kontaktdaten</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {contact.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                    {contact.email}
                  </a>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">
                    {contact.phone}
                  </a>
                </div>
              )}
              {contact.phoneMobile && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span>{contact.phoneMobile} (Mobil)</span>
                </div>
              )}
              {(contact.street || contact.city) && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                  <span>
                    {[contact.street, [contact.zipCode, contact.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
              {contact.assignedToUser && (
                <div className="flex items-center gap-2 pt-2 border-t">
                  <span className="text-gray-500">Zuständig:</span>
                  <span className="font-medium">{contact.assignedToUser.name}</span>
                </div>
              )}
              {contact.lastInteractionAt && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-500">
                    Letzte Interaktion: {formatDate(contact.lastInteractionAt)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vehicle interests */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Fahrzeug-Interessen</CardTitle>
            </CardHeader>
            <CardContent>
              <VehicleInterestList interests={contact.vehicleInterests} />
            </CardContent>
          </Card>

          {/* Tags */}
          {contact.tags.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {contact.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
