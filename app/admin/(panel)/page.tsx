import { Activity, AlertTriangle, FileText, Inbox, KeyRound, PenLine, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import RefreshButton from "@/components/admin/dashboard/RefreshButton";
import { RevealGroup, RevealItem } from "@/components/admin/dashboard/Reveal";
import StatTile from "@/components/admin/dashboard/StatTile";
import TrendChartLazy from "@/components/admin/dashboard/TrendChartLazy";
import {
  getActivitySeries,
  getContentCounts,
  getEmailHealth,
  getNewInquiriesCount,
  getRecentActivity,
  getSystemHealth,
  getUserSecurityStatus,
  type ActivitySeries,
  type Probe,
} from "@/lib/admin/dashboard";
import { formatDateTime, relativeTime } from "@/lib/admin/format";
import { hasPermission, requirePermission, type AuthUser } from "@/lib/auth/dal";
import { authAdapter } from "@/lib/data";
import type { DailyCounts } from "@/lib/data/maintenance";

// A title template does not apply to the page in the same segment as the layout
// that defines it, so the dashboard spells out its full title.
export const metadata: Metadata = { title: { absolute: "Dashboard - Admin" } };

// Read outside the components: a server render is one request, and this is its clock.
const clock = () => Date.now();

type SeriesKey = keyof Omit<DailyCounts, "day">;

// The dashboard streams: the header paints at once and each section fills in
// as its own queries answer, so one slow probe never holds up the rest. Every
// number links to the list behind it and the trend says how fresh it is
// (the series is cached for a minute). Only the queries the viewer's
// permissions cover are run, and every one tolerates a missing database.
export default async function DashboardPage() {
  const user = await requirePermission("viewDashboard");
  const can = {
    audit: hasPermission(user, "viewAuditLogs"),
    content: hasPermission(user, "editPages") || hasPermission(user, "editCollections"),
    leads: hasPermission(user, "viewLeads"),
    health: hasPermission(user, "viewSecurityStatus"),
  };
  const seriesKeys = [can.leads && "inquiries", can.content && "posts", can.audit && "activity"].filter(Boolean) as SeriesKey[];
  const series = seriesKeys.length > 0 ? getActivitySeries(user) : Promise.resolve(null);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">What changed, what needs you, and how the site is running.</p>
        </div>
        <RefreshButton />
      </header>

      <Suspense fallback={null}>
        <AccountAlerts user={user} />
      </Suspense>

      <Suspense fallback={<TilesSkeleton count={2 + Number(can.leads) + Number(can.audit) + Number(can.content)} />}>
        <Tiles user={user} can={can} series={series} />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-3">
        {seriesKeys.length > 0 ? (
          <Suspense fallback={<PanelSkeleton className={can.health ? "lg:col-span-2" : "lg:col-span-3"} height="h-80" />}>
            <TrendPanel series={series} keys={seriesKeys} className={can.health ? "lg:col-span-2" : "lg:col-span-3"} />
          </Suspense>
        ) : null}
        {can.health ? (
          <Suspense fallback={<PanelSkeleton height="h-80" />}>
            <HealthPanel className={seriesKeys.length > 0 ? "" : "lg:col-span-3"} />
          </Suspense>
        ) : null}
      </div>

      {can.audit ? (
        <Suspense fallback={<PanelSkeleton height="h-64" />}>
          <ActivityPanel user={user} />
        </Suspense>
      ) : null}
    </div>
  );
}

// ─── sections ───────────────────────────────────────────────────────────────

async function AccountAlerts({ user }: { user: AuthUser }) {
  const [status, factors] = await Promise.all([getUserSecurityStatus(user.id), authAdapter.findMfaFactors(user.id).catch(() => null)]);
  const strong = Boolean(factors && (factors.totpEnabledAt || factors.passkeys > 0));
  const alerts: { title: string; body: string; href: string; action: string }[] = [];
  if (status.mustChangePassword) {
    alerts.push({ title: "Change your password", body: "An administrator set it for you.", href: "/admin/account", action: "Change it" });
  }
  if (!strong) {
    alerts.push({
      title: "Add an authenticator app or a passkey",
      body: "A strong second factor keeps this account safe if the password leaks.",
      href: "/admin/account#security",
      action: "Set it up",
    });
  }
  if (alerts.length === 0) return null;
  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div
          key={alert.title}
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-medium text-amber-950 dark:text-amber-100">{alert.title}</p>
              <p className="text-amber-900/80 dark:text-amber-200/80">{alert.body}</p>
            </div>
          </div>
          <Link
            href={alert.href}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {alert.action}
          </Link>
        </div>
      ))}
    </div>
  );
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const lastWeek = (values: number[]) => sum(values.slice(-7));

