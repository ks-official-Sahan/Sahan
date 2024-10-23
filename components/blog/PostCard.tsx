"use client"
import { Button } from '@nextui-org/react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import React from 'react'
import { ReadTimeBadge, RecentBadge } from '../common/Badges'

const PostCard = ({ ...post }: RecentPostProps) => {

    const router = useRouter();

    return (
        <Button onClick={() => router.push("/blog/" + post.id + "?b=" + post.title)} className='p-0 text-start justify-start flex-1 min-h-[489px] rounded-[24px] border bg-[#00000042] backdrop-blur-[16px] flex flex-col'>

            <div className="w-full h-[273px] relative">
                <Image src={post.image} alt={post.id} fill className="rounded-t-[24px] object-cover" />
                <div className='  gap-[20px] absolute bottom-[20px] left-[18px] group hidden group-hover:flex transform transition-transform duration-300'>

                    <div className=" text-[12px] font-semibold uppercase px-[16px] flex justify-center items-center py-[6px] rounded-full border bg-[#00000096] backdrop-blur-sm text-[#ffffff90] w-fit">{post.category}</div>
                    <ReadTimeBadge time={post.readTime} bgColor='bg-[#0E242C96]' />
                </div>
            </div>

            <div className='w-full py-[20px] px-[24px]'>
                <div className='text-[20px] font-semibold line-clamp-2 overflow-hidden whitespace-nowrap text-wrap leading-[28px]'>{post.title}</div>
                <div className='text-[15px] text-secondaryT line-clamp-2 overflow-hidden whitespace-nowrap text-wrap pt-[10px]'>{post.description}</div>
            </div>

            <div className='flex justify-between items-center w-full px-[24px]'>
                <div className='font-semibold text-[14px] text-secondaryT'>{post.date}</div>
                <div className='text-[14px] font-medium text-secondaryT flex items-center gap-3'>#{post.tags[0]} <span className='text-[10px] font-semibold px-[8px] border rounded-full'>+{post.tags.length-1}</span></div>
            </div>

        </Button>
    )
}

export default PostCard
