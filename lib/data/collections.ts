type Timestamps = "id" | "createdAt" | "updatedAt";
/** Insert shape: no id or timestamps, and columns with a default may be left out. */
type NewOf<Row, Defaulted extends keyof Row> = Omit<Row, Timestamps | Defaulted> & Partial<Pick<Row, Defaulted>>;

/** A table the admin orders by hand. A grouped table is ordered within each group. */
export interface SortedRepo<Row, New> {
  find(id: string): Promise<Row | null>;
  /** One past the highest sortOrder (within `groupId` for a grouped table); 1 when empty. */
  nextSortOrder(groupId?: string): Promise<number>;
  create(input: New): Promise<Row>;
  update(id: string, changes: Partial<New>): Promise<Row>;
  delete(id: string): Promise<void>;
  /** Swaps sortOrder with the nearest row above or below (in the same group); no change at either end. */
  move(row: { id: string; sortOrder: number; groupId?: string }, direction: "up" | "down"): Promise<void>;
}

export interface ProjectRecord {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  role: string;
  organization: string | null;
  organizationUrl: string | null;
  category: string;
  status: string;
  platforms: string[];
  tech: string[];
  /** { kind, url, label? }[]. The first entry is the primary action. */
  links: unknown;
  /** { src, alt, fit?, background?, position?, mediaId? } or null. Writing null clears it. */
  image: unknown;
  year: string;
  featured: boolean;
  sortOrder: number;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export type NewProject = NewOf<ProjectRecord, "organization" | "organizationUrl" | "platforms" | "tech" | "links" | "image" | "featured" | "sortOrder" | "published">;

export interface ProjectRepo extends SortedRepo<ProjectRecord, NewProject> {
  findBySlug(slug: string): Promise<ProjectRecord | null>;
  /** Published projects in display order. */
  listPublished(): Promise<ProjectRecord[]>;
  listForAdmin(): Promise<Array<Pick<ProjectRecord, "id" | "title" | "category" | "status" | "published" | "featured" | "sortOrder">>>;
  count(): Promise<number>;
  createMany(input: NewProject[]): Promise<void>;
}

export interface ExperienceRecord {
  id: string;
  company: string;
  companyUrl: string | null;
  role: string;
  period: string;
  type: string;
  location: string | null;
  highlights: string[];
  current: boolean;
  sortOrder: number;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export type NewExperience = NewOf<ExperienceRecord, "companyUrl" | "location" | "highlights" | "current" | "sortOrder" | "published">;

export interface ExperienceRepo extends SortedRepo<ExperienceRecord, NewExperience> {
  /** Published entries in display order. */
  listPublished(): Promise<ExperienceRecord[]>;
  listForAdmin(): Promise<Array<Pick<ExperienceRecord, "id" | "company" | "role" | "period" | "type" | "published" | "sortOrder">>>;
  count(): Promise<number>;
  createMany(input: NewExperience[]): Promise<void>;
}

export interface ServiceGroupRecord {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
export type NewServiceGroup = NewOf<ServiceGroupRecord, "sortOrder">;

export interface ServiceRecord {
  id: string;
  /** Stable short key such as WEB or BCK. */
  key: string;
  groupId: string;
  iconKey: string;
  name: string;
  description: string;
  /** { title, href?, list: { name, metric }[] } or null. */
  done: unknown;
  sortOrder: number;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export type NewService = NewOf<ServiceRecord, "done" | "sortOrder" | "published">;

export interface ServiceGroupRepo extends SortedRepo<ServiceGroupRecord, NewServiceGroup> {
  /** The group with its services in display order. */
  findWithServices(id: string): Promise<(ServiceGroupRecord & { services: ServiceRecord[] }) | null>;
  listForAdmin(): Promise<Array<{ id: string; name: string; services: Array<{ published: boolean }> }>>;
}

export interface SkillGroupRecord {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
export type NewSkillGroup = NewOf<SkillGroupRecord, "sortOrder">;

export interface SkillRecord {
  id: string;
  groupId: string;
  name: string;
  abbr: string;
  type: string;
  iconKey: string;
  /** "fill" or "stroke". */
  variant: string;
  colorLight: string;
  colorDark: string;
  /** { colors: [r, g, b], bgLight, bgDark } for the About grid, or null. */
  grid: unknown;
  gridOrder: number | null;
  sortOrder: number;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export type NewSkill = NewOf<SkillRecord, "variant" | "grid" | "gridOrder" | "sortOrder" | "published">;

export interface SkillGroupRepo extends SortedRepo<SkillGroupRecord, NewSkillGroup> {
  /** The group with its skills in display order. */
  findWithSkills(id: string): Promise<(SkillGroupRecord & { skills: SkillRecord[] }) | null>;
  listForAdmin(): Promise<Array<{ id: string; key: string; label: string; skills: Array<{ published: boolean }> }>>;
}

export type ServiceRepo = SortedRepo<ServiceRecord, NewService>;
export type SkillRepo = SortedRepo<SkillRecord, NewSkill>;
