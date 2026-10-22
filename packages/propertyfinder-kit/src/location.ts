const DEFAULT_EXCLUDED_STARTS = [
  "This apartment",
  "The tower",
  "The building",
  "Step into",
  "Situated in",
  "Located in",
  "Nestled among",
  "Designed by",
];

/**
 * A building name from a description's opening ("Marina 29 offers ...").
 * `excludedStarts` adds openings that are never a building, such as the
 * agency's own name ("Acme is ...").
 */
export function extractBuildingFromDescription(description: string, excludedStarts: readonly string[] = []): string | null {
  if (!description) return null;

  const match = description.match(/^([A-Za-z0-9&.\- ]{2,41}) (is|offers|combines|provides|features|fosters)/);
  if (!match) return null;

  const candidate = match[1].trim();

  // If candidate is literally just "This", reject it.
  if (candidate === "This") return null;

  for (const start of [...DEFAULT_EXCLUDED_STARTS, ...excludedStarts]) {
    if (description.startsWith(start)) {
      return null;
    }
  }

  if (candidate.length >= 2 && candidate.length <= 41) {
    return candidate;
  }

  return null;
}
