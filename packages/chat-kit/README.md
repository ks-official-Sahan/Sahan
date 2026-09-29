# @sahan-sac/chat-kit

Headless portfolio chatbot core, built on `@sahan-sac/ai-core`. It provides:

- guarded prompt building;
- prompt-injection and output-link guards;
- a signed anonymous-visitor cookie for rate limiting;
- a knowledge-base builder;
- `runChat`, one chat turn from visitor message to filtered reply.

It is headless and framework-agnostic: no Prisma, no Next.js APIs, no React. The host app keeps:

- the HTTP route, origin checks and rate limits;
- cookie I/O and settings;
- storage (through `ChatStore`) and caching;
- the widget UI.

## Subpaths

| Import | What |
| --- | --- |
| `@sahan-sac/chat-kit/types` | `ChatbotConfig`, `ChatSite` (the owner identity; optional `kind`, `scope` and `linkExample` set the wording, default "site"), `ChatTurn`, `CHAT_TONES` |
| `@sahan-sac/chat-kit/handler` | `runChat(input, deps)`, `CHAT_BUDGETS` (12 s per attempt, 20 s chain, 5 s hedge, 500 tokens) |
| `@sahan-sac/chat-kit/knowledge` | `buildKnowledge(sources)`, `profileSection(site)`, `trainingSection(entries)`, `knowledgeHosts(text)` |
| `@sahan-sac/chat-kit/prompts` | `buildChatPrompt` (fixed system prompt, knowledge as fenced reference data) |
| `@sahan-sac/chat-kit/guard` | `guardUserMessage`, `filterModelOutput` (strips HTML, secrets, `/admin` paths and links to hosts not allowed) |
| `@sahan-sac/chat-kit/visitor-cookie` | `newChatVisitorId`, `signChatVisitorId`, `verifyChatVisitorCookie`, `chatVisitorCookieOptions`, `CHAT_VISITOR_COOKIE` (default name "chat_vid"; any name works) |
| `@sahan-sac/chat-kit/adapter` | `ChatStore`, `ChatSessionInput`, `ChatMessageInput` |
| `@sahan-sac/chat-kit/session-summaries` | `ChatSessionSummary`, `parseChatSessionListParams`, page-size limits for the admin conversations list |

Only `handler` imports `server-only`. The other subpaths are pure, and `session-summaries` and `types` are safe in client components.

## Environment

Uses `@sahan-sac/ai-core`'s variables; see its README for the full table. The chatbot runs only when `chatbotEnabled(env)` from `@sahan-sac/ai-core/availability` is true:

- `ENABLE_CHATBOT` is on. It defaults to `true`; `false`, `0`, `no` or `off` turns it off.
- At least one text provider key is set.

When the chatbot is off, return 503 from the route and do not render the widget.

## Wiring

```ts
import { realProviders, sharedAiHealth } from "@sahan-sac/ai-core/providers";
import { runChat } from "@sahan-sac/chat-kit/handler";

const result = await runChat(
  {
    message,
    history: await store.getRecentMessages(sessionId, 10),
    knowledge: await getKnowledge(), // cached by the app
    config: { tone: "professional" },
    site: chatSite,
    siteHostname: new URL(env.SITE_URL).hostname,
    extraHosts: ["wa.me", "t.me"],
  },
  { providers: realProviders(env, "chat"), health: sharedAiHealth, logger }
);
if (!result.ok) return new Response(null, { status: 503 });
// result.text is already filtered; store it with result.tokens and result.latencyMs.
```

Knowledge sources run in parallel and join in order. A source that throws is skipped and reported, so one failing source never empties the knowledge base:

```ts
import { buildKnowledge, profileSection, trainingSection } from "@sahan-sac/chat-kit/knowledge";

const knowledge = await buildKnowledge(
  [
    { name: "profile", load: () => profileSection(chatSite) },
    { name: "posts", load: async () => (await getPosts()).map((post) => `- ${post.title} (/blog/${post.slug})\n`).join("") },
    { name: "training", load: async () => trainingSection(await db.chatTrainingEntry.findMany({ where: { isActive: true }, take: 50 })) },
  ],
  { onError: (source, error) => logger.warn("knowledge source failed", { source, error: String(error) }) }
);
```

A Prisma `ChatStore`:

```ts
import type { ChatStore } from "@sahan-sac/chat-kit/adapter";

export const prismaChatStore: ChatStore = {
  upsertSession: (input) => db.chatSession.upsert({ where: { sessionId: input.sessionId }, update: {}, create: input }),
  addMessage: (input) =>
    Promise.all([
      db.chatSession.update({ where: { sessionId: input.sessionId }, data: { messagesCount: { increment: 1 } } }),
      db.chatMessage.create({ data: input }),
    ]),
  getRecentMessages: async (sessionId, limit) =>
    (await db.chatMessage.findMany({ where: { sessionId }, orderBy: { createdAt: "desc" }, take: limit })).reverse(),
  linkInquiry: (sessionId, inquiryId) => db.chatSession.update({ where: { sessionId }, data: { inquiryId, capturedLead: true } }),
  listSessionSummaries: async ({ limit, offset }) => /* select without message bodies */ [],
};
```

The visitor cookie is a rate-limit fallback for callers whose IP is unknown. It holds a random id plus an HMAC. Pass the secret in (for example `INTERNAL_SIGNING_SECRET`): nothing in this package reads `process.env`.
