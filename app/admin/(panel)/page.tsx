import { LayoutDashboard } from "lucide-react";
import type { Metadata } from "next";

import EmptyState from "@/components/admin/ui/EmptyState";
import { requirePermission } from "@/lib/auth/dal";

// A title template does not apply to the page in the same segment as the layout
// that defines it, so the dashboard spells out its full title.
export const metadata: Metadata = { title: { absolute: "Dashboard - Admin" } };

export default async function DashboardPage() {
  await requirePermission("viewDashboard");

  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A summary of the site, its content and its inbox.
      </p>
      <EmptyState
        className="mt-8"
        icon={<LayoutDashboard />}
        title="Nothing to show yet"
        description="Content, media and lead summaries appear here as those areas are set up."
      />
    </div>
  );
}
