import CountUp from "@/components/home/CountUp";
import { HomeContainer } from "@/components/home/HomeSection";
import { Projects } from "@/contents/projects";
import { MySkills } from "@/contents/skills";
import React from "react";

// Every number is derived from this site's own data, so the strip can never
// claim more than the Works and Skills pages already show.
const platformCount = new Set(Projects.flatMap((p) => p.platforms ?? [])).size;
const clientSites = Projects.filter((p) => p.category === "freelance").length;
// Tools only: working-style skills and repeats across categories don't count.
const skillCount = new Set(
  MySkills.tabs.categories
    .filter(
      (category) =>
        !["General Skills", "Mentoring Skills"].includes(category.category)
    )
    .flatMap((category) => category.skills.map((skill) => skill.name))
).size;

const stats = [
  { value: Projects.length, label: "Projects shipped" },
  { value: clientSites, label: "Client websites" },
  { value: platformCount, label: "Platforms covered" },
  { value: skillCount, label: "Technologies used" },
];

const ProofStrip = () => (
  <section aria-label="Track record" className="w-full mt-12">
    <HomeContainer>
      <dl className="reveal grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-bBORDERFADE bg-bBORDERFADE s768:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-1 bg-bCARD px-5 py-6 lg:px-8 lg:py-8"
          >
            {/* dt stays first in the DOM (required by dl); flex order puts the
                number visually above its label. */}
            <dt className="order-2 text-sm opacity-70">{stat.label}</dt>
            <dd className="order-1 text-[length:clamp(2rem,1.2rem+2.4vw,3.5rem)] font-semibold leading-none tracking-[-0.02em] tabular-nums">
              <CountUp to={stat.value} />
            </dd>
          </div>
        ))}
      </dl>
    </HomeContainer>
  </section>
);

export default ProofStrip;
