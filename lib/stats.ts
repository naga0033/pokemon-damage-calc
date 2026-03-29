import type { Nature, StatKey, BaseStats, EVIVs } from "./types";

export const NATURE_DATA: Record<Nature, { boosted: StatKey | null; reduced: StatKey | null; ja: string }> = {
  hardy:   { boosted: null,      reduced: null,      ja: "がんばりや" },
  lonely:  { boosted: "attack",  reduced: "defense", ja: "さみしがり" },
  brave:   { boosted: "attack",  reduced: "speed",   ja: "ゆうかん"   },
  adamant: { boosted: "attack",  reduced: "spAtk",   ja: "いじっぱり" },
  naughty: { boosted: "attack",  reduced: "spDef",   ja: "やんちゃ"   },
  bold:    { boosted: "defense", reduced: "attack",  ja: "ずぶとい"   },
  docile:  { boosted: null,      reduced: null,      ja: "すなお"     },
  relaxed: { boosted: "defense", reduced: "speed",   ja: "のんき"     },
  impish:  { boosted: "defense", reduced: "spAtk",   ja: "わんぱく"   },
  lax:     { boosted: "defense", reduced: "spDef",   ja: "のうてんき" },
  timid:   { boosted: "speed",   reduced: "attack",  ja: "おくびょう" },
  hasty:   { boosted: "speed",   reduced: "defense", ja: "せっかち"   },
  serious: { boosted: null,      reduced: null,      ja: "まじめ"     },
  jolly:   { boosted: "speed",   reduced: "spAtk",   ja: "ようき"     },
  naive:   { boosted: "speed",   reduced: "spDef",   ja: "むじゃき"   },
  modest:  { boosted: "spAtk",   reduced: "attack",  ja: "ひかえめ"   },
  mild:    { boosted: "spAtk",   reduced: "defense", ja: "おっとり"   },
  quiet:   { boosted: "spAtk",   reduced: "speed",   ja: "れいせい"   },
  bashful: { boosted: null,      reduced: null,      ja: "てれや"     },
  rash:    { boosted: "spAtk",   reduced: "spDef",   ja: "うっかりや" },
  calm:    { boosted: "spDef",   reduced: "attack",  ja: "おだやか"   },
  gentle:  { boosted: "spDef",   reduced: "defense", ja: "おとなしい" },
  sassy:   { boosted: "spDef",   reduced: "speed",   ja: "なまいき"   },
  careful: { boosted: "spDef",   reduced: "spAtk",   ja: "しんちょう" },
  quirky:  { boosted: null,      reduced: null,      ja: "きまぐれ"   },
};

export const STAT_NAMES_JA: Record<StatKey, string> = {
  hp:      "HP",
  attack:  "こうげき",
  defense: "ぼうぎょ",
  spAtk:   "とくこう",
  spDef:   "とくぼう",
  speed:   "すばやさ",
};

/** 最終HP計算 */
export function calcHp(base: number, iv: number, ev: number, level: number): number {
  return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
}

/** 最終ステータス計算（HP以外） */
export function calcStat(
  base: number,
  iv: number,
  ev: number,
  level: number,
  nature: Nature,
  statKey: StatKey
): number {
  const base_val = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;
  const { boosted, reduced } = NATURE_DATA[nature];
  let mod = 1;
  if (boosted === statKey) mod = 1.1;
  if (reduced === statKey) mod = 0.9;
  return Math.floor(base_val * mod);
}

/** 全ステータスを計算して返す */
export function calcAllStats(
  base: BaseStats,
  ivs: EVIVs,
  evs: EVIVs,
  level: number,
  nature: Nature
): BaseStats {
  return {
    hp:      calcHp(base.hp, ivs.hp, evs.hp, level),
    attack:  calcStat(base.attack,  ivs.attack,  evs.attack,  level, nature, "attack"),
    defense: calcStat(base.defense, ivs.defense, evs.defense, level, nature, "defense"),
    spAtk:   calcStat(base.spAtk,   ivs.spAtk,   evs.spAtk,   level, nature, "spAtk"),
    spDef:   calcStat(base.spDef,   ivs.spDef,   evs.spDef,   level, nature, "spDef"),
    speed:   calcStat(base.speed,   ivs.speed,   evs.speed,   level, nature, "speed"),
  };
}

export const DEFAULT_IVS: EVIVs = { hp: 31, attack: 31, defense: 31, spAtk: 31, spDef: 31, speed: 31 };
export const DEFAULT_EVS: EVIVs = { hp: 0, attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 };
