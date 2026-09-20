import AboutPageClient from "@/components/about/AboutPageClient";
import { getGitHubStats } from "@/lib/github";

const About = async () => {
  const githubStats = await getGitHubStats();

  return <AboutPageClient githubStats={githubStats} />;
};

export default About;
