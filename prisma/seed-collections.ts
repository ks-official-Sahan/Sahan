import { Projects } from "@/contents/projects";
import { Experience } from "@/contents/experience";
import { db } from "@/lib/db/prisma";
import { seedProjects, seedExperience } from "@/lib/collections/seed";

async function main() {
  console.log("Seeding collections...");

  await db.$transaction(async (tx) => {
    await seedProjects(tx, Projects);
    console.log(`✓ Seeded ${Projects.length} projects`);

    await seedExperience(tx, Experience);
    console.log(`✓ Seeded ${Experience.length} experience entries`);
  });

  console.log("Collections seeded successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
