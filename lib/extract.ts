/**
 * Fetch a URL and reduce it to readable article text — enough signal for the
 * scriptwriter without pulling in nav, scripts, or boilerplate.
 */
export async function extractArticle(url: string): Promise<{ title: string; content: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SocialVideoFactory/1.0)" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Could not fetch URL (HTTP ${res.status})`);
  const html = await res.text();

  const titleMatch =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = decode(titleMatch?.[1]?.trim() ?? url);

  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // prefer <article> / <main> when present
  const scoped =
    body.match(/<article[\s\S]*?<\/article>/i)?.[0] ||
    body.match(/<main[\s\S]*?<\/main>/i)?.[0] ||
    body;

  const paragraphs = [...scoped.matchAll(/<(p|h1|h2|h3|li)[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((m) => decode(m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()))
    .filter((t) => t.length > 40);

  let content = paragraphs.join("\n\n");
  if (content.length < 300) {
    // fallback: strip all tags
    content = decode(scoped.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  }
  if (content.length < 100) throw new Error("Could not extract readable text from that URL.");
  return { title, content: content.slice(0, 40000) };
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
