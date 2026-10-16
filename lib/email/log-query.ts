import { EMAIL_CATEGORIES, type EmailCategory } from "@sahan-sac/email-kit";
import { DELIVERY_STATUSES, type DeliveryStatus } from "@sahan-sac/email-kit/tracking";

// The delivery log's URL state (status, category, keyset cursor), parsed
// strictly: an unknown value is dropped, never passed to the database.

export const LOG_PAGE_SIZE = 50;

export interface LogQuery {
  status?: DeliveryStatus;
  category?: EmailCategory;
  before?: { createdAt: Date; id: string };
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function parseLogQuery(params: Record<string, string | string[] | undefined>): LogQuery {
  const status = one(params.status);
  const category = one(params.category);
  const before = one(params.before);
  const query: LogQuery = {};
  if (status && (DELIVERY_STATUSES as readonly string[]).includes(status)) query.status = status as DeliveryStatus;
  if (category && (EMAIL_CATEGORIES as readonly string[]).includes(category)) query.category = category as EmailCategory;
  const match = before ? /^(\d{13})_([a-z0-9]{1,40})$/.exec(before) : null;
  if (match) query.before = { createdAt: new Date(Number(match[1])), id: match[2]! };
  return query;
}

/** The cursor for the page after `row`. */
export function cursorOf(row: { createdAt: Date; id: string }): string {
  return `${row.createdAt.getTime()}_${row.id}`;
}

/** Query string for a page, keeping the filters. */
export function logHref(query: LogQuery, before?: string): string {
  const search = new URLSearchParams();
  if (query.status) search.set("status", query.status);
  if (query.category) search.set("category", query.category);
  if (before) search.set("before", before);
  const text = search.toString();
  return text ? `/admin/emails?${text}` : "/admin/emails";
}
