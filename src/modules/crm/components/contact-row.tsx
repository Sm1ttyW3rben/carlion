import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ContactTypeBadge } from "./contact-type-badge";
import type { ContactListItem } from "../domain/types";

export function ContactRow({ contact }: { contact: ContactListItem }) {
  return (
    <TableRow className="hover:bg-gray-50">
      <TableCell>
        <Link
          href={`/kontakte/${contact.id}`}
          className="font-medium text-gray-900 hover:underline"
        >
          {contact.displayName}
        </Link>
      </TableCell>
      <TableCell>
        <ContactTypeBadge type={contact.contactType} />
      </TableCell>
      <TableCell className="text-gray-600">{contact.email ?? "—"}</TableCell>
      <TableCell className="text-gray-600">{contact.phone ?? "—"}</TableCell>
      <TableCell className="text-gray-600">
        {contact.assignedToUser?.name ?? "—"}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {contact.isInactive && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
              Inaktiv
            </Badge>
          )}
          {contact.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
}
