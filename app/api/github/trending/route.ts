import { NextRequest, NextResponse } from "next/server";
import { topRepos } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const window = req.nextUrl.searchParams.get("window") === "all-time" ? "all-time" : "trending";
  try {
    return NextResponse.json({ repos: await topRepos(window) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch GitHub repos.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