async function Tiles({
  user,
  can,
  series,
}: {
  user: AuthUser;
  can: { audit: boolean; content: boolean; leads: boolean };
  series: Promise<ActivitySeries | null>;
}) {
  const [days, inquiries, content, factors] = await Promise.all([
    series.then((result) => result?.days ?? []),
    can.leads ? getNewInquiriesCount() : Promise.resolve(0),
    can.content ? getContentCounts() : Promise.resolve({ drafts: 0, unpublished: 0 }),
    authAdapter.findMfaFactors(user.id).catch(() => null),
  ]);
  const column = (key: SeriesKey) => days.map((day) => day[key]);
  const strongCount = factors ? (factors.totpEnabledAt ? 1 : 0) + factors.passkeys : 0;

  const tiles: { key: string; node: ReactNode }[] = [];
  if (can.leads) {
    const trend = column("inquiries");
    tiles.push({
      key: "inquiries",
      node: (
        <StatTile
          href="/admin/leads?status=NEW"
          label="New inquiries"
          value={inquiries}
          icon={<Inbox className="size-4" />}
          caption="waiting for a reply"
          trend={trend}
          delta={{ value: lastWeek(trend), period: "this week" }}
          tone="attention"
        />
      ),
    });
  }
  if (can.content) {
    const trend = column("posts");
    tiles.push(
      {
        key: "unpublished",
        node: (
          <StatTile
            href="/admin/blog?status=DRAFT"
            label="Not yet public"
            value={content.unpublished}
            icon={<PenLine className="size-4" />}
            caption={`includes ${content.drafts} draft ${content.drafts === 1 ? "block" : "blocks"}`}
          />
        ),
      },
      {
        key: "published",
        node: (
          <StatTile
            href="/admin/blog?status=PUBLISHED"
            label="Posts published"
            value={sum(trend)}
            icon={<FileText className="size-4" />}
            caption="in the last 30 days"
            trend={trend}
          />
        ),
      }
    );
  }
  if (can.audit) {
    const trend = column("activity");
    tiles.push({
      key: "activity",
      node: (
        <StatTile
          href="/admin/audit"
          label="Admin activity"
          value={lastWeek(trend)}
          icon={<Activity className="size-4" />}
          caption="changes in the last 7 days"
          trend={trend}
        />
      ),
    });
  }
  tiles.push({
    key: "security",
    node: (
      <StatTile
        href="/admin/account#security"
        label="Your sign-in"
        value={strongCount}
        icon={strongCount > 0 ? <ShieldCheck className="size-4" /> : <KeyRound className="size-4" />}
        caption={strongCount > 0 ? "strong factors (app or passkeys)" : "no app or passkey yet"}
      />
    ),
  });

  return (
    <RevealGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <RevealItem key={tile.key}>{tile.node}</RevealItem>
      ))}
    </RevealGroup>
  );
}

const SERIES_META: Record<SeriesKey, { label: string; color: string }> = {
  inquiries: { label: "Inquiries", color: "hsl(var(--chart-1))" },
  posts: { label: "Posts published", color: "hsl(var(--chart-2))" },
  activity: { label: "Admin activity", color: "hsl(var(--chart-4))" },
};

