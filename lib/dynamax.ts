import type { PokemonType, MoveData } from "./types";

/** ダイマックス技名テーブル */
const DMAX_MOVE_NAMES: Record<PokemonType, string> = {
  normal:   "ダイアタック",
  fire:     "ダイバーン",
  water:    "ダイストリーム",
  electric: "ダイサンダー",
  grass:    "ダイソウゲン",
  ice:      "ダイアイス",
  fighting: "ダイナックル",
  poison:   "ダイアシッド",
  ground:   "ダイアース",
  flying:   "ダイジェット",
  psychic:  "ダイサイコ",
  bug:      "ダイワーム",
  rock:     "ダイロック",
  ghost:    "ダイホロウ",
  dragon:   "ダイドラグーン",
  dark:     "ダイアーク",
  steel:    "ダイスチル",
  fairy:    "ダイフェアリー",
  stellar:  "ダイアタック",
};

/** 格闘・毒タイプ用のダイマックス技威力テーブル */
function getFightingPoisonDmaxPower(basePower: number): number {
  if (basePower <= 40) return 70;
  if (basePower <= 50) return 75;
  if (basePower <= 60) return 80;
  if (basePower <= 70) return 85;
  if (basePower <= 100) return 90;
  if (basePower <= 140) return 95;
  return 100;
}

/** 通常タイプ用のダイマックス技威力テーブル */
function getGeneralDmaxPower(basePower: number): number {
  if (basePower <= 40) return 90;
  if (basePower <= 50) return 100;
  if (basePower <= 60) return 110;
  if (basePower <= 70) return 120;
  if (basePower <= 100) return 130;
  if (basePower <= 140) return 140;
  return 150;
}

/** 元技からダイマックス技の威力を算出 */
export function getDynamaxPower(basePower: number, moveType: PokemonType): number {
  if (moveType === "fighting" || moveType === "poison") {
    return getFightingPoisonDmaxPower(basePower);
  }
  return getGeneralDmaxPower(basePower);
}

/** 元技からダイマックス技名を取得 */
export function getDynamaxMoveName(moveType: PokemonType): string {
  return DMAX_MOVE_NAMES[moveType] ?? "ダイアタック";
}

/** 変化技の場合はダイウォール固定 */
export function getDynamaxMove(move: MoveData): { name: string; japaneseName: string; power: number } {
  if (move.category === "status") {
    return { name: "max-guard", japaneseName: "ダイウォール", power: 0 };
  }
  const power = getDynamaxPower(move.power ?? 0, move.type);
  const japaneseName = getDynamaxMoveName(move.type);
  return { name: `max-${move.type}`, japaneseName, power };
}
