import { Script } from "./types";

/**
 * Caption cue generation, adapted from the pattern used by popular
 * open-source auto-shorts / auto-subtitle tools (e.g. ShortGPT,
 * MoneyPrinterTurbo, captacity, auto-subtitle): burn-in captions read best as
 * short 3-7 word chunks synced to speech, not whole sentences dumped as one
 * cue. We don't render/burn video ourselves (this is a planning tool, not a
 * renderer), so instead we export standard .srt/.vtt files pre-chunked the
 * same way, ready to drop into CapCut/Premiere/Descript when editing.
 */

const MAX_WORDS_PER_CUE = 6;
const MIN_CUE_SECONDS = 0.9;

interface Cue {
  startSec: number;
  endSec: number;
  text: string;
}

export function scriptToCues(script: Script): Cue[] {
  const cues: Cue[] = [];
  for (const section of script.sections) {
    const words = section.text.split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    const duration = Math.max(section.endSec - section.startSec, MIN_CUE_SECONDS);
    const secPerWord = duration / words.length;

    for (let i = 0; i < words.length; i += MAX_WORDS_PER_CUE) {
      const chunk = words.slice(i, i + MAX_WORDS_PER_CUE);
      const startOffset = i * secPerWord;
      const endOffset = Math.min((i + chunk.length) * secPerWord, duration);
      const start = section.startSec + startOffset;
      const end = Math.max(section.startSec + endOffset, start + MIN_CUE_SECONDS * 0.5);
      cues.push({ startSec: start, endSec: end, text: chunk.join(" ") });
    }
  }
  return cues;
}

export function scriptToSrt(script: Script): string {
  const cues = scriptToCues(script);
  return cues
    .map((c, i) => `${i + 1}\n${srtTime(c.startSec)} --> ${srtTime(c.endSec)}\n${c.text}\n`)
    .join("\n");
}

export function scriptToVtt(script: Script): string {
  const cues = scriptToCues(script);
  return (
    "WEBVTT\n\n" +
    cues.map((c) => `${vttTime(c.startSec)} --> ${vttTime(c.endSec)}\n${c.text}\n`).join("\n")
  );
}

function srtTime(sec: number): string {
  return formatTime(sec, ",");
}
function vttTime(sec: number): string {
  return formatTime(sec, ".");
}
function formatTime(sec: number, msSep: string): string {
  const totalMs = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}${msSep}${pad(ms, 3)}`;
}
