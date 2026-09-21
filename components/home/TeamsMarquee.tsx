import { HomeContainer } from "@/components/home/HomeSection";
import Marquee from "@/components/ui/marquee";
import { HomeContent } from "@/contents/home";
import { Experience } from "@/contents/experience";
import { Projects } from "@/contents/projects";
import React from "react";

// Real names only: every employer from the experience list plus every project
// title. Text, not logos, so nothing here implies a brand endorsement.
const names = [
  ...new Set([
    ...Experience.filter((entry) => entry.type !== "freelance").map((entry) =>
      entry.company.replace(/\s+(PVT\s+)?Ltd$/i, "")
    ),
    ...Projects.map((project) => project.title),
  ]),
];

const fade =
  "[mask-image:linear-gradient(to_right,transparent,#000_10%,#000_90%,transparent)]";

const TeamsMarquee = () => {
  const { teams } = HomeContent;

  return (
    <section aria-label={teams.label} className="w-full pt-2">
      <HomeContainer>
        <p className="mb-3 text-sm opacity-70">{teams.label}</p>

        {/* Screen readers get a plain list; the moving copy is decoration. */}
        <ul className="sr-only motion-reduce:not-sr-only motion-reduce:flex motion-reduce:flex-wrap motion-reduce:gap-x-8 motion-reduce:gap-y-2">
          {names.map((name) => (
            <li key={name} className="text-lg font-semibold opacity-70">
              {name}
            </li>
          ))}
        </ul>

        <div aria-hidden="true" className={`motion-reduce:hidden ${fade}`}>
          <Marquee pauseOnHover className="p-0 [--duration:50s] [--gap:3rem]">
            {names.map((name) => (
              <span
                key={name}
                className="whitespace-nowrap text-xl font-semibold opacity-60 transition-opacity duration-200 hover:opacity-100"
              >
                {name}
              </span>
            ))}
          </Marquee>
        </div>
      </HomeContainer>
    </section>
  );
};

export default TeamsMarquee;
