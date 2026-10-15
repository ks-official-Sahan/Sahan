// Names the e2e fixtures create and the specs look for. Not secrets: the
// password comes from E2E_PASSWORD and the unlock secret from the environment.
export const E2E_USERS = {
  editor: { email: "editor@e2e.test", name: "E2E Editor", role: "EDITOR" },
  manager: { email: "manager@e2e.test", name: "E2E Manager", role: "MANAGER" },
} as const;

export const E2E_POSTS = {
  published: {
    slug: "e2e-published-post",
    title: "E2E published post",
    body: "This post is public, so the site and the content API list it.",
    status: "PUBLISHED",
  },
  draft: {
    slug: "e2e-draft-post",
    title: "E2E draft post",
    body: "This draft must never be visible to the public.",
    status: "DRAFT",
  },
} as const;
