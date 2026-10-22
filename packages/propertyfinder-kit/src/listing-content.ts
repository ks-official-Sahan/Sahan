/**
 * Normalizes Property Finder listing copy — paragraphs, amenities, connectivity,
 * and payment highlights aligned with PF portal structure.
 */

const HTML_BREAK = /<br\s*\/?>/gi;
const HTML_PARA = /<\/p>\s*<p[^>]*>/gi;
const HTML_TAGS = /<[^>]+>/g;

const AMENITIES_HEADING =
  /^(?:amenities|features|facilities|property\s+features)\s*:?\s*$/i;

const CONNECTIVITY_HEADING = /^connectivity\b/i;

const GROUP_HEADING_ONLY = /^([A-Za-z][\w\s&'-]{1,55}):\s*$/;

const PAYMENT_HIGHLIGHT =
  /^(?:installment\s+payable|payable\s+\d+%|payment\s+plan)/i;

const SUBTITLE_LINE = /\bfor\s+(?:sale|rent)\s+in\b/i;

const MINUTES_IN_LINE = /\d+\s*[-–]\s*\d+\s*minutes?/i;

const BULLET_LINE =
  /^[\s]*(?:[-•*●▪◦–—]|\d+[.)])\s+(.+)$/;

const LIST_ITEM_SPLIT = /\s*[,;|•●▪◦]\s*/;

export interface ConnectivityItem {
  place: string;
  duration: string;
}

export interface ConnectivityGroup {
  heading: string;
  items: ConnectivityItem[];
}

export type DescriptionBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "payment"; text: string }
  | { kind: "amenities_heading" }
  | { kind: "amenity"; text: string }
  | { kind: "connectivity_intro"; text: string }
  | { kind: "connectivity_group"; heading: string; items: ConnectivityItem[] };

export interface ParsedListingContent {
  /** e.g. "Apartment for sale in Empire Gardens, …" */
  subtitle?: string;
  /** Marketing / narrative paragraphs (preview + SEO body) */
  introParagraphs: string[];
  paymentHighlights: string[];
  amenities: string[];
  connectivityIntro?: string;
  connectivityGroups: ConnectivityGroup[];
  /** Ordered blocks for the full-description modal */
  fullDescriptionBlocks: DescriptionBlock[];
}

