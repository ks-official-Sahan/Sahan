"use client"
import { Button } from '@nextui-org/react'
import { ArrowUpRight } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import React from 'react'
import { ReadTimeBadge } from '../common/Badges'
import { Tooltip } from '@mantine/core';


const FlatPostCard = ({ ...post }: RecentPostProps) => {

  const router = useRouter();

  return (
    <Button onClick={() => router.push("/blog/" + post.id + "?b=" + post.title)} className='w-full p-0 text-start h-[144px] border rounded-[12px] flex items-center gap-[20px] bg-[#00000042] backdrop-blur-md'>

      <div className='w-[192px] h-full relative'>
        <Image src='/de/mountains-lake.jpg' alt={post.id} fill className='rounded-l-[12px] object-cover' />
      </div>

      {/* CONTENT */}
      <div className='pt-[22px] pb-[20px] pr-[26px]'>

        {/* ROW1 */}
        <div className='flex justify-between items-start gap-[100px]'>

          <div className=''>
            <div className='line-clamp-1 text-[20px] font-semibold leading-[28px]'>{post.title}</div>
            <div className='line-clamp-1 text-[15px] opacity-65 pt-[4px]'>{post.description}</div>
          </div>

          <div className='p-[7px] flex justify-center items-center rounded-full border bg-[#00000060] backdrop-blur-sm'>
            <ArrowUpRight size={16} />
          </div>

        </div>

        {/* ROW2 */}
        <div className='flex items-center justify-between w-full  pt-[17px]'>
          <div className='flex items-center gap-[20px]'>
            {/* <RecentBadge /> */}
            <ReadTimeBadge time={post.readTime} />
            <div className="text-[12px] font-semibold uppercase px-[16px] py-[8px] rounded-full border opacity-65">{post.category}</div>
          </div>

          <div className='flex items-center gap-[20px]'>
            <div className='text-[12px] font-semibold opacity-65 '>{post.date}</div>
            {/* TAGS */}
            <Tooltip
              multiline
          
              withArrow
              transitionProps={{ duration: 200 }}
              label={post.tags.map((tag, key)=>(
                <div className='w-full' key={key}>#{tag}</div>
              ))}
            >
              <div className="flex gap-4  items-center overflow-hidden">
                {post.tags.slice(0, 2).map((tag, key) => (
                  <div key={key} className="text-[14px] font-medium text-secondaryT">#{tag}</div>
                ))}
                {post.tags.length > 2 ? <div className="text-[10px] font-medium text-secondaryT px-3 flex justify-center items-center border rounded-full">+{post.tags.length-2}</div> : ""}
              </div>
            </Tooltip>
          </div>
        </div>

      </div>

    </Button>
  )
}

export default FlatPostCard
