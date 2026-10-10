import {
  Boxes, CircleHelp, Cloud, Code2, Compass, Container, Database, FileText,
  Globe, GraduationCap, Layers, LayoutDashboard, Lightbulb, Monitor, Palette,
  PenTool, Plug, Presentation, SearchCode, Server, ShieldCheck, Smartphone,
  Video, type LucideIcon,
} from "lucide-react";

import type { Service } from "@/types/service";

// No prototype: a CMS iconKey such as "constructor" must not resolve to an
// Object.prototype member and crash rendering.
const serviceIcons: Record<string, LucideIcon | undefined> = Object.assign(Object.create(null), {
  Boxes, Cloud, Code2, Compass, Container, Database, FileText, Globe,
  GraduationCap, Layers, LayoutDashboard, Lightbulb, Monitor, Palette,
  PenTool, Plug, Presentation, SearchCode, Server, ShieldCheck, Smartphone,
  Video,
});

export default function ServiceGlyph({ service, size = 16, className }: { service: Service; size?: number; className?: string }) {
  const Icon = service.icon ?? serviceIcons[service.iconKey ?? ""] ?? CircleHelp;
  return <Icon size={size} className={className} aria-hidden="true" />;
}
