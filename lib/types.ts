export type ModelId =
  | "claude-fable-5"
  | "claude-opus-4-8"
  | "claude-sonnet-5"
  | "claude-haiku-4-5"
  | "gpt-5.5";

export interface ModelOption {
  id: ModelId;
  label: string;
  provider: "anthropic" | "openai";
  blurb: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  { id: "claude-fable-5", label: "Claude Fable 5", provider: "anthropic", blurb: "Anthropic's most capable model — best hooks and structure" },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", provider: "anthropic", blurb: "Top-tier quality, great default" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", provider: "anthropic", blurb: "Fast and near-Opus quality" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "anthropic", blurb: "Fastest, cheapest drafts" },
  { id: "gpt-5.5", label: "GPT-5.5", provider: "openai", blurb: "OpenAI's writer, for comparison" },
];

export type SourceType = "url" | "text" | "file";

export interface ScriptSection {
  /** e.g. "Hook", "Context", "Value", "Payoff", "CTA" */
  name: string;
  /** seconds into the video this section starts */
  startSec: number;
  endSec: number;
  text: string;
  /** delivery note for the creator, e.g. "punchy, direct to camera" */
  direction: string;
}

export interface Script {
  title: string;
  hook: string;
  sections: ScriptSection[];
  cta: string;
  estimatedSeconds: number;
  wordCount: number;
  /** the formula/structure explanation shown in the "Formula" tab */
  formula: string;
  /** which model wrote this version */
  model: ModelId;
  generatedAt: string;
  /** free-form notes about what changed vs the previous version */
  revisionNote?: string;
}

export type FactVerdict = "accurate" | "questionable" | "inaccurate" | "unverifiable";

export interface FactCheckClaim {
  claim: string;
  verdict: FactVerdict;
  explanation: string;
  suggestion?: string;
}

export interface FactCheckResult {
  checkedAt: string;
  model: ModelId;
  usedWebSearch: boolean;
  overall: "pass" | "needs_review";
  claims: FactCheckClaim[];
}

export interface BrollClip {
  provider: "pexels" | "search-link";
  videoUrl?: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
  searchUrl?: string;
  durationSec?: number;
  credit?: string;
}

export interface BrollScene {
  /** seconds into the video the clip should be placed */
  startSec: number;
  endSec: number;
  /** what the viewer should see */
  description: string;
  /** stock-footage search query */
  searchQuery: string;
  /** why it belongs at this moment */
  placementNote: string;
  clip?: BrollClip;
}

export interface BrollPlan {
  generatedAt: string;
  scenes: BrollScene[];
}

export interface Short {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  status: "draft" | "scripted" | "ready";
  source: {
    type: SourceType;
    url?: string;
    fileName?: string;
    /** the raw material the script is based on */
    content: string;
  };
  angle: string;
  targetSeconds: number;
  model: ModelId;
  /** newest last — full revision history */
  scripts: Script[];
  factCheck?: FactCheckResult;
  broll?: BrollPlan;
  /** insights snapshot that was fed into generation */
  insightsUsed?: string;
}

export interface VideoStat {
  platform: "instagram" | "youtube";
  id: string;
  title: string;
  publishedAt: string;
  views: number;
  likes: number;
  comments: number;
  shares?: number;
  /** average % of the video watched, when available */
  retentionPct?: number;
  durationSec: number;
  hook?: string;
  topic?: string;
}

export interface PerformanceInsights {
  generatedAt: string;
  usingSampleData: boolean;
  videos: VideoStat[];
  /** derived, human-readable takeaways — also fed into the script prompt */
  takeaways: string[];
  /** condensed string injected into generation prompts */
  promptSummary: string;
}
