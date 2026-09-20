export type EmploymentType =
  | "full-time"
  | "contract"
  | "part-time"
  | "internship"
  | "freelance";

export interface ExperienceEntry {
  company: string;
  companyUrl?: string;
  role: string;
  period: string;
  type: EmploymentType;
  location?: string;
  highlights: string[];
  current?: boolean;
}
