import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import DeliveryStatusBadge from "@/components/admin/email/DeliveryStatusBadge";
import { badgeClass, cardClass } from "@/components/admin/ui/styles";
import { formatDateTime } from "@/lib/admin/format";
import { requirePermission } from "@/lib/auth/dal";
import { repos } from "@/lib/data";

export const metadata: Metadata = { title: "Email" };

const ID = /^[a-z0-9]{1,40}$/;

export default async function EmailDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("manageSettings");
  const { id } = await params;
  if (!ID.test(id)) notFound();
  const delivery = await repos.emailDeliveries.find(id);
  if (!delivery) notFound();

  return (
    <div className="space-y-6">
      <Link href="/admin/emails" className="text-sm underline underline-offset-2">
        All emails
      </Link>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight break-words">{delivery.subject}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <DeliveryStatusBadge status={delivery.status} />
          <span className={badgeClass}>{delivery.category}</span>
          <span className="text-muted-foreground">to {delivery.recipient}</span>
        </div>
      </header>

      <dl className={`${cardClass} grid gap-3 text-sm sm:grid-cols-2`}>
        <div>
          <dt className="text-muted-foreground">Sent</dt>
          <dd>{formatDateTime(delivery.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Provider message id</dt>
          <dd className="break-all font-mono text-xs">{delivery.providerMessageId ?? "None"}</dd>
        </div>
        {delivery.ref ? (
          <div>
            <dt className="text-muted-foreground">About</dt>
            <dd className="font-mono text-xs">{delivery.ref}</dd>
          </div>
        ) : null}
        {delivery.errorClass ? (
          <div>
            <dt className="text-muted-foreground">Error</dt>
            <dd className="font-mono text-xs">{delivery.errorClass}</dd>
          </div>
        ) : null}
      </dl>

      <section className={`${cardClass} space-y-3`} aria-labelledby="attempts-heading">
        <h2 id="attempts-heading" className="text-lg font-semibold">
          Providers tried
        </h2>
        <ol className="space-y-1 text-sm">
          {delivery.attempts.map((attempt, index) => (
            <li key={`${attempt.provider}-${index}`} className="flex flex-wrap gap-2">
              <span className="font-medium">
                {index + 1}. {attempt.provider}
              </span>
              <span className={attempt.ok ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"}>
                {attempt.ok ? "accepted" : (attempt.errorClass ?? "failed")}
              </span>
              <span className="tabular-nums text-muted-foreground">{attempt.ms} ms</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={`${cardClass} space-y-3`} aria-labelledby="events-heading">
        <h2 id="events-heading" className="text-lg font-semibold">
          Events
        </h2>
        {delivery.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No webhook events yet.</p>
        ) : (
          <ol className="space-y-3 border-l border-border pl-4 text-sm">
            {delivery.events.map((event) => (
              <li key={event.id} className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <DeliveryStatusBadge status={event.status} />
                  <code className="text-xs">{event.type}</code>
                </div>
                <p className="text-xs text-muted-foreground">{formatDateTime(event.at)}</p>
                {event.detail ? <p className="text-xs">{event.detail}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
