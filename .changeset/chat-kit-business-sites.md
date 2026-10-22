---
"@sahan-sac/chat-kit": minor
---

Business sites, query-aware knowledge and lead capture, ported from Valorem's chatbot.

- `ChatSite.entity: "business"` makes the assistant speak for a company instead of about a person; `persona` replaces the tone-based opening line; `gitHubUrl` is now optional.
- `KnowledgeSource.load(query)` receives the visitor's message, recent turns and current page, so a source returns only what is relevant. `buildKnowledge` takes the query as a third argument; sources that ignore it keep working.
- `rankByQuery` and `queryTerms` pick the items that best match a question (stop words dropped, ties keep your order).
- `@sahan-sac/chat-kit/lead`: `extractContact` finds an email address and phone number in a visitor message.
