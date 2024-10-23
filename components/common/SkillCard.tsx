"use client"
import React from 'react'
import { CanvasRevealEffect } from '../ui/canvas-reveal-effect'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils';

interface SkillCardProps {
    isBorderTop?: boolean;
    isBoderBottom?: boolean;
    isBorderLeft?: boolean;
    isBorderRight?: boolean;
    icon: React.ReactNode;
    title: string;
    bgColors?: {
        light: string;
        dark: string;
    };
    colors?: [...number[]]
}

const SkillCard = ({
    isBoderBottom = true,
    isBorderLeft = true,
    isBorderRight = true,
    isBorderTop = true,
    title,
    icon,
    bgColors = { dark: "dark:bg-emerald-900", light: "bg-emerald-500" },
    colors = [125, 211, 252]
}: SkillCardProps) => {

    return (
        <div className={cn(
            'w-[200px] border-dashed  cursor-pointer ',
            isBoderBottom && "border-b",
            isBorderTop && "border-t",
            isBorderLeft && "border-l",
            isBorderRight && "border-r"
        )} >
            <Card title={title} icon={icon}>
                <CanvasRevealEffect
                    animationSpeed={3}
                    containerClassName={cn(
                        bgColors?.dark,
                        bgColors?.light
                    )}
                    colors={[colors]}
                    dotSize={2}
                    showGradient

                />
                {/* Radial gradient for the cute fade */}
                <div className={cn(
                    bgColors.light,
                    "absolute inset-0 [mask-image:radial-gradient(400px_at_center,white,transparent)] dark:bg-black/90",
                )} />
            </Card>
        </div>
    )
}

export default SkillCard

const Card = ({
    title,
    icon,
    children,
}: {
    title: string;
    icon: React.ReactNode;
    children?: React.ReactNode;
}) => {
    const [hovered, setHovered] = React.useState(false);
    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="group/canvas-card flex items-center justify-center max-w-sm w-full mx-auto p-4 relative h-[138px]"
        >
            <AnimatePresence>
                {hovered && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="h-full w-full absolute inset-0"
                    >
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="relative z-20">
                <div className="text-center group-hover/canvas-card:-translate-y-1 group-hover/canvas-card:opacity-100 transition duration-200 w-full  mx-auto flex items-center justify-center">
                    {icon}
                </div>
                <h2 className="dark:text-white text-[18px] text-center group-hover/canvas-card:pt-1 group-hover/canvas-card:h-auto h-0 opacity-0 group-hover/canvas-card:opacity-100 relative z-10 text-black   font-medium group-hover/canvas-card:text-white group-hover/canvas-card:translate-y-1 transition duration-200">
                    {title}
                </h2>
            </div>
        </div>
    );
};

