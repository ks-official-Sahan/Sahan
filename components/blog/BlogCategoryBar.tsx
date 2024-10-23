"use client"
import { BlogCategories, BlogContent } from '@/contents/blog'
import React, { useEffect, useMemo, useState } from 'react'
import BlogCategoryCard from './BlogCategoryCard'
import { usePathname, useRouter } from 'next/navigation'

const BlogCategoryBar = () => {

    const [selectedCategory, setSelectedCategory] = useState(1);
    const [blogCount, setBlogCount] = useState(0);
    const router = useRouter();
    const path = usePathname();

    useEffect(() => {
        const getLocalCategory = async () => {
            const ct = localStorage.getItem("category");
            setSelectedCategory(ct ? JSON.parse(ct) : 1);
            router.replace("/blog?ct=" + ct);
        };
        getLocalCategory();
    }, [path, router]);


    useMemo(() => {
        const count = () => {
            let count = 0;
            BlogCategories.map((category) => count += category.articles.length);
            setBlogCount(count);
        }
        count();
    }, [])


    return (
        <div className="flex flex-col w-full">

            {/* TITLE */}
            <div className="flex flex-col">
                <div className="flex items-center gap-[20px]">
                    <div className="w-[100px] h-[1px] bg-black dark:bg-white opacity-20"></div>
                    <div className="text-[12px] font-semibold uppercase px-[10px] py-[6px] rounded-full border">{BlogContent.categorySection.badgeTitle}</div>
                </div>

                <div className="pt-3 text-[2rem] font-semibold">{BlogContent.categorySection.title}</div>
                <div className="text-secondaryT pt-[6px]">Total {blogCount} Articles.</div>
            </div>

            <div className='w-full flex items-center gap-[20px] pt-[40px]'>
                {BlogCategories.map((category) => (
                    <BlogCategoryCard
                        key={category.id}
                        id={category.id}
                        name={category.name}
                        selected={selectedCategory}
                        onClick={setSelectedCategory}
                        color={category.colors}
                        articleCount={category.articles.length}
                    />
                ))}
            </div>
        </div>
    )
}

export default BlogCategoryBar
