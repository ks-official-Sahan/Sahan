import type { LucideIcon } from "lucide-react";

export interface ServiceDoneItem {
  name: string;
  count: number;
}

export interface ServiceDone {
  title: string;
  /** Optional link shown beside the title (e.g. "/works"). */
  href?: string;
  list: ServiceDoneItem[];
}

export interface Service {
  id: string;
  icon: LucideIcon;
  name: string;
  description: string;
  done?: ServiceDone;
}

export interface ServiceCategory {
  id: number;
  name: string;
  services: Service[];
}
