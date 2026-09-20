export interface GitHubStats {
  username: string;
  profileUrl: string;
  publicRepos: number | null;
  followers: number | null;
  contributionsLastYear: number | null;
  source: "graphql" | "public" | "unavailable";
}

const GITHUB_USERNAME = "ks-official-sahan";
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Fetches lightweight GitHub stats for the profile card.
 *
 * Prefers GitHub's authenticated GraphQL API (accurate contribution count,
 * including private contributions per the user's own profile visibility
 * setting) when a `GITHUB_TOKEN` env var is configured. Falls back to
 * GitHub's public REST API plus a community-maintained public
 * contributions endpoint (no token required) so this works out of the box
 * with zero configuration. Cached via Next.js fetch revalidation so this
 * behaves like a "near real-time" stat without hitting these APIs on
 * every page request.
 */
export async function getGitHubStats(): Promise<GitHubStats> {
  const profileUrl = `https://github.com/${GITHUB_USERNAME}`;
  const token = process.env.GITHUB_TOKEN;

  if (token) {
    const viaGraphql = await getStatsViaGraphql(token);
    if (viaGraphql) return { ...viaGraphql, profileUrl };
  }

  const viaPublicApi = await getStatsViaPublicApi();
  if (viaPublicApi) return { ...viaPublicApi, profileUrl };

  return {
    username: GITHUB_USERNAME,
    profileUrl,
    publicRepos: null,
    followers: null,
    contributionsLastYear: null,
    source: "unavailable",
  };
}

async function getStatsViaGraphql(
  token: string
): Promise<Omit<GitHubStats, "profileUrl"> | null> {
  const query = `
    query ($login: String!) {
      user(login: $login) {
        repositories(privacy: PUBLIC) { totalCount }
        followers { totalCount }
        contributionsCollection {
          contributionCalendar { totalContributions }
        }
      }
    }
  `;

  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { login: GITHUB_USERNAME } }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const user = json?.data?.user;
    if (!user) return null;

    return {
      username: GITHUB_USERNAME,
      publicRepos: user.repositories?.totalCount ?? null,
      followers: user.followers?.totalCount ?? null,
      contributionsLastYear:
        user.contributionsCollection?.contributionCalendar
          ?.totalContributions ?? null,
      source: "graphql",
    };
  } catch {
    return null;
  }
}

async function getStatsViaPublicApi(): Promise<Omit<
  GitHubStats,
  "profileUrl"
> | null> {
  const [profile, contributions] = await Promise.all([
    fetchJson(`https://api.github.com/users/${GITHUB_USERNAME}`),
    fetchJson(
      `https://github-contributions-api.jogruber.de/v4/${GITHUB_USERNAME}?y=last`
    ),
  ]);

  if (!profile && !contributions) return null;

  const contributionsLastYear = Array.isArray(contributions?.contributions)
    ? contributions.contributions.reduce(
        (sum: number, day: { count: number }) => sum + (day.count ?? 0),
        0
      )
    : null;

  return {
    username: GITHUB_USERNAME,
    publicRepos: profile?.public_repos ?? null,
    followers: profile?.followers ?? null,
    contributionsLastYear,
    source: "public",
  };
}

async function fetchJson(url: string) {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
