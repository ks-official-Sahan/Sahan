import CountUp from "@/components/home/CountUp";
import WrapperBody from "@/components/wrappers/WrapperBody";
import { Projects } from "@/contents/projects";
import { MySkills } from "@/contents/skills";
import React from "react";

// Every number is derived from this site's own data, so the strip can never
// claim more than the Works and Skills pages already show.
const platformCount = new Set(Projects.flatMap((p) => p.platforms ?? [])).size;
const clientSites = Projects.filter((p) => p.category === "freelance").length;
const skillCount = MySkills.tabs.categories.reduce(
  (total, category) => total + category.skills.length,
  0
);

const stats = [
  { value: Projects.length, label: "Projects shipped" },
  { value: clientSites, label: "Client websites" },
  { value: platformCount, label: "Platforms covered" },
  { value: skillCount, label: "Technologies used" },
];

const ProofStrip = () => (
  <section
    aria-label="Track record"
    className="flex w-full flex-col items-center pt-8"
  >
    <WrapperBody>
      <dl className="reveal grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-bBORDERFADE bg-bBORDERFADE lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-1 bg-bCARD px-6 py-6"
          >
            {/* dt stays first in the DOM (required by dl); flex order puts the
                number visually above its label. */}
            <dt className="order-2 text-sm opacity-70">{stat.label}</dt>
            <dd className="order-1 text-[length:clamp(2rem,4vw,2.75rem)] font-semibold leading-none tracking-[-0.02em] tabular-nums">
              <CountUp to={stat.value} />
            </dd>
          </div>
        ))}
      </dl>
    </WrapperBody>
  </section>
);

export default ProofStrip;
