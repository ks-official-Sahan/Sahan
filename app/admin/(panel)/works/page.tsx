import { requirePermission } from "@/lib/auth/dal";
import { Button } from "@/components/admin/ui/button";
import Link from "next/link";

export default async function WorksPage() {
  await requirePermission("editCollections");

  const collections = [
    {
      name: "Projects",
      href: "/admin/works/projects",
      description: "Manage portfolio projects, their status, links and featured flag",
    },
    {
      name: "Experience",
      href: "/admin/works/experience",
      description: "Manage work history and experience entries",
    },
    {
      name: "Services",
      href: "/admin/works/services",
      description: "Manage services and service groups (coming soon)",
    },
    {
      name: "Skills",
      href: "/admin/works/skills",
      description: "Manage skills, skill groups and their grid layout (coming soon)",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Works Collections</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Manage projects, experience, services and skills</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {collections.map((collection) => (
          <Link
            key={collection.href}
            href={collection.href}
            className="block p-6 border rounded-lg hover:border-blue-500 hover:shadow-lg transition-all"
          >
            <h2 className="text-xl font-semibold mb-2">{collection.name}</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">{collection.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
