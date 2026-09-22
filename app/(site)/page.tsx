import { getPageContent } from "@/lib/cms/loaders";
import { getProjects, getExperience } from "@/lib/collections";
import { Projects } from "@/contents/projects";
import { Experience } from "@/contents/experience";
import HomePageView from "@/components/pages/HomePageView";

export default async function Home() {
  const content = await getPageContent("home");
  const projects = await getProjects(Projects);
  const experience = await getExperience(Experience);
  return <HomePageView content={content} projects={projects} experience={experience} />;
}
