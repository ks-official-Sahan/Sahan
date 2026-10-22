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

import { extractBuildingFromDescription } from "./location";

describe("review fixes", () => {
  it("keeps lead fields from legacy data when an entity has no payload", () => {
    const record = extractLeadIngestPayload({ entity: { id: "lead-99", type: "lead" }, data: { sender: "x", status: "new" } } as never);
    assert.deepEqual(record, { sender: "x", status: "new", id: "lead-99" });
  });

  it("reads digits 9 in building names and takes extra excluded openings", () => {
    assert.equal(extractBuildingFromDescription("Marina 29 offers sea views"), "Marina 29");
    assert.equal(extractBuildingFromDescription("Acme is a brokerage", ["Acme is"]), null);
  });
});

import { normalizeAmenityList } from "./listing-content";

describe("amenity labels", () => {
  it("keeps curated labels intact", () => {
    assert.deepEqual(normalizeAmenityList(["Central A/C", "Private Gym", "Built-in Wardrobes", "view of the sea"]), ["Built-in Wardrobes", "Central A/C", "Private Gym", "View of the Sea"]);
  });
});
