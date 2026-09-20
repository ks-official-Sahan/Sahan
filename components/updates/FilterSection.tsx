"use client";

import { UpdatesContent } from "@/contents/updates";
import React from "react";

const FilterSection = ({ className = "" }) => {
  const TopicIcon = UpdatesContent.fs.topics.icon;
  const TagsIcon = UpdatesContent.fs.tags.icon;

  return (
    <div
      className={`${className} justify-start items-start lg:w-5/12 md:w-full sm:w-full box-border px-[10px] lg:ps-20 flex-col pb-10 gap-[20px]`}
    >
      {/* TOPICS */}
      <div className="flex flex-col gap-4">
        {/* TITLE */}
        <div className="flex items-center gap-3 ">
          <div className="w-[30px] h-[30px] rounded-[6px] border dark:bg-[#1A1A1A] flex justify-center items-center">
            <TopicIcon size={14} />
          </div>
          <div className="text-[18px] font-semibold">
            {UpdatesContent.fs.topics.title}
          </div>
        </div>

        {/* TOPIC CHIPS */}
        <div className="flex flex-wrap gap-[10px]">
          {UpdatesContent.topics.map((topic, index) => (
            <span
              key={index}
              className="text-[12px] font-semibold text-black/65 dark:text-white/65 py-[6px] pl-[16px] pr-[16px] rounded-[6px] border dark:bg-[#232323]"
            >
              {topic.name}
            </span>
          ))}
        </div>
      </div>

      {/* TAGS */}
      <div className="flex flex-col gap-4">
        {/* TITLE */}
        <div className="flex items-center gap-3 ">
          <div className="w-[30px] h-[30px] rounded-[6px] border dark:bg-[#1A1A1A] flex justify-center items-center">
            <TagsIcon size={14} />
          </div>
          <div className="text-[18px] font-semibold">
            {UpdatesContent.fs.tags.title}
          </div>
        </div>

        {/* TOPIC CHIPS */}
        <div className="flex flex-wrap gap-[10px]">
          {UpdatesContent.tags.map((tag, index) => (
            <span
              key={index}
              className="text-[12px] font-semibold text-white/65 py-[6px] px-[16px] rounded-full text-[#6BFF60] border bg-[#6BFF60]/10"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FilterSection;
