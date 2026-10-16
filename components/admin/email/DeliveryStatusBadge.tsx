import type { DeliveryStatus } from "@sahan-sac/email-kit/tracking";

import { cn } from "@/lib/utils";

// One badge for an email's delivery status, used by the delivery log and the
// invite list. Text carries the meaning; colour only reinforces it.

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  queued: "Queued",
  sent: "Sent",
  delayed: "Delayed",
  delivered: "Delivered",
  opened: "Opened",
  clicked: "Clicked",
  unsubscribed: "Unsubscribed",
  complained: "Marked as spam",
  bounced: "Bounced",
  blocked: "Blocked",
  failed: "Failed",
};

const TONE: Record<DeliveryStatus, "pending" | "good" | "bad"> = {
  queued: "pending",
  sent: "pending",
  delayed: "pending",
  delivered: "good",
  opened: "good",
  clicked: "good",
  unsubscribed: "bad",
  complained: "bad",
  bounced: "bad",
  blocked: "bad",
  failed: "bad",
};

const TONE_CLASS = {
  pending: "border-border bg-muted text-muted-foreground",
  good: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300",
  bad: "border-destructive/40 bg-destructive/10 text-destructive",
} as const;

export default function DeliveryStatusBadge({ status, title }: { status: DeliveryStatus; title?: string }) {
  return (
    <span
      title={title}
      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", TONE_CLASS[TONE[status]])}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {DELIVERY_STATUS_LABEL[status]}
    </span>
  );
}
