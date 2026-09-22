import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/dal";
import { listInquiries } from "@/lib/inquiries/service";
import { LeadsList } from "@/components/admin/leads/LeadsList";

interface PageProps {
  searchParams: Promise<{
    status?: string;
    search?: string;
    page?: string;
  }>;
}

export const metadata = {
  title: "Leads",
};

export default async function LeadsPage({ searchParams }: PageProps) {
  await requirePermission("viewLeads");

  const params = await searchParams;
  const status = (["NEW", "CONTACTED", "CLOSED", "SPAM"] as const).includes(params.status as any)
    ? (params.status as "NEW" | "CONTACTED" | "CLOSED" | "SPAM")
    : undefined;
  const search = params.search || "";
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const limit = 50;
  const offset = (page - 1) * limit;

  const { rows, total } = await listInquiries({
    status,
    search: search || undefined,
    limit,
    offset,
  });

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contact Inquiries</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Manage incoming contact form submissions
        </p>
      </div>

      <LeadsList inquiries={rows} total={total} page={page} totalPages={totalPages} status={status} search={search} />
    </div>
  );
}
