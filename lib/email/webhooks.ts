import "server-only";

import type { DeliveryEvent } from "@sahan-sac/email-kit/tracking";

import { repos } from "@/lib/data";
import { log } from "@/lib/log";
import { readBodyText } from "@/lib/security/read-body";

// Shared tail of the provider webhooks (app/api/webhooks/email/*): read the
// body with a size cap, then apply each verified event to its delivery.
// Signatures are checked by the route before anything here runs.

/** Provider payloads are small; anything larger is not a delivery event. */
export const MAX_WEBHOOK_BYTES = 256 * 1024;

/** The raw body, or null when it is larger than MAX_WEBHOOK_BYTES. */
export async function readCappedBody(request: Request): Promise<string | null> {
  return readBodyText(request, MAX_WEBHOOK_BYTES);
}

/**
 * Applies events. 200 once stored, even when no delivery matches (the
 * provider must not retry those forever); 500 on a database failure, so the
 * provider retries later.
 */
export async function applyDeliveryEvents(events: DeliveryEvent[], providers: readonly string[]): Promise<Response> {
  try {
    let matched = 0;
    for (const event of events) {
      if (await repos.emailDeliveries.applyEvent(event, providers)) matched += 1;
    }
    return Response.json({ received: events.length, matched });
  } catch (error) {
    log.error("email webhook not applied", { error: String(error), providers: providers.join(",") });
    return new Response(null, { status: 500 });
  }
}
