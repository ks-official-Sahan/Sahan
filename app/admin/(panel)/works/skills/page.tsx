import { requirePermission } from "@/lib/auth/dal";
import { db } from "@/lib/db/prisma";
import { Button } from "@/components/admin/ui/button";
import Link from "next/link";

export default async function SkillsPage() {
  await requirePermission("editCollections");
  const groups = await db.skillGroup.findMany({
    orderBy: { sortOrder: "asc" },
    include: { skills: { orderBy: { sortOrder: "asc" } } },
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Skill Groups</h1>
        <Link href="/admin/works/skills/create">
          <Button>New Skill Group</Button>
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className="text-muted-foreground">No skill groups yet.</p>
      ) : (
        <table className="w-full border-collapse border border-border">
          <thead className="bg-muted">
            <tr>
              <th className="border border-border px-4 py-2 text-left">Title</th>
              <th className="border border-border px-4 py-2 text-left">Published</th>
              <th className="border border-border px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.id}>
                <td className="border border-border px-4 py-2">{group.label}</td>
                <td className="border border-border px-4 py-2">
                  {group.skills.filter((skill) => skill.published).length} / {group.skills.length}
                </td>
                <td className="border border-border px-4 py-2">
                  <Link href={`/admin/works/skills/${group.id}`}>
                    <Button size="sm" variant="ghost">Edit</Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
