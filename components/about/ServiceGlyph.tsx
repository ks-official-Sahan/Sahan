import Icon, { type IconSpec } from "@/components/icons/Icon";
import type { Service } from "@/types/service";

// No prototype: a CMS iconKey such as "constructor" must not resolve to an
// Object.prototype member and crash rendering.
// Keys are the lucide names the CMS stores; animated where itshover has a match.
const serviceIcons: Record<string, IconSpec | undefined> = Object.assign(Object.create(null), {
  Boxes: { name: "stack-3" },
  Cloud: { name: "cloud-1" },
  Code2: { name: "code-xml" },
  Compass: { lucideIconName: "Compass" },
  Container: { name: "docker" },
  Database: { lucideIconName: "Database" },
  FileText: { name: "file-description" },
  Globe: { name: "globe" },
  GraduationCap: { name: "book" },
  Layers: { name: "layers" },
  LayoutDashboard: { name: "layout-dashboard" },
  Lightbulb: { lucideIconName: "Lightbulb" },
  Monitor: { lucideIconName: "Monitor" },
  Palette: { name: "paint" },
  PenTool: { name: "pen" },
  Plug: { name: "plug-connected" },
  Presentation: { lucideIconName: "Presentation" },
  SearchCode: { name: "code" },
  Server: { name: "cpu" },
  ShieldCheck: { name: "shield-check" },
  Smartphone: { lucideIconName: "Smartphone" },
  Video: { lucideIconName: "Video" },
} satisfies Record<string, IconSpec>);

export default function ServiceGlyph({ service, size = 16, className }: { service: Service; size?: number; className?: string }) {
  if (service.icon) {
    const Legacy = service.icon;
    return <Legacy size={size} className={className} aria-hidden="true" />;
  }
  return <Icon {...(serviceIcons[service.iconKey ?? ""] ?? { name: "question-mark" })} size={size} className={className} />;
}