async function TrendPanel({ series, keys, className }: { series: Promise<ActivitySeries | null>; keys: SeriesKey[]; className?: string }) {
  const result = await series;
  if (!result) {
    return (
      <Panel title="Last 30 days" className={className}>
        <p className="text-sm text-muted-foreground">The trend is unavailable: the database did not answer.</p>
      </Panel>
    );
  }
  // Only the series this viewer may see reach the browser.
  const days = result.days.map((day) => ({
    day: day.day,
    inquiries: keys.includes("inquiries") ? day.inquiries : undefined,
    posts: keys.includes("posts") ? day.posts : undefined,
    activity: keys.includes("activity") ? day.activity : undefined,
  }));
  const generated = new Date(result.generatedAt);
  return (
    <Panel
      title="Last 30 days"
      className={className}
      aside={
        <span className="text-xs text-muted-foreground" title={formatDateTime(generated)}>
          Updated {relativeTime(generated, clock())}
        </span>
      }
    >
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
        {keys.map((key) => (
          <li key={key} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: SERIES_META[key].color }} />
            {SERIES_META[key].label}
            <span className="font-medium tabular-nums text-foreground">{sum(result.days.map((day) => day[key]))}</span>
          </li>
        ))}
      </ul>
      <TrendChartLazy days={days} keys={keys} />
      <table className="sr-only">
        <caption>Daily counts for the last 30 days</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            {keys.map((key) => (
              <th key={key} scope="col">
                {SERIES_META[key].label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.days.map((day) => (
            <tr key={day.day}>
              <th scope="row">{day.day}</th>
              {keys.map((key) => (
                <td key={key}>{day[key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

const PROBE_TEXT: Record<Probe["state"], string> = { up: "Online", down: "Not answering", off: "In-memory" };
const PROBE_DOT: Record<Probe["state"], string> = { up: "bg-emerald-500", down: "bg-red-500", off: "bg-amber-500" };

async function HealthPanel({ className }: { className?: string }) {
  const [health, email] = await Promise.all([getSystemHealth(), getEmailHealth()]);
  const rows: { name: string; detail: string; state: Probe["state"]; ms: number | null; text?: string }[] = [
    { name: "Database", detail: "primary storage", ...health.database },
    { name: "Redis", detail: "cache, sessions and rate limits", ...health.redis },
    { name: "Email", detail: "transactional mail", state: email?.canSend ? "up" : "down", ms: null, text: email?.canSend ? "Ready" : "Not configured" },
  ];
  return (
    <Panel title="System" className={className} aside={<span className="text-xs text-muted-foreground">Checked just now</span>}>
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.name} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm font-medium">{row.name}</p>
              <p className="text-xs text-muted-foreground">{row.detail}</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {row.ms !== null ? <span className="text-xs tabular-nums text-muted-foreground">{row.ms} ms</span> : null}
              <span className={`size-2 rounded-full ${PROBE_DOT[row.state]}`} aria-hidden="true" />
              <span>{row.text ?? PROBE_TEXT[row.state]}</span>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

async function ActivityPanel({ user }: { user: AuthUser }) {
  const activity = await getRecentActivity(user, 8);
  const now = clock();
  return (
    <Panel
      title="Recent activity"
      aside={
        <Link href="/admin/audit" className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Audit log
        </Link>
      }
    >
      {activity.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet.</p>
      ) : (
        <ol className="divide-y divide-border">
          {activity.map((entry) => (
            <li key={entry.id} className="flex items-baseline justify-between gap-4 py-2.5 text-sm first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate font-medium">{entry.action}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {entry.actorEmail ?? "System"}
                  {entry.entityType ? ` · ${entry.entityType}` : ""}
                </p>
              </div>
              <time
                dateTime={entry.createdAt.toISOString()}
                title={formatDateTime(entry.createdAt)}
                className="shrink-0 text-xs tabular-nums text-muted-foreground"
              >
                {relativeTime(entry.createdAt, now)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

// ─── building blocks ────────────────────────────────────────────────────────

function Panel({ title, aside, className, children }: { title: string; aside?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm ${className ?? ""}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function TilesSkeleton({ count }: { count: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="h-[132px] animate-pulse rounded-xl border border-border bg-muted/40 motion-reduce:animate-none" />
      ))}
    </div>
  );
}

function PanelSkeleton({ className, height }: { className?: string; height: string }) {
  return <div className={`${height} animate-pulse rounded-xl border border-border bg-muted/40 motion-reduce:animate-none ${className ?? ""}`} aria-hidden="true" />;
}
