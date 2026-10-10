import { Projects } from "@/contents/projects";
import { Experience } from "@/contents/experience";
import { MyServices } from "@/contents/service";
import { MySkills } from "@/contents/skills";
import { withTx } from "@/lib/data/prisma";
import { db } from "@/lib/db/prisma";
import { seedProjects, seedExperience, seedServices, seedSkills } from "@/lib/collections/seed";

async function main() {
  console.log("Seeding collections...");

  await withTx(async (tx) => {
    await seedProjects(tx, Projects);
    console.log(`✓ Seeded ${Projects.length} projects`);

    await seedExperience(tx, Experience);
    console.log(`✓ Seeded ${Experience.length} experience entries`);

    await seedServices(tx, MyServices.categories);
    console.log(`✓ Seeded ${MyServices.categories.length} service groups`);

    await seedSkills(tx, MySkills.tabs.categories);
    console.log(`✓ Seeded ${MySkills.tabs.categories.length} skill groups`);
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
