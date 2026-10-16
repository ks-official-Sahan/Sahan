import { parseBrevoEvents, verifyBrevoWebhook } from "@sahan-sac/email-kit/tracking";

import { applyDeliveryEvents, readCappedBody } from "@/lib/email/webhooks";
import { getEnv } from "@/lib/env";

// Brevo transactional events, for mail sent through the Brevo API or Brevo
// SMTP (both report under the same message id). Create the webhook with
// bearer authentication and set BREVO_WEBHOOK_TOKEN to that token. Exempt
// from the proxy's origin check and maintenance mode (proxy.ts): the token is
// the authentication. Without the token the route does not exist (404).

export async function POST(request: Request) {
  const token = getEnv().BREVO_WEBHOOK_TOKEN;
  if (!token) return new Response(null, { status: 404 });
  if (!verifyBrevoWebhook({ token, authorization: request.headers.get("authorization") })) {
    return new Response(null, { status: 401 });
  }

  const rawBody = await readCappedBody(request);
  if (rawBody === null) return new Response(null, { status: 413 });
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(null, { status: 400 });
  }
  return applyDeliveryEvents(parseBrevoEvents(payload), ["brevo-api", "brevo-smtp"]);
}
