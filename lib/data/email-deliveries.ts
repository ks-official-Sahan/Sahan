import type { DeliveryEvent, DeliveryRecord, DeliveryStatus } from "@sahan-sac/email-kit";

export interface EmailDeliveryView {
  id: string;
  provider: string | null;
  providerMessageId: string | null;
  category: string;
  ref: string | null;
  recipient: string;
  recipients: number;
  subject: string;
  status: DeliveryStatus;
  errorClass: string | null;
  attempts: DeliveryRecord["attempts"];
  lastEventAt: Date | null;
  createdAt: Date;
}

export interface EmailDeliveryEventView {
  id: string;
  type: string;
  status: DeliveryStatus;
  detail: string | null;
  at: Date;
}

export interface EmailDeliveryFilter {
  status?: DeliveryStatus;
  category?: string;
  /** Keyset cursor: the last row of the previous page. */
  before?: { createdAt: Date; id: string };
  take: number;
}

/** The latest delivery for one ref, for status badges (the invite list). */
export interface RefStatus {
  status: DeliveryStatus;
  provider: string | null;
  at: Date;
}

export interface EmailDeliveryRepo {
  record(input: DeliveryRecord & { status: DeliveryStatus }): Promise<void>;
  /**
   * Applies one webhook event to the delivery sent through any of `providers`
   * with that provider message id. Returns false when no delivery matches
   * (a message sent before tracking, or from another app on the same account).
   */
  applyEvent(event: DeliveryEvent, providers: readonly string[]): Promise<boolean>;
  list(filter: EmailDeliveryFilter): Promise<EmailDeliveryView[]>;
  find(id: string): Promise<(EmailDeliveryView & { events: EmailDeliveryEventView[] }) | null>;
  /** Latest delivery per ref, in one query. */
  latestByRefs(refs: readonly string[]): Promise<Map<string, RefStatus>>;
  pruneBefore(before: Date): Promise<number>;
}
