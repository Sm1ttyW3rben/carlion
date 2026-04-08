import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Phone } from "lucide-react";
import { ContactTypeBadge } from "./contact-type-badge";
import type { ContactListItem } from "../domain/types";

export function ContactCard({ contact }: { contact: ContactListItem }) {
  return (
    <Link href={`/kontakte/${contact.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <User className="h-5 w-5 text-gray-500" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {contact.displayName}
                </p>
                {contact.assignedToUser && (
                  <p className="text-xs text-gray-500 truncate">
                    {contact.assignedToUser.name}
                  </p>
                )}
              </div>
            </div>
            <ContactTypeBadge type={contact.contactType} />
          </div>

          {/* Contact info */}
          <div className="space-y-1 text-sm text-gray-600">
            {contact.email && (
              <div className="flex items-center gap-1.5 truncate">
                <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{contact.phone}</span>
              </div>
            )}
          </div>

          {/* Tags + inactive */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {contact.isInactive && (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
                Inaktiv
              </Badge>
            )}
            {contact.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
