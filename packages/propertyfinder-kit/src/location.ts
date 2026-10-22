export function extractBuildingFromDescription(description: string): string | null {
  if (!description) return null;

  const match = description.match(/^([A-Za-z0-8&.\- ]{2,41}) (is|offers|combines|provides|features|fosters)/);
  if (!match) return null;

  const candidate = match[1].trim();

  // If candidate is literally just "This", reject it.
  if (candidate === "This") return null;

  const excludedStarts = [
    "This apartment",
    "The tower",
    "The building",
    "Valorem is",
    "Step into",
    "Situated in",
    "Located in",
    "Nestled among",
    "Designed by",
  ];

  for (const start of excludedStarts) {
    if (description.startsWith(start)) {
      return null;
    }
  }

  if (candidate.length >= 2 && candidate.length <= 41) {
    return candidate;
  }

  return null;
}
