import React from "react";
import UserCard from "@/components/custom/card/UserCard";
import CompanyCard from "@/components/custom/card/CompanyCard";
import ContactCard from "@/components/custom/card/ContactCard";
import AboutCard from "@/components/custom/card/AboutCard";
import Header from "@/components/custom/home/Header";
import ServiceCard from "@/components/custom/card/ServiceCard";
import Particals from "@/components/custom/Particals";
import AnimatedWrapper from "@/components/custom/home/AnimatedWrapper";

export default function Home() {
  return (
    <div>
      {/* HERO */}
      <section
        id="hero"
        className="w-full min-h-[832px] pb-[60px] relative 
        pt-[160px] md:pt-24 sm:pt-32
        dark:from-black dark:to-[#0d0d0d] bg-gradient-to-b 
        flex flex-col items-center"
      >
        <Particals quantity={300} size={0.5} />

        {/* Header */}
        <Header />

        {/* HERO BENTO */}
        <AnimatedWrapper className="w-full h-auto flex flex-col justify-center items-center pt-[80px] md:pt-[60px] xs:px-2 sm:px-2 md:px-4 lg:px-6 xl:px-12">
          <div className="flex flex-col gap-[32px] justify-center items-center">
            {/* COL 1 */}
            <section className="flex gap-[28px] p-2 sm:flex-col md:flex-col">
              {/* ROW 1 */}
              <div className="flex flex-col md:flex-row justify-center items-center gap-[28px] order-1 sm:order-2 md:order-2">
                {/* CARD 1 */}
                <AboutCard />
                <CompanyCard className="hidden md:flex " height={288} />
              </div>

              {/* ROW 2 */}
              <div className="flex flex-col items-center gap-[28px] order-2 sm:order-1 md:order-1">
                {/* CARD 2 */}
                <UserCard className="flex sm:hidden" />
                <UserCard className="hidden sm:flex" width={300} height={320} />

                {/* CARD 3 */}
                <CompanyCard className="flex md:hidden lg:hidden" />
                <ContactCard className="flex sm:hidden md:hidden" />
              </div>

              {/* ROW 3 */}
              <div className="flex flex-col justify-center items-center gap-[28px] cursor-pointer order-3">
                {/* CARD 4 */}
                <CompanyCard className="hidden lg:flex" height={288} />
                <ContactCard className="flex lg:hidden" />
              </div>
            </section>

            {/* COL 2 */}
            <section className="flex gap-[28px] p-2 sm:flex-col md:flex-col flex-wrap justify-center items-center">
              {/* CARD 5 = RANDOM SERVICE OR SKILL */}
              <ServiceCard
                title={"Web Dev"}
                description={"Integrating latest technologies"}
              />
              <ServiceCard width={300} height={250} />
              <ServiceCard
                title={"Mobile"}
                description={"Crafting best experience"}
              />
            </section>
          </div>
        </AnimatedWrapper>
      </section>

      {/* WHAT I DO */}

      {/* <Explore /> */}
    </div>
  );
}
