import type { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/lib/auth/dal";
import { cardClass } from "@/components/admin/ui/styles";

export const metadata: Metadata = { title: "Works", robots: "noindex, nofollow, nocache" };

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
      description: "Manage services and service groups",
    },
    {
      name: "Skills",
      href: "/admin/works/skills",
      description: "Manage skills and skill groups",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Works Collections</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage projects, experience, services and skills</p>
      </div>

      <div className="grid grid-cols-1 gap-6 s768:grid-cols-2">
        {collections.map((collection) => (
          <Link
            key={collection.href}
            href={collection.href}
            className={`${cardClass} block transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
          >
            <h2 className="text-base font-medium">{collection.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{collection.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
