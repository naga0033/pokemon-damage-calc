export type PokemonType =
  | "normal" | "fire" | "water" | "electric" | "grass" | "ice"
  | "fighting" | "poison" | "ground" | "flying" | "psychic" | "bug"
  | "rock" | "ghost" | "dragon" | "dark" | "steel" | "fairy"
  | "stellar";   // ステラテラスタイプ（テラスタル専用）

export type MoveCategory = "physical" | "special" | "status";

export type WeatherCondition = "none" | "sun" | "rain" | "sand" | "snow";

export type TerrainCondition = "none" | "electric" | "grassy" | "misty" | "psychic";

export interface BaseStats {
  hp: number;
  attack: number;
  defense: number;
  spAtk: number;
  spDef: number;
  speed: number;
}

export interface AbilityEntry {
  slug: string;
  isHidden: boolean;
  slot: number;
}

export interface PokemonData {
  id: number;
  name: string;        // English slug (PokeAPI用)
  japaneseName: string;
  types: PokemonType[];
  baseStats: BaseStats;
  spriteUrl: string;
  moveNames: string[]; // English slugs
  abilities: AbilityEntry[];
  weight?: number;     // 体重（kg×10。PokeAPIの単位はヘクトグラム）
}

export interface MoveData {
  name: string;         // English slug
  japaneseName: string;
  type: PokemonType;
  category: MoveCategory;
  power: number | null;
  accuracy: number | null;
  priority: number;
  pp?: number;
}

export type StatKey = keyof BaseStats;

export type Nature =
  | "hardy" | "lonely" | "brave" | "adamant" | "naughty"
  | "bold" | "docile" | "relaxed" | "impish" | "lax"
  | "timid" | "hasty" | "serious" | "jolly" | "naive"
  | "modest" | "mild" | "quiet" | "bashful" | "rash"
  | "calm" | "gentle" | "sassy" | "careful" | "quirky";

export interface EVIVs {
  hp: number;
  attack: number;
  defense: number;
  spAtk: number;
  spDef: number;
  speed: number;
}

export interface FieldConditions {
  lightScreen: boolean;    // ひかりの壁
  reflect: boolean;        // リフレクター
  auroraVeil: boolean;     // オーロラベール
  stealthRock: boolean;    // ステルスロック
  spikesLayers: 0 | 1 | 2 | 3;  // まきびし層数
  substitute: boolean;     // みがわり
  leftovers: boolean;      // たべのこし（回復込み確定数）
  poisonStatus: "none" | "poison" | "toxic";  // 毒状態
  toxicTurns: number;      // どくどく経過ターン数 (1-15)
}

export const DEFAULT_FIELD: FieldConditions = {
  lightScreen: false,
  reflect: false,
  auroraVeil: false,
  stealthRock: false,
  spikesLayers: 0,
  substitute: false,
  leftovers: false,
  poisonStatus: "none",
  toxicTurns: 1,
};

export interface PokemonState {
  pokemon: PokemonData | null;
  level: number;
  nature: Nature;
  ivs: EVIVs;
  evs: EVIVs;
  teraType: PokemonType | null;
  isTerastallized: boolean;
  isDynamaxed: boolean;
  isMegaEvolved: boolean;
  megaForm: string | null;
  isBurned: boolean;
  isCharged: boolean;
  ability: string;
  item: string;
  statRanks: { attack: number; spAtk: number; defense: number; spDef: number };
  fieldConditions: FieldConditions;
}

export interface DamageResult {
  minDamage: number;
  maxDamage: number;
  minPercent: number;
  maxPercent: number;
  koLabel: string;
  typeEffectiveness: number;
  attackStat: number;
  defenseStat: number;
  defenderHp: number;
  rolls: number[];
  /** 連続技: 1回あたりのダメージ (min-max) */
  perHit?: { min: number; max: number };
  /** 連続技のヒット数 */
  hitCount?: number;
  /** みがわり情報 */
  substituteInfo?: {
    subHp: number;          // みがわりHP
    hitsToBreak: number;    // 壊すのに必要なヒット数
    bodyDamageMin: number;  // みがわり破壊後の本体ダメージ(最小)
    bodyDamageMax: number;  // みがわり破壊後の本体ダメージ(最大)
    bypassed: boolean;      // 音系/すりぬけで貫通したか
  };
}
