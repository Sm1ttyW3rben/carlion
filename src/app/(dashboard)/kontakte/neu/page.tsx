"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/shared/lib/trpc/client";
import { ContactForm } from "@/modules/crm/components/contact-form";

export default function KontaktNeuPage() {
  const router = useRouter();

  const mutation = api.crm.create.useMutation({
    onSuccess: (data) => {
      router.push(`/kontakte/${data.id}`);
    },
  });

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/kontakte"
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kontakt anlegen</h1>
          <p className="text-sm text-gray-500 mt-0.5">Neuen Kontakt erstellen</p>
        </div>
      </div>

      {mutation.error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
          {mutation.error.message}
        </div>
      )}

      <ContactForm
        onSubmit={(data) => mutation.mutate(data as Parameters<typeof mutation.mutate>[0])}
        isPending={mutation.isPending}
        submitLabel="Kontakt anlegen"
      />
    </div>
  );
}
