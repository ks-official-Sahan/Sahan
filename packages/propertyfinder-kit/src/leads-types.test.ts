/**
 * Feedback loop: PF inbox must expose Atlas status, not InquiryStatus NEW.
 * Run: npx tsx --test lib/propertyfinder/leads-types.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizePfLead,
  pfLeadContact,
  pfLeadDisplayName,
} from "./leads-types";

const ATLAS_WHATSAPP_LEAD = {
  id: "message_lead_32171651",
  channel: "whatsapp",
  status: "replied",
  entityType: "listing",
  createdAt: "2026-09-16T01:12:20Z",
  sender: {
    name: "Ingrid",
    contacts: [{ type: "phone", value: "+971524668781" }],
  },
  listing: {
    id: "DS838HW03KDEYPQZEGNTW392RM",
    reference: "DS838HW03KDEYPQZEGNTW392RM",
  },
  tags: null,
};

describe("normalizePfLead fidelity", () => {
  it("keeps Atlas status replied (not Inquiry NEW)", () => {
    const lead = normalizePfLead({ ...ATLAS_WHATSAPP_LEAD });
    assert.ok(lead);
    assert.equal(lead!.status, "replied");
    assert.notEqual(lead!.status, "NEW");
  });

  it("phone from sender.contacts; email may be null", () => {
    const lead = normalizePfLead({ ...ATLAS_WHATSAPP_LEAD });
    assert.ok(lead);
    assert.equal(pfLeadContact(lead!, "phone"), "+971524668781");
    assert.equal(pfLeadContact(lead!, "email"), null);
    assert.equal(pfLeadDisplayName(lead!), "Ingrid");
  });

  it("preserves listing id + reference for site/PF resolve", () => {
    const lead = normalizePfLead({ ...ATLAS_WHATSAPP_LEAD });
    assert.ok(lead);
    assert.equal(lead!.listing?.id, "DS838HW03KDEYPQZEGNTW392RM");
    assert.equal(lead!.listing?.reference, "DS838HW03KDEYPQZEGNTW392RM");
  });
});
