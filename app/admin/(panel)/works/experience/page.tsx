import { requirePermission } from "@/lib/auth/dal";
import { db } from "@/lib/db/prisma";
import Link from "next/link";
import { Button } from "@/components/admin/ui/button";

export default async function ExperiencePage() {
  await requirePermission("editCollections");

  const experiences = await db.experience.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Experience</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Manage work history and experience entries</p>
        </div>
        <Button asChild>
          <Link href="/admin/works/experience/new">Add Experience</Link>
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4 font-semibold">Company</th>
              <th className="text-left py-3 px-4 font-semibold">Role</th>
              <th className="text-left py-3 px-4 font-semibold">Period</th>
              <th className="text-left py-3 px-4 font-semibold">Type</th>
              <th className="text-left py-3 px-4 font-semibold">Published</th>
              <th className="text-left py-3 px-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {experiences.map((exp) => (
              <tr key={exp.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="py-3 px-4 font-medium">{exp.company}</td>
                <td className="py-3 px-4 text-sm">{exp.role}</td>
                <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{exp.period}</td>
                <td className="py-3 px-4 text-sm capitalize">{exp.type}</td>
                <td className="py-3 px-4 text-sm">
                  <span className={exp.published ? "text-green-600" : "text-gray-500"}>
                    {exp.published ? "Yes" : "Draft"}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm">
                  <Link href={`/admin/works/experience/${exp.id}`} className="text-blue-600 hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {experiences.length === 0 && (
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          <p>No experience entries yet.</p>
          <Button asChild className="mt-4">
            <Link href="/admin/works/experience/new">Create your first entry</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
