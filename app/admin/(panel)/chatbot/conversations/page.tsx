import { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/lib/auth/dal";
import { db } from "@/lib/db/prisma";
import EmptyState from "@/components/admin/ui/EmptyState";
import { badgeClass, tableClass, tdClass, thClass } from "@/components/admin/ui/styles";

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
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Conversation History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Recent chat sessions from visitors. Click a session to view the full conversation.
        </p>
      </div>

      {sessions.length === 0 ? (
        <EmptyState title="No conversations yet" description="Visitor chats will appear here once someone uses the chatbot." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className={tableClass}>
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th scope="col" className={thClass}>
                  Session ID
                </th>
                <th scope="col" className={thClass}>
                  Messages
                </th>
                <th scope="col" className={thClass}>
                  Lead Captured
                </th>
                <th scope="col" className={thClass}>
                  Contact
                </th>
                <th scope="col" className={thClass}>
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sessions.map((session) => (
                <tr key={session.id} className="hover:bg-muted/40">
                  <td className={tdClass}>
                    <Link
                      href={`/admin/chatbot/conversations/${session.sessionId}`}
                      className="font-mono text-sm text-primary hover:underline"
                    >
                      {session.sessionId.slice(0, 8)}...
                    </Link>
                  </td>
                  <td className={tdClass}>{session.messagesCount}</td>
                  <td className={tdClass}>
                    {session.capturedLead ? (
                      <span className={badgeClass}>Yes</span>
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
                  </td>
                  <td className={tdClass}>{session.inquiry?.email || "-"}</td>
                  <td className={`${tdClass} text-muted-foreground`}>{session.createdAt.toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
