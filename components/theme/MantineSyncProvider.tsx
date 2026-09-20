"use client";

import { MantineProvider } from "@mantine/core";
import { useTheme } from "next-themes";
import { theme } from "@/config/mantine-theme";

/**
 * next-themes is the single source of truth for light/dark mode (it drives
 * Tailwind's `dark:` classes, which style almost the entire UI). Mantine is
 * only used for a couple of components (the mobile nav Drawer/Burger), so
 * rather than letting Mantine manage its own independent color scheme, this
 * derives it from next-themes to avoid the two systems drifting out of sync
 * (which previously caused an `<html>` hydration mismatch).
 */
export function MantineSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { resolvedTheme } = useTheme();

  return (
    <MantineProvider
      forceColorScheme={resolvedTheme === "light" ? "light" : "dark"}
      theme={theme}
    >
      {children}
    </MantineProvider>
  );
}
