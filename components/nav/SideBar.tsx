"use client";

import React from "react";
import NavItem from "./NavItem";
import { Drawer } from "@mantine/core";
import ThemeSwitch from "../theme/theme-switch";
import { SiteNavigations } from "@/config/nav";

const SideBar = ({ currentPath, title, opened, close }: SideBarProps) => {
  return (
    <Drawer.Root offset={8} radius="md" opened={opened} onClose={close}>
      <Drawer.Overlay />
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title className="uppercase text-green-500">
            {title}
          </Drawer.Title>
          <Drawer.CloseButton />
        </Drawer.Header>
        <Drawer.Body>
          <div className="flex justify-between items-center mt-4">
            <span>Theme:</span>
            <ThemeSwitch />
          </div>

          <div
            className={`px-[4px] flex flex-col items-center  text-[14px] h-auto mt-6 gap-4 w-full`}
          >
            {SiteNavigations.sidebar.map((item) => (
              <NavItem
                key={item.title}
                currentPath={currentPath}
                title={item.title}
                isSideBarItem={true}
              />
            ))}
          </div>
        </Drawer.Body>
      </Drawer.Content>
    </Drawer.Root>
  );
};

export default SideBar;
