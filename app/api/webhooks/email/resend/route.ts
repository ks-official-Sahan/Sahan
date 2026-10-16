import { parseResendEvent, verifyResendWebhook } from "@sahan-sac/email-kit/tracking";

import { applyDeliveryEvents, readCappedBody } from "@/lib/email/webhooks";
import { getEnv } from "@/lib/env";

// Resend delivery events (sent, delivered, opened, bounced...), Svix-signed.
// Point a Resend webhook at /api/webhooks/email/resend and set
// RESEND_WEBHOOK_SECRET to its signing secret. Exempt from the proxy's origin
// check and maintenance mode (proxy.ts): the signature is the authentication.
// Without the secret the route does not exist (404).

export async function POST(request: Request) {
  const secret = getEnv().RESEND_WEBHOOK_SECRET;
  if (!secret) return new Response(null, { status: 404 });

  const rawBody = await readCappedBody(request);
  if (rawBody === null) return new Response(null, { status: 413 });
  if (!verifyResendWebhook({ secret, rawBody, headers: request.headers })) return new Response(null, { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(null, { status: 400 });
  }
  const event = parseResendEvent(payload);
  return applyDeliveryEvents(event ? [event] : [], ["resend"]);
}
