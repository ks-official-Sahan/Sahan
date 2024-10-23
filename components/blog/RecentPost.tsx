"use client"
import React from 'react'
import { AspectRatio, Tooltip } from '@mantine/core';
import Image from 'next/image';
import { Button, Image as NextUiImage } from "@nextui-org/react"
import { ReadTimeBadge, RecentBadge } from '@/components/common/Badges';
import { cn } from '@/lib/utils';
import { righteous } from '@/lib/fonts';
import { useRouter } from 'next/navigation';


const RecentPost = ({...post}:RecentPostProps) => {
    const router = useRouter();

  return (
    <Button onClick={()=>router.push("/blog/" + post.id+"?b="+post.title)} className='w-8/12 p-0 text-start min-h-[489px] flex gap-[30px] rounded-[24px] border bg-[#00000024] backdrop-blur-[16px]'>
      
      {/* IMAGE PLACEHOLDER */}
      <div className='w-1/2 h-full rounded-l-[24px] relative flex items-center justify-end'>
            <Image src={post.image} loading='lazy' alt='blurred image' fill className='object-cover w-full h-full rounded-l-[24px]'/>
            {/* FILTER BLUR */}
            <div className='absolute w-full h-full bg-[#00000042] backdrop-blur-[11px] z-30 rounded-l-[24px]'></div>

            {/* TOP IMAGE */}
            <div className='z-50 w-10/12'>
                <AspectRatio ratio={4 / 3} >
                    <NextUiImage src={post.image}  alt="main image" className="w-full h-full rounded-r-none"/>
                </AspectRatio>
            </div>
      </div>

      {/* DETAILS */}
      <div className='w-1/2 box-border pt-10 pb-[26px] pr-[30px]'>

            <div className='text-[1.5rem] font-semibold text-[#E1FFC7] leading-[32px] text-wrap line-clamp-3'>{post.title}</div>

            <div className='text-secondaryT pt-[14px] text-wrap line-clamp-3'>{post.description}</div>

            <div className='flex items-center gap-[20px] pt-[26px]'>
                <RecentBadge/>
                <ReadTimeBadge time={post.readTime}/>
            </div>

            {/* TAGS */}
            <Tooltip
              multiline
          
              withArrow
              transitionProps={{ duration: 200 }}
              label={post.tags.map((tag, key)=>(
                <div className='w-full' key={key}>#{tag}</div>
              ))}
            >
            <div className="flex gap-4 mt-5 items-center overflow-hidden w-fit">
                {post.tags.slice(0, 3).map((tag, key)=>(
                    <div key={key} className="text-[14px] font-medium text-secondaryT">#{tag}</div>
                ))}
                {post.tags.length > 3? <div className="text-[10px] font-medium text-secondaryT px-3 flex justify-center items-center border rounded-full">+{post.tags.length-3}</div>:""}
            </div>
            </Tooltip>
            <div className='grid grid-cols-2 items-center gap-[20px] pt-[26px]'>
                {/* CATEGORY */}
                <div className='w-full h-[100px] flex flex-col justify-center border rounded-[24px] px-[17px] py-[22px] from-[#26470E13] to-[#00000013] bg-gradient-to-b backdrop-blur-[33px]'>
                    <div className='text-[12px] font-semibold text-secondaryT'>Category</div>
                    <div className={cn(righteous.className, "uppercase text-[#E1FFC7] opacity-80 pt-[8px]")}>{post.category}</div>
                </div>

                {/* PUBLISHED ON */}
                <div className='w-full h-[100px] flex flex-col justify-center border rounded-[24px] px-[17px] py-[22px] bg-[#00000013] backdrop-blur-[33px]'>
                    <div className='text-[12px] font-semibold text-secondaryT'>Published on</div>
                    <div className={cn(righteous.className, "uppercase opacity-60 pt-[8px]")}>{post.date}</div>
                </div>
            </div>
            

      </div>

    </Button>
  )
}

export default RecentPost
