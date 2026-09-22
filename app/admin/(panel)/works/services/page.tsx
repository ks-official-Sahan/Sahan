import { requirePermission } from "@/lib/auth/dal";
import { db } from "@/lib/db/prisma";
import { Button } from "@/components/admin/ui/button";
import Link from "next/link";

export default async function ServicesPage() {
  await requirePermission("editCollections");
  const groups = await db.serviceGroup.findMany({
    orderBy: { sortOrder: "asc" },
    include: { services: { orderBy: { sortOrder: "asc" } } },
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Service Groups</h1>
        <Link href="/admin/works/services/create">
          <Button>New Service Group</Button>
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className="text-muted-foreground">No service groups yet.</p>
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
                <td className="border border-border px-4 py-2">{group.name}</td>
                <td className="border border-border px-4 py-2">
                  {group.services.filter((service) => service.published).length} / {group.services.length}
                </td>
                <td className="border border-border px-4 py-2">
                  <Link href={`/admin/works/services/${group.id}`}>
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