/** Strip HTML and normalize line endings / spaces. */
export function stripListingHtml(raw: string): string {
  return raw
    .replace(HTML_BREAK, "\n")
    .replace(HTML_PARA, "\n\n")
    .replace(HTML_TAGS, "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/ {2,}/g, " ")
    .trim();
}

const SMALL_WORDS = new Set(["a", "an", "and", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"]);
const UPPER_WORDS = new Map([["a/c", "A/C"], ["ac", "A/C"], ["bhk", "BHK"], ["bbq", "BBQ"], ["tv", "TV"], ["wifi", "WiFi"]]);

/** Title case for amenity labels: small joining words stay lower case (never the first). */
function titleCaseAmenity(label: string): string {
  const cleaned = label.trim();
  if (!cleaned) return "";
  return cleaned
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLowerCase();
      const fixed = UPPER_WORDS.get(lower);
      if (fixed) return fixed;
      if (index > 0 && SMALL_WORDS.has(lower)) return lower;
      // Hyphenated words keep the hyphen: "built-in" -> "Built-in".
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function dedupeLabels(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const label = titleCaseAmenity(item);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out.sort((a, b) => a.localeCompare(b, "en"));
}

function isLikelyAmenityLine(line: string): boolean {
  if (!line || line.length > 80) return false;
  if (MINUTES_IN_LINE.test(line)) return false;
  if (CONNECTIVITY_HEADING.test(line)) return false;
  if (GROUP_HEADING_ONLY.test(line)) return false;
  if (PAYMENT_HIGHLIGHT.test(line)) return false;
  if (AMENITIES_HEADING.test(line)) return false;
  return true;
}

/** Split "Business Bay: 25-30 minutes DIFC: 30-35 minutes" into items */
export function parseDestinationLine(line: string): ConnectivityItem[] {
  const items: ConnectivityItem[] = [];
  const re = /([A-Za-z0-9][^:]{1,52}?):\s*(\d[\d\s–-]*minutes?)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) {
    items.push({
      place: match[1].trim(),
      duration: match[2].trim(),
    });
  }
  if (items.length === 0 && line.includes(":")) {
    const idx = line.indexOf(":");
    const place = line.slice(0, idx).trim();
    const duration = line.slice(idx + 1).trim();
    if (place && duration) items.push({ place, duration });
  }
  return items;
}

type ParseMode = "intro" | "payment" | "amenities" | "connectivity";

/**
 * Full PF-style parse: subtitle, body, payments, amenities, connectivity groups.
 */
export function parseListingContent(raw: string): ParsedListingContent {
  const text = stripListingHtml(raw);
  const empty: ParsedListingContent = {
    introParagraphs: [],
    paymentHighlights: [],
    amenities: [],
    connectivityGroups: [],
    fullDescriptionBlocks: [],
  };
  if (!text) return empty;

  const lines = text.split("\n").map((l) => l.trim());
  let mode: ParseMode = "intro";
  let subtitle: string | undefined;
  let connectivityIntro: string | undefined;
  let currentGroup: ConnectivityGroup | null = null;
  let introBuffer: string[] = [];
  const introParagraphs: string[] = [];
  const paymentHighlights: string[] = [];
  const amenities: string[] = [];
  const connectivityGroups: ConnectivityGroup[] = [];
  const fullDescriptionBlocks: DescriptionBlock[] = [];
  let subtitleConsumed = false;

  const flushIntro = () => {
    const block = introBuffer.join(" ").replace(/\s+/g, " ").trim();
    introBuffer = [];
    if (!block) return;
    introParagraphs.push(block);
    fullDescriptionBlocks.push({ kind: "paragraph", text: block });
  };

  const pushGroup = (group: ConnectivityGroup | null) => {
    if (!group || group.items.length === 0) return;
    connectivityGroups.push(group);
    fullDescriptionBlocks.push({
      kind: "connectivity_group",
      heading: group.heading,
      items: group.items,
    });
  };

  const startConnectivity = (introLine?: string) => {
    mode = "connectivity";
    if (introLine && !connectivityIntro) {
      connectivityIntro = introLine;
      fullDescriptionBlocks.push({ kind: "connectivity_intro", text: introLine });
    }
    currentGroup = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      if (mode === "intro" && introBuffer.length) flushIntro();
      continue;
    }

    if (!subtitleConsumed && SUBTITLE_LINE.test(line)) {
      subtitle = line;
      subtitleConsumed = true;
      continue;
    }

    if (AMENITIES_HEADING.test(line)) {
      if (mode === "intro" && introBuffer.length) flushIntro();
      mode = "amenities";
      fullDescriptionBlocks.push({ kind: "amenities_heading" });
      continue;
    }

    if (CONNECTIVITY_HEADING.test(line)) {
      if (mode === "intro" && introBuffer.length) flushIntro();
      if (mode === "amenities") mode = "connectivity";
      pushGroup(currentGroup);
      startConnectivity(line);
      continue;
    }

    if (PAYMENT_HIGHLIGHT.test(line) && mode !== "amenities" && mode !== "connectivity") {
      if (mode === "intro" && introBuffer.length) flushIntro();
      mode = "payment";
      paymentHighlights.push(line);
      fullDescriptionBlocks.push({ kind: "payment", text: line });
      continue;
    }

    if (mode === "payment" && PAYMENT_HIGHLIGHT.test(line)) {
      paymentHighlights.push(line);
      fullDescriptionBlocks.push({ kind: "payment", text: line });
      continue;
    }

    if (mode === "payment" && !PAYMENT_HIGHLIGHT.test(line)) {
      mode = "intro";
      introBuffer.push(line);
      continue;
    }

    if (mode === "connectivity") {
      const groupMatch = line.match(GROUP_HEADING_ONLY);
      if (groupMatch && !MINUTES_IN_LINE.test(line)) {
        pushGroup(currentGroup);
        currentGroup = { heading: groupMatch[1].trim(), items: [] };
        continue;
      }

      const destinations = parseDestinationLine(line);
      if (destinations.length > 0) {
        if (!currentGroup) {
          currentGroup = { heading: "Nearby", items: [] };
        }
        currentGroup.items.push(...destinations);
        continue;
      }

      if (isLikelyAmenityLine(line)) continue;
      continue;
    }

    if (mode === "amenities") {
      if (CONNECTIVITY_HEADING.test(line) || GROUP_HEADING_ONLY.test(line)) {
        pushGroup(currentGroup);
        if (CONNECTIVITY_HEADING.test(line)) {
          startConnectivity(line);
        } else {
          startConnectivity();
          currentGroup = {
            heading: line.replace(/:\s*$/, "").trim(),
            items: [],
          };
        }
        continue;
      }

      const bullet = line.match(BULLET_LINE);
      const label = bullet ? bullet[1].trim() : line;
      if (isLikelyAmenityLine(label)) {
        const amenity = titleCaseAmenity(label);
        if (amenity) {
          amenities.push(amenity);
          fullDescriptionBlocks.push({ kind: "amenity", text: amenity });
        }
      }
      continue;
    }

    const bullet = line.match(BULLET_LINE);
    if (bullet && isLikelyAmenityLine(bullet[1])) {
      mode = "amenities";
      fullDescriptionBlocks.push({ kind: "amenities_heading" });
      const amenity = titleCaseAmenity(bullet[1].trim());
      if (amenity) {
        amenities.push(amenity);
        fullDescriptionBlocks.push({ kind: "amenity", text: amenity });
      }
      continue;
    }

    if (mode === "intro") {
      introBuffer.push(line);
    }
  }

  if (introBuffer.length) flushIntro();
  pushGroup(currentGroup);

  return {
    subtitle,
    introParagraphs,
    paymentHighlights,
    amenities: dedupeLabels(amenities),
    connectivityIntro,
    connectivityGroups,
    fullDescriptionBlocks,
  };
}

/** @deprecated Use parseListingContent — kept for callers expecting paragraphs only */
export interface ParsedListingDescription {
  paragraphs: string[];
  extractedAmenities: string[];
}

export function parseListingDescription(raw: string): ParsedListingDescription {
  const parsed = parseListingContent(raw);
  return {
    paragraphs: parsed.introParagraphs,
    extractedAmenities: parsed.amenities,
  };
}

export function normalizeAmenityList(
  fromApi: string[],
  fromDescription: string[] = [],
): string[] {
  return dedupeLabels([...fromApi, ...fromDescription]);
}

export function parseDelimitedList(value?: string | null): string[] {
  if (!value?.trim()) return [];
  const trimmed = value.trim();
  const parts = trimmed.includes("\n")
    ? trimmed.split("\n").map((s) => s.trim()).filter(Boolean)
    : trimmed.split(LIST_ITEM_SPLIT).map((s) => s.trim()).filter(Boolean);
  return dedupeLabels(parts.length >= 2 ? parts : [trimmed]);
}

export function descriptionPlainText(paragraphs: string[]): string {
  return paragraphs.join("\n\n").trim();
}

/** Flatten connectivity groups into legacy Record for JSON-LD / fallbacks */
export function connectivityGroupsToRecord(
  groups: ConnectivityGroup[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const group of groups) {
    for (const item of group.items) {
      const key = `${group.heading} — ${item.place}`;
      out[key] = item.duration;
    }
  }
  return out;
}
