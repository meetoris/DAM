import fs from "fs";
import path from "path";
import { Short } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "shorts.json");

function ensure(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, "[]", "utf8");
}

export function listShorts(): Short[] {
  ensure();
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const parsed = JSON.parse(raw) as Short[];
    return parsed.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  } catch {
    return [];
  }
}

export function getShort(id: string): Short | undefined {
  return listShorts().find((s) => s.id === id);
}

export function saveShort(short: Short): Short {
  ensure();
  const all = listShorts().filter((s) => s.id !== short.id);
  short.updatedAt = new Date().toISOString();
  all.push(short);
  fs.writeFileSync(DB_PATH, JSON.stringify(all, null, 2), "utf8");
  return short;
}

export function deleteShort(id: string): void {
  ensure();
  const all = listShorts().filter((s) => s.id !== id);
  fs.writeFileSync(DB_PATH, JSON.stringify(all, null, 2), "utf8");
}

export function newId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}
