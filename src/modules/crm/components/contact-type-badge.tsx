import { Badge } from "@/components/ui/badge";
import { CONTACT_TYPE_LABELS } from "../domain/constants";
import type { ContactType } from "../domain/types";

const TYPE_COLORS: Record<ContactType, string> = {
  customer: "bg-green-100 text-green-800 border-green-200",
  prospect: "bg-blue-100 text-blue-800 border-blue-200",
  seller: "bg-orange-100 text-orange-800 border-orange-200",
  partner: "bg-purple-100 text-purple-800 border-purple-200",
  other: "bg-gray-100 text-gray-800 border-gray-200",
};

export function ContactTypeBadge({ type }: { type: ContactType }) {
  return (
    <Badge variant="outline" className={TYPE_COLORS[type]}>
      {CONTACT_TYPE_LABELS[type]}
    </Badge>
  );
}
