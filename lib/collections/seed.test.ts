import { test } from "node:test";
import { strictEqual } from "node:assert";
import { Projects } from "@/contents/projects";
import { Experience } from "@/contents/experience";
import { loadProjects } from "./projects";
import { loadExperience } from "./experience";

test("projects: seeded data structure matches", async () => {
  const fakeDb = {
    project: {
      findMany: async () =>
        Projects.map((p, i) => ({
          id: `project-${i}`,
          slug: p.slug,
          title: p.title,
          tagline: p.tagline,
          description: p.description,
          role: p.role,
          organization: p.organization ?? null,
          organizationUrl: p.organizationUrl ?? null,
          category: p.category,
          status: p.status,
          platforms: p.platforms ?? [],
          tech: p.tech ?? [],
          links: p.links ?? [],
          image: p.image ?? null,
          year: p.year,
          featured: p.featured ?? false,
          sortOrder: i,
          published: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
    },
  };

  const loaded = await loadProjects(fakeDb);
  strictEqual(loaded.length, Projects.length);
  loaded.forEach((item, i) => {
    strictEqual(item.slug, Projects[i].slug);
    strictEqual(item.featured, Projects[i].featured ?? false);
  });
});

test("experience: seeded data structure matches", async () => {
  const fakeDb = {
    experience: {
      findMany: async () =>
        Experience.map((e, i) => ({
          id: `exp-${i}`,
          company: e.company,
          companyUrl: e.companyUrl ?? null,
          role: e.role,
          period: e.period,
          type: e.type,
          location: e.location ?? null,
          highlights: e.highlights ?? [],
          current: e.current ?? false,
          sortOrder: i,
          published: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
    },
  };

  const loaded = await loadExperience(fakeDb);
  strictEqual(loaded.length, Experience.length);
  loaded.forEach((item, i) => {
    strictEqual(item.company, Experience[i].company);
    strictEqual(item.type, Experience[i].type);
  });
});
