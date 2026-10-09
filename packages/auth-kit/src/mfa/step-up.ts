import { createHmac } from "node:crypto";

import { constantTimeEqual } from "../login-unlock";

// Step-up verification: an emailed code (purpose STEP_UP) that confirms one
// sensitive action, such as a developer masking themself. A challenge row has
// no payload, so the action rides in a ticket the server signs when it issues
// the code; the code then confirms that action, for that user, and nothing
// else. The ticket is opaque to the browser. The secret is a parameter, so
// this stays pure and testable.

export interface StepUp {
  challengeId: string;
  /** What the code confirms, e.g. "mask:self:on". */
  action: string;
}

const MAX_TICKET = 1024;

function mac(secret: string, userId: string, challengeId: string, action: string): string {
  return createHmac("sha256", secret).update(`step-up:v1:${userId}:${challengeId}:${action}`).digest("base64url");
}

/** The ticket handed to the browser with the code prompt: the challenge, the action and their signature. */
export function signStepUp(secret: string, userId: string, step: StepUp): string {
  return [step.challengeId, Buffer.from(step.action, "utf8").toString("base64url"), mac(secret, userId, step.challengeId, step.action)].join(".");
}

/** The challenge and action a ticket was signed for; null when it was altered, malformed or signed for someone else. */
export function readStepUp(secret: string, userId: string, ticket: unknown): StepUp | null {
  if (typeof ticket !== "string" || ticket.length > MAX_TICKET) return null;
  const parts = ticket.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) return null;
  const [challengeId, encoded, signature] = parts as [string, string, string];
  const action = Buffer.from(encoded, "base64url").toString("utf8");
  return constantTimeEqual(signature, mac(secret, userId, challengeId, action)) ? { challengeId, action } : null;
}
