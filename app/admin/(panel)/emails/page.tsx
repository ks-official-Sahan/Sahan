import { EMAIL_CATEGORIES } from "@sahan-sac/email-kit";
import { quotaKey } from "@sahan-sac/email-kit/quota";
import { DELIVERY_STATUSES } from "@sahan-sac/email-kit/tracking";
import type { Metadata } from "next";
import Link from "next/link";

import DeliveryStatusBadge, { DELIVERY_STATUS_LABEL } from "@/components/admin/email/DeliveryStatusBadge";
import EmptyState from "@/components/admin/ui/EmptyState";
import { badgeClass, cardClass, tableClass, tdClass, thClass } from "@/components/admin/ui/styles";
import { formatDateTime, relativeTime } from "@/lib/admin/format";
import { requirePermission } from "@/lib/auth/dal";
import { kv } from "@/lib/cache/redis";
import { repos } from "@/lib/data";
import { getEmailHealth } from "@/lib/email";
import { cursorOf, LOG_PAGE_SIZE, logHref, parseLogQuery } from "@/lib/email/log-query";
import { getEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Emails" };

// Read outside the component: a server render is one request, and this is its clock.
const clock = () => Date.now();

const PROVIDER_LABEL: Record<string, string> = {
  "brevo-api": "Brevo API",
  resend: "Resend",
  "brevo-smtp": "Brevo SMTP",
  capture: "Capture (tests)",
};

const selectClass = "h-9 rounded-md border border-input bg-background px-3 text-sm";

export default async function EmailsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission("manageSettings");
  const nowMs = clock();
  const query = parseLogQuery(await searchParams);
  const env = getEnv();

  const [rows, health, brevoToday] = await Promise.all([
    repos.emailDeliveries.list({ ...query, take: LOG_PAGE_SIZE + 1 }),
    getEmailHealth(),
    kv.get<number>(quotaKey("brevo-api", new Date(nowMs))).catch(() => null),
  ]);
  const page = rows.slice(0, LOG_PAGE_SIZE);
  const next = rows.length > LOG_PAGE_SIZE ? page[page.length - 1] : undefined;
  const brevoLimit = env.BREVO_DAILY_LIMIT ?? 300;
  const filtered = Boolean(query.status || query.category);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Emails</h1>
        <p className="text-sm text-muted-foreground">
          Every email the site sent, the provider that took it, and what happened next. Provider webhooks update the status.
          Recipients are masked. Message bodies are never stored.
        </p>
      </header>

      <section className={`${cardClass} grid gap-4 sm:grid-cols-3`} aria-label="Sending setup">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">Sending order</h2>
          {health.order.length === 0 ? (
            <p className="text-sm text-destructive">No provider is configured.</p>
          ) : (
            <ol className="flex flex-wrap items-center gap-1 text-sm">
              {health.order.map((name, index) => (
                <li key={name} className="flex items-center gap-1">
                  {index > 0 ? <span aria-hidden className="text-muted-foreground">→</span> : null}
                  <span className={badgeClass}>{PROVIDER_LABEL[name] ?? name}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="text-xs text-muted-foreground">
            Change it in{" "}
            <Link href="/admin/settings" className="underline underline-offset-2">
              Settings
            </Link>
            .
          </p>
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-medium">Brevo API today</h2>
          <p className="text-sm tabular-nums">
            {brevoToday ?? 0}
            {brevoLimit > 0 ? ` of ${brevoLimit}` : ""} sent
          </p>
          <p className="text-xs text-muted-foreground">At the limit, mail goes to the next provider until midnight UTC.</p>
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-medium">Status webhooks</h2>
          <ul className="space-y-0.5 text-sm">
            <li>Resend: {env.RESEND_WEBHOOK_SECRET ? "on" : "off (set RESEND_WEBHOOK_SECRET)"}</li>
            <li>Brevo: {env.BREVO_WEBHOOK_TOKEN ? "on" : "off (set BREVO_WEBHOOK_TOKEN)"}</li>
          </ul>
          <p className="text-xs text-muted-foreground">Without a webhook, a status stays at Sent.</p>
        </div>
      </section>

      <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Filter emails">
        <label className="space-y-1 text-sm">
          <span className="block font-medium">Status</span>
          <select name="status" defaultValue={query.status ?? ""} className={selectClass}>
            <option value="">Any</option>
            {DELIVERY_STATUSES.map((status) => (
              <option key={status} value={status}>
                {DELIVERY_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-medium">Type</span>
          <select name="category" defaultValue={query.category ?? ""} className={selectClass}>
            <option value="">Any</option>
            {EMAIL_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-9 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted">
          Filter
        </button>
        {filtered ? (
          <Link href="/admin/emails" className="py-2 text-sm underline underline-offset-2">
            Clear
          </Link>
        ) : null}
      </form>

      {page.length === 0 ? (
        <EmptyState title="No emails" description={filtered ? "Nothing matches these filters." : "Sent emails show here."} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className={tableClass}>
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th scope="col" className={thClass}>
                  When
                </th>
                <th scope="col" className={thClass}>
                  To
                </th>
                <th scope="col" className={thClass}>
                  Subject
                </th>
                <th scope="col" className={thClass}>
                  Type
                </th>
                <th scope="col" className={thClass}>
                  Provider
                </th>
                <th scope="col" className={thClass}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {page.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className={tdClass} title={formatDateTime(row.createdAt)}>
                    <Link href={`/admin/emails/${row.id}`} className="underline-offset-2 hover:underline">
                      {relativeTime(row.createdAt, nowMs)}
                    </Link>
                  </td>
                  <td className={tdClass}>
                    {row.recipient}
                    {row.recipients > 1 ? <span className="text-xs text-muted-foreground"> +{row.recipients - 1}</span> : null}
                  </td>
                  <td className={`${tdClass} max-w-[18rem] truncate`} title={row.subject}>
                    {row.subject}
                  </td>
                  <td className={tdClass}>
                    <span className={badgeClass}>{row.category}</span>
                  </td>
                  <td className={tdClass}>
                    {row.provider ? (PROVIDER_LABEL[row.provider] ?? row.provider) : "None"}
                    {row.attempts.length > 1 ? (
                      <span className="block text-xs text-muted-foreground">
                        after {row.attempts.length - 1} fallback{row.attempts.length > 2 ? "s" : ""}
                      </span>
                    ) : null}
                  </td>
                  <td className={tdClass}>
                    <DeliveryStatusBadge status={row.status} title={row.errorClass ?? undefined} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav aria-label="Pages" className="flex gap-3 text-sm">
        {query.before ? (
          <Link href={logHref({ ...query, before: undefined })} className="underline underline-offset-2">
            Newest
          </Link>
        ) : null}
        {next ? (
          <Link href={logHref(query, cursorOf(next))} className="underline underline-offset-2">
            Older
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
