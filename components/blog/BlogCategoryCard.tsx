"use client"
import { righteous } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { Button } from '@nextui-org/react'
import { useTheme } from 'next-themes'
import React from 'react'
import Image from 'next/image'
import { motion } from "framer-motion"
import { BlogCategories } from '@/contents/blog'

const BlogCategoryCard = ({ ...category }: BlogCategoryCardProps) => {

    const [left, right] = category.name.split(" ");

    const { theme } = useTheme();

    return (
        <div className={cn(BlogCategories.length <= 4 && "flex-1", ' relative  flex justify-end')}>
            <Button
                style={{
                    backgroundColor: category.selected === category.id ? theme === "dark" ? category.color.dark.main + "13" : category.color.light.main + "13" : "",
                    borderColor: category.selected === category.id ? theme === "dark" ? category.color.dark.main + "31" : category.color.light.main + "31" : ""
                }}
                className={cn(
                    BlogCategories.length <= 4 && "w-full",
                    'px-[30px]  h-[170px] flex flex-col justify-center items-start rounded-[24px] border',
                    category.selected === category.id ? `pr-[90px] mr-[10px]` : `bg-[#fafafa] dark:bg-[#00000013] backdrop-blur-[33px]`
                )}
                onClick={() => {
                    category.onClick(category.id);
                    localStorage.setItem("category", category.id.toString());
                    // Update the query param without reloading the page
                    const newParams = new URLSearchParams(window.location.search);
                    newParams.set("ct", category.id.toString() || "1");

                    // Update the browser's URL
                    const newUrl = `${window.location.pathname}?${newParams.toString()}`;
                    window.history.replaceState(null, "", newUrl);
                }}
            >
                {/* NAME */}
                <div
                    style={{
                        color: category.selected === category.id ? theme === "dark" ? category.color.dark.text : category.color.light.text : ""

                    }}
                    className={cn(
                        righteous.className,
                        "text-[2rem] uppercase flex flex-col items-start text-start leading-[32px] opacity-80",
                        category.selected === category.id ? `` : ``
                    )}>
                    <span>{left}</span>
                    <span>{right}</span>
                </div>

                {/* COUNT */}
                <div className='text-[12px] mt-[16px] font-medium px-[16px] py-[6px] rounded-[10px] border bg-[#f7f7f7] dark:bg-[#00000043] backdrop-blur-sm'>
                    {category.articleCount} Articles
                </div>


            </Button>
            {category.selected === category.id &&
                <motion.div
                    key={category.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, type: "spring" }}
                    className="absolute right-[-12px] bottom-[-12px]"
                >
                    <Image src={"/av/c2.svg"} width={110} height={203} alt='C2' className='object-cover' />
                </motion.div>
            }
        </div>
    )
}

export default BlogCategoryCard
