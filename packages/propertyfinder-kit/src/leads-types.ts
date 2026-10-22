/**
 * Property Finder Atlas lead shape — keep field names/types aligned with GET /v1/leads.
 * Do not remap into InquiryStatus / Prisma Inquiry for the PF inbox.
 */

export type PFLeadContactType = "phone" | "email" | "whatsappUsername" | string;

export type PFLeadContact = {
  type: PFLeadContactType;
  value: string;
};

export type PFLeadSender = {
  name?: string | null;
  contacts?: PFLeadContact[] | null;
};

export type PFLeadListingRef = {
  id?: string | null;
  reference?: string | null;
};

export type PFLeadPublicProfile = {
  id?: number | string | null;
};

/** Message / call / email delivery status from Atlas (live sample: sent|read|replied|failed). */
export type PFLeadStatus = string;

export type PFLead = {
  id: string;
  channel?: string | null;
  status: PFLeadStatus;
  entityType?: string | null;
  createdAt: string;
  sender: PFLeadSender;
  listing?: PFLeadListingRef | null;
  publicProfile?: PFLeadPublicProfile | null;
  responseLink?: string | null;
  tags?: unknown;
  project?: Record<string, unknown> | null;
  /** Passthrough for seller / unknown Atlas fields */
  [key: string]: unknown;
};

export const PF_LEAD_PIPELINE_STATUSES = [
  "sent",
  "delivered",
  "read",
  "replied",
  "failed",
] as const;

export type PFLeadPipelineStatus = (typeof PF_LEAD_PIPELINE_STATUSES)[number];

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function normalizeContacts(raw: unknown): PFLeadContact[] {
  if (!Array.isArray(raw)) return [];
  const out: PFLeadContact[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const type = asString(row.type);
    const value = asString(row.value);
    if (!type || !value) continue;
    out.push({ type, value });
  }
  return out;
}

/** Coerce Atlas JSON into typed PFLead. Returns null if id missing. */
export function normalizePfLead(raw: Record<string, unknown>): PFLead | null {
  const id = asString(raw.id) ?? asString(raw.leadId);
  if (!id) return null;

  const senderRaw =
    raw.sender && typeof raw.sender === "object" && !Array.isArray(raw.sender)
      ? (raw.sender as Record<string, unknown>)
      : {};
  const listingRaw =
    raw.listing && typeof raw.listing === "object" && !Array.isArray(raw.listing)
      ? (raw.listing as Record<string, unknown>)
      : null;
  const profileRaw =
    raw.publicProfile &&
    typeof raw.publicProfile === "object" &&
    !Array.isArray(raw.publicProfile)
      ? (raw.publicProfile as Record<string, unknown>)
      : null;

  const createdAt =
    asString(raw.createdAt) ??
    asString(raw.created_at) ??
    new Date(0).toISOString();

  return {
    ...raw,
    id,
    channel: asString(raw.channel) ?? asString(raw.leadChannel),
    status: asString(raw.status) ?? "unknown",
    entityType: asString(raw.entityType) ?? asString(raw.leadType),
    createdAt,
    sender: {
      name: asString(senderRaw.name) ?? asString(raw.sender_name),
      contacts: normalizeContacts(senderRaw.contacts),
    },
    listing: listingRaw
      ? {
          id: asString(listingRaw.id),
          reference: asString(listingRaw.reference),
        }
      : null,
    publicProfile: profileRaw
      ? { id: profileRaw.id as number | string | null }
      : null,
    responseLink: asString(raw.responseLink),
    tags: raw.tags ?? null,
    project:
      raw.project && typeof raw.project === "object" && !Array.isArray(raw.project)
        ? (raw.project as Record<string, unknown>)
        : null,
  };
}

export function pfLeadContact(
  lead: Pick<PFLead, "sender">,
  type: "phone" | "email",
): string | null {
  const contacts = lead.sender?.contacts ?? [];
  for (const c of contacts) {
    if (String(c.type).toLowerCase() === type && c.value) return c.value;
  }
  return null;
}

export function pfLeadDisplayName(lead: PFLead): string {
  return lead.sender?.name?.trim() || "Unknown";
}

export function pfLeadListingKey(lead: PFLead): string | null {
  return (
    lead.listing?.reference?.trim() ||
    lead.listing?.id?.trim() ||
    null
  );
}
