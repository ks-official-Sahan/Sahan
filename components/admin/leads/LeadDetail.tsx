"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Inquiry, InquiryEmailEvent } from "@prisma/client";

import { changeInquiryStatus, addInquiryNote } from "@/lib/actions/leads";

interface LeadDetailProps {
  inquiry: Inquiry & {
    assignee?: { id: string; name: string | null; email: string } | null;
    events?: InquiryEmailEvent[];
  };
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  CONTACTED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  CLOSED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  SPAM: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function LeadDetail({ inquiry }: LeadDetailProps) {
  const [statusState, statusAction] = useActionState(changeInquiryStatus, {
    ok: false,
    message: null,
    error: null,
  });
  const [noteState, noteAction] = useActionState(addInquiryNote, {
    ok: false,
    message: null,
    error: null,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{inquiry.name}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{inquiry.email}</p>
        </div>
        <Link href="/admin/leads" className="text-blue-600 dark:text-blue-400 hover:underline">
          Back to list
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Contact Info */}
        <div className="border rounded-lg p-4 space-y-3">
          <div>
            <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">Email</div>
            <div className="text-sm">{inquiry.email}</div>
          </div>
          {inquiry.phone && (
            <div>
              <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">Phone</div>
              <div className="text-sm">{inquiry.phone}</div>
            </div>
          )}
          {inquiry.topic && (
            <div>
              <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">Topic</div>
              <div className="text-sm">{inquiry.topic}</div>
            </div>
          )}
          <div>
            <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">Received</div>
            <div className="text-sm">{inquiry.createdAt.toLocaleString()}</div>
          </div>
        </div>

        {/* Status & Spam */}
        <div className="border rounded-lg p-4 space-y-3">
          <div>
            <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Status</div>
            <form action={statusAction} className="flex gap-2">
              <input type="hidden" name="inquiryId" value={inquiry.id} />
              <select
                name="status"
                defaultValue={inquiry.status}
                onChange={(e) => {
                  const formData = new FormData();
                  formData.set("inquiryId", inquiry.id);
                  formData.set("status", e.target.value);
                  statusAction(formData);
                }}
                className="flex-1 px-2 py-1 border rounded-md text-sm"
              >
                <option value="NEW">New</option>
                <option value="CONTACTED">Contacted</option>
                <option value="CLOSED">Closed</option>
                <option value="SPAM">Spam</option>
              </select>
            </form>
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Spam Score</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                <div className="h-full bg-red-500" style={{ width: `${Math.min(inquiry.spamScore, 100)}%` }} />
              </div>
              <div className="text-sm font-mono">{inquiry.spamScore}/100</div>
            </div>
          </div>
        </div>

        {/* Meta Info */}
        <div className="border rounded-lg p-4 space-y-3 text-sm">
          <div>
            <div className="font-semibold text-gray-600 dark:text-gray-400">Source</div>
            <div className="capitalize">{inquiry.source}</div>
          </div>
          {inquiry.userAgent && (
            <div>
              <div className="font-semibold text-gray-600 dark:text-gray-400">User Agent</div>
              <div className="text-xs truncate">{inquiry.userAgent}</div>
            </div>
          )}
          {inquiry.pagePath && (
            <div>
              <div className="font-semibold text-gray-600 dark:text-gray-400">Page</div>
              <div className="text-xs truncate">{inquiry.pagePath}</div>
            </div>
          )}
        </div>
      </div>

      {/* Message */}
      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-2">Message</h2>
        <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{inquiry.message}</p>
      </div>

      {/* Notes */}
      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">Notes</h2>
        <form action={noteAction} className="space-y-2">
          <input type="hidden" name="inquiryId" value={inquiry.id} />
          <textarea
            name="note"
            defaultValue={inquiry.notes || ""}
            placeholder="Add internal notes..."
            className="w-full p-2 border rounded-md text-sm min-h-24"
          />
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
            Save Notes
          </button>
          {noteState.error && <p className="text-red-600 text-sm">{noteState.error}</p>}
          {noteState.message && <p className="text-green-600 text-sm">{noteState.message}</p>}
        </form>
      </div>

      {/* Email Events */}
      {inquiry.events && inquiry.events.length > 0 && (
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Email History</h2>
          <div className="space-y-2">
            {inquiry.events.map((event) => (
              <div
                key={event.id}
                className={`p-3 rounded-md text-sm ${
                  event.ok
                    ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                    : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold capitalize">
                      {event.kind} {event.ok ? "✓" : "✗"}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {event.provider} • {event.createdAt.toLocaleString()}
                    </div>
                  </div>
                  {event.error && <div className="text-xs">{event.error}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
