import { Prisma } from "@prisma/client";

import type {
  ExperienceRepo,
  NewProject,
  NewService,
  NewSkill,
  ProjectRepo,
  ServiceGroupRepo,
  ServiceRepo,
  SkillGroupRepo,
  SkillRepo,
} from "../collections";
import type { DbClient } from "./client";

type Neighbour = { id: string; sortOrder: number } | null;
type NeighbourWhere = { sortOrder: { lt: number } | { gt: number } };

const nextAfter = (max: number | null): number => (max ?? 0) + 1;

/** Swaps `row` with its nearest neighbour in `direction`; nothing to do at either end. */
export async function swapWithNeighbour(
  row: { id: string; sortOrder: number },
  direction: "up" | "down",
  neighbour: (where: NeighbourWhere, order: "asc" | "desc") => Promise<Neighbour>,
  setSortOrder: (id: string, sortOrder: number) => Promise<unknown>
): Promise<void> {
  if (direction === "up" && row.sortOrder <= 0) return;
  const other =
    direction === "up"
      ? await neighbour({ sortOrder: { lt: row.sortOrder } }, "desc")
      : await neighbour({ sortOrder: { gt: row.sortOrder } }, "asc");
  if (!other) return;
  await setSortOrder(other.id, row.sortOrder);
  await setSortOrder(row.id, other.sortOrder);
}

// Json columns: undefined leaves the column alone, null clears it (Prisma
// needs its DbNull sentinel for that on a nullable Json column).
const json = (value: unknown) => (value === undefined ? undefined : (value as Prisma.InputJsonValue));
const nullableJson = (value: unknown) => (value === null ? Prisma.DbNull : json(value));

function projectData<T extends Partial<NewProject>>(input: T) {
  return { ...input, links: json(input.links), image: nullableJson(input.image) };
}
function serviceData<T extends Partial<NewService>>(input: T) {
  return { ...input, done: nullableJson(input.done) };
}
function skillData<T extends Partial<NewSkill>>(input: T) {
  return { ...input, grid: nullableJson(input.grid) };
}

const POSITION = { id: true, sortOrder: true } as const;

export function projectRepo(client: DbClient): ProjectRepo {
  return {
    find: (id) => client.project.findUnique({ where: { id } }),
    findBySlug: (slug) => client.project.findUnique({ where: { slug } }),
    listPublished: () => client.project.findMany({ where: { published: true }, orderBy: { sortOrder: "asc" } }),
    listForAdmin: () =>
      client.project.findMany({
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true, category: true, status: true, published: true, featured: true, sortOrder: true },
      }),
    count: () => client.project.count(),
    async createMany(input) {
      await client.project.createMany({ data: input.map(projectData) });
    },
    async nextSortOrder() {
      const { _max } = await client.project.aggregate({ _max: { sortOrder: true } });
      return nextAfter(_max.sortOrder);
    },
    create: (input) => client.project.create({ data: projectData(input) }),
    update: (id, changes) => client.project.update({ where: { id }, data: projectData(changes) }),
    async delete(id) {
      await client.project.delete({ where: { id } });
    },
    move: (row, direction) =>
      swapWithNeighbour(
        row,
        direction,
        (where, order) => client.project.findFirst({ where, orderBy: { sortOrder: order }, select: POSITION }),
        (id, sortOrder) => client.project.update({ where: { id }, data: { sortOrder } })
      ),
  };
}

export function experienceRepo(client: DbClient): ExperienceRepo {
  return {
    find: (id) => client.experience.findUnique({ where: { id } }),
    listPublished: () => client.experience.findMany({ where: { published: true }, orderBy: { sortOrder: "asc" } }),
    listForAdmin: () =>
      client.experience.findMany({
        orderBy: { sortOrder: "asc" },
        select: { id: true, company: true, role: true, period: true, type: true, published: true, sortOrder: true },
      }),
    count: () => client.experience.count(),
    async createMany(input) {
      await client.experience.createMany({ data: input });
    },
    async nextSortOrder() {
      const { _max } = await client.experience.aggregate({ _max: { sortOrder: true } });
      return nextAfter(_max.sortOrder);
    },
    create: (input) => client.experience.create({ data: input }),
    update: (id, changes) => client.experience.update({ where: { id }, data: changes }),
    async delete(id) {
      await client.experience.delete({ where: { id } });
    },
    move: (row, direction) =>
      swapWithNeighbour(
        row,
        direction,
        (where, order) => client.experience.findFirst({ where, orderBy: { sortOrder: order }, select: POSITION }),
        (id, sortOrder) => client.experience.update({ where: { id }, data: { sortOrder } })
      ),
  };
}

