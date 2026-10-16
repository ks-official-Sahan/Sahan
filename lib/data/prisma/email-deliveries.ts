import type { Prisma } from "@prisma/client";
import { nextStatus, type DeliveryStatus } from "@sahan-sac/email-kit/tracking";

import type { EmailDeliveryRepo, EmailDeliveryView, RefStatus } from "../email-deliveries";
import type { DbClient } from "./client";

const VIEW = {
  id: true, provider: true, providerMessageId: true, category: true, ref: true, recipient: true, recipients: true,
  subject: true, status: true, errorClass: true, attempts: true, lastEventAt: true, createdAt: true,
} as const;

/** Two webhook events for one message can race; the status update retries on a changed row. */
const MAX_STATUS_RETRIES = 3;

const asView = (row: Record<string, unknown>) => row as unknown as EmailDeliveryView;

export function emailDeliveryRepo(client: DbClient): EmailDeliveryRepo {
  return {
    async record(input) {
      await client.emailDelivery.create({
        data: {
          provider: input.provider,
          providerMessageId: input.providerMessageId ?? null,
          category: input.category,
          ref: input.ref ?? null,
          recipient: input.recipient,
          recipients: input.recipients,
          subject: input.subject.slice(0, 300),
          status: input.status,
          errorClass: input.errorClass ?? null,
          attempts: input.attempts as unknown as Prisma.InputJsonValue,
        },
      });
    },

    async applyEvent(event, providers) {
      const row = await client.emailDelivery.findFirst({
        where: { providerMessageId: event.providerMessageId, provider: { in: [...providers] } },
        select: { id: true, status: true },
      });
      if (!row) return false;
      await client.emailDeliveryEvent.create({
        data: { deliveryId: row.id, type: event.type.slice(0, 60), status: event.status, detail: event.detail ?? null, at: event.at },
      });
      // Compare-and-set on the status read, so a concurrent event is never lost.
      let current = row.status as DeliveryStatus;
      for (let attempt = 0; attempt < MAX_STATUS_RETRIES; attempt += 1) {
        const next = nextStatus(current, event.status);
        const { count } = await client.emailDelivery.updateMany({
          where: { id: row.id, status: current },
          data: { status: next, lastEventAt: event.at },
        });
        if (count === 1) return true;
        const fresh = await client.emailDelivery.findUnique({ where: { id: row.id }, select: { status: true } });
        if (!fresh) return true;
        current = fresh.status as DeliveryStatus;
      }
      return true;
    },

    async list({ status, category, before, take }) {
      const rows = await client.emailDelivery.findMany({
        where: {
          ...(status ? { status } : {}),
          ...(category ? { category } : {}),
          ...(before ? { OR: [{ createdAt: { lt: before.createdAt } }, { createdAt: before.createdAt, id: { lt: before.id } }] } : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take,
        select: VIEW,
      });
      return rows.map(asView);
    },

    async find(id) {
      const row = await client.emailDelivery.findUnique({
        where: { id },
        select: { ...VIEW, events: { orderBy: { at: "asc" }, select: { id: true, type: true, status: true, detail: true, at: true } } },
      });
      return row ? (row as unknown as EmailDeliveryView & { events: [] }) : null;
    },

    async latestByRefs(refs) {
      const result = new Map<string, RefStatus>();
      if (refs.length === 0) return result;
      const rows = await client.emailDelivery.findMany({
        where: { ref: { in: [...refs] } },
        orderBy: [{ ref: "asc" }, { createdAt: "desc" }],
        distinct: ["ref"],
        select: { ref: true, status: true, provider: true, lastEventAt: true, createdAt: true },
      });
      for (const row of rows) {
        if (row.ref) result.set(row.ref, { status: row.status as DeliveryStatus, provider: row.provider, at: row.lastEventAt ?? row.createdAt });
      }
      return result;
    },

    async pruneBefore(before) {
      const { count } = await client.emailDelivery.deleteMany({ where: { createdAt: { lt: before } } });
      return count;
    },
  };
}
