import { ACTIVITY_TYPE_LABELS } from "../domain/constants";
import type { ActivityView } from "../domain/types";
import {
  MessageSquare, Phone, Mail, MailOpen, MessageCircle,
  Car, FileText, UserCheck, ArrowRightLeft, Eye,
} from "lucide-react";

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  note: MessageSquare,
  call: Phone,
  email_in: MailOpen,
  email_out: Mail,
  whatsapp_in: MessageCircle,
  whatsapp_out: MessageCircle,
  visit: Eye,
  test_drive: Car,
  offer_sent: FileText,
  deal_created: FileText,
  deal_won: FileText,
  deal_lost: FileText,
  vehicle_interest: Car,
  type_change: ArrowRightLeft,
  assignment_change: UserCheck,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActivityItem({ activity }: { activity: ActivityView }) {
  const Icon = ACTIVITY_ICONS[activity.activityType] ?? MessageSquare;
  const label = ACTIVITY_TYPE_LABELS[activity.activityType] ?? activity.activityType;

  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mt-0.5">
        <Icon className="h-4 w-4 text-gray-500" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-gray-900">
            {activity.title ?? label}
          </p>
          <time className="text-xs text-gray-400 whitespace-nowrap">
            {formatDate(activity.performedAt)}
          </time>
        </div>
        {activity.description && (
          <p className="text-sm text-gray-600 mt-0.5">{activity.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
          {activity.performedBy && <span>{activity.performedBy.name}</span>}
          {activity.vehicleLabel && (
            <span className="text-blue-600">🚗 {activity.vehicleLabel}</span>
          )}
        </div>
      </div>
    </div>
  );
}
