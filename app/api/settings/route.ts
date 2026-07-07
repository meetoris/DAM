import { NextRequest, NextResponse } from "next/server";
import { SETTING_KEYS, StoredSettings, readSettings, writeSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET returns per-field status only — never raw secrets. A stored secret is
 * reported as {set: true, hint: "…last4"} so the admin can tell what's live.
 */
export async function GET() {
  const stored = readSettings();
  const fields = SETTING_KEYS.map(({ key, env, label, group, secret }) => {
    const storedVal = stored[key];
    const envVal = process.env[env];
    const value = storedVal || envVal || "";
    return {
      key,
      label,
      group,
      secret,
      set: Boolean(value),
      source: storedVal ? "settings" : envVal ? "env" : null,
      hint: value ? (secret ? `…${value.slice(-4)}` : value) : "",
    };
  });
  return NextResponse.json({ fields });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Partial<StoredSettings> = {};
  for (const { key } of SETTING_KEYS) {
    const v = body[key];
    if (typeof v === "string") patch[key] = v.trim();
  }
  writeSettings(patch);
  return NextResponse.json({ ok: true });
}
