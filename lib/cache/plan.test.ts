import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PAGE_PATHS,
  forCacheClear,
  forCollection,
  forContentPublish,
  forPost,
  forPostList,
  forSettings,
  forTraining,
} from "./plan";
import { staticTags } from "./tags";

test("publishing a section invalidates its page tag and the chatbot knowledge", () => {
  const plan = forContentPublish("about");
  assert.deepEqual(plan.tags, ["cms:page:about", "chatbot:knowledge"]);
  assert.deepEqual(plan.paths, ["/about"]);
});

test("a shared section revalidates every page that shows it", () => {
  const plan = forContentPublish("home", {
    consumers: ["/", "/about", "/works", "/updates"],
    section: "finalCta",
  });
  assert.deepEqual(plan.tags, ["cms:page:home", "chatbot:knowledge"]);
  assert.deepEqual(plan.paths, ["/", "/about", "/works", "/updates"]);
});

test("publishing a site section also expires the site config, and seo adds the sitemap", () => {
  const identity = forContentPublish("site", { section: "identity" });
  assert.deepEqual(identity.tags, ["cms:page:site", "chatbot:knowledge", "site:config"]);
  assert.deepEqual(identity.paths, PAGE_PATHS.site);

  const seo = forContentPublish("site", { section: "seo" });
  assert.deepEqual(seo.paths, [...PAGE_PATHS.site, "/sitemap.xml"]);
});

test("a collection change refreshes home, about and works", () => {
  const plan = forCollection("projects");
  assert.deepEqual(plan.tags, ["collection:projects", "chatbot:knowledge"]);
  assert.deepEqual(plan.paths, ["/", "/about", "/works"]);
});

test("a post change refreshes the list, the post, taxonomy, feeds and the sitemap", () => {
  const plan = forPost("hello-world");
  assert.deepEqual(plan.tags, ["blog:list", "blog:post:hello-world", "blog:taxonomy", "chatbot:knowledge"]);
  assert.deepEqual(plan.paths, ["/updates", "/updates/hello-world", "/sitemap.xml", "/rss.xml"]);
});

test("a post plan refuses an unsafe slug", () => {
  assert.throws(() => forPost("../admin"), /Invalid post slug/);
  assert.throws(() => forPost("A B"), /Invalid post slug/);
});

test("the post list plan has no per-post tag", () => {
  const plan = forPostList();
  assert.equal(plan.tags.some((tag) => tag.startsWith("blog:post:")), false);
  assert.ok(plan.tags.includes("blog:list"));
});

test("settings refresh the public layout", () => {
  const plan = forSettings();
  assert.deepEqual(plan.tags, ["settings:public"]);
  assert.deepEqual(plan.paths, [{ path: "/", type: "layout" }]);
});

test("training entries only touch the chatbot knowledge", () => {
  assert.deepEqual(forTraining(), { tags: ["chatbot:knowledge"], paths: [] });
});

test("clear cache expires every slug-independent tag", () => {
  const plan = forCacheClear();
  assert.deepEqual(plan.tags, staticTags());
  assert.deepEqual(plan.paths, [{ path: "/", type: "layout" }]);
});

test("every plan lists each tag and path once", () => {
  const plans = [
    forContentPublish("site", { section: "seo" }),
    forCollection("skills"),
    forPost("a"),
    forPostList(),
    forSettings(),
    forCacheClear(),
  ];
  for (const plan of plans) {
    assert.equal(new Set(plan.tags).size, plan.tags.length);
    const paths = plan.paths.map((entry) => (typeof entry === "string" ? entry : `${entry.type}:${entry.path}`));
    assert.equal(new Set(paths).size, paths.length);
  }
});
