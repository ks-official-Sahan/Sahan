"use client"
import PostCard from '@/components/blog/PostCard'
import RecentPost from '@/components/blog/RecentPost'
import HighlightWord from '@/components/common/HighlightWord'
import WrapperBody from '@/components/wrappers/WrapperBody'
import { BlogContent } from '@/contents/blog'
import { righteous } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import React, { useEffect } from 'react'
import { motion } from "framer-motion"
import BlogCategoryBar from '@/components/blog/BlogCategoryBar'
import FlatPostCard from '@/components/blog/FlatPostCard'
import { useSearchParams } from 'next/navigation'

const Blog = () => {

  const searchParams = useSearchParams();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const ct = searchParams.get("ct");
  useEffect(() => {
    const ct = localStorage.getItem("category");
    if (ct === null) {
      localStorage.setItem("category", "1");
    }
  });

  return (
    <div className='w-full flex flex-col items-center min-h-screen'>

      {/* HEADING */}
      <section className='w-full h-[380px] border-b box-border pt-[151px] text-center dark:bg-grid-small-white/[0.1] bg-grid-small-black/[0.2] relative'>
      <div className="absolute pointer-events-none inset-0 flex items-center justify-center dark:bg-black bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
        <WrapperBody>
          <div className='flex flex-col items-center'>
            <HighlightWord
              text={BlogContent.title}
              wordToHighlight='Blog'
              className={cn(righteous.className, "text-[40px] uppercase")}
              highlightClassName='text-[#CBFFC0]'
            />
            <div className='max-w-[558px] pt-3 text-secondaryT'>{BlogContent.subtitle}</div>
          </div>
        </WrapperBody>
      </section>

      {/* RECENT POSTS */}
      <motion.section
        initial={{ y: 20 }}
        animate={{ y: -32 }}
        transition={{ duration: 1, type: "spring" }}
        className='flex flex-col items-center w-full'>
        <WrapperBody>
          <div className='flex gap-[20px]'>
            <RecentPost
              id={"2"}
              title='Building a Scalable Authentication System with NestJS'
              description='A deep dive into how I developed a centralized identity management system for ImaginecoreX, featuring best practices and challenges faced.'
              category='PROGRAMMING TIPS'
              date='Sep 5, 2024'
              image='/de/mountains-lake.jpg'
              readTime='5 Min'
              tags={["SaaS", "NestJS"]}
            />
            <PostCard
              id={"1"}
              title='Building a Scalable Authentication System with NestJS'
              description='A deep dive into how I developed a centralized identity management system for ImaginecoreX, featuring best practices and challenges faced.'
              category='PROGRAMMING TIPS'
              date='Sep 5, 2024'
              image='/de/cute-fox.jpg'
              readTime='5 Min'
              tags={["SaaS", "NestJS"]}
            />
          </div>
        </WrapperBody>
      </motion.section>


      {/* CATEGORY BAR */}
      <motion.section
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        transition={{ duration: 1, type: "spring" }}
        className='mt-[60px] '>
        <WrapperBody>
          <div className='w-full'>
            <BlogCategoryBar />
          </div>
        </WrapperBody>
      </motion.section>

      {/* POSTS */}
      <section className='py-[40px]'>
        <WrapperBody>
          <div>

            <div className='flex flex-col gap-[20px]'>
              {["", "", ""].map((post, key) => (
                <FlatPostCard 
                key={key}
                  id={"1"}
                  title='Building a Scalable Authentication System with NestJS'
                  description='A deep dive into how I developed a centralized identity management system for ImaginecoreX, featuring best practices and challenges faced.'
                  category='PROGRAMMING TIPS'
                  date='Sep 5, 2024'
                  image='/de/mountains-lake.jpg'
                  readTime='5 Min'
                  tags={["SaaS", "NestJS", "NextJS", "AI"]}
                />
              ))}
            </div>

            <div className='grid grid-cols-3 gap-[20px] mt-[20px]'>
              {["", "", ""].map((post, key) => (
                <PostCard
                  id={"1"}
                  title='Building a Scalable Authentication System with NestJS'
                  description='A deep dive into how I developed a centralized identity management system for ImaginecoreX, featuring best practices and challenges faced.'
                  category='PROGRAMMING TIPS'
                  date='Sep 5, 2024'
                  image='/de/cute-fox.jpg'
                  readTime='5 Min'
                  tags={["SaaS", "NestJS"]}
                  key={key} />
              ))}
            </div>

          </div>
        </WrapperBody>
      </section>

    </div>
  )
}

export default Blog
