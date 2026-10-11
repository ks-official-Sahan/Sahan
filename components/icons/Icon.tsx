"use client";

import {
  Briefcase,
  ImageIcon,
  Inbox,
  Loader2,
  Menu,
  Monitor,
  MonitorSmartphone,
  Newspaper,
  Search,
  Settings,
  Sun,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { LazyMotion, domAnimation, useReducedMotion } from "motion/react";
import { useEffect, useRef, type ComponentType, type RefAttributes } from "react";

import { cn } from "@/lib/utils";

import CheckedIcon from "./animated/checked-icon";
import CopyIcon from "./animated/copy-icon";
import ExternalLinkIcon from "./animated/external-link-icon";
import EyeIcon from "./animated/eye-icon";
import EyeOffIcon from "./animated/eye-off-icon";
import FileDescriptionIcon from "./animated/file-description-icon";
import HistoryCircleIcon from "./animated/history-circle-icon";
import InfoCircleIcon from "./animated/info-circle-icon";
import LayoutDashboardIcon from "./animated/layout-dashboard-icon";
import LinkIcon from "./animated/link-icon";
import LogoutIcon from "./animated/logout-icon";
import MessageCircleIcon from "./animated/message-circle-icon";
import MoonIcon from "./animated/moon-icon";
import PlugConnectedIcon from "./animated/plug-connected-icon";
import RefreshIcon from "./animated/refresh-icon";
import SaveIcon from "./animated/save-icon";
import ShieldCheckIcon from "./animated/shield-check-icon";
import SparklesIcon from "./animated/sparkles-icon";
import TrashIcon from "./animated/trash-icon";
import TriangleAlertIcon from "./animated/triangle-alert-icon";
import type { AnimatedIconHandle, AnimatedIconProps } from "./animated/types";
import UploadIcon from "./animated/upload-icon";
import UserIcon from "./animated/user-icon";
import UsersIcon from "./animated/users-icon";
import XIcon from "./animated/x-icon";

type AnimatedComponent = ComponentType<AnimatedIconProps & RefAttributes<AnimatedIconHandle>>;

// Icons with a hover animation (itshover, 24px round-cap outline, the same
// visual family as lucide). Names follow lucide's, so swapping is a rename.
const ANIMATED = {
  check: CheckedIcon,
  copy: CopyIcon,
  "external-link": ExternalLinkIcon,
  eye: EyeIcon,
  "eye-off": EyeOffIcon,
  "file-text": FileDescriptionIcon,
  history: HistoryCircleIcon,
  info: InfoCircleIcon,
  "layout-dashboard": LayoutDashboardIcon,
  link: LinkIcon,
  "log-out": LogoutIcon,
  "message-circle": MessageCircleIcon,
  moon: MoonIcon,
  plug: PlugConnectedIcon,
  refresh: RefreshIcon,
  save: SaveIcon,
  "shield-check": ShieldCheckIcon,
  sparkles: SparklesIcon,
  trash: TrashIcon,
  "triangle-alert": TriangleAlertIcon,
  upload: UploadIcon,
  user: UserIcon,
  users: UsersIcon,
  x: XIcon,
} satisfies Record<string, AnimatedComponent>;

// Static lucide icons where itshover has no match in the same style.
const STATIC = {
  briefcase: Briefcase,
  image: ImageIcon,
  inbox: Inbox,
  loader: Loader2,
  menu: Menu,
  monitor: Monitor,
  "monitor-smartphone": MonitorSmartphone,
  newspaper: Newspaper,
  search: Search,
  settings: Settings,
  sun: Sun,
  wand: Wand2,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ANIMATED | keyof typeof STATIC;

/** The control whose hover or keyboard focus plays the icon's animation. */
const TRIGGER = "a, button, summary, label, [role='button'], [role='menuitem'], [data-icon-trigger]";

/**
 * One icon for the whole UI. Animated icons play when the surrounding link or
 * button is hovered or keyboard-focused, so the whole control is the target,
 * not the few pixels of the SVG. Reduced motion renders them still. Size comes
 * from `className` (default `size-4`); the SVG fills it.
 */
export default function Icon({ name, className, label }: { name: IconName; className?: string; label?: string }) {
  const wrapper = useRef<HTMLSpanElement>(null);
  const handle = useRef<AnimatedIconHandle>(null);
  const reduced = useReducedMotion();
  const Animated: AnimatedComponent | null = name in ANIMATED ? ANIMATED[name as keyof typeof ANIMATED] : null;
  const Static: LucideIcon | null = Animated ? null : STATIC[name as keyof typeof STATIC];

  useEffect(() => {
    const own = wrapper.current;
    if (!Animated || reduced || !own) return;
    const target = own.parentElement?.closest<HTMLElement>(TRIGGER) ?? own;
    const start = () => handle.current?.startAnimation();
    const stop = () => handle.current?.stopAnimation();
    const focusIn = () => {
      if (target.matches(":focus-visible")) start();
    };
    target.addEventListener("pointerenter", start);
    target.addEventListener("pointerleave", stop);
    target.addEventListener("focusin", focusIn);
    target.addEventListener("focusout", stop);
    return () => {
      target.removeEventListener("pointerenter", start);
      target.removeEventListener("pointerleave", stop);
      target.removeEventListener("focusin", focusIn);
      target.removeEventListener("focusout", stop);
    };
  }, [Animated, reduced]);

  return (
    <span
      ref={wrapper}
      className={cn("inline-flex size-4 shrink-0", className)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {Animated ? (
        <LazyMotion features={domAnimation}>
          <Animated ref={handle} size="100%" />
        </LazyMotion>
      ) : Static ? (
        <Static size="100%" aria-hidden />
      ) : null}
    </span>
  );
}
