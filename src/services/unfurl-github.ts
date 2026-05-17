// ---------------------------------------------------------------------------
// GitHub README image extraction (best-effort fallback when no og:image)
// ---------------------------------------------------------------------------

import { USER_AGENT } from "./unfurl-fetch";

const GITHUB_REPO_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/;

// GitHub special paths that are not repositories
const GITHUB_SPECIAL_PATHS = new Set([
  "gist",
  "settings",
  "notifications",
  "explore",
  "topics",
  "trending",
  "collections",
  "sponsors",
  "orgs",
  "features",
]);

const README_FETCH_TIMEOUT_MS = 5000;

/** Resolve a relative README image path to an absolute raw.githubusercontent URL. */
function resolveReadmeImage(
  owner: string,
  repo: string,
  branch: string,
  imageUrl: string,
): string {
  if (imageUrl.startsWith("http")) return imageUrl;
  const stripped = imageUrl.replace(/^\.\//, "");
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${stripped}`;
}

/** Fetch a README file on a specific branch, returning its text or null on failure. */
async function fetchReadme(
  owner: string,
  repo: string,
  branch: string,
): Promise<string | null> {
  try {
    const readmeUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      README_FETCH_TIMEOUT_MS,
    );
    const response = await fetch(readmeUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export async function fetchGitHubReadmeImage(
  url: string,
): Promise<string | null> {
  const match = url.match(GITHUB_REPO_RE);
  if (!match) return null;

  const [, owner, repo] = match;
  if (GITHUB_SPECIAL_PATHS.has(owner)) return null;
  const cleanRepo = repo.replace(/\.git$/, "");

  for (const branch of ["main", "master"]) {
    const text = await fetchReadme(owner, cleanRepo, branch);
    if (!text) continue;

    // Extract first markdown image: ![alt](url)
    const imgMatch = text.match(/!\[[^\]]*\]\(([^)]+)\)/);
    if (!imgMatch?.[1]) continue;

    return resolveReadmeImage(owner, cleanRepo, branch, imgMatch[1]);
  }

  return null;
}