export function serviceGroupRepo(client: DbClient): ServiceGroupRepo {
  return {
    find: (id) => client.serviceGroup.findUnique({ where: { id } }),
    findWithServices: (id) =>
      client.serviceGroup.findUnique({ where: { id }, include: { services: { orderBy: { sortOrder: "asc" } } } }),
    listForAdmin: () =>
      client.serviceGroup.findMany({
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, services: { select: { published: true }, orderBy: { sortOrder: "asc" } } },
      }),
    async nextSortOrder() {
      const { _max } = await client.serviceGroup.aggregate({ _max: { sortOrder: true } });
      return nextAfter(_max.sortOrder);
    },
    create: (input) => client.serviceGroup.create({ data: input }),
    update: (id, changes) => client.serviceGroup.update({ where: { id }, data: changes }),
    async delete(id) {
      // Service.groupId cascades, so this also removes the group's services.
      await client.serviceGroup.delete({ where: { id } });
    },
    move: (row, direction) =>
      swapWithNeighbour(
        row,
        direction,
        (where, order) => client.serviceGroup.findFirst({ where, orderBy: { sortOrder: order }, select: POSITION }),
        (id, sortOrder) => client.serviceGroup.update({ where: { id }, data: { sortOrder } })
      ),
  };
}

export function serviceRepo(client: DbClient): ServiceRepo {
  return {
    find: (id) => client.service.findUnique({ where: { id } }),
    async nextSortOrder(groupId) {
      const { _max } = await client.service.aggregate({ _max: { sortOrder: true }, where: { groupId } });
      return nextAfter(_max.sortOrder);
    },
    create: (input) => client.service.create({ data: serviceData(input) }),
    update: (id, changes) => client.service.update({ where: { id }, data: serviceData(changes) }),
    async delete(id) {
      await client.service.delete({ where: { id } });
    },
    move: (row, direction) =>
      swapWithNeighbour(
        row,
        direction,
        (where, order) =>
          client.service.findFirst({ where: { groupId: row.groupId, ...where }, orderBy: { sortOrder: order }, select: POSITION }),
        (id, sortOrder) => client.service.update({ where: { id }, data: { sortOrder } })
      ),
  };
}

export function skillGroupRepo(client: DbClient): SkillGroupRepo {
  return {
    find: (id) => client.skillGroup.findUnique({ where: { id } }),
    findWithSkills: (id) =>
      client.skillGroup.findUnique({ where: { id }, include: { skills: { orderBy: { sortOrder: "asc" } } } }),
    listForAdmin: () =>
      client.skillGroup.findMany({
        orderBy: { sortOrder: "asc" },
        select: { id: true, key: true, label: true, skills: { select: { published: true }, orderBy: { sortOrder: "asc" } } },
      }),
    async nextSortOrder() {
      const { _max } = await client.skillGroup.aggregate({ _max: { sortOrder: true } });
      return nextAfter(_max.sortOrder);
    },
    create: (input) => client.skillGroup.create({ data: input }),
    update: (id, changes) => client.skillGroup.update({ where: { id }, data: changes }),
    async delete(id) {
      // Skill.groupId cascades, so this also removes the group's skills.
      await client.skillGroup.delete({ where: { id } });
    },
    move: (row, direction) =>
      swapWithNeighbour(
        row,
        direction,
        (where, order) => client.skillGroup.findFirst({ where, orderBy: { sortOrder: order }, select: POSITION }),
        (id, sortOrder) => client.skillGroup.update({ where: { id }, data: { sortOrder } })
      ),
  };
}

export function skillRepo(client: DbClient): SkillRepo {
  return {
    find: (id) => client.skill.findUnique({ where: { id } }),
    async nextSortOrder(groupId) {
      const { _max } = await client.skill.aggregate({ _max: { sortOrder: true }, where: { groupId } });
      return nextAfter(_max.sortOrder);
    },
    create: (input) => client.skill.create({ data: skillData(input) }),
    update: (id, changes) => client.skill.update({ where: { id }, data: skillData(changes) }),
    async delete(id) {
      await client.skill.delete({ where: { id } });
    },
    move: (row, direction) =>
      swapWithNeighbour(
        row,
        direction,
        (where, order) =>
          client.skill.findFirst({ where: { groupId: row.groupId, ...where }, orderBy: { sortOrder: order }, select: POSITION }),
        (id, sortOrder) => client.skill.update({ where: { id }, data: { sortOrder } })
      ),
  };
}
