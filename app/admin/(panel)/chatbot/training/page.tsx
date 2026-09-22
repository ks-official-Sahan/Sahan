import { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/lib/auth/dal";
import { listTrainingEntries } from "@/lib/actions/chatbot";

export const metadata: Metadata = {
  title: "Training Data",
  robots: "noindex, nofollow, nocache",
};

export default async function TrainingPage() {
  await requirePermission("manageChatbot");

  const entries = await listTrainingEntries({ limit: 100 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Training Data</h1>
          <p className="text-gray-600 mt-2">
            Create FAQ entries and training examples to improve chatbot responses.
          </p>
        </div>
        <Link
          href="/admin/chatbot/training/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
        >
          Add Training Entry
        </Link>
      </div>

      {entries.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600 mb-4">No training entries yet.</p>
          <Link
            href="/admin/chatbot/training/new"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
          >
            Create First Entry
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Question</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Category</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Priority</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Active</th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm max-w-md truncate">{entry.question}</td>
                  <td className="px-6 py-4 text-sm">{entry.category}</td>
                  <td className="px-6 py-4 text-sm">{entry.priority}</td>
                  <td className="px-6 py-4 text-sm">
                    {entry.isActive ? (
                      <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                        Yes
                      </span>
                    ) : (
                      <span className="inline-block bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-medium">
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/chatbot/training/${entry.id}`}
                      className="text-blue-600 hover:underline text-sm font-medium"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
