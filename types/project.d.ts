export type ProjectPlatform = "android" | "ios" | "web" | "web-admin";

export type ProjectCategory =
  | "product"
  | "freelance"
  | "contract"
  | "internship"
  | "internal";

// Where the project stands today, so a visitor is never sent to a dead end.
export type ProjectStatus =
  | "live"
  | "demo"
  | "upcoming"
  | "unpublished"
  | "offline"
  | "private";

export type ProjectLinkKind =
  | "website"
  | "webapp"
  | "playstore"
  | "appstore"
  | "demo"
  | "casestudy"
  | "facebook";

export interface ProjectLink {
  kind: ProjectLinkKind;
  url: string;
  /** Overrides the default label for the kind, e.g. "Developer page". */
  label?: string;
}

export interface ProjectImage {
  /** Local path under /public. Remote images are copied in, never hot-linked. */
  src: string;
  alt: string;
  /** "contain" for phone mockups that must not be cropped. Default "cover". */
  fit?: "cover" | "contain";
  /** Backdrop behind a "contain" image, matched to the image's own background. */
  background?: string;
  /** CSS object-position for "cover", to keep the useful part in frame. */
  position?: string;
}

export interface Project {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  role: string;
  organization?: string;
  organizationUrl?: string;
  category: ProjectCategory;
  status: ProjectStatus;
  platforms?: ProjectPlatform[];
  tech?: string[];
  /** First entry is the primary "visit" action. */
  links?: ProjectLink[];
  image?: ProjectImage;
  year: string;
  featured?: boolean;
}
