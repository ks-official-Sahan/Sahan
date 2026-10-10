import { getPageContent } from "@/lib/cms/loaders";
import { getProjects, getExperience, getServices, getSkills } from "@/lib/collections";
import { Projects } from "@/contents/projects";
import { Experience } from "@/contents/experience";
import HomePageView from "@/components/pages/HomePageView";

export default async function Home() {
  const [content, projects, experience, serviceGroups, skillGroups] = await Promise.all([
    getPageContent("home"),
    getProjects(Projects),
    getExperience(Experience),
    getServices(),
    getSkills(),
  ]);
  return <HomePageView content={content} projects={projects} experience={experience} serviceGroups={serviceGroups} skillGroups={skillGroups} />;
}
