/**
 * Normalize + extract helpers for PF webhooks.
 * Run: npx tsx --test lib/propertyfinder/webhook-payload.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractLeadIngestPayload,
  extractListingId,
  normalizePropertyFinderWebhookEvent,
} from "./webhook-payload";

describe("normalizePropertyFinderWebhookEvent", () => {
  it("parses Atlas entity/payload envelope", () => {
    const event = normalizePropertyFinderWebhookEvent({
      id: "evt-1",
      type: "listing.systemUpdated",
      timestamp: "2026-09-22T10:00:00Z",
      entity: { id: "01LISTING", type: "listing" },
      payload: { operation: "permit_correction", price: 1500000 },
    });
    assert.ok(event);
    assert.equal(event!.type, "listing.systemUpdated");
    assert.equal(extractListingId(event!), "01LISTING");
    assert.equal(event!.payload?.operation, "permit_correction");
  });

  it("parses legacy data envelope", () => {
    const event = normalizePropertyFinderWebhookEvent({
      id: "evt-2",
      type: "listing.published",
      created_at: "2026-01-01T00:00:00Z",
      data: { listing_id: 42, listing: { id: 42, slug: "villa-42" } },
    });
    assert.ok(event);
    assert.equal(extractListingId(event!), "42");
  });

  it("maps lead.created entity id into ingest payload", () => {
    const event = normalizePropertyFinderWebhookEvent({
      id: "lead-created-1",
      type: "lead.created",
      timestamp: "2026-09-22T10:00:00Z",
      entity: { id: "lead-99", type: "lead" },
      payload: {
        channel: "whatsapp",
        status: "sent",
        sender: { name: "Jane", contacts: [] },
      },
    });
    assert.ok(event);
    const ingest = extractLeadIngestPayload(event!);
    assert.equal(ingest.id, "lead-99");
    assert.equal(ingest.channel, "whatsapp");
  });

  it("rejects missing type", () => {
    assert.equal(normalizePropertyFinderWebhookEvent({ id: "x" }), null);
  });
});
