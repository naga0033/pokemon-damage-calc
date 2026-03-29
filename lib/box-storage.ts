import type { PokemonState } from "./types";

export interface BoxEntry {
  id: string;
  name: string;
  state: PokemonState;
  moves?: string[];   // 技1-4 スラッグ（空文字 = なし）
  createdAt: number;
}

const KEY = "pokemon-dmg-box-v1";

export function loadBox(): BoxEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveToBox(name: string, state: PokemonState, moves?: string[]): BoxEntry[] {
  const entries = loadBox();
  const entry: BoxEntry = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name, state, moves, createdAt: Date.now() };
  const next = [entry, ...entries];
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function deleteFromBox(id: string): BoxEntry[] {
  const next = loadBox().filter((e) => e.id !== id);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function updateBox(id: string, name: string, state: PokemonState, moves?: string[]): BoxEntry[] {
  const entries = loadBox();
  const next = entries.map((e) => e.id === id ? { ...e, name, state, moves } : e);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

/* ── バトルチーム ── */

export interface BattleTeam {
  id: string;
  name: string;
  memberIds: string[];  // BoxEntry IDs (max 6)
  createdAt: number;
}

const TEAM_KEY = "pokemon-dmg-teams-v1";

export function loadTeams(): BattleTeam[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(TEAM_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveTeams(teams: BattleTeam[]) {
  localStorage.setItem(TEAM_KEY, JSON.stringify(teams));
}

export function createTeam(name: string): BattleTeam[] {
  const teams = loadTeams();
  const team: BattleTeam = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    memberIds: [],
    createdAt: Date.now(),
  };
  const next = [...teams, team];
  saveTeams(next);
  return next;
}

export function updateTeam(id: string, patch: Partial<Pick<BattleTeam, "name" | "memberIds">>): BattleTeam[] {
  const teams = loadTeams();
  const next = teams.map((t) => t.id === id ? { ...t, ...patch } : t);
  saveTeams(next);
  return next;
}

export function deleteTeam(id: string): BattleTeam[] {
  const next = loadTeams().filter((t) => t.id !== id);
  saveTeams(next);
  return next;
}

/* ── データ共有（URL エクスポート/インポート） ── */

/** ボックスデータをURL共有用の文字列にエンコード */
export function exportBoxToShareString(entries: BoxEntry[]): string {
  const json = JSON.stringify(entries);
  // TextEncoder → バイナリ → base64url
  const bytes = new TextEncoder().encode(json);
  // 簡易圧縮: そのままbase64化（大きなデータはURLが長くなるが、数十体なら問題なし）
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** URL共有用の文字列からボックスデータをデコード */
export function importBoxFromShareString(encoded: string): BoxEntry[] | null {
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json);
    if (!Array.isArray(data)) return null;
    return data as BoxEntry[];
  } catch {
    return null;
  }
}

/** インポートしたデータを既存ボックスにマージ（ID重複は上書き） */
export function mergeImportedBox(imported: BoxEntry[]): BoxEntry[] {
  const existing = loadBox();
  const existingIds = new Set(existing.map((e) => e.id));
  const newEntries = imported.filter((e) => !existingIds.has(e.id));
  const merged = [...newEntries, ...existing];
  localStorage.setItem(KEY, JSON.stringify(merged));
  return merged;
}
