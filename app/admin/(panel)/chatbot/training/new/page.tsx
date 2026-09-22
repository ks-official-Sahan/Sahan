import { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/lib/auth/dal";
import { createTrainingEntry } from "@/lib/actions/chatbot";
import { buttonVariants } from "@/components/admin/ui/styles";

export const metadata: Metadata = {
  title: "New Training Entry",
  robots: "noindex, nofollow, nocache",
};

export default async function NewTrainingPage() {
  await requirePermission("manageChatbot");

  async function handleSubmit(formData: FormData) {
    "use server";

    const category = formData.get("category") as string;
    const question = formData.get("question") as string;
    const answer = formData.get("answer") as string;
    const priority = parseInt(formData.get("priority") as string, 10);
    const isActive = formData.get("isActive") === "on";

    await createTrainingEntry({
      category: category || "FAQ",
      question,
      answer,
      priority,
      isActive,
    });

    // Redirect handled by server action audit
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">New Training Entry</h1>
          <p className="text-gray-600 mt-2">Add a new FAQ or training example for the chatbot.</p>
        </div>
        <Link href="/admin/chatbot/training" className={buttonVariants.secondary}>
          Back to Training
        </Link>
      </div>

      <form action={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 max-w-2xl space-y-5">
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <input
            type="text"
            id="category"
            name="category"
            defaultValue="FAQ"
            required
            maxLength={100}
            className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div>
          <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-1">
            Question <span className="text-red-600">*</span>
          </label>
          <textarea
            id="question"
            name="question"
            required
            maxLength={2000}
            minLength={5}
            className="w-full min-h-24 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            placeholder="What is the question visitors might ask?"
          />
          <p className="text-xs text-gray-500 mt-1">5-2000 characters</p>
        </div>

        <div>
          <label htmlFor="answer" className="block text-sm font-medium text-gray-700 mb-1">
            Answer <span className="text-red-600">*</span>
          </label>
          <textarea
            id="answer"
            name="answer"
            required
            maxLength={5000}
            minLength={5}
            className="w-full min-h-32 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            placeholder="Provide the answer the chatbot should give..."
          />
          <p className="text-xs text-gray-500 mt-1">5-5000 characters</p>
        </div>

        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
            Priority (0-100)
          </label>
          <input
            type="number"
            id="priority"
            name="priority"
            defaultValue={0}
            min={0}
            max={100}
            className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <p className="text-xs text-gray-500 mt-1">Higher numbers appear first in responses</p>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="isActive"
            name="isActive"
            defaultChecked
            className="w-4 h-4 rounded border-gray-300"
          />
          <label htmlFor="isActive" className="ml-2 text-sm font-medium text-gray-700">
            Active
          </label>
        </div>

        <div className="flex gap-2 pt-4">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition"
          >
            Create Entry
          </button>
          <Link
            href="/admin/chatbot/training"
            className="border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded font-medium transition"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
