"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/shared/lib/trpc/client";
import { ContactForm } from "@/modules/crm/components/contact-form";

export default function KontaktBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: contact, isLoading } = api.crm.getById.useQuery({ id });

  const mutation = api.crm.update.useMutation({
    onSuccess: () => {
      router.push(`/kontakte/${id}`);
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
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
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/kontakte/${id}`}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {contact.displayName} bearbeiten
          </h1>
        </div>
      </div>

      {mutation.error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
          {mutation.error.message}
        </div>
      )}

      <ContactForm
        defaultValues={{
          salutation: contact.salutation ?? undefined,
          firstName: contact.firstName ?? undefined,
          lastName: contact.lastName ?? undefined,
          companyName: contact.companyName ?? undefined,
          email: contact.email ?? undefined,
          phone: contact.phone ?? undefined,
          phoneMobile: contact.phoneMobile ?? undefined,
          whatsappNumber: contact.whatsappNumber ?? undefined,
          street: contact.street ?? undefined,
          zipCode: contact.zipCode ?? undefined,
          city: contact.city ?? undefined,
          country: contact.country,
          contactType: contact.contactType,
          notes: "notes" in contact ? (contact.notes ?? undefined) : undefined,
        }}
        onSubmit={(data) =>
          mutation.mutate({
            id,
            ...data,
          } as Parameters<typeof mutation.mutate>[0])
        }
        isPending={mutation.isPending}
        submitLabel="Speichern"
      />
    </div>
  );
}
