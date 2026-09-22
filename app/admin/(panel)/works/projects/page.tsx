import { requirePermission } from "@/lib/auth/dal";
import { db } from "@/lib/db/prisma";
import Link from "next/link";
import { Button } from "@/components/admin/ui/button";

export default async function ProjectsPage() {
  await requirePermission("editCollections");

  const projects = await db.project.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Manage portfolio projects</p>
        </div>
        <Button asChild>
          <Link href="/admin/works/projects/new">Add Project</Link>
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4 font-semibold">Title</th>
              <th className="text-left py-3 px-4 font-semibold">Category</th>
              <th className="text-left py-3 px-4 font-semibold">Status</th>
              <th className="text-left py-3 px-4 font-semibold">Published</th>
              <th className="text-left py-3 px-4 font-semibold">Featured</th>
              <th className="text-left py-3 px-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="py-3 px-4">{project.title}</td>
                <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{project.category}</td>
                <td className="py-3 px-4 text-sm">{project.status}</td>
                <td className="py-3 px-4 text-sm">
                  <span className={project.published ? "text-green-600" : "text-gray-500"}>
                    {project.published ? "Yes" : "Draft"}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm">
                  {project.featured ? (
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">Featured</span>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </td>
                <td className="py-3 px-4 text-sm">
                  <Link href={`/admin/works/projects/${project.id}`} className="text-blue-600 hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {projects.length === 0 && (
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          <p>No projects yet.</p>
          <Button asChild className="mt-4">
            <Link href="/admin/works/projects/new">Create your first project</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
