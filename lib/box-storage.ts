import type { PokemonState } from "./types";

export interface BoxEntry {
  id: string;
  name: string;
  state: PokemonState;
  moves?: string[];   // 技1-4 スラッグ（空文字 = なし）
  createdAt: number;
  updatedAt?: number;
}

const KEY = "pokemon-dmg-box-v1";

function normalizeMovesForPokemon(pokemonSlug: string | undefined, moves?: string[]): string[] | undefined {
  if (!moves) return moves;

  if (pokemonSlug === "zacian-crowned") {
    return moves.map((move) => move === "iron-head" ? "behemoth-blade" : move);
  }

  if (pokemonSlug === "zamazenta-crowned") {
    return moves.map((move) => move === "iron-head" ? "behemoth-bash" : move);
  }

  return moves;
}

function normalizeEntry(entry: BoxEntry): BoxEntry {
  return {
    ...entry,
    moves: normalizeMovesForPokemon(entry.state.pokemon?.name, entry.moves),
    updatedAt: entry.updatedAt ?? entry.createdAt,
  };
}

function persistEntries(entries: BoxEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

export function loadBox(): BoxEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? "[]") as BoxEntry[]).map(normalizeEntry);
  } catch {
    return [];
  }
}

export function saveToBox(name: string, state: PokemonState, moves?: string[]): BoxEntry[] {
  const entries = loadBox();
  const now = Date.now();
  const entry: BoxEntry = { id: `${now}-${Math.random().toString(36).slice(2)}`, name, state, moves, createdAt: now, updatedAt: now };
  const next = [entry, ...entries];
  persistEntries(next);
  return next;
}

export function deleteFromBox(id: string): BoxEntry[] {
  const next = loadBox().filter((e) => e.id !== id);
  persistEntries(next);
  return next;
}

export function updateBox(id: string, name: string, state: PokemonState, moves?: string[]): BoxEntry[] {
  const entries = loadBox();
  const now = Date.now();
  const next = entries.map((e) => e.id === id ? { ...e, name, state, moves, updatedAt: now } : e);
  persistEntries(next);
  return next;
}

/* ── バトルチーム ── */

export interface BattleTeam {
  id: string;
  name: string;
  memberIds: string[];  // BoxEntry IDs (max 6)
  createdAt: number;
  updatedAt?: number;
}

const TEAM_KEY = "pokemon-dmg-teams-v1";

function normalizeTeam(team: BattleTeam): BattleTeam {
  return {
    ...team,
    updatedAt: team.updatedAt ?? team.createdAt,
  };
}

export function loadTeams(): BattleTeam[] {
  if (typeof window === "undefined") return [];
  try {
    return (JSON.parse(localStorage.getItem(TEAM_KEY) ?? "[]") as BattleTeam[]).map(normalizeTeam);
  } catch {
    return [];
  }
}

function saveTeams(teams: BattleTeam[]) {
  localStorage.setItem(TEAM_KEY, JSON.stringify(teams));
}

export function createTeam(name: string): BattleTeam[] {
  const teams = loadTeams();
  const now = Date.now();
  const team: BattleTeam = {
    id: `${now}-${Math.random().toString(36).slice(2)}`,
    name,
    memberIds: [],
    createdAt: now,
    updatedAt: now,
  };
  const next = [...teams, team];
  saveTeams(next);
  return next;
}

export function updateTeam(id: string, patch: Partial<Pick<BattleTeam, "name" | "memberIds">>): BattleTeam[] {
  const teams = loadTeams();
  const now = Date.now();
  const next = teams.map((t) => t.id === id ? { ...t, ...patch, updatedAt: now } : t);
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
    return (data as BoxEntry[]).map(normalizeEntry);
  } catch {
    return null;
  }
}

/** インポートしたデータを既存ボックスにマージ（ID重複は新しい updatedAt を優先） */
export function mergeImportedBox(imported: BoxEntry[]): BoxEntry[] {
  const existing = loadBox();
  const mergedMap = new Map<string, BoxEntry>();

  for (const entry of [...existing, ...imported.map(normalizeEntry)]) {
    const current = mergedMap.get(entry.id);
    if (!current || (entry.updatedAt ?? entry.createdAt) >= (current.updatedAt ?? current.createdAt)) {
      mergedMap.set(entry.id, entry);
    }
  }

  const merged = [...mergedMap.values()].sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
  persistEntries(merged);
  return merged;
}
