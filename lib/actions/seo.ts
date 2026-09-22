"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction } from "@/lib/actions/guard";
import { done, fail, type ActionState } from "@/lib/actions/state";
import { audit } from "@/lib/admin/audit";
import { collectIndexableUrls, isIndexNowConfigured, pingIndexNowWithStatus } from "@/lib/seo/indexnow";
import { regenerateLlmsTxt } from "@/lib/seo/llms-txt";

// Server actions backing the Settings screen's SEO tools section: llms.txt
// regeneration, sitemap revalidation, and IndexNow pings. Every mutation
// authorizes first, matching the pattern in lib/actions/settings.ts.

const ADMIN_SETTINGS_PATH = "/admin/settings";

export async function regenerateLlmsTxtAction(_previous: ActionState, _formData: FormData): Promise<ActionState> {
  const authz = await authorizeAction("manageSettings");
  if (!authz.ok) return fail(authz.error);

  const content = await regenerateLlmsTxt(authz.user);
  await audit({
    action: "seo.llmsTxt.regenerated",
    actor: { id: authz.user.id, email: authz.user.email },
    entityType: "Setting",
    entityId: "seo.llmsTxt",
    meta: { bytes: content.length },
  });
  revalidatePath("/llms.txt");
  revalidatePath(ADMIN_SETTINGS_PATH);
  return done(`llms.txt regenerated (${content.length} bytes).`);
}

/** Sahan's sitemap (app/sitemap.ts) is already fully dynamic per request, so
 * "regenerate" is a cache revalidation, not a file rebuild. */
export async function regenerateSitemapAction(_previous: ActionState, _formData: FormData): Promise<ActionState> {
  const authz = await authorizeAction("manageSettings");
  if (!authz.ok) return fail(authz.error);

  revalidatePath("/sitemap.xml");
  await audit({
    action: "seo.sitemap.regenerated",
    actor: { id: authz.user.id, email: authz.user.email },
    entityType: "Setting",
  });
  revalidatePath(ADMIN_SETTINGS_PATH);
  return done("Sitemap revalidated.");
}

export async function pingIndexNowAction(_previous: ActionState, _formData: FormData): Promise<ActionState> {
  const authz = await authorizeAction("manageSettings");
  if (!authz.ok) return fail(authz.error);

  if (!isIndexNowConfigured()) return fail("INDEXNOW_KEY is not configured.");

  const urls = await collectIndexableUrls();
  const result = await pingIndexNowWithStatus(urls);

  await audit({
    action: "seo.indexnow.pinged",
    actor: { id: authz.user.id, email: authz.user.email },
    entityType: "Setting",
    meta: { submitted: result.submitted, endpoints: result.endpoints },
  });
  revalidatePath(ADMIN_SETTINGS_PATH);

  const failed = result.endpoints.filter((endpoint) => !endpoint.ok);
  if (failed.length > 0) {
    return fail(
      `Pinged ${result.submitted} URL(s), but ${failed.map((endpoint) => endpoint.name).join(", ")} failed.`
    );
  }
  return done(`Pinged ${result.submitted} URL(s) to ${result.endpoints.map((endpoint) => endpoint.name).join(" and ")}.`);
}
