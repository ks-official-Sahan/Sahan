import { Box } from 'lucide-react'
import React from 'react'
import TwoWayScrollAnimation from '../animations/aelomotion/two-way-scroll-animation'

const UpdatesCard = ({...update}:UpdatesCardProps) => {
  return (
    <TwoWayScrollAnimation
    animate={{ opacity: 1, }}  // Animation when scrolling down
    reverse={{ opacity: 0, }} // Reverse animation when scrolling up
    initial={{ opacity: 0, }}   // Initial state
    threshold={0.2}
    key={update.id}
    >
      <div className='w-full max-w-[556px] rounded-[12px] px-[26px] py-[30px] border bg-[#1A1A1A] hover:from-[#1A1A1A] hover:to-[#232323] hover:bg-gradient-to-t transition-all duration-300 ease-in-out'>
      
      {/* HEADER */}
      <div className='flex items-center justify-between'>
        {/* LEFT */}
        <div className='flex items-center gap-2'>
            <Box size={16}/>
            <span className='font-semibold text-[14px] text-[#91FF00]'>{update.topic}</span>
        </div>

        {/* RIGHT */}
        <div>
          <div className='font-semibold text-[14px] opacity-60'>{update.date}</div>
        </div>
      </div>

      {/* TITLE & CONTENT */}
      <div className='w-full flex flex-col pt-[24px]'>
        <div className='font-semibold text-[20px]'>{update.title}</div>
        <div className='font-medium opacity-80 pt-2'>{update.content}</div>
      </div>

      {/* TAGS */}
      <div className='flex items-center flex-wrap gap-[10px] pt-[26px] '>
        {update.tags.map((tag, index)=>(
          <div className='text-[12px] font-semibold text-[#6BFF60] py-[6px] px-[16px] rounded-full border bg-[#6BFF60]/10' key={index}>{tag}</div>
        ))}
      </div>

    </div>
    </TwoWayScrollAnimation>
  )
}

export default UpdatesCard
