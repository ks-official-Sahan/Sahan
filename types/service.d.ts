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
  /** Icon name (a lucide name, mapped to an animated icon in ServiceGlyph). */
  iconKey?: string;
  name: string;
  description: string;
  done?: ServiceDone;
}

export interface ServiceCategory {
  id: string | number;
  name: string;
  services: Service[];
}
