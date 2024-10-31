"use client";

import React from "react";
import ThemeSwitch from "../theme/theme-switch";
import Link from "next/link";
import { JelloElement } from "../animations/shoelace/jello-element";
import { Button } from "@nextui-org/react";
import { Burger } from "@mantine/core";
import { SiteNavigations } from "@/config/nav";
import NavItem from "./NavItem";

const NavBar = ({ title, currentPath, opened, toggle }: NavBarProps) => {
  return (
    <nav className="flex items-center justify-between w-full relative ">
      {/* LEFT */}
      <div className="z-[50]">
        <Link href={"/"} className="font-bold uppercase text-xl text-green-500">
          {title}
        </Link>
      </div>

      {/* CENTER lg */}
      <div className="absolute hidden-md-flex-lg flex-col items-center w-full z-[10]">
        <div
          className={`px-[4px] flex items-center  text-[14px] h-[41px] rounded-full border border-[#0000001f] dark:border-[#ffffff1f] backdrop-blur-sm `}
        >
          {SiteNavigations.navbar.map((item) => (
            <NavItem
              key={item.title}
              currentPath={currentPath}
              title={item.title}
            />
          ))}
        </div>
      </div>

      {/* CENTER md */}
      <div className="absolute hidden md:flex flex-col items-center w-full z-[10] ">
        <div
          className={`px-[4px] flex items-center  text-[14px] h-[41px] rounded-full border border-[#0000001f] dark:border-[#ffffff1f] backdrop-blur-sm `}
        >
          {SiteNavigations.sidebar.map((item) => (
            <NavItem
              key={item.title}
              currentPath={currentPath}
              title={item.title}
            />
          ))}
        </div>
      </div>

      {/* RIGHT */}
      <div className="hidden-sm-flex-lg items-center gap-6 z-[50]">
        <ThemeSwitch />
        <Link href={`/contact`} className="md:hidden">
          <JelloElement>
            <Button className="text-[14px] font-semibold dark:text-black text-white bg-[#19cf31] dark:bg-[#91FF00] h-[37px] px-[20px] rounded-[15px] flex justify-center items-center">
              Let&apos;s Talk
            </Button>
          </JelloElement>
        </Link>
      </div>

      {/* MENUBAR */}
      <div className="flex-sm-hidden-lg">
        <Burger
          opened={opened}
          onClick={toggle}
          aria-label="Toggle navigation"
        />
      </div>
    </nav>
  );
};

export default NavBar;
