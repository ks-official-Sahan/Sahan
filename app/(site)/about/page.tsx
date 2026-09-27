import AboutPageView from "@/components/pages/AboutPageView";
import { getPageContent } from "@/lib/cms/loaders";
import { getProjects } from "@/lib/collections";
import { getGitHubStats } from "@/lib/github";
import { Projects } from "@/contents/projects";

const About = async () => {
  const [about, home, githubStats, projects] = await Promise.all([
    getPageContent("about"),
    getPageContent("home"),
    getGitHubStats(),
    getProjects(Projects),
  ]);

  return <AboutPageView content={about} home={home} githubStats={githubStats} projects={projects} />;
};

export default About;
