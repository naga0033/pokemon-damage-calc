import type { PokemonState } from "./types";

export interface HistoryEntry {
  pokemonName: string;       // 重複判定キー（英語slug）
  state: PokemonState;       // 努力値・性格・特性・道具など全部
  moves?: string[];          // 選んでた技のslug配列
  usedAt: number;            // 最終使用タイムスタンプ
}

const KEY = "pokemon-dmg-history-v1";
const MAX_ENTRIES = 20;

/** 履歴を読み込む（新しい順） */
export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as HistoryEntry[];
  } catch {
    return [];
  }
}

/**
 * 履歴にポケモンの状態を保存する。
 * 同じポケモンが既にあれば上書き更新し、なければ先頭に追加。
 * 最大 MAX_ENTRIES 件まで保持。
 */
export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const entries = loadHistory();
  // 同じポケモンがあれば除去（上書き用）
  const filtered = entries.filter((e) => e.pokemonName !== entry.pokemonName);
  // 先頭に追加
  const next = [entry, ...filtered].slice(0, MAX_ENTRIES);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
