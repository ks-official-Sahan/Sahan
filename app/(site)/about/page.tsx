import AboutPageView from "@/components/pages/AboutPageView";
import { getPageContent } from "@/lib/cms/loaders";
import { getProjects, getExperience, getServices, getSkills } from "@/lib/collections";
import { getGitHubStats } from "@/lib/github";
import { Projects } from "@/contents/projects";
import { Experience } from "@/contents/experience";

const About = async () => {
  const [about, home, githubStats, projects, experience, serviceGroups, skillGroups] = await Promise.all([
    getPageContent("about"),
    getPageContent("home"),
    getGitHubStats(),
    getProjects(Projects),
    getExperience(Experience),
    getServices(),
    getSkills(),
  ]);

  return <AboutPageView content={about} home={home} githubStats={githubStats} projects={projects} experience={experience} serviceGroups={serviceGroups} skillGroups={skillGroups} />;
};

export default About;
