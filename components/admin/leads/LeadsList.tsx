"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Inquiry } from "@prisma/client";

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  CONTACTED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  CLOSED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  SPAM: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

interface LeadsListProps {
  inquiries: Inquiry[];
  total: number;
  page: number;
  totalPages: number;
  status?: string;
  search?: string;
}

export function LeadsList({ inquiries, total, page, totalPages, status, search }: LeadsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1");
    router.push(`/admin/leads?${params.toString()}`);
  };

  const goToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(newPage));
    router.push(`/admin/leads?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select
          value={status || ""}
          onChange={(e) => updateFilter("status", e.target.value)}
          className="px-3 py-2 border rounded-md text-sm"
        >
          <option value="">All statuses</option>
          <option value="NEW">New</option>
          <option value="CONTACTED">Contacted</option>
          <option value="CLOSED">Closed</option>
          <option value="SPAM">Spam</option>
        </select>

        <input
          type="text"
          placeholder="Search..."
          defaultValue={search}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              updateFilter("search", (e.target as HTMLInputElement).value);
            }
          }}
          className="px-3 py-2 border rounded-md text-sm flex-1"
        />

        <a
          href="/api/admin/export/leads"
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md text-sm hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          Export CSV
        </a>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Name</th>
              <th className="px-4 py-2 text-left font-semibold">Email</th>
              <th className="px-4 py-2 text-left font-semibold">Topic</th>
              <th className="px-4 py-2 text-left font-semibold">Status</th>
              <th className="px-4 py-2 text-left font-semibold">Spam Score</th>
              <th className="px-4 py-2 text-left font-semibold">Date</th>
            </tr>
          </thead>
          <tbody>
            {inquiries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-600 dark:text-gray-400">
                  No inquiries found
                </td>
              </tr>
            ) : (
              inquiries.map((inquiry) => (
                <tr
                  key={inquiry.id}
                  className="border-b hover:bg-gray-50 dark:hover:bg-gray-900 transition"
                >
                  <td className="px-4 py-3">
                    <Link href={`/admin/leads/${inquiry.id}`} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                      {inquiry.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{inquiry.email}</td>
                  <td className="px-4 py-3">{inquiry.topic || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[inquiry.status]}`}>
                      {inquiry.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-12 h-6 bg-gray-200 dark:bg-gray-700 rounded">
                      <div
                        className="h-full bg-red-500 rounded"
                        style={{ width: `${Math.min(inquiry.spamScore, 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                    {inquiry.createdAt.toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {inquiries.length === 0 ? 0 : (page - 1) * 50 + 1} to{" "}
          {Math.min(page * 50, total)} of {total} inquiries
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => goToPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="px-3 py-2 border rounded-md text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-2 text-sm">
            {page} of {totalPages}
          </span>
          <button
            onClick={() => goToPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="px-3 py-2 border rounded-md text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
