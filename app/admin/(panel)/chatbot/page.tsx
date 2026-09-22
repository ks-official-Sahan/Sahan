import { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Chatbot",
  robots: "noindex, nofollow, nocache",
};

export default async function ChatbotDashboard() {
  // Check permission for viewing chat history
  await requirePermission("viewChatHistory");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Chatbot Management</h1>
        <p className="text-gray-600 mt-2">Manage conversations and training data for the chatbot.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Conversation History Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Conversation History</h2>
          <p className="text-gray-600 text-sm mb-4">
            View and manage chat sessions from visitors.
          </p>
          <Link
            href="/admin/chatbot/conversations"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
          >
            View Conversations
          </Link>
        </div>

        {/* Training Data Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Training Data</h2>
          <p className="text-gray-600 text-sm mb-4">
            Create and manage FAQ entries and training examples.
          </p>
          <Link
            href="/admin/chatbot/training"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
          >
            Manage Training Data
          </Link>
        </div>
      </div>
    </div>
  );
}
