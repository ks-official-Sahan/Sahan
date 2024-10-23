"use client"
import Particles from '@/components/magicui/particles'
import FilterSection from '@/components/updates/FilterSection'
import UpdatesCard from '@/components/updates/UpdatesCard'
import WrapperBody from '@/components/wrappers/WrapperBody'
import { UpdatesContent } from '@/contents/updates'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { righteous } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import React, { useEffect, useState } from 'react'

const Updates = () => {

  const { theme } = useTheme();
  const [color, setColor] = useState("#ffffff");

  useEffect(() => {
    setColor(theme === "dark" ? "#ffffff" : "#000000");
  }, [theme]);

  return (
    <div className='min-h-screen w-full flex flex-col items-center pb-[60px] relative'>

<Particles
          className="absolute inset-0"
          quantity={100}
          ease={80}
          color={color}
          refresh
        />

      {/* TOP */}
      <section className='flex flex-col items-center pt-[151px] text-center'>
        <WrapperBody>
          <div className='w-full flex flex-col items-center'>

            {/* TITLE */}
            <div className={cn(
              // righteous.className,
              'flex items-center uppercase text-[40px] gap-2 font-bold',
            )}>
              <div>{UpdatesContent.title.w1}</div>
              <div className='text-[#91FF00]'>{UpdatesContent.title.w2}</div>
            </div>

            {/* SUB-TITLE */}
            <div className='text-[18px] font-medium opacity-65'>
              <div>{UpdatesContent.subtitle}</div>
            </div>

          </div>
        </WrapperBody>
      </section>

      {/* CONTENT */}
      <section className='flex flex-col items-center pt-[80px]'>
        <WrapperBody>
          <div className='flex justify-end w-full '>

            {/* POST CARDS */}
            <div className='flex flex-col items-center gap-[24px] z-[100] w-6/12'>
            {UpdatesContent.posts.map((post, index)=>(
              <UpdatesCard {...post} key={index}/>
            ))}
            </div>

            {/* FILTER SECTION */}
            <FilterSection/>

          </div>
        </WrapperBody>
      </section>

    </div>
  )
}

export default Updates
