import fs from "fs";
import path from "path";

/**
 * Admin-managed integration credentials, editable from Settings → Integrations.
 * Stored in data/settings.json (gitignored). A value saved in the UI takes
 * precedence over the corresponding environment variable, so an admin can fix
 * or rotate keys without redeploying; env vars remain the fallback.
 */
export interface StoredSettings {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  pexelsApiKey?: string;
  instagramAccessToken?: string;
  instagramUserId?: string;
  youtubeApiKey?: string;
  youtubeChannelId?: string;
}

export const SETTING_KEYS: { key: keyof StoredSettings; env: string; label: string; group: string; secret: boolean }[] = [
  { key: "anthropicApiKey", env: "ANTHROPIC_API_KEY", label: "Anthropic API key", group: "AI models", secret: true },
  { key: "openaiApiKey", env: "OPENAI_API_KEY", label: "OpenAI API key", group: "AI models", secret: true },
  { key: "openaiModel", env: "OPENAI_MODEL", label: "OpenAI model id", group: "AI models", secret: false },
  { key: "pexelsApiKey", env: "PEXELS_API_KEY", label: "Pexels API key (B-roll clips)", group: "B-roll", secret: true },
  { key: "instagramAccessToken", env: "INSTAGRAM_ACCESS_TOKEN", label: "Instagram access token", group: "Performance loop", secret: true },
  { key: "instagramUserId", env: "INSTAGRAM_USER_ID", label: "Instagram user id", group: "Performance loop", secret: false },
  { key: "youtubeApiKey", env: "YOUTUBE_API_KEY", label: "YouTube Data API key", group: "Performance loop", secret: true },
  { key: "youtubeChannelId", env: "YOUTUBE_CHANNEL_ID", label: "YouTube channel id", group: "Performance loop", secret: false },
];

const FILE = path.join(process.cwd(), "data", "settings.json");

export function readSettings(): StoredSettings {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as StoredSettings;
  } catch {
    return {};
  }
}

export function writeSettings(patch: Partial<StoredSettings>): StoredSettings {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const current = readSettings();
  for (const [k, v] of Object.entries(patch)) {
    if (typeof v !== "string") continue;
    if (v === "") delete current[k as keyof StoredSettings];
    else current[k as keyof StoredSettings] = v;
  }
  fs.writeFileSync(FILE, JSON.stringify(current, null, 2), { encoding: "utf8", mode: 0o600 });
  return current;
}

/** Resolve one credential: UI-saved value first, env var fallback. */
export function cred(key: keyof StoredSettings): string | undefined {
  const stored = readSettings()[key];
  if (stored) return stored;
  const env = SETTING_KEYS.find((s) => s.key === key)?.env;
  return env ? process.env[env] || undefined : undefined;
}
