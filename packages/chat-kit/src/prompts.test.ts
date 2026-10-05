import assert from "node:assert/strict";
import { test } from "node:test";

import { buildChatPrompt } from "./prompts";
import type { ChatSite } from "./types";

const site: ChatSite = {
  author: "Ada",
  authorFullName: "Ada Example",
  role: "Engineer",
  company: "Engineer at Example Ltd",
  location: "Remote",
  tagline: "Ship it",
  email: "ada@example.com",
  phoneDisplay: "+1 555 0100",
  gitHubUrl: "https://github.com/ada",
  siteUrl: "https://ada.example",
  description: "Builds things.",
};

test("owner guidance comes after the fixed rules and before the reference data; none adds nothing", () => {
  const withGuidance = buildChatPrompt({ config: { tone: "professional" }, site: { ...site, guidance: "Mention the newsletter when asked about updates." }, knowledge: "- fact", userMessage: "hi" });
  const rules = withGuidance.system.indexOf("## Behavioral Rules");
  const guidance = withGuidance.system.indexOf("Mention the newsletter");
  const data = withGuidance.system.indexOf("<<<BEGIN_REFERENCE_DATA>>>");
  assert.ok(rules >= 0 && rules < guidance && guidance < data);

  const plain = buildChatPrompt({ config: { tone: "professional" }, site, userMessage: "hi" });
  assert.ok(!plain.system.includes("Standing guidance"));
});
