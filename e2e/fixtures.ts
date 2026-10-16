// End-to-end fixtures: test accounts and posts the specs rely on.
// Run after `pnpm db:migrate` and `pnpm db:seed` (which creates the roles), and
// before `pnpm build` (the build prerenders the sitemap and post pages):
//   pnpm e2e:fixtures
// Idempotent. Refuses any database schema but `sahan_test`, so it can never
// write test accounts into the real site.
import { hashPassword } from "../lib/auth/password";
import { autoExcerptOf } from "../lib/blog/excerpt";
import { db } from "../lib/db/prisma";
import { schemaFromUrl } from "../lib/db/url";

import { E2E_POSTS, E2E_USERS } from "./data";

async function main() {
  const schema = schemaFromUrl(process.env.DATABASE_URL);
  if (schema !== "sahan_test") throw new Error(`e2e fixtures only run against the sahan_test schema, not "${schema}"`);
  const password = process.env.E2E_PASSWORD;
  if (!password || password.length < 12) throw new Error("Set E2E_PASSWORD (12+ characters) for the test accounts");

  const passwordHash = await hashPassword(password);
  for (const user of Object.values(E2E_USERS)) {
    const fields = {
      name: user.name,
      role: user.role,
      passwordHash,
      emailVerified: true,
      mfaEnabled: false,
      mustChangePassword: false,
      disabledAt: null,
    };
    await db.user.upsert({ where: { email: user.email }, update: fields, create: { email: user.email, ...fields } });
  }

  const author = await db.user.findUniqueOrThrow({ where: { email: E2E_USERS.editor.email }, select: { id: true } });
  const hour = 60 * 60 * 1000;
  for (const post of Object.values(E2E_POSTS)) {
    const text = `${post.title}. ${post.body}`;
    const fields = {
      title: post.title,
      content: post.body,
      contentHtml: `<p>${post.body}</p>`,
      contentText: text,
      autoExcerpt: autoExcerptOf(text),
      topic: "Testing",
      tags: ["e2e"],
      status: post.status,
      publishedAt: post.status === "PUBLISHED" ? new Date(Date.now() - hour) : null,
      publishAt: null,
      authorId: author.id,
    };
    await db.post.upsert({ where: { slug: post.slug }, update: fields, create: { slug: post.slug, ...fields } });
  }

  console.log(`e2e fixtures ready: ${Object.keys(E2E_USERS).length} users, ${Object.keys(E2E_POSTS).length} posts`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
