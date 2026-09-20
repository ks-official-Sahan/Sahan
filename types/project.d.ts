export type ProjectPlatform = "android" | "ios" | "web" | "web-admin";

export type ProjectCategory =
  | "product"
  | "freelance"
  | "contract"
  | "internal";

export interface Project {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  role: string;
  organization?: string;
  organizationUrl?: string;
  category: ProjectCategory;
  platforms?: ProjectPlatform[];
  tech?: string[];
  url?: string;
  image?: string;
  year: string;
  featured?: boolean;
  private?: boolean;
}
