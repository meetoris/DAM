/**
 * GitHub as a content source: find the hottest repos (max stars) and turn the
 * winner's README into script source material — the "this repo is blowing up"
 * genre of short, generated automatically.
 */

export interface TrendingRepo {
  fullName: string;
  description: string;
  stars: number;
  language: string | null;
  url: string;
  createdAt: string;
}

const GH_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "SocialVideoFactory/1.0",
  "X-GitHub-Api-Version": "2022-11-28",
};

/**
 * Top repos by stars. window="trending" = created in the last 30 days
 * (what's blowing up right now); window="all-time" = max stars overall.
 */
export async function topRepos(window: "trending" | "all-time", limit = 10): Promise<TrendingRepo[]> {
  const q =
    window === "trending"
      ? `created:>${new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)} stars:>50`
      : "stars:>10000";
  const res = await fetch(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${limit}`,
    { headers: GH_HEADERS }
  );
  if (!res.ok) throw new Error(`GitHub API error (HTTP ${res.status}) — try again in a minute (unauthenticated rate limit is 10 searches/min).`);
  const data = (await res.json()) as { items?: any[] };
  return (data.items ?? []).map((r) => ({
    fullName: r.full_name,
    description: r.description ?? "",
    stars: r.stargazers_count ?? 0,
    language: r.language ?? null,
    url: r.html_url,
    createdAt: r.created_at ?? "",
  }));
}

/** Fetch a repo's metadata + README as script source material. */
export async function repoSource(fullName: string): Promise<{ title: string; url: string; content: string }> {
  const clean = fullName.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\/+$/, "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(clean)) throw new Error(`"${fullName}" is not a valid owner/repo.`);

  const metaRes = await fetch(`https://api.github.com/repos/${clean}`, { headers: GH_HEADERS });
  if (!metaRes.ok) throw new Error(`Could not fetch repo ${clean} (HTTP ${metaRes.status}).`);
  const meta = (await metaRes.json()) as {
    full_name: string;
    description?: string;
    stargazers_count?: number;
    language?: string;
    html_url: string;
    topics?: string[];
  };

  let readme = "";
  const readmeRes = await fetch(`https://api.github.com/repos/${clean}/readme`, {
    headers: { ...GH_HEADERS, Accept: "application/vnd.github.raw+json" },
  });
  if (readmeRes.ok) readme = await readmeRes.text();

  const content = [
    `GitHub repository: ${meta.full_name}`,
    `Stars: ${meta.stargazers_count ?? "?"} · Language: ${meta.language ?? "?"} · Topics: ${(meta.topics ?? []).join(", ") || "—"}`,
    `Description: ${meta.description ?? "—"}`,
    "",
    "README:",
    stripMarkdown(readme).slice(0, 30000),
  ].join("\n");

  return { title: meta.full_name, url: meta.html_url, content };
}

/** Light cleanup so the scriptwriter sees prose, not markup noise. */
function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " [code example] ")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/[*_`>|]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
