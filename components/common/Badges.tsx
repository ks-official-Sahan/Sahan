import { cn } from '@/lib/utils'
import { BookOpen, Clock } from 'lucide-react'
import React from 'react'

export const ReadTimeBadge = ({ time, bgColor = "bg-[#0E242C80]" }: { time: string, bgColor?: string }) => {
  return (
    <div className={cn(bgColor, 'px-[16px] py-[8px] rounded-[10px] border backdrop-blur-sm')}>
      <div className='flex items-center gap-[10px] opacity-80 text-[12px] font-medium'>
        <BookOpen size={14} />
        <span>{time} Read</span>
      </div>
    </div>
  )
}


export const RecentBadge = ({ bgColor = "bg-[#00000080]" }: { bgColor?: string }) => {
  return (
    <div
      className={cn(bgColor, 'px-[16px] py-[8px] rounded-[10px] border  backdrop-blur-sm')}
    >
      <div className='flex items-center gap-[10px] opacity-80 text-[12px] font-medium'>
        <Clock size={14} />
        <span>Recent</span>
      </div>
    </div>
  )
}
