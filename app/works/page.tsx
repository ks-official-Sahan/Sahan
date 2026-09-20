"use client";

import WrapperBody from "@/components/wrappers/WrapperBody";
import { WorksContent } from "@/contents/works";
import { righteous } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowDownRight } from "lucide-react";
import { useTheme } from "next-themes";
import { useSearchParams } from "next/navigation";
import HeaderCard from "@/components/custom/work/HeaderCard";
import Particals from "@/components/custom/Particals";
import ProjectGrid from "@/components/works/ProjectGrid";
import { ProjectFilters } from "@/contents/projects";
import { Button } from "@nextui-org/react";

type FilterValue = (typeof ProjectFilters)[number]["value"];

const Works = () => {
  const { theme } = useTheme();

  const [workType, setWorkType] = useState("design");
  const [filter, setFilter] = useState<FilterValue>("freelance");

  const searchParams = useSearchParams();

  const handleTypeChange = (type: "des" | "pro") => {
    localStorage.setItem("wt", type);

    const newParams = new URLSearchParams(window.location.search);
    newParams.set("wt", type);

    const newUrl = `${window.location.pathname}?${newParams.toString()}`;
    window.history.replaceState(null, "", newUrl);
  };

  // Seed state from the URL once on mount — never write back via router.replace
  // (that would update searchParams → re-trigger this effect → infinite loop).
  // Use window.history.replaceState for the initial default so the URL is clean
  // without causing a React navigation event.
  useEffect(() => {
    const wt = searchParams.get("wt") ?? localStorage.getItem("wt") ?? "des";
    const normalised = wt === "pro" ? "pro" : "des";

    setWorkType(normalised === "des" ? "design" : "projects");
    setFilter(normalised === "des" ? "freelance" : "product");
    localStorage.setItem("wt", normalised);

    // Only patch the URL if it is missing — no router call, no re-render.
    if (!searchParams.get("wt")) {
      window.history.replaceState(null, "", `/works?wt=${normalised}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — run once on mount only

  return (
    <div
      className={cn(
        "w-full flex flex-col items-center min-h-screen box-border border-b from-green-200 dark:from-gray-900 bg-gradient-to-b pt-[100px] lg:pt-[151px] relative",
        workType === "design"
          ? "to-[#46b66f] dark:to-green-800"
          : "to-blue-500 dark:to-cyan-950"
      )}
    >
      {/* HERO */}
      <Particals quantity={550} />

      <section
        className={cn(
          "w-full min-h-[565px] box-border border-b pt-[40px] sm:pt-0 lg:pt-[120px] relative"
        )}
      >
        <Particals quantity={200} />

        <WrapperBody>
          <div className="w-full">
            {/* Header */}
            <div className="text-center dark:text-white flex flex-col items-center gap-[12px]">
              <div className={cn(righteous.className, "text-[40px] uppercase")}>
                {WorksContent.title}
              </div>
              <div className="text-[15px] max-w-[560px] opacity-65">
                {WorksContent.description}
              </div>
            </div>

            {/* Cards */}
            <div className="flex sm:flex-col justify-center gap-[30px] items-center pt-[25px] pb-[40px]">
              {/* Card 1 */}
              <HeaderCard workType={workType} title="design" rotate={-7.5}>
                <Button
                  onPress={() => {
                    setWorkType("design");
                    setFilter("freelance");
                    handleTypeChange("des");
                  }}
                  className="bg-transparent w-[268px] h-[211px] rounded-[24px] p-0 m-0 backdrop-blur-[33px]"
                >
                  <div
                    style={{
                      backgroundColor:
                        workType === "design"
                          ? theme === "dark"
                            ? WorksContent.workTypes.design.colors.dark.main +
                              "13"
                            : WorksContent.workTypes.design.colors.light.main +
                              "13"
                          : "#00000013",
                      borderColor:
                        workType === "design"
                          ? theme === "dark"
                            ? WorksContent.workTypes.design.colors.dark.main +
                              "31"
                            : WorksContent.workTypes.design.colors.light.main +
                              "31"
                          : "",
                    }}
                    className="w-full h-full border rounded-[24px] backdrop-blur-[33px] "
                  >
                    <div className="flex flex-col pl-[85px] pt-[30px] text-gray-900 dark:text-gray-400">
                      <div
                        style={{
                          color:
                            WorksContent.workTypes.design.colors.light.text,
                        }}
                        className={cn(
                          righteous.className,
                          "text-[2rem] uppercase leading-[32px] flex flex-col items-start "
                        )}
                      >
                        <div>{WorksContent.workTypes.design.title.line1}</div>
                        <div>{WorksContent.workTypes.design.title.line2}</div>
                      </div>

                      <div className="flex flex-col items-start text-[12px] opacity-65 pt-[10px]">
                        <div>
                          {WorksContent.workTypes.design.subtitle.line1}
                        </div>
                        <div>
                          {WorksContent.workTypes.design.subtitle.line2}
                        </div>
                      </div>

                      <div className="flex items-center gap-[10px] pt-4">
                        <div className="text-[13px] font-medium px-[16px] py-[6px] h-[30px] border rounded-[10px] bg-[#00000075] backdrop-blur-sm flex justify-center items-center w-fit text-gray-200">
                          <span className="opacity-65">Explore Now...</span>
                        </div>
                        <div className="w-[30px] h-[30px] rounded-full border bg-[#00000060] backdrop-blur-sm flex justify-center items-center text-secondaryT">
                          <ArrowDownRight size={16} />
                        </div>
                      </div>
                    </div>
                  </div>
                </Button>
                <motion.div
                  initial={{ rotate: 0 }}
                  animate={{ rotate: workType === "design" ? 5 : 0 }}
                  transition={{ duration: 1, type: "spring" }}
                  className="absolute left-[-18px] bottom-[-5px]"
                >
                  <Image
                    src={"/av/c1.svg"}
                    alt=""
                    width={126}
                    height={203}
                    className="object-cover"
                  />
                </motion.div>
              </HeaderCard>

              {/* Card 2 */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 19 }}
                transition={{ duration: 1, type: "spring" }}
                className="sm:hidden"
              >
                <Image
                  src={"/av/c3.svg"}
                  width={277}
                  height={277}
                  alt="Works illustration"
                  className="object-cover"
                  loading="eager"
                  priority
                />
              </motion.div>

              {/* Card 3 */}
              <HeaderCard workType={workType} title="projects" rotate={7.5}>
                <Button
                  onPress={() => {
                    setWorkType("projects");
                    setFilter("product");
                    handleTypeChange("pro");
                  }}
                  className="bg-transparent w-[268px] h-[211px] rounded-[24px] p-0 m-0 backdrop-blur-[33px]"
                >
                  <div
                    style={{
                      backgroundColor:
                        workType === "projects"
                          ? theme === "dark"
                            ? WorksContent.workTypes.project.colors.dark.main +
                              "13"
                            : WorksContent.workTypes.project.colors.light.main +
                              "13"
                          : "#00000013",
                      borderColor:
                        workType === "projects"
                          ? theme === "dark"
                            ? WorksContent.workTypes.project.colors.dark.main +
                              "31"
                            : WorksContent.workTypes.project.colors.light.main +
                              "31"
                          : "",
                    }}
                    className="w-full h-full border rounded-[24px] bg-[#00000013] backdrop-blur-[33px]"
                  >
                    <div className="flex flex-col pl-[30px] pt-[30px] text-gray-900 dark:text-gray-400">
                      <div
                        style={{
                          color:
                            WorksContent.workTypes.project.colors.light.text,
                        }}
                        className={cn(
                          righteous.className,
                          "text-[2rem] uppercase leading-[32px] flex flex-col items-start "
                        )}
                      >
                        <div>{WorksContent.workTypes.project.title.line1}</div>
                        <div>{WorksContent.workTypes.project.title.line2}</div>
                      </div>

                      <div className="flex flex-col items-start text-[12px] opacity-65 pt-[10px]">
                        <div>
                          {WorksContent.workTypes.project.subtitle.line1}
                        </div>
                        <div>
                          {WorksContent.workTypes.project.subtitle.line2}
                        </div>
                      </div>

                      <div className="flex items-center gap-[10px] pt-4">
                        <div className="w-[30px] h-[30px] rounded-full border bg-[#00000060] backdrop-blur-sm flex justify-center items-center text-secondaryT">
                          <ArrowDownLeft size={16} />
                        </div>
                        <div className="text-[13px] font-medium px-[16px] py-[6px] h-[30px] border rounded-[10px] bg-[#00000075] backdrop-blur-sm flex justify-center items-center w-fit text-gray-200">
                          <span className="opacity-65">Explore Now...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Button>

                <motion.div
                  initial={{ rotate: 0 }}
                  animate={{ rotate: workType === "projects" ? -5 : 0 }}
                  transition={{ duration: 1, type: "spring" }}
                  className="absolute right-[-26px] bottom-[-12px]"
                >
                  <Image
                    src={"/av/c2.svg"}
                    alt=""
                    width={110}
                    height={203}
                    className="object-cover"
                  />
                </motion.div>
              </HeaderCard>
            </div>
          </div>
        </WrapperBody>
      </section>

      {/* WORKS */}
      <section className="border-y w-full">
        <div className="flex flex-col w-full items-center bg-opacity-50 py-[60px]">
          <WrapperBody>
            <ProjectGrid filter={filter} onFilterChange={setFilter} />
          </WrapperBody>
        </div>
      </section>
    </div>
  );
};

export default Works;
