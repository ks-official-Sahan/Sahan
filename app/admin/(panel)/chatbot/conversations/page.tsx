import { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/lib/auth/dal";
import { db } from "@/lib/db/prisma";

export const metadata: Metadata = {
  title: "Conversations",
  robots: "noindex, nofollow, nocache",
};

export default async function ConversationsPage() {
  await requirePermission("viewChatHistory");

  // Get recent sessions with message count
  const sessions = await db.chatSession.findMany({
    select: {
      id: true,
      sessionId: true,
      messagesCount: true,
      createdAt: true,
      capturedLead: true,
      inquiry: {
        select: {
          id: true,
          email: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Conversation History</h1>
        <p className="text-gray-600 mt-2">
          Recent chat sessions from visitors. Click a session to view the full conversation.
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">No conversations yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Session ID</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Messages</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Lead Captured</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Contact</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sessions.map((session) => (
                <tr key={session.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm">
                    <Link
                      href={`/admin/chatbot/conversations/${session.sessionId}`}
                      className="text-blue-600 hover:underline font-mono"
                    >
                      {session.sessionId.slice(0, 8)}...
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm">{session.messagesCount}</td>
                  <td className="px-6 py-4 text-sm">
                    {session.capturedLead ? (
                      <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                        Yes
                      </span>
                    ) : (
                      <span className="text-gray-500">No</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {session.inquiry?.email || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {session.createdAt.toLocaleDateString()}
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
