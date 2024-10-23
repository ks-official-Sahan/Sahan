import React from 'react'

interface ContactDetailsBox {
    children: React.ReactNode;
    className?: string;
}

const ContactDetailsBox = ({children, className}: ContactDetailsBox) => {
  return (
    <div className={`${className} border rounded-[24px] bg-[#f7f7f7] dark:bg-[#00000023] flex flex-col gap-[10px] backdrop-blur-sm w-[364px] min-h-[260px] px-[16px] py-[14px]`}>
      {children}
    </div>
  )
}

export default ContactDetailsBox
