"use client";

import { useEffect, useState, useRef } from "react";

import { MessageCircle, Send, X } from "lucide-react";

import type { ChatbotConfig } from "@/lib/settings/schema";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatWidgetProps {
  enabled: boolean;
  config: ChatbotConfig;
  siteUrl?: string;
}

// Styled with the same tokens as the rest of the public site (bCARD,
// bBORDERFADE, bICON, .press/.lift from style/globals.css — see
// ContactChannels.tsx and the status-dot components for the same
// convention), instead of hardcoded Tailwind blue/green/gray, so the widget
// reads as part of the portfolio and not a bolted-on default component.
export default function ChatWidget({ enabled, config, siteUrl }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => {
    // Generate a simple UUID-like sessionId
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (!enabled || !config.enabled) {
    return null;
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user" as const, content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: input,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = (await response.json()) as { response: string };
      const assistantMessage = { role: "assistant" as const, content: data.response };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = {
        role: "assistant" as const,
        content: "Sorry, I encountered an error. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-20 right-8 z-50 flex flex-col items-end s768:bottom-8 s768:right-8">
      {/* Panel: scales in from the trigger, never from scale(0) (see
          style/globals.css's .press/.lift for the same easing convention).
          Kept mounted so the exit transition can play instead of unmounting
          instantly. */}
      <div
        role="dialog"
        aria-label="Chat"
        aria-hidden={!isOpen}
        style={{ transitionTimingFunction: "var(--ease-out)" }}
        className={`mb-3 flex h-[28rem] w-[min(22rem,calc(100vw-2.5rem))] origin-bottom-right flex-col overflow-hidden rounded-[20px] border border-bBORDERFADE bg-bCARD shadow-2xl shadow-black/20 transition-[opacity,transform] duration-200 ${
          isOpen ? "pointer-events-auto scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-bBORDERFADE px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bICON opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-bICON" />
            </span>
            <h2 className="text-sm font-semibold">Chat with me</h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="press flex h-8 w-8 items-center justify-center rounded-full text-current opacity-70 transition-colors hover:bg-bICON_FADE hover:opacity-100"
            aria-label="Close chat"
          >
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center opacity-70">
              <p className="text-sm font-semibold">{config.greeting}</p>
              <p className="text-xs">How can I help?</p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-[16px] px-3.5 py-2 text-sm ${
                  msg.role === "user"
                    ? "rounded-br-[6px] bg-bICON text-white dark:text-black"
                    : "rounded-bl-[6px] bg-bFCARD"
                }`}
              >
                <p className="break-words leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-[16px] rounded-bl-[6px] bg-bFCARD px-3.5 py-3">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60 [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60 [animation-delay:240ms]" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-bBORDERFADE p-3">
          <div className="flex items-end gap-2 rounded-full border border-bBORDERFADE bg-bFCARD px-2 py-1.5 focus-within:border-bICON">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 1000))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              disabled={isLoading}
              aria-label="Message"
              className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:opacity-50 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="press flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bICON text-white transition-opacity disabled:opacity-30 dark:text-black"
              aria-label="Send message"
            >
              <Send size={14} />
            </button>
          </div>
          <p className="mt-1.5 px-1 text-[11px] opacity-50">{input.length}/1000</p>
        </div>
      </div>

      {/* Trigger */}
      <button
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close chat" : "Open chat"}
        className="press flex h-14 w-14 items-center justify-center rounded-full bg-bICON text-white shadow-lg shadow-black/20 transition-transform dark:text-black"
      >
        <span className="relative grid h-6 w-6 place-items-center">
          <MessageCircle
            size={24}
            className={`absolute transition-[opacity,transform] duration-200 ${
              isOpen ? "scale-75 opacity-0" : "scale-100 opacity-100"
            }`}
          />
          <X
            size={22}
            className={`absolute transition-[opacity,transform] duration-200 ${
              isOpen ? "scale-100 opacity-100" : "scale-75 opacity-0"
            }`}
          />
        </span>
      </button>
    </div>
  );
}
