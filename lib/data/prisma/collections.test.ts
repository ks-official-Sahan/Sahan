import assert from "node:assert/strict";
import { test } from "node:test";

import { serviceGroupRepo, swapWithNeighbour } from "./collections";

function table(rows: Array<{ id: string; sortOrder: number }>) {
  const neighbour = async (where: { sortOrder: { lt: number } | { gt: number } }, order: "asc" | "desc") => {
    const bound = where.sortOrder;
    const matches = rows
      .filter((row) => ("lt" in bound ? row.sortOrder < bound.lt : row.sortOrder > bound.gt))
      .sort((a, b) => (order === "asc" ? a.sortOrder - b.sortOrder : b.sortOrder - a.sortOrder));
    return matches[0] ? { ...matches[0] } : null;
  };
  const setSortOrder = async (id: string, sortOrder: number) => {
    rows.find((row) => row.id === id)!.sortOrder = sortOrder;
  };
  const order = () => [...rows].sort((a, b) => a.sortOrder - b.sortOrder).map((row) => row.id);
  return { neighbour, setSortOrder, order };
}

test("swapWithNeighbour moves a row past its nearest neighbour, skipping gaps", async () => {
  const rows = [
    { id: "a", sortOrder: 1 },
    { id: "b", sortOrder: 4 },
    { id: "c", sortOrder: 9 },
  ];
  const t = table(rows);
  await swapWithNeighbour({ ...rows[2] }, "up", t.neighbour, t.setSortOrder);
  assert.deepEqual(t.order(), ["a", "c", "b"]);
  await swapWithNeighbour({ ...rows[0] }, "down", t.neighbour, t.setSortOrder);
  assert.deepEqual(t.order(), ["c", "a", "b"]);
});

test("swapWithNeighbour leaves the ends alone", async () => {
  const rows = [
    { id: "a", sortOrder: 1 },
    { id: "b", sortOrder: 2 },
  ];
  const t = table(rows);
  await swapWithNeighbour({ ...rows[0] }, "up", t.neighbour, t.setSortOrder);
  await swapWithNeighbour({ ...rows[1] }, "down", t.neighbour, t.setSortOrder);
  assert.deepEqual(t.order(), ["a", "b"]);
});

test("updateIfUnchanged writes only while updatedAt matches, and answers null otherwise", async () => {
  const seen: unknown[] = [];
  const expected = new Date("2026-10-10T00:00:00.000Z");
  const ok = { serviceGroup: { update: async (args: unknown) => (seen.push(args), { id: "g1", name: "New" }) } };
  assert.deepEqual(await serviceGroupRepo(ok as never).updateIfUnchanged("g1", expected, { name: "New" }), { id: "g1", name: "New" });
  assert.deepEqual(seen[0], { where: { id: "g1", updatedAt: expected }, data: { name: "New" } });

  const stale = { serviceGroup: { update: async () => Promise.reject(Object.assign(new Error("not found"), { code: "P2025" })) } };
  assert.equal(await serviceGroupRepo(stale as never).updateIfUnchanged("g1", expected, { name: "New" }), null);

  const down = { serviceGroup: { update: async () => Promise.reject(Object.assign(new Error("timeout"), { code: "P1008" })) } };
  await assert.rejects(serviceGroupRepo(down as never).updateIfUnchanged("g1", expected, { name: "New" }), /timeout/);
});
