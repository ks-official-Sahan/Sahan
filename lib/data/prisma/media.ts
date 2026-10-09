import type { Prisma } from "@prisma/client";

import type { MediaRepo } from "../media";
import type { DbClient } from "./client";

export function mediaRepo(client: DbClient): MediaRepo {
  return {
    find(id) {
      return client.mediaAsset.findUnique({ where: { id } });
    },
    findMany(ids) {
      return ids.length === 0 ? Promise.resolve([]) : client.mediaAsset.findMany({ where: { id: { in: ids } } });
    },
    async findWithUsages(id) {
      const asset = await client.mediaAsset.findUnique({
        where: { id },
        include: { usages: { select: { id: true, entityType: true, entityId: true, field: true } } },
      });
      if (!asset) return null;

      // Older rows may predate MediaUsage tracking. Cover-media foreign keys
      // and project JSON references are checked directly before deletion too.
      // Every current save records a MediaUsage row in its own transaction, so
      // the delete path's lockForUpdate() is what makes a concurrent save and
      // delete safe; this scan only covers rows written before tracking. The
      // project table is a small, admin-curated portfolio list, so the JSON
      // filter stays cheap.
      const [legacyProjectImages, legacyPostCovers] = await Promise.all([
        client.project.findMany({
          where: { image: { path: ["mediaId"], equals: id } },
          select: { id: true },
          take: 100,
        }),
        client.post.findMany({ where: { coverMediaId: id }, select: { id: true }, take: 100 }),
      ]);
      const usages = new Map(asset.usages.map((usage) => [`${usage.entityType}:${usage.entityId}:${usage.field}`, usage]));
      for (const project of legacyProjectImages) {
        const key = `Project:${project.id}:image`;
        if (!usages.has(key)) usages.set(key, { id: `legacy:${key}`, entityType: "Project", entityId: project.id, field: "image" });
      }
      for (const post of legacyPostCovers) {
        const key = `Post:${post.id}:cover`;
        if (!usages.has(key)) usages.set(key, { id: `legacy:${key}`, entityType: "Post", entityId: post.id, field: "cover" });
      }
      return { ...asset, usages: [...usages.values()] };
    },
    async lockForUpdate(id) {
      await client.$queryRaw`SELECT id FROM media_assets WHERE id = ${id} FOR UPDATE`;
    },
    listPage({ query, kind, after, take }) {
      const trimmed = query?.trim();
      const where: Prisma.MediaAssetWhereInput = {
        ...(kind ? { kind } : {}),
        ...(trimmed
          ? {
              OR: [
                { title: { startsWith: trimmed, mode: "insensitive" } },
                { publicId: { startsWith: trimmed, mode: "insensitive" } },
                { alt: { startsWith: trimmed, mode: "insensitive" } },
                { folder: { startsWith: trimmed, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(after
          ? {
              AND: [
                {
                  OR: [
                    { createdAt: { lt: after.createdAt } },
                    { createdAt: after.createdAt, id: { lt: after.id } },
                  ],
                },
              ],
            }
          : {}),
      };
      return client.mediaAsset.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take });
    },
    listRecent(limit) {
      return client.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: limit });
    },
    create(input) {
      return client.mediaAsset.create({ data: input });
    },
    async createIfMissing(input) {
      await client.mediaAsset.upsert({
        where: { provider_publicId: { provider: input.provider, publicId: input.publicId } },
        create: input,
        update: {},
      });
    },
    updateMetadata(id, input) {
      return client.mediaAsset.update({ where: { id }, data: input });
    },
    async delete(id) {
      await client.mediaAsset.delete({ where: { id } });
    },
    async recordUsage(input) {
      await client.mediaUsage.upsert({
        where: { mediaId_entityType_entityId_field: input },
        update: {},
        create: input,
      });
    },
    async recordUsages(inputs) {
      if (inputs.length > 0) await client.mediaUsage.createMany({ data: inputs, skipDuplicates: true });
    },
    async clearUsage(entityType, entityIds) {
      if (typeof entityIds !== "string" && entityIds.length === 0) return;
      await client.mediaUsage.deleteMany({
        where: { entityType, entityId: typeof entityIds === "string" ? entityIds : { in: [...entityIds] } },
      });
    },
  };
}
