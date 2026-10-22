// Pure PF webhook payload helpers (no Redis / Next imports — safe for unit tests)

import type { PFWebhookEvent, PFWebhookEventType } from "./types";

/** Normalize Atlas (entity/payload) and legacy (data) webhook bodies. */
export function normalizePropertyFinderWebhookEvent(
  raw: unknown,
): PFWebhookEvent | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  const type = typeof body.type === "string" ? body.type : "";
  if (!type) return null;

  const id =
    body.id != null ? String(body.id) : `anon-${type}-${Date.now()}`;

  const entity =
    body.entity && typeof body.entity === "object" && !Array.isArray(body.entity)
      ? (body.entity as PFWebhookEvent["entity"])
      : undefined;

  const payload =
    body.payload &&
    typeof body.payload === "object" &&
    !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : undefined;

  const data =
    body.data && typeof body.data === "object" && !Array.isArray(body.data)
      ? (body.data as PFWebhookEvent["data"])
      : undefined;

  return {
    id,
    type: type as PFWebhookEventType,
    timestamp:
      typeof body.timestamp === "string"
        ? body.timestamp
        : typeof body.created_at === "string"
          ? body.created_at
          : undefined,
    created_at:
      typeof body.created_at === "string" ? body.created_at : undefined,
    entity,
    payload,
    data,
  };
}

export function extractListingId(event: PFWebhookEvent): string | null {
  if (event.entity?.type === "listing" && event.entity.id) {
    return String(event.entity.id);
  }
  const fromPayloadListing = event.payload?.listing;
  if (
    fromPayloadListing &&
    typeof fromPayloadListing === "object" &&
    !Array.isArray(fromPayloadListing) &&
    (fromPayloadListing as { id?: unknown }).id != null
  ) {
    return String((fromPayloadListing as { id: unknown }).id);
  }
  const id = event.data?.listing_id ?? event.data?.listing?.id;
  return id != null ? String(id) : null;
}

/** Build lead ingest record from Atlas entity+payload or legacy data. */
export function extractLeadIngestPayload(
  event: PFWebhookEvent,
): Record<string, unknown> {
  if (event.entity?.type === "lead" || event.payload) {
    // Atlas sends payload; older events carry the lead in data.
    const payload = { ...(event.payload ?? (event.data as Record<string, unknown> | undefined) ?? {}) };
    if (event.entity?.id != null && payload.id == null) {
      payload.id = event.entity.id;
    }
    return payload;
  }
  if (event.data && typeof event.data === "object") {
    return event.data as Record<string, unknown>;
  }
  return {};
}
