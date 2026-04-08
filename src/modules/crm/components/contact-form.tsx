"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CONTACT_TYPE_VALUES,
  CONTACT_TYPE_LABELS,
  CONTACT_SOURCE_VALUES,
  CONTACT_SOURCE_LABELS,
} from "../domain/constants";

const formSchema = z
  .object({
    salutation: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    companyName: z.string().optional(),
    email: z.string().email("Ungültige E-Mail").optional().or(z.literal("")),
    phone: z.string().optional(),
    phoneMobile: z.string().optional(),
    whatsappNumber: z.string().optional(),
    street: z.string().optional(),
    zipCode: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    contactType: z.string().optional(),
    source: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.lastName || data.companyName, {
    message: "Nachname oder Firmenname muss angegeben werden.",
    path: ["lastName"],
  });

type FormValues = z.infer<typeof formSchema>;

interface ContactFormProps {
  defaultValues?: Partial<FormValues>;
  onSubmit: (data: FormValues) => void;
  isPending?: boolean;
  submitLabel?: string;
}

export function ContactForm({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel = "Speichern",
}: ContactFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      country: "DE",
      contactType: "prospect",
      source: "manual",
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Identity */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-gray-700">Identität</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="salutation">Anrede</Label>
            <Select
              value={watch("salutation") ?? ""}
              onValueChange={(v) => setValue("salutation", v ?? undefined)}
            >
              <SelectTrigger id="salutation">
                <SelectValue placeholder="Anrede wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Herr">Herr</SelectItem>
                <SelectItem value="Frau">Frau</SelectItem>
                <SelectItem value="Divers">Divers</SelectItem>
                <SelectItem value="Firma">Firma</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="firstName">Vorname</Label>
            <Input id="firstName" {...register("firstName")} />
          </div>
          <div>
            <Label htmlFor="lastName">Nachname</Label>
            <Input id="lastName" {...register("lastName")} />
            {errors.lastName && (
              <p className="text-xs text-red-600 mt-1">{errors.lastName.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="companyName">Firma</Label>
            <Input id="companyName" {...register("companyName")} />
          </div>
        </div>
      </fieldset>

      {/* Contact channels */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-gray-700">Kontaktdaten</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email">E-Mail</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && (
              <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="phone">Telefon</Label>
            <Input id="phone" {...register("phone")} />
          </div>
          <div>
            <Label htmlFor="phoneMobile">Mobil</Label>
            <Input id="phoneMobile" {...register("phoneMobile")} />
          </div>
          <div>
            <Label htmlFor="whatsappNumber">WhatsApp</Label>
            <Input id="whatsappNumber" {...register("whatsappNumber")} />
          </div>
        </div>
      </fieldset>

      {/* Address */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-gray-700">Adresse</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-3">
            <Label htmlFor="street">Straße</Label>
            <Input id="street" {...register("street")} />
          </div>
          <div>
            <Label htmlFor="zipCode">PLZ</Label>
            <Input id="zipCode" {...register("zipCode")} />
          </div>
          <div>
            <Label htmlFor="city">Stadt</Label>
            <Input id="city" {...register("city")} />
          </div>
          <div>
            <Label htmlFor="country">Land</Label>
            <Input id="country" {...register("country")} />
          </div>
        </div>
      </fieldset>

      {/* Classification */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-gray-700">Klassifikation</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="contactType">Kontakttyp</Label>
            <Select
              value={watch("contactType")}
              onValueChange={(v) => setValue("contactType", v ?? undefined)}
            >
              <SelectTrigger id="contactType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_TYPE_VALUES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {CONTACT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!defaultValues && (
            <div>
              <Label htmlFor="source">Quelle</Label>
              <Select
                value={watch("source")}
                onValueChange={(v) => setValue("source", v ?? undefined)}
              >
                <SelectTrigger id="source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_SOURCE_VALUES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {CONTACT_SOURCE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </fieldset>

      {/* Notes */}
      <div>
        <Label htmlFor="notes">Notizen</Label>
        <Textarea id="notes" rows={3} {...register("notes")} />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Wird gespeichert..." : submitLabel}
      </Button>
    </form>
  );
}
