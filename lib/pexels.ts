import { BrollClip } from "./types";

interface PexelsVideoFile {
  quality: string;
  width: number;
  link: string;
}
interface PexelsVideo {
  id: number;
  duration: number;
  image: string;
  user: { name: string };
  video_files: PexelsVideoFile[];
}

/**
 * Find a stock clip for a scene. With PEXELS_API_KEY set, returns a real
 * downloadable clip; otherwise returns a search link the creator can open.
 */
export async function findClip(query: string): Promise<BrollClip> {
  const key = process.env.PEXELS_API_KEY;
  const searchUrl = `https://www.pexels.com/search/videos/${encodeURIComponent(query)}/`;
  if (!key) return { provider: "search-link", searchUrl };

  try {
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=3&orientation=portrait`,
      { headers: { Authorization: key } }
    );
    if (!res.ok) return { provider: "search-link", searchUrl };
    const data = (await res.json()) as { videos?: PexelsVideo[] };
    const video = data.videos?.[0];
    if (!video) return { provider: "search-link", searchUrl };

    // prefer a small/medium file so downloads stay manageable
    const files = [...video.video_files].sort((a, b) => a.width - b.width);
    const file = files.find((f) => f.width >= 540) ?? files[files.length - 1];
    return {
      provider: "pexels",
      videoUrl: `https://www.pexels.com/video/${video.id}/`,
      downloadUrl: file?.link,
      thumbnailUrl: video.image,
      durationSec: video.duration,
      credit: `Pexels / ${video.user.name}`,
    };
  } catch {
    return { provider: "search-link", searchUrl };
  }
}
