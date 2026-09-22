"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/dal";
import { db } from "@/lib/db/prisma";
import { audit } from "@/lib/admin/audit";
import { TAGS } from "@/lib/cache/tags";
import { invalidate } from "@/lib/cache/invalidate";
import { forTraining } from "@/lib/cache/plan";
import type { ChatTrainingEntry } from "@prisma/client";

const trainingEntrySchema = z.object({
  category: z.string().min(1).max(100),
  question: z.string().min(5).max(2000),
  answer: z.string().min(5).max(5000),
  priority: z.number().int().min(0).max(100).default(0),
  isActive: z.boolean().default(true),
});

type TrainingEntryInput = z.infer<typeof trainingEntrySchema>;

/** Create a training entry for the chatbot. */
export async function createTrainingEntry(input: unknown): Promise<ChatTrainingEntry> {
  const user = await requirePermission("manageChatbot");

  const parsed = trainingEntrySchema.parse(input);

  const entry = await db.chatTrainingEntry.create({
    data: {
      category: parsed.category,
      question: parsed.question,
      answer: parsed.answer,
      priority: parsed.priority,
      isActive: parsed.isActive,
      createdById: user.id,
    },
  });

  // Invalidate knowledge cache
  await invalidate(forTraining());

  await audit({
    action: "chatbot.training.created",
    entityType: "ChatTrainingEntry",
    entityId: entry.id,
    after: entry,
  });

  return entry;
}

/** Update a training entry. */
export async function updateTrainingEntry(
  id: string,
  input: unknown
): Promise<ChatTrainingEntry> {
  const user = await requirePermission("manageChatbot");

  const parsed = trainingEntrySchema.parse(input);

  const before = await db.chatTrainingEntry.findUniqueOrThrow({
    where: { id },
  });

  const entry = await db.chatTrainingEntry.update({
    where: { id },
    data: {
      category: parsed.category,
      question: parsed.question,
      answer: parsed.answer,
      priority: parsed.priority,
      isActive: parsed.isActive,
    },
  });

  // Invalidate knowledge cache
  await invalidate(forTraining());

  await audit({
    action: "chatbot.training.updated",
    entityType: "ChatTrainingEntry",
    entityId: id,
    before,
    after: entry,
  });

  return entry;
}

/** Delete a training entry. */
export async function deleteTrainingEntry(id: string): Promise<void> {
  const user = await requirePermission("manageChatbot");

  const entry = await db.chatTrainingEntry.findUniqueOrThrow({
    where: { id },
  });

  await db.chatTrainingEntry.delete({
    where: { id },
  });

  // Invalidate knowledge cache
  await invalidate(forTraining());

  await audit({
    action: "chatbot.training.deleted",
    entityType: "ChatTrainingEntry",
    entityId: id,
    before: entry,
  });
}

/** Get all training entries with optional filtering. */
export async function listTrainingEntries(options?: {
  active?: boolean;
  category?: string;
  limit?: number;
  offset?: number;
}): Promise<ChatTrainingEntry[]> {
  await requirePermission("manageChatbot");

  const where: Record<string, unknown> = {};
  if (options?.active !== undefined) where.isActive = options.active;
  if (options?.category) where.category = options.category;

  return db.chatTrainingEntry.findMany({
    where,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
  });
}
