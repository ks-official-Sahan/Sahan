import {
  Boxes, CircleHelp, Cloud, Code2, Compass, Container, Database, FileText,
  Globe, GraduationCap, Layers, LayoutDashboard, Lightbulb, Monitor, Palette,
  PenTool, Plug, Presentation, SearchCode, Server, ShieldCheck, Smartphone,
  Video, type LucideIcon,
} from "lucide-react";

import type { Service } from "@/types/service";

const serviceIcons: Record<string, LucideIcon> = {
  Boxes, Cloud, Code2, Compass, Container, Database, FileText, Globe,
  GraduationCap, Layers, LayoutDashboard, Lightbulb, Monitor, Palette,
  PenTool, Plug, Presentation, SearchCode, Server, ShieldCheck, Smartphone,
  Video,
};

export default function ServiceGlyph({ service, size = 16, className }: { service: Service; size?: number; className?: string }) {
  const Icon = service.icon ?? serviceIcons[service.iconKey ?? ""] ?? CircleHelp;
  return <Icon size={size} className={className} aria-hidden="true" />;
}
