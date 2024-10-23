"use client"
import { Button } from '@nextui-org/react';
import { BriefcaseBusiness, Handshake, HomeIcon, Rss, User } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react'
import { motion } from "framer-motion";


const FooterNav = () => {

    const [currentPath, setCurrentPath] = useState("");
    const path = usePathname();

    const router = useRouter();

    const handleNavigation = (href: "home" | "about" | "works" | "blog" | "updates" | "contact") => {
        if (href === "home") {
            router.push("/", { scroll: true });

        } else if (href === "about") {
            router.push("/about", { scroll: true });

        } else if (href === "works") {
            router.push("/works", { scroll: true });

        } else if (href === "blog") {
            router.push("/blog", { scroll: true });

        } else if (href === "updates") {
            router.push("/updates", { scroll: true });

        } else if (href === "contact") {
            router.push("/contact", { scroll: true });

        }
    };

    useEffect(() => {

        const changeCurrentPath = () => {
            if (path === "/") {
                setCurrentPath("home");
            } else if (path.endsWith("about")) {
                setCurrentPath("about");
            } else if (path.endsWith("works")) {
                setCurrentPath("works");
            } else if (path.endsWith("updates")) {
                setCurrentPath("updates");
            } else if (path.endsWith("blog")) {
                setCurrentPath("blog");
            } else if (path.endsWith("contact")) {
                setCurrentPath("contact");
            }
        }

        changeCurrentPath();


    }, [path]);

    return (
        <div className='w-fit h-fit border rounded-[12px] flex items-center'>
            <div className='flex flex-col'>
                <div className='flex items-center'>
                    <Button onClick={() => handleNavigation("home")} className={`min-w-[50px] w-[50px] h-[50px] border-b border-r rounded-tl-[12px] rounded-r-none rounded-b-none 
                ${currentPath === "home" ? "bg-[#f7f7f7] dark:bg-[#00000032] text-[#19cf31] dark:text-[#91FF00]" : "bg-transparent text-[#9c9c9c]"}
                `}>
                        <div className='w-full h-full flex justify-center items-center'>
                            <HomeIcon size={20} />
                        </div>
                    </Button>
                    <Button onClick={() => handleNavigation("about")} className={`min-w-[50px] w-[50px] h-[50px] border-b border-r bg-transparent rounded-none
                 ${currentPath === "about" ? "bg-[#f7f7f7] dark:bg-[#00000032] text-[#19cf31] dark:text-[#91FF00]" : "bg-transparent text-[#9c9c9c]"}
                `}>
                        <div className='w-full h-full flex justify-center items-center'>
                            <User size={20} />
                        </div>
                    </Button>
                </div>
                <div className='flex items-center'>
                    <Button onClick={() => handleNavigation("works")} className={`min-w-[50px] w-[50px] h-[50px] border-r rounded-bl-[12px] bg-transparent rounded-r-none rounded-t-none
                 ${currentPath === "works" ? "bg-[#f7f7f7] dark:bg-[#00000032] text-[#19cf31] dark:text-[#91FF00]" : "bg-transparent text-[#9c9c9c]"}
                `}>
                        <div className='w-full h-full flex justify-center items-center'>
                            <BriefcaseBusiness size={20} />
                        </div>
                    </Button>
                    {/* <Button onClick={() => handleNavigation("blog")} className={`min-w-[50px] w-[50px] h-[50px] border-r bg-transparent rounded-none
                 ${currentPath === "blog" ? "bg-[#f7f7f7] dark:bg-[#00000032] text-[#19cf31] dark:text-[#91FF00]" : "bg-transparent text-[#9c9c9c]"}
                `}>
                        <div className='w-full h-full flex justify-center items-center'>
                            <Rss size={20} />
                        </div>
                    </Button> */}
                       <Button onClick={() => handleNavigation("updates")} className={`min-w-[50px] w-[50px] h-[50px] border-r bg-transparent rounded-none
                 ${currentPath === "updates" ? "bg-[#f7f7f7] dark:bg-[#00000032] text-[#19cf31] dark:text-[#91FF00]" : "bg-transparent text-[#9c9c9c]"}
                `}>
                        <div className='w-full h-full flex justify-center items-center'>
                            <Rss size={20} />
                        </div>
                    </Button>
                </div>
            </div>
            <Button onClick={() => handleNavigation("contact")} className={`min-w-[50px] w-[50px] h-[100px] rounded-r-[12px] bg-transparent rounded-l-none
         ${currentPath === "contact" ? "bg-[#f7f7f7] dark:bg-[#00000032] text-[#19cf31] dark:text-[#91FF00]" : "bg-transparent text-[#9c9c9c]"}
        `}>
                <motion.div
                    initial={{ rotate: -90 }}
                    className='w-[84px] h-[34px] px-[13px] rounded-full border flex items-center gap-[4px]'
                >
                    <Handshake size={12} /> <span className='text-[10px] font-semibold '>Contact</span>
                </motion.div>
            </Button>
        </div>
    )
}

export default FooterNav
