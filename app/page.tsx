"use client";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { PokemonState, PokemonData, MoveData, MoveCategory, StatKey, Nature, PokemonType, WeatherCondition, TerrainCondition, FieldConditions, EVIVs } from "@/lib/types";
import { DEFAULT_FIELD } from "@/lib/types";
import { DEFAULT_IVS, DEFAULT_EVS, calcAllStats, NATURE_DATA, STAT_NAMES_JA } from "@/lib/stats";
import { ITEMS, ITEM_MAP, getFlingPower } from "@/lib/items";
import { POPULAR_MOVE_SLUGS, MOVE_METADATA, SOUND_MOVES, POKEMON_MOVE_PRIORITY } from "@/lib/move-metadata";
import { POKEMON_MOVE_USAGE } from "@/lib/move-usage";
import { MOVE_NAMES_JA, getMoveJaName } from "@/lib/move-names";
import { calcDamage, isGrounded } from "@/lib/damage";
import { getDynamaxMove } from "@/lib/dynamax";
import { getMegaForms, type MegaForm } from "@/lib/mega-data";
import { fetchPokemon, fetchMove } from "@/lib/pokeapi";
import { findPokemonCandidates, EN_TO_JA, resolvePokemonJaName } from "@/lib/pokemon-names";
import { getTypeEffectiveness } from "@/lib/type-chart";
import { ALL_TYPES, ALL_TERA_TYPES, TYPE_NAMES_JA } from "@/lib/type-chart";
import PokemonSearch from "@/components/PokemonSearch";
import StatEditor from "@/components/StatEditor";
import { NumpadPopup } from "@/components/NumpadPopup";
import MoveSelector from "@/components/MoveSelector";
import DamageResultPanel, { inferBoosts, REVERSE_CANDIDATES } from "@/components/DamageResult";
import TypeBadge from "@/components/TypeBadge";
import { saveToBox, loadBox, deleteFromBox, updateBox, loadTeams, BattleTeam, BoxEntry, importBoxFromShareString, mergeImportedBox } from "@/lib/box-storage";
import { loadHistory, saveHistory, type HistoryEntry } from "@/lib/history-storage";
import { ABILITY_NAMES_JA, getAbilityJaName } from "@/lib/ability-names";
import BoxManager from "@/components/BoxManager";
import { useAuth } from "@/lib/auth-context";
import { saveCloudDataToCloud, migrateLocalToCloud, subscribeToCloudChanges } from "@/lib/box-sync";
import { KanaKeyboard } from "@/components/KanaKeyboard";
import { POKEMON_MASTER_DATA } from "@/lib/pokemon-master-data";
import { findBestJaMatch, getJaMatchCandidates, normalizeJaText } from "@/lib/japanese-match";
import { normalizeOcrActualStats, normalizeOcrEvs, parseJapaneseEvStatGrid, parseJapaneseLabeledActualStats, parseStatLetterActualStats, parseStatLetterEvs, parseStatLetterRows } from "@/lib/ocr-ev";
import { countParsedFields, inferNatureAndEvsFromActualStats, inferNatureFromActualStatsAndEvs, mergeParsedResults, type ParsedPokeText, type ParseSuggestions } from "@/lib/ocr-parser";
import { formatPokemonText } from "@/lib/pokemon-text";
import { copyText } from "@/lib/clipboard";

// ───────────────────────────────────────
// ツールチップ（汎用）
// ───────────────────────────────────────
function Tooltip({ text, side = "top" }: { text: string; side?: "top" | "bottom" }) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative inline-block cursor-help ml-0.5"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="text-[10px] text-gray-400 hover:text-blue-500 select-none font-bold border border-gray-300 rounded-full w-3.5 h-3.5 inline-flex items-center justify-center leading-none">i</span>
      {show && (
        <span className={`absolute z-[500] ${side === "top" ? "bottom-full mb-1" : "top-full mt-1"} left-1/2 -translate-x-1/2 w-52 bg-gray-800 text-white text-[11px] rounded-lg px-3 py-2 pointer-events-none shadow-xl leading-relaxed whitespace-pre-wrap`}>
          {text}
        </span>
      )}
    </span>
  );
}

// ───────────────────────────────────────
// 登録モーダル用ヘルパー
// ───────────────────────────────────────
/** 技スラッグ → 日本語名 */
const getMoveJa = (slug: string): string => MOVE_NAMES_JA[slug] || slug;

/** ポケモンが覚えられる技の中から人気順に抽出 */
const getPopularMovesForPokemon = (pokemon: PokemonData): string[] => {
  // マスターデータがあればS40採用率順で返す
  const master = POKEMON_MASTER_DATA[pokemon.name];
  if (master) {
    const masterSlugs = master.moves.map((m) => m.slug);
    // マスター技 + 残りのPopular技を結合
    const masterSet = new Set(masterSlugs);
    const pokemonMoves = new Set(pokemon.moveNames);
    const remaining = POPULAR_MOVE_SLUGS.filter((m) => pokemonMoves.has(m) && !masterSet.has(m));
    return [...masterSlugs, ...remaining];
  }
  const pokemonMoves = new Set(pokemon.moveNames);
  return POPULAR_MOVE_SLUGS.filter((m) => pokemonMoves.has(m));
};

// ───────────────────────────────────────
// 特性 → 天気・フィールド自動セットマップ
// ───────────────────────────────────────
const ABILITY_AUTO_ENV: Record<string, { weather?: WeatherCondition; terrain?: TerrainCondition }> = {
  // ☀️ 晴れをセットする特性
  "drought":           { weather: "sun"  },   // ひでり（リザードン・キュウコン等）
  "orichalcum-pulse":  { weather: "sun"  },   // ひひいろのこどう（コライドン）
  "mega-solar":        { weather: "sun"  },   // メガソーラー（メガメガニウム）
  "desolate-land":     { weather: "sun"  },   // おわりのだいち（グラードン）
  // 🌧️ 雨をセットする特性
  "drizzle":           { weather: "rain" },   // あめふらし（カイオーガ・ニョロトノ）
  "primordial-sea":    { weather: "rain" },   // はじまりのうみ（カイオーガ原始）
  // ❄️ 雪をセットする特性
  "snow-warning":      { weather: "snow" },   // ゆきふらし（ユキノオー・ユキメノコ）
  // 🌪️ 砂嵐をセットする特性
  "sand-stream":       { weather: "sand" },   // すなおこし（バンギラス・カバルドン）
  "sand-spit":         { weather: "sand" },   // すなはき（ヤドカリ）
  // なし（天気を消す特性）
  "air-lock":          { weather: "none" },   // エアロック（レックウザ）
  "delta-stream":      { weather: "none" },   // デルタストリーム（メガレックウザ）
  "cloud-nine":        { weather: "none" },   // てんきや（ハピナス等）
  // ⚡ エレキフィールド
  "electric-surge":    { terrain: "electric" }, // エレキメイカー（カプ・コケコ）
  "hadron-engine":     { terrain: "electric" }, // ハドロンエンジン（ミライドン）
  // 🌿 グラスフィールド
  "grassy-surge":      { terrain: "grassy"   }, // グラスメイカー（カプ・ブルル）
  // 🌫️ ミストフィールド
  "misty-surge":       { terrain: "misty"    }, // ミストメイカー（カプ・レヒレ）
  // 🔮 サイコフィールド
  "psychic-surge":     { terrain: "psychic"  }, // サイコメイカー（カプ・テテフ）
};

// ステルスロック ダメージ計算（タイプ相性ベース）
function calcStealthRockHp(hp: number, defTypes: PokemonType[], teraType: PokemonType | null, isTerastallized: boolean): number {
  const effectiveTypes = isTerastallized && teraType ? [teraType] : defTypes;
  const eff = getTypeEffectiveness("rock", effectiveTypes);
  return Math.floor(hp * eff / 8);
}

// まきびし ダメージ計算（ひこうタイプ・ふゆう持ちは無効）
function calcSpikesHp(hp: number, layers: 0 | 1 | 2 | 3, types: PokemonType[], ability: string, item: string, teraType: PokemonType | null, isTerastallized: boolean): number {
  if (layers === 0) return 0;
  if (!isGrounded(types, ability, item, teraType, isTerastallized)) return 0;
  if (layers === 1) return Math.floor(hp / 8);
  if (layers === 2) return Math.floor(hp / 6);
  return Math.floor(hp / 4);
}

function getAbilityBoostedStat(
  ability: string,
  stats: { attack: number; defense: number; spAtk: number; spDef: number; speed: number } | null,
  weather: WeatherCondition,
  terrain: TerrainCondition
): "attack" | "defense" | "spAtk" | "spDef" | "speed" | null {
  if (!stats) return null;

  const isProtoActive = ability === "protosynthesis" && weather === "sun";
  const isQuarkActive = ability === "quark-drive" && terrain === "electric";
  if (!isProtoActive && !isQuarkActive) return null;

  const entries: Array<["attack" | "defense" | "spAtk" | "spDef" | "speed", number]> = [
    ["attack", stats.attack],
    ["defense", stats.defense],
    ["spAtk", stats.spAtk],
    ["spDef", stats.spDef],
    ["speed", stats.speed],
  ];
  entries.sort((a, b) => b[1] - a[1]);

  return entries[0]?.[0] ?? null;
}

function computeMobileKoLabel(rolls: number[], hp: number): string {
  for (let n = 1; n <= 6; n++) {
    const minTotal = rolls[0] * n;
    const maxTotal = rolls[rolls.length - 1] * n;
    if (minTotal >= hp) return `確定${["1", "2", "3", "4", "5", "6"][n - 1]}発`;
    if (maxTotal >= hp) {
      const koCount = rolls.filter((r) => r * n >= hp).length;
      return `乱数${["1", "2", "3", "4", "5", "6"][n - 1]}発 (${koCount}/16)`;
    }
  }
  return "7発以上";
}

function getMobileBarColors(koLabel: string, exceedsHp = false): { solid: string; range: string; text: string } {
  if (koLabel.startsWith("確定1発")) {
    return { solid: "bg-red-500", range: "bg-red-200", text: "text-red-600" };
  }
  if (koLabel.startsWith("乱数1発")) {
    return { solid: "bg-orange-500", range: "bg-orange-200", text: "text-orange-600" };
  }
  if (koLabel.startsWith("確定2発") || koLabel.startsWith("乱数2発")) {
    return {
      solid: exceedsHp ? "bg-red-500" : "bg-orange-400",
      range: "bg-orange-200",
      text: "text-yellow-700",
    };
  }
  return {
    solid: exceedsHp ? "bg-red-500" : "bg-orange-400",
    range: "bg-orange-200",
    text: "text-gray-700",
  };
}

const DEFAULT_STATE: PokemonState = {
  pokemon: null,
  level: 50,
  nature: "hardy",
  ivs: DEFAULT_IVS,
  evs: DEFAULT_EVS,
  teraType: null,
  isTerastallized: false,
  isDynamaxed: false,
  isMegaEvolved: false,
  megaForm: null,
  isBurned: false,
  isCharged: false,
  ability: "",
  item: "",
  statRanks: { attack: 0, spAtk: 0, defense: 0, spDef: 0 },
  fieldConditions: { ...DEFAULT_FIELD },
};

const WEATHER_OPTIONS: { value: WeatherCondition; label: string }[] = [
  { value: "none", label: "なし" },
  { value: "sun",  label: "晴れ ☀️" },
  { value: "rain", label: "雨 🌧️" },
  { value: "sand", label: "砂嵐 🌪️" },
  { value: "snow", label: "雪 ❄️" },
];

const TERRAIN_OPTIONS: { value: TerrainCondition; label: string }[] = [
  { value: "none",     label: "なし" },
  { value: "electric", label: "エレキ ⚡" },
  { value: "grassy",   label: "グラス 🌿" },
  { value: "misty",    label: "ミスト 🌫️" },
  { value: "psychic",  label: "サイコ 🔮" },
];

// ───────────────────────────────────────
// 性格グリッド定数（行=上昇ステ、列=下降ステ）
// ───────────────────────────────────────
const NATURE_STAT_KEYS: StatKey[] = ["attack", "defense", "spAtk", "spDef", "speed"];
const NATURE_GRID: Nature[][] = [
  ["hardy",   "lonely",  "adamant", "naughty", "brave"  ],
  ["bold",    "docile",  "impish",  "lax",     "relaxed"],
  ["modest",  "mild",    "bashful", "rash",    "quiet"  ],
  ["calm",    "gentle",  "careful", "quirky",  "sassy"  ],
  ["timid",   "hasty",   "jolly",   "naive",   "serious"],
];

// ───────────────────────────────────────
// ポケモン登録モーダル（新規登録 + 一覧管理）
// ───────────────────────────────────────
interface RegModalProps {
  attacker: PokemonState;
  defender: PokemonState;
  onClose: () => void;
  onEntriesChange?: (entries: BoxEntry[]) => void;
  initialEditEntry?: BoxEntry | null;
}

function RegistrationModal({ attacker: _attacker, defender: _defender, onClose, onEntriesChange, initialEditEntry }: RegModalProps) {
  const [entries, setEntries] = useState<BoxEntry[]>(() => loadBox());
  const syncEntries = (next: BoxEntry[]) => { setEntries(next); onEntriesChange?.(next); };
  const [didAutoEdit, setDidAutoEdit] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  // 新規登録フォーム（常に表示）
  const [newRegPokemon, setNewRegPokemon] = useState<PokemonData | null>(null);
  const [newRegPokemonName, setNewRegPokemonName] = useState("");
  const [newRegName, setNewRegName] = useState("");
  const [newRegNature, setNewRegNature] = useState<Nature>("hardy");
  const [newRegLevel, setNewRegLevel] = useState<number>(50);
  const [newRegLevelStr, setNewRegLevelStr] = useState<string>("50");
  const [newRegEvs, setNewRegEvs] = useState<EVIVs>({ hp: 0, attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 });
  const [newRegItem, setNewRegItem] = useState("");
  const [newRegNatureOpen, setNewRegNatureOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  // テラスタイプ・技4スロット
  const [newRegTeraType, setNewRegTeraType] = useState<PokemonType | null>(null);
  const [newRegMoves, setNewRegMoves] = useState<string[]>(["", "", "", ""]);
  const [newRegAbility, setNewRegAbility] = useState<string>("");
  // 技スロット選択UI
  const [openMoveSlot, setOpenMoveSlot] = useState<number | null>(null);
  const [moveQuery, setMoveQuery] = useState("");
  // アイテム検索
  const [itemDropOpen, setItemDropOpen] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const [showItemKana, setShowItemKana] = useState(false);
  // テンキー
  const [activeField, setActiveField] = useState<{ key: keyof EVIVs | 'level'; mode: 'ev' | 'stat' | 'level' } | null>(null);
  const [numpadVal, setNumpadVal] = useState("0");
  const [numpadFresh, setNumpadFresh] = useState(true);
  // スクショ読み取り
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pasteLoading, setPasteLoading] = useState(false);
  // スクショOCR
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const ocrFileInputRef = useRef<HTMLInputElement>(null);
  const ocrCameraInputRef = useRef<HTMLInputElement>(null);
  // ポケモン候補選択
  const [pokeCandidates, setPokeCandidates] = useState<Array<{ name: string; ja: string }>>([]);
  const [pendingParsed, setPendingParsed] = useState<ReturnType<typeof parsePokeText> | null>(null);
  const [parseSuggestions, setParseSuggestions] = useState<ParseSuggestions | null>(null);

  // ── 性格辞書（高速ルックアップ用Set）──
  const NATURE_JA_SET = useMemo(() => new Set(Object.values(NATURE_DATA).map((v) => v.ja)), []);
  const NATURE_JA_LIST = useMemo(() => Object.values(NATURE_DATA).map((v) => v.ja), []);
  const NATURE_JA_TO_KEY = useMemo(() => Object.fromEntries(Object.entries(NATURE_DATA).map(([k, v]) => [v.ja, k])), []);
  // ── 技辞書（日本語名Set + 逆引き）──
  const MOVE_JA_SET = useMemo(() => new Set(Object.values(MOVE_NAMES_JA)), []);
  const MOVE_JA_LIST = useMemo(() => Object.values(MOVE_NAMES_JA), []);
  // ── 持ち物辞書 ──
  const ITEM_JA_SET = useMemo(() => new Set(ITEMS.map((i) => i.ja)), []);
  const ITEM_JA_LIST = useMemo(() => ITEMS.map((i) => i.ja), []);
  // ── タイプ名辞書 ──
  const TYPE_JA_SET = useMemo(() => new Set(Object.values(TYPE_NAMES_JA)), []);
  const TYPE_JA_LIST = useMemo(() => Object.values(TYPE_NAMES_JA), []);
  // ── ポケモン名辞書（長い名前順にソート）──
  const POKEMON_JA_SORTED = useMemo(() => Object.values(EN_TO_JA).sort((a, b) => b.length - a.length), []);
  const ABILITY_JA_LIST = useMemo(() => [...new Set(Object.values(ABILITY_NAMES_JA))], []);
  const MOVE_USAGE_JA = useMemo(() => {
    return Object.fromEntries(
      Object.entries(POKEMON_MOVE_USAGE).map(([slug, moves]) => [
        slug,
        moves.map((move) => getMoveJaName(move)).filter((name) => name && !name.includes("-")),
      ]),
    ) as Record<string, string[]>;
  }, []);
  const inferPokemonFromTraits = useCallback((abilityJa: string, moveJas: string[]): string => {
    if (!abilityJa && moveJas.length === 0) return "";

    let bestName = "";
    let bestScore = 0;
    const candidateSlugs = new Set<string>([
      ...Object.keys(POKEMON_MASTER_DATA),
      ...Object.keys(POKEMON_MOVE_USAGE),
    ]);

    for (const slug of candidateSlugs) {
      const master = POKEMON_MASTER_DATA[slug];
      const jaName = master?.jaName ?? EN_TO_JA[slug];
      if (!jaName) continue;
      let score = 0;

      if (abilityJa) {
        const abilityNames = (master?.abilities ?? []).map((ability) => ABILITY_NAMES_JA[ability.slug]).filter(Boolean);
        if (abilityNames.includes(abilityJa)) score += 4;
      }

      if (moveJas.length > 0) {
        const moveSet = new Set<string>([
          ...(master?.moves.map((move) => move.jaName) ?? []),
          ...(MOVE_USAGE_JA[slug] ?? []),
        ]);
        for (const move of moveJas) {
          if (moveSet.has(move)) score += 1;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestName = jaName;
      }
    }

    return bestScore >= 3 ? bestName : "";
  }, [MOVE_USAGE_JA]);


  /** テキストをパースしてポケモン情報を抽出（コンテキスト推論付き） */
  const parsePokeText = useCallback((raw: string): ParsedPokeText => {
    // ── OCRノイズ前処理 ──
    let cleaned = raw
      .split(/\n/)
      .map((line) => line.replace(/\s+/g, ""))
      .join("\n")
      .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      .replace(/[（]/g, "(").replace(/[）]/g, ")")
      .replace(/[,，][/／]/g, "@")
      .replace(/[＠﹫]/g, "@")
      .replace(/[|｜]/g, "/")
      .replace(/[“”]/g, "\"")
      .replace(/[’]/g, "'");

    // 改行なしで繋がるケースに改行を挿入
    cleaned = cleaned
      .replace(/(テラス?タイプ)/g, "\n$1")
      .replace(/(特性[:：])/g, "\n$1")
      .replace(/(性格[:：])/g, "\n$1")
      .replace(/(努力値[:：]?)/g, "\n$1")
      .replace(/(持ち?物[:：])/g, "\n$1")
      .replace(/(名前[:：]|ポケモン[:：])/g, "\n$1")
      .replace(/(技[:：])/g, "\n$1");

    const lines = cleaned.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const isChampionsLayout = /pokemon\s*champions|能力ポイント|VP/i.test(raw) || /能力ポイント|VP/.test(cleaned);

    let pokemonName = "";
    let item = "";
    let teraType = "";
    let nature = "";
    let ability = "";
    const evs: EVIVs = { hp: 0, attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 };
    const actualStats: Partial<EVIVs> = {};
    const moves: string[] = [];
    let hasEvs = false;
    const unmatchedLines: string[] = []; // パターンに一致しなかった行
    const isLikelyStatNoise = (line: string) =>
      /[0-9＋+]/.test(line) || /(?:^|[^A-Z])[HABCDS](?:[^A-Z]|$)/i.test(line) || /努力値|実数値/.test(line);
    const isLikelyMoveText = (line: string) =>
      !isLikelyStatNoise(line)
      && /[ぁ-んァ-ヶ一-龠]/.test(line)
      && line.length >= 2
      && line.length <= 12;

    for (const line of lines) {
      const parsedEvStatGrid = parseJapaneseEvStatGrid(line);
      const gridHasStats = Object.keys(parsedEvStatGrid.stats).length > 0;
      const gridHasEvs = Object.keys(parsedEvStatGrid.evs).length > 0;
      if (gridHasStats || gridHasEvs) {
        Object.assign(actualStats, parsedEvStatGrid.stats);
        if (gridHasEvs) {
          Object.assign(evs, parsedEvStatGrid.evs);
          hasEvs = true;
        }
        continue;
      }

      const parsedStatRows = parseStatLetterRows(line);
      const rowHasStats = Object.keys(parsedStatRows.stats).length > 0;
      const rowHasEvs = Object.keys(parsedStatRows.evs).length > 0;
      if (rowHasStats || rowHasEvs) {
        Object.assign(actualStats, parsedStatRows.stats);
        if (rowHasEvs) {
          Object.assign(evs, parsedStatRows.evs);
          hasEvs = true;
        }
        if (rowHasStats && !/^[HABCDS]\s*[:：]?\s*\d{1,3}(?=$|\s*$)/i.test(line.trim())) {
          continue;
        }
      }

      const parsedLetterEvs = parseStatLetterEvs(line);
      if (Object.keys(parsedLetterEvs).length > 0) {
        Object.assign(evs, parsedLetterEvs);
        hasEvs = true;
        continue;
      }

      const parsedActualStats = parseStatLetterActualStats(line);
      if (Object.keys(parsedActualStats).length >= 3) {
        Object.assign(actualStats, parsedActualStats);
      }
      const parsedJapaneseActualStats = parseJapaneseLabeledActualStats(line);
      if (Object.keys(parsedJapaneseActualStats).length > 0) {
        Object.assign(actualStats, parsedJapaneseActualStats);
      }

      // ── ポケモン名 @ 持ち物 テラス:タイプ ──
      if (line.includes("@") || line.includes("＠")) {
        const [pn, rest] = line.split(/[@＠]/);
        pokemonName = pn.trim().replace(/\s*[\(（].*?[\)）]\s*/, "").replace(/\s/g, "");
        const restStr = rest?.trim() ?? "";
        const teraInLine = restStr.match(/テラス?[:：](.+)$/);
        if (teraInLine) {
          item = restStr.slice(0, teraInLine.index).replace(/\s/g, "");
          teraType = teraInLine[1].replace(/\s/g, "");
        } else {
          item = restStr.replace(/\s/g, "");
        }
        continue;
      }
      // ── 名前 / ポケモン ──
      const nameMatch = line.match(/^(?:名前|ポケモン)[:：](.+)/);
      if (nameMatch) {
        pokemonName = nameMatch[1].trim().replace(/\s*[\(（].*?[\)）]\s*/, "").replace(/\s/g, "");
        continue;
      }
      // ── 持ち物 ──
      const itemMatch = line.match(/^(?:持物|持ち物|もちもの)[:：](.+)/);
      if (itemMatch) {
        item = itemMatch[1].trim().replace(/\s/g, "");
        continue;
      }
      // ── テラスタイプ ──
      const teraMatch = line.match(/テラス?(?:タイプ)?[:：](.+)/);
      if (teraMatch) { teraType = teraMatch[1]; continue; }
      // ── 特性 ──
      const abilityMatch = line.match(/特性[:：](.+)/);
      if (abilityMatch) { ability = abilityMatch[1]; continue; }
      // ── 性格（ラベル付き）──
      const natureMatch = line.match(/性格[:：](.+)/);
      if (natureMatch) { nature = natureMatch[1]; continue; }
      // ── EV形式C: 191(124)-x-122(12)-204(+244)-136(4)-171(124) ──
      if (/\d+\([\+]?\d+\)/.test(line) && line.includes("-")) {
        const parts = line.split(/-/);
        const keys: Array<keyof EVIVs> = ["hp", "attack", "defense", "spAtk", "spDef", "speed"];
        parts.forEach((p, i) => {
          if (i < keys.length) {
            const evMatch = p.match(/\(\+?(\d+)\)/);
            if (evMatch) { evs[keys[i]] = parseInt(evMatch[1], 10); hasEvs = true; }
          }
        });
        continue;
      }
      if (/^実数値/.test(line)) continue;
      // ── 技構成: 技名/技名/技名/技名 or 技: 技名, 技名... ──
      if (/^(技構成|技)[:：]?/.test(line) || line.includes("/") || line.includes("／") || line.includes(",")) {
        const moveList = line
          .replace(/^(技構成|技)[:：]?\s*/, "")
          .split(/\s*[/／,，]\s*/)
          .map((m) => m.replace(/\s/g, ""))
          .filter(Boolean);
        moves.push(...moveList);
        continue;
      }
      // ── 単独の技/持ち物/特性候補 ──
      const normalizedLine = normalizeJaText(line);
      const moveCandidate = findBestJaMatch(line, MOVE_JA_LIST);
      if (!isLikelyStatNoise(line) && moveCandidate && normalizeJaText(moveCandidate) === normalizedLine && moves.length < 4) {
        moves.push(moveCandidate);
        continue;
      }
      if (isChampionsLayout && isLikelyMoveText(line) && moves.length < 4) {
        const fuzzyMove = findBestJaMatch(line, MOVE_JA_LIST, { maxDistance: 2 });
        if (fuzzyMove && !moves.includes(fuzzyMove) && fuzzyMove !== ability) {
          moves.push(fuzzyMove);
          continue;
        }
      }
      const itemCandidate = findBestJaMatch(line, ITEM_JA_LIST);
      if (!item && itemCandidate && normalizeJaText(itemCandidate) === normalizedLine) {
        item = itemCandidate;
        continue;
      }
      const abilityCandidate = findBestJaMatch(line, ABILITY_JA_LIST);
      if (!ability && abilityCandidate && normalizeJaText(abilityCandidate) === normalizedLine) {
        ability = abilityCandidate;
        continue;
      }
      const natureCandidate = findBestJaMatch(line, NATURE_JA_LIST);
      if (!nature && natureCandidate && normalizeJaText(natureCandidate) === normalizedLine) {
        nature = natureCandidate;
        continue;
      }
      // ── 1行目がポケモン名のみ ──
      if (!pokemonName && lines.indexOf(line) === 0) {
        const resolvedPokemon = resolvePokemonJaName(line.replace(/\s*[\(（].*?[\)）]\s*/, "").replace(/\s/g, ""));
        if (resolvedPokemon) {
          pokemonName = resolvedPokemon;
          continue;
        }
      }
      // ── 単独行のポケモン名候補 ──
      if (!pokemonName) {
        const resolvedPokemon = resolvePokemonJaName(line);
        if (resolvedPokemon) {
          pokemonName = resolvedPokemon;
          continue;
        }
      }
      // パターン不一致→後段のコンテキスト推論に回す
      if (!isLikelyStatNoise(line)) {
        unmatchedLines.push(line);
      }
    }

    // ════════════════════════════════════════
    // Phase 2: 全テキスト横断のコンテキスト推論
    // （行パターンで拾えなかった項目を辞書照合で補完）
    // ════════════════════════════════════════
    const fullText = cleaned.replace(/\n/g, ""); // 全テキストを1行に

    // 【性格】テキスト全体から性格25種+漢字エイリアスを検索
    if (!nature) {
      // まずひらがな性格名で検索
      const sortedNatures = [...NATURE_JA_SET].sort((a, b) => b.length - a.length);
      for (const nJa of sortedNatures) {
        if (fullText.includes(nJa)) { nature = nJa; break; }
      }
      // 次に漢字エイリアスで検索
      if (!nature) {
        const NATURE_KANJI: Record<string, string> = {
          "控えめ": "ひかえめ", "控え目": "ひかえめ", "意地っぱり": "いじっぱり",
          "陽気": "ようき", "臆病": "おくびょう", "勇敢": "ゆうかん", "腕白": "わんぱく",
          "図太い": "ずぶとい", "呑気": "のんき", "慎重": "しんちょう", "穏やか": "おだやか",
          "冷静": "れいせい", "無邪気": "むじゃき", "生意気": "なまいき", "大人しい": "おとなしい",
        };
        for (const [kanji, hira] of Object.entries(NATURE_KANJI)) {
          if (fullText.includes(kanji)) { nature = hira; break; }
        }
      }
    }

    // 【テラタイプ】「テラス」近傍のタイプ名、または単独タイプ名
    if (!teraType) {
      const teraIdx = fullText.indexOf("テラス");
      if (teraIdx >= 0) {
        const after = fullText.slice(teraIdx + 3, teraIdx + 20).replace(/^[タイプ:：\s]*/,"");
        for (const tJa of TYPE_JA_SET) {
          if (after.startsWith(tJa)) { teraType = tJa; break; }
        }
      }
    }

    // 【持ち物】テキスト全体から持ち物辞書と照合（長い名前を優先）
      if (!item) {
        const sortedItems = [...ITEMS].sort((a, b) => b.ja.length - a.ja.length);
        for (const iObj of sortedItems) {
          if (iObj.ja.length >= 3 && fullText.includes(iObj.ja)) { item = iObj.ja; break; }
        }
        if (!item) {
          item = findBestJaMatch(fullText, ITEM_JA_LIST, { maxDistance: 2 }) ?? "";
        }
      }

    // 【ポケモン名】テキスト全体からポケモン名辞書と照合（長い名前を優先）
      if (!pokemonName) {
        for (const candidateLine of lines.slice(0, 3)) {
          const resolvedPokemon = resolvePokemonJaName(candidateLine);
          if (resolvedPokemon) {
            pokemonName = resolvedPokemon;
            break;
          }
        }
      }
      if (!pokemonName) {
        for (const pJa of POKEMON_JA_SORTED) {
          if (pJa.length >= 2 && fullText.includes(pJa)) { pokemonName = pJa; break; }
        }
      }
      if (!pokemonName) {
        for (const line of unmatchedLines) {
          const resolvedPokemon = resolvePokemonJaName(line);
          if (resolvedPokemon) {
            pokemonName = resolvedPokemon;
            break;
          }
        }
      }
      if (!pokemonName) {
        pokemonName = findBestJaMatch(fullText, POKEMON_JA_SORTED, { maxDistance: 2 }) ?? "";
      }
      if (pokemonName) {
        pokemonName = resolvePokemonJaName(pokemonName) ?? pokemonName;
      }
      if (!pokemonName && (ability || moves.length > 0)) {
        const inferredPokemon = inferPokemonFromTraits(ability, moves);
        if (inferredPokemon) {
          pokemonName = inferredPokemon;
        }
      }

    // 【技】テキスト全体から技辞書と照合（3文字以上の技名を優先、最大4つ）
      if (moves.length < 4) {
        const sortedMoves = Object.values(MOVE_NAMES_JA).filter((m) => m.length >= 3).sort((a, b) => b.length - a.length);
        for (const mJa of sortedMoves) {
          if (fullText.includes(mJa) && !moves.includes(mJa)) {
            moves.push(mJa);
            if (moves.length >= 4) break;
          }
        }
      if (moves.length === 0 && !isChampionsLayout) {
          for (const line of unmatchedLines) {
            const matchedMove = findBestJaMatch(line, MOVE_JA_LIST, { maxDistance: 2 });
            if (matchedMove && !moves.includes(matchedMove)) {
              moves.push(matchedMove);
              if (moves.length >= 4) break;
            }
          }
        }
      }
      if (!pokemonName && (ability || moves.length > 0)) {
        const inferredPokemon = inferPokemonFromTraits(ability, moves);
        if (inferredPokemon) {
          pokemonName = inferredPokemon;
        }
      }

      if (!ability) {
        ability = findBestJaMatch(fullText, ABILITY_JA_LIST, { maxDistance: 2 }) ?? "";
      }

      if (!teraType) {
        teraType = findBestJaMatch(fullText, TYPE_JA_LIST, { maxDistance: 1 }) ?? "";
      }

      if (!nature) {
        nature = findBestJaMatch(fullText, NATURE_JA_LIST, { maxDistance: 1 }) ?? "";
      }

    // 【EV】fullTextから「実数値(EV)-実数値(EV)-...」パターンを直接探す
    if (!hasEvs) {
      const parsedRows = parseStatLetterRows(cleaned);
      if (Object.keys(parsedRows.evs).length > 0) {
        Object.assign(evs, parsedRows.evs);
        hasEvs = true;
      }
      if (Object.keys(actualStats).length === 0 && Object.keys(parsedRows.stats).length > 0) {
        Object.assign(actualStats, parsedRows.stats);
      }
    }

    if (!hasEvs) {
      const parsedLetterEvs = parseStatLetterEvs(cleaned);
      if (Object.keys(parsedLetterEvs).length > 0) {
        Object.assign(evs, parsedLetterEvs);
        hasEvs = true;
      }
    }

    if (Object.keys(actualStats).length === 0) {
      Object.assign(actualStats, parseJapaneseEvStatGrid(cleaned).stats);
      Object.assign(actualStats, parseStatLetterActualStats(cleaned));
      Object.assign(actualStats, parseJapaneseLabeledActualStats(cleaned));
    }

    if (!hasEvs) {
      const parsedGrid = parseJapaneseEvStatGrid(cleaned);
      if (Object.keys(parsedGrid.evs).length > 0) {
        Object.assign(evs, parsedGrid.evs);
        hasEvs = true;
      }
      if (Object.keys(actualStats).length === 0 && Object.keys(parsedGrid.stats).length > 0) {
        Object.assign(actualStats, parsedGrid.stats);
      }
    }

    if (!hasEvs) {
      // EV形式C全体を正規表現で探す: 数値またはx が - で6つ繋がる
      const evLineMatch = fullText.match(/(\d+\(\+?\d+\)|[xX×]|\d+)(-(\d+\(\+?\d+\)|[xX×]|\d+)){4,5}/);
      if (evLineMatch) {
        const parts = evLineMatch[0].split(/-/);
        const keys: Array<keyof EVIVs> = ["hp", "attack", "defense", "spAtk", "spDef", "speed"];
        let foundAny = false;
        parts.forEach((p, i) => {
          if (i < keys.length) {
            const evMatch = p.match(/\(\+?(\d+)\)/);
            if (evMatch) { evs[keys[i]] = parseInt(evMatch[1], 10); foundAny = true; }
          }
        });
        if (foundAny) hasEvs = true;
      }
      // フォールバック: かっこ内の数値を全部集めて合計510以下なら採用
      if (!hasEvs) {
        const allParenNums = [...fullText.matchAll(/\(\+?(\d+)\)/g)].map((m) => parseInt(m[1], 10));
        if (allParenNums.length >= 4 && allParenNums.length <= 6) {
          const sum = allParenNums.reduce((a, b) => a + b, 0);
          if (sum >= 4 && sum <= 510 && allParenNums.every((v) => v >= 0 && v <= 252)) {
            const keys: Array<keyof EVIVs> = ["hp", "attack", "defense", "spAtk", "spDef", "speed"];
            allParenNums.forEach((v, i) => { if (i < 6) evs[keys[i]] = v; });
            hasEvs = true;
          }
        }
      }
    }

    // ════════════════════════════════════════
    // Phase 3: EV検証（合計510超えの場合はリセット）
    // ════════════════════════════════════════
    const evTotal = Object.values(evs).reduce((a, b) => a + b, 0);
    if (evTotal > 510) {
      (Object.keys(evs) as Array<keyof EVIVs>).forEach((k) => { evs[k] = 0; });
      hasEvs = false;
    }

    // 何項目埋まったかカウント
    let filledCount = 0;
    if (pokemonName) filledCount++;
    if (item) filledCount++;
    if (teraType) filledCount++;
    if (nature) filledCount++;
    if (ability) filledCount++;
    if (hasEvs) filledCount++;
    if (moves.length > 0) filledCount++;

    return { pokemonName, item, teraType, nature, ability, evs, actualStats, moves, isChampionsLayout, filledCount };
  }, [NATURE_JA_SET, NATURE_JA_LIST, MOVE_JA_SET, MOVE_JA_LIST, ITEM_JA_SET, ITEM_JA_LIST, TYPE_JA_SET, TYPE_JA_LIST, POKEMON_JA_SORTED, ABILITY_JA_LIST, inferPokemonFromTraits]);

  /** パース結果をフォームに部分反映する（読み取れた項目だけセット。失敗項目はスキップ） */
  const applyParsedData = useCallback(async (parsed: ParsedPokeText): Promise<string[]> => {
    const warnings: string[] = [];
    const suggestions: ParseSuggestions = {};
    let loadedPokemon: PokemonData | null = null;

    // ════ 漢字→正式名 共通変換テーブル（関数先頭で宣言）════
    const ABILITY_ALIAS: Record<string, string> = {
      "雨降らし": "あめふらし", "日照り": "ひでり", "砂起こし": "すなおこし", "雪降らし": "ゆきふらし",
      "威嚇": "いかく", "浮遊": "ふゆう", "頑丈": "がんじょう", "型破り": "かたやぶり",
      "天然": "てんねん", "再生力": "さいせいりょく", "毒手": "どくしゅ",
      "貰い火": "もらいび", "厚い脂肪": "あついしぼう", "適応力": "てきおうりょく",
    };

    // ポケモン名
    if (parsed.pokemonName) {
      let pokeLoaded = false;
      try {
        const poke = await fetchPokemon(parsed.pokemonName);
        loadedPokemon = poke;
        setNewRegPokemon(poke);
        setNewRegPokemonName(poke.japaneseName ?? poke.name);
        pokeLoaded = true;

        // フォーム違いの候補があるか確認（ランドロス→霊獣/化身 等）
        const candidates = findPokemonCandidates(parsed.pokemonName);
        if (candidates.length > 1) {
          // 候補が複数→ユーザーに選ばせる
          setPokeCandidates(candidates);
          setPendingParsed(parsed);
        }

        // 特性（漢字変換 → 完全一致 → 含む一致フォールバック）
        if (parsed.ability) {
          let aClean = parsed.ability.replace(/\s/g, "");
          aClean = ABILITY_ALIAS[aClean] ?? aClean;
          const matched = poke.abilities.find((a: { slug: string }) => getAbilityJaName(a.slug) === aClean)
            || poke.abilities.find((a: { slug: string }) => {
              const jaName = getAbilityJaName(a.slug);
              return aClean.includes(jaName) || jaName.includes(aClean);
            });
          if (matched) setNewRegAbility(matched.slug);
          else warnings.push(`特性「${parsed.ability}」が一致しません`);
        }
      } catch {
        // fetchPokemon失敗: 候補検索を試みる
        const candidates = findPokemonCandidates(parsed.pokemonName);
        if (candidates.length > 0) {
          setPokeCandidates(candidates);
          setPendingParsed(parsed);
          suggestions.pokemon = candidates.slice(0, 5);
          if (candidates.length === 1) {
            // 候補が1つだけなら自動選択
            try {
              const poke = await fetchPokemon(candidates[0].name);
              loadedPokemon = poke;
              setNewRegPokemon(poke);
              setNewRegPokemonName(poke.japaneseName ?? poke.name);
              pokeLoaded = true;
              setPokeCandidates([]);
              setPendingParsed(null);
              if (parsed.ability) {
                const aClean = parsed.ability.replace(/\s/g, "");
                const matched = poke.abilities.find((a: { slug: string }) => getAbilityJaName(a.slug) === aClean)
                  || poke.abilities.find((a: { slug: string }) => { const jaName = getAbilityJaName(a.slug); return aClean.includes(jaName) || jaName.includes(aClean); });
                if (matched) setNewRegAbility(matched.slug);
              }
            } catch { /* fall through */ }
          }
        }
        if (!pokeLoaded && candidates.length <= 1) {
          warnings.push(`ポケモン「${parsed.pokemonName}」が見つかりません`);
          const fallbackCandidates = findPokemonCandidates(parsed.pokemonName);
          if (fallbackCandidates.length > 0) suggestions.pokemon = fallbackCandidates.slice(0, 5);
        }
      }
    }

    // ════ 漢字→正式名 共通変換テーブル ════
    const NATURE_ALIAS: Record<string, string> = {
      "控えめ": "ひかえめ", "控え目": "ひかえめ", "意地っぱり": "いじっぱり", "意地張り": "いじっぱり",
      "陽気": "ようき", "臆病": "おくびょう", "勇敢": "ゆうかん", "寂しがり": "さみしがり",
      "腕白": "わんぱく", "図太い": "ずぶとい", "呑気": "のんき", "慎重": "しんちょう",
      "穏やか": "おだやか", "大人しい": "おとなしい", "生意気": "なまいき", "冷静": "れいせい",
      "せっかち": "せっかち", "無邪気": "むじゃき", "やんちゃ": "やんちゃ", "能天気": "のうてんき",
      "おっとり": "おっとり", "うっかりや": "うっかりや", "頑張り屋": "がんばりや",
      "素直": "すなお", "照れ屋": "てれや", "真面目": "まじめ", "気まぐれ": "きまぐれ",
    };
    const ITEM_ALIAS: Record<string, string> = {
      "突撃チョッキ": "とつげきチョッキ", "拘りメガネ": "こだわりメガネ", "拘り鉢巻": "こだわりハチマキ",
      "拘りスカーフ": "こだわりスカーフ", "命の珠": "いのちのたま", "気合の襷": "きあいのタスキ",
      "命の玉": "いのちのたま", "毒毒玉": "どくどくだま", "火炎玉": "かえんだま",
      "朽ちた剣": "くちたけん", "朽ちた盾": "くちたたて", "食べ残し": "たべのこし",
      "雷プレート": "いかずちプレート", "炎プレート": "ひのたまプレート",
      "水プレート": "しずくプレート", "草プレート": "みどりのプレート",
      "氷プレート": "つららのプレート", "拳プレート": "こぶしのプレート",
      "風船": "ふうせん", "弱点保険": "じゃくてんほけん", "光の粘土": "ひかりのねんど",
      "厚底ブーツ": "あつぞこブーツ", "黒い眼鏡": "くろいメガネ", "黒いヘドロ": "くろいヘドロ",
      "半分回復きのみ": "オボンのみ", "混乱実": "フィラのみ",
    };
    const TERA_ALIAS: Record<string, string> = {
      "炎": "ほのお", "火": "ほのお", "水": "みず", "電気": "でんき", "雷": "でんき",
      "草": "くさ", "氷": "こおり", "格闘": "かくとう", "毒": "どく", "地面": "じめん",
      "飛行": "ひこう", "超": "エスパー", "虫": "むし", "岩": "いわ",
      "霊": "ゴースト", "竜": "ドラゴン", "悪": "あく", "鋼": "はがね", "妖": "フェアリー",
      "ノーマル": "ノーマル", "エスパー": "エスパー", "ゴースト": "ゴースト",
      "ドラゴン": "ドラゴン", "フェアリー": "フェアリー", "ステラ": "ステラ",
    };
    const MOVE_ALIAS: Record<string, string> = {
      "冷凍ビーム": "れいとうビーム", "雷": "かみなり", "波乗り": "なみのり",
      "火炎放射": "かえんほうしゃ", "地震": "じしん", "潮吹き": "しおふき",
      "高速移動": "こうそくいどう", "剣の舞": "つるぎのまい", "瞑想": "めいそう",
      "挑発": "ちょうはつ", "草分け": "くさわけ", "巨獣斬": "きょじゅうざん", "巨獣弾": "きょじゅうだん",
      "身代わり": "みがわり", "鬼火": "おにび", "怒りの粉": "いかりのこな",
      "電磁波": "でんじは", "大地の力": "だいちのちから", "日本晴れ": "にほんばれ",
      "雨乞い": "あまごい", "竜の舞": "りゅうのまい",
    };

    // ── 性格（漢字変換 → 完全一致 → 含む一致フォールバック）──
    if (parsed.nature) {
      let nClean = parsed.nature.replace(/\s/g, "");
      nClean = NATURE_ALIAS[nClean] ?? nClean;
      const ne = Object.entries(NATURE_DATA).find(([, v]) => v.ja === nClean)
        || Object.entries(NATURE_DATA).find(([, v]) => nClean.includes(v.ja) || v.ja.includes(nClean));
      if (ne) setNewRegNature(ne[0] as Nature);
      else {
        warnings.push(`性格「${parsed.nature}」が不明`);
        suggestions.nature = getJaMatchCandidates(parsed.nature, NATURE_JA_LIST, { maxDistance: 1, limit: 3 })
          .map((ja) => NATURE_JA_TO_KEY[ja] as Nature)
          .filter(Boolean);
      }
    }

    let resolvedNature = parsed.nature
      ? (Object.entries(NATURE_DATA).find(([, v]) => v.ja === (NATURE_ALIAS[parsed.nature.replace(/\s/g, "")] ?? parsed.nature.replace(/\s/g, "")))?.[0] as Nature | undefined)
      : undefined;

    // ── EV ──
    const totalEv = Object.values(parsed.evs).reduce((a, b) => a + b, 0);
    if (totalEv > 0) {
      setNewRegEvs({ hp: parsed.evs.hp, attack: parsed.evs.attack, defense: parsed.evs.defense, spAtk: parsed.evs.spAtk, spDef: parsed.evs.spDef, speed: parsed.evs.speed });
    }
    if (loadedPokemon && Object.keys(parsed.actualStats).length > 0) {
      if (!parsed.nature && totalEv > 0) {
        const inferredNature = inferNatureFromActualStatsAndEvs(loadedPokemon, parsed.actualStats, parsed.evs, resolvedNature);
        if (inferredNature) {
          setNewRegNature(inferredNature);
          resolvedNature = inferredNature;
        }
      }
      if (totalEv === 0) {
      const inferred = inferNatureAndEvsFromActualStats(loadedPokemon, parsed.actualStats, resolvedNature);
      if (inferred) {
        setNewRegEvs(inferred.evs);
        if (!parsed.nature) {
          setNewRegNature(inferred.nature);
          resolvedNature = inferred.nature;
        }
      }
      }
    }
    // ── 持ち物（漢字変換 → 完全一致 → 含む一致フォールバック）──
    if (parsed.item) {
      let iClean = parsed.item.replace(/\s/g, "");
      iClean = ITEM_ALIAS[iClean] ?? iClean;
      const mi = ITEMS.find((i) => i.ja === iClean)
        || ITEMS.find((i) => iClean.includes(i.ja) || i.ja.includes(iClean));
      if (mi) setNewRegItem(mi.slug);
      else {
        warnings.push(`持ち物「${parsed.item}」が不明`);
        suggestions.item = getJaMatchCandidates(parsed.item, ITEM_JA_LIST, { maxDistance: 2, limit: 3 });
      }
    }
    // ── テラタイプ（漢字変換 → 完全一致 → 含む一致フォールバック）──
    if (parsed.teraType) {
      let tClean = parsed.teraType.replace(/\s/g, "");
      tClean = TERA_ALIAS[tClean] ?? tClean;
      const te = Object.entries(TYPE_NAMES_JA).find(([, ja]) => ja === tClean)
        || Object.entries(TYPE_NAMES_JA).find(([, ja]) => tClean.includes(ja) || ja.includes(tClean));
      if (te) setNewRegTeraType(te[0] as PokemonType);
      else {
        warnings.push(`テラタイプ「${parsed.teraType}」が不明`);
        suggestions.teraType = getJaMatchCandidates(parsed.teraType, TYPE_JA_LIST, { maxDistance: 1, limit: 3 })
          .map((ja) => Object.entries(TYPE_NAMES_JA).find(([, value]) => value === ja)?.[0] as PokemonType)
          .filter(Boolean);
      }
    }
    // ── 技（漢字変換 → 完全一致 → 含む一致フォールバック）──
    if (parsed.moves.length > 0) {
      const slugs = parsed.moves.slice(0, 4).map((m, index) => {
        let mClean = m.replace(/\s/g, "");
        mClean = MOVE_ALIAS[mClean] ?? mClean;
        const e = Object.entries(MOVE_NAMES_JA).find(([, ja]) => ja === mClean)
          || Object.entries(MOVE_NAMES_JA).find(([, ja]) => mClean.includes(ja) || ja.includes(mClean));
        if (!e) {
          warnings.push(`技「${m}」が不明`);
          const options = getJaMatchCandidates(m, MOVE_JA_LIST, { maxDistance: 2, limit: 3 })
            .map((ja) => Object.entries(MOVE_NAMES_JA).find(([, value]) => value === ja)?.[0] ?? "")
            .filter(Boolean);
          if (options.length > 0) {
            suggestions.moves = [...(suggestions.moves ?? []), { index, options }];
          }
        }
        return e ? e[0] : "";
      });
      setNewRegMoves([slugs[0] || "", slugs[1] || "", slugs[2] || "", slugs[3] || ""]);
    }
    // ── 型名自動生成 ──
    if (parsed.pokemonName) {
      const pokeName = parsed.pokemonName;
      // 持ち物名は正式名変換後のものを使う
      const resolvedItem = parsed.item ? (ITEM_ALIAS[parsed.item] ?? parsed.item) : "";
      if (resolvedItem) {
        const shortItem = resolvedItem.replace(/^とつげき/, "").replace(/^こだわり/, "");
        setNewRegName(`${shortItem}${pokeName}`);
      } else if (parsed.nature) {
        const resolvedNature = NATURE_ALIAS[parsed.nature] ?? parsed.nature;
        setNewRegName(`${resolvedNature}${pokeName}`);
      } else {
        setNewRegName(pokeName);
      }
    }

    // ── フォーム推論（技構成からフォルムを判定）──
    // 例: ランドロスで「そらをとぶ」→霊獣フォルム
    if (parsed.pokemonName && parsed.moves.length > 0) {
      const FORM_HINTS: Record<string, { moves: string[]; form: string }[]> = {
        "ランドロス": [
          { moves: ["そらをとぶ", "つるぎのまい", "とんぼがえり"], form: "ランドロス(れいじゅう)" },
        ],
        "ガチグマ": [
          { moves: ["ブラッドムーン", "だいちのちから", "ハイパーボイス"], form: "ガチグマ(あかつき)" },
        ],
        "バドレックス": [
          { moves: ["アストラルビット"], form: "バドレックス(くろうま)" },
          { moves: ["ブリザードランス"], form: "バドレックス(しろうま)" },
        ],
      };
      const hints = FORM_HINTS[parsed.pokemonName];
      if (hints) {
        const moveSlugs = parsed.moves.map((m) => {
          const e = Object.entries(MOVE_NAMES_JA).find(([, ja]) => ja === m);
          return e ? e[1] : m;
        });
        for (const hint of hints) {
          if (hint.moves.some((hm) => moveSlugs.includes(hm))) {
            // フォルム違いが検出された→候補を表示
            const candidates = findPokemonCandidates(hint.form);
            if (candidates.length === 1) {
              try {
                const poke = await fetchPokemon(candidates[0].name);
                setNewRegPokemon(poke);
                setNewRegPokemonName(poke.japaneseName ?? poke.name);
                setNewRegAbility(poke.abilities[0]?.slug ?? "");
              } catch { /* ignore */ }
            } else if (candidates.length > 1) {
              setPokeCandidates(candidates);
              setPendingParsed(parsed);
            }
            break;
          }
        }
      }
    }

    // フォームにスクロール
    setTimeout(() => {
      document.querySelector("[data-newreg-form]")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);

    if (parsed.ability && warnings.some((warning) => warning.includes("特性"))) {
      suggestions.ability = getJaMatchCandidates(parsed.ability, ABILITY_JA_LIST, { maxDistance: 2, limit: 3 });
    }
    setParseSuggestions(
      Object.values(suggestions).some((value) => Array.isArray(value) && value.length > 0)
        ? suggestions
        : null
    );

    return warnings;
  }, [ABILITY_JA_LIST, ITEM_JA_LIST, MOVE_JA_LIST, NATURE_JA_LIST, NATURE_JA_TO_KEY, TYPE_JA_LIST]);

  /** テキスト貼り付けからパース→自動入力 */
  const handleTextParse = useCallback(async (raw: string) => {
    setPasteLoading(true);
    setPasteError(null);
    try {
      const parsed = parsePokeText(raw);
      if (parsed.filledCount === 0) {
        setPasteError("テキストからポケモン情報を読み取れませんでした");
        return;
      }
      const warnings = await applyParsedData(parsed);
      setPasteText("");
      if (warnings.length > 0) {
        setPasteError(`一部の項目が不明: ${warnings.join("、")}`);
      } else {
        setSavedMessage(`✅ ${parsed.filledCount}項目を推論して反映しました`);
        setTimeout(() => setSavedMessage(null), 2500);
      }
    } catch (err) {
      setPasteError(err instanceof Error ? err.message : "解析に失敗しました");
    } finally {
      setPasteLoading(false);
    }
  }, [parsePokeText, applyParsedData]);

  /**
   * スクショ解析:
   * 1. まずTesseract.jsローカルOCRで解析（育成論画像・白背景テキストに強い）
   * 2. ローカルOCRで項目が足りない場合のみClaude Vision APIで補完
   * → サーバー側エラー時もローカルOCRだけで動作を継続する
   */
  const handleOcrFile = useCallback(async (file: File) => {
    setOcrError(null);
    setOcrPreview(null);
    setOcrLoading(true);
    try {
      // プレビュー用dataURL
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      setOcrPreview(dataUrl);

      // ── 方法1: Tesseract.jsローカルOCR ──
      let localParsed: ReturnType<typeof parsePokeText> | null = null;
      let localOcrText = "";
      try {
        const tesseractMod = await import("tesseract.js");
        const Tesseract = tesseractMod.default ?? tesseractMod;
        const { data } = await Tesseract.recognize(file, "jpn", { logger: () => {} });
        localOcrText = data.text?.trim() ?? "";
        if (localOcrText.length >= 3) {
          localParsed = parsePokeText(localOcrText);
        } else {
          setPasteText("");
        }
      } catch {
        // ローカルOCRに失敗してもAI補完を試す
      }

      const localHasEvs = localParsed ? Object.values(localParsed.evs).some((value) => value > 0) : false;
      const localHasStats = localParsed ? Object.keys(localParsed.actualStats).length >= 4 : false;
      const shouldTrustLocalOcr = !!localParsed
        && localParsed.filledCount >= 6
        && !!localParsed.item
        && !!localParsed.nature
        && (localHasEvs || localHasStats)
        && !localParsed.isChampionsLayout;

      if (shouldTrustLocalOcr && localParsed) {
        const warnings = await applyParsedData(localParsed);
        setOcrLoading(false);
        setPasteText("");
        setTimeout(() => setOcrPreview(null), 2500);
        if (warnings.length > 0) {
          setOcrError(`${localParsed.filledCount}項目を解析して反映しました。不明: ${warnings.join("、")}`);
        } else {
          setSavedMessage(`✅ ${localParsed.filledCount}項目を解析して反映しました`);
          setTimeout(() => setSavedMessage(null), 2500);
        }
        return;
      }

      // ── 方法2: Claude Vision APIで補完 ──
      try {
        const res = await fetch("/api/parse-screenshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: dataUrl,
            mediaType: file.type || "image/png",
            ocrText: localOcrText || undefined,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          if (!json.error && json.pokemonName) {
            const evMap = normalizeOcrEvs(json.evs);
            const actualStats = normalizeOcrActualStats(json.stats);
            const apiParsed = {
              pokemonName: json.pokemonName || "",
              item: json.item || "",
              teraType: json.teraType || "",
              nature: json.nature || "",
              ability: json.ability || "",
              evs: { ...evMap },
              actualStats,
              moves: (json.moves || []).filter(Boolean) as string[],
              isChampionsLayout: /pokemon\s*champions|能力ポイント|VP/i.test(JSON.stringify(json)),
              filledCount: [json.pokemonName, json.item, json.teraType, json.nature, json.ability,
                ...(json.moves || [])].filter(Boolean).length +
                ((Object.values(evMap).some((v: unknown) => v && v !== 0) || Object.keys(actualStats).length > 0) ? 1 : 0),
            };

            const parsed = localParsed ? mergeParsedResults(apiParsed, localParsed) : apiParsed;
            const warnings = await applyParsedData(parsed);
            setOcrLoading(false);
            setPasteText("");
            setTimeout(() => setOcrPreview(null), 2500);
            if (warnings.length > 0) {
              setOcrError(`${parsed.filledCount}項目をAIで解析して反映しました。不明: ${warnings.join("、")}`);
            } else {
              setSavedMessage(`✅ ${parsed.filledCount}項目をAIで解析して反映しました`);
              setTimeout(() => setSavedMessage(null), 2500);
            }
            return;
          }
        }
      } catch {
        // AI APIが失敗してもローカルOCR結果があれば下で使う
      }

      setOcrLoading(false);
      if (localParsed && localParsed.filledCount > 0) {
        const warnings = await applyParsedData(localParsed);
        setPasteText("");
        setTimeout(() => setOcrPreview(null), 2500);
        if (warnings.length > 0) {
          setOcrError(`${localParsed.filledCount}項目を解析して反映しました。不明: ${warnings.join("、")}`);
        } else {
          setSavedMessage(`✅ ${localParsed.filledCount}項目を解析して反映しました`);
          setTimeout(() => setSavedMessage(null), 2500);
        }
        return;
      }

      setOcrPreview(null);
      setPasteText("");
      setOcrError("画像の解析に失敗しました。テキストから読込をお試しください。");
    } catch {
      setOcrError("画像の読み取りに失敗しました。テキストを直接貼り付けてお試しください。");
      setOcrPreview(null);
      setOcrLoading(false);
    }
  }, [parsePokeText, applyParsedData]);

  /** 候補からポケモンを選択して残りのデータを反映 */
  const handleCandidateSelect = useCallback(async (candidate: { name: string; ja: string }) => {
    setPokeCandidates([]);
    try {
      if (pendingParsed) {
        const reparsed = { ...pendingParsed, pokemonName: candidate.ja };
        setPendingParsed(null);
        const warnings = await applyParsedData(reparsed);
        if (warnings.length > 0) {
          setOcrError(`一部の項目が不明: ${warnings.join("、")}`);
        }
      } else {
        const poke = await fetchPokemon(candidate.name);
        setNewRegPokemon(poke);
        setNewRegPokemonName(poke.japaneseName ?? poke.name);
      }
      // フォームにスクロール
      setTimeout(() => {
        document.querySelector("[data-newreg-form]")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch {
      setOcrError(`「${candidate.ja}」の読み込みに失敗しました`);
    }
  }, [pendingParsed, applyParsedData]);

  const resetNewReg = () => {
    setEditingId(null);
    setNewRegPokemon(null);
    setNewRegPokemonName("");
    setNewRegName("");
    setNewRegNature("hardy");
    setNewRegLevel(50);
    setNewRegLevelStr("50");
    setNewRegEvs({ hp: 0, attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 });
    setNewRegItem("");
    setNewRegTeraType(null);
    setNewRegMoves(["", "", "", ""]);
    setNewRegAbility("");
    setNewRegNatureOpen(false);
    setOpenMoveSlot(null);
    setMoveQuery("");
    setItemDropOpen(false);
    setItemQuery("");
    setActiveField(null);
    setNumpadVal("0");
    setNumpadFresh(true);
    setIsComposing(false);
    setParseSuggestions(null);
    setPasteError(null);
    setOcrError(null);
    setOcrPreview(null);
    setIsDragOver(false);
  };

  const commitNewReg = () => {
    if (isComposing) return;
    if (!newRegPokemon || !newRegName.trim()) return;
    const state: PokemonState = {
      pokemon: newRegPokemon,
      level: newRegLevel,
      nature: newRegNature,
      ivs: DEFAULT_IVS,
      evs: newRegEvs,
      teraType: newRegTeraType,
      isTerastallized: false,
      isDynamaxed: false,
      isMegaEvolved: false,
      megaForm: null,
      isBurned: false,
      isCharged: false,
      ability: newRegAbility || (newRegPokemon.abilities[0]?.slug ?? ""),
      item: newRegItem,
      statRanks: { attack: 0, spAtk: 0, defense: 0, spDef: 0 },
      fieldConditions: { ...DEFAULT_FIELD },
    };
    const movesToSave = newRegMoves.filter(m => m.trim() !== "");
    if (editingId) {
      syncEntries(updateBox(editingId, newRegName.trim(), state, movesToSave));
      setSavedMessage(`「${newRegName.trim()}」を上書き保存しました！`);
    } else {
      syncEntries(saveToBox(newRegName.trim(), state, movesToSave));
      setSavedMessage(`「${newRegName.trim()}」を登録しました！`);
    }
    resetNewReg();
    setTimeout(() => { setSavedMessage(null); }, 2000);
  };

  const copyNewRegAsText = async () => {
    if (!newRegPokemon) return;
    const state: PokemonState = {
      pokemon: newRegPokemon,
      level: newRegLevel,
      nature: newRegNature,
      ivs: DEFAULT_IVS,
      evs: newRegEvs,
      teraType: newRegTeraType,
      isTerastallized: false,
      isDynamaxed: false,
      isMegaEvolved: false,
      megaForm: null,
      isBurned: false,
      isCharged: false,
      ability: newRegAbility || (newRegPokemon.abilities[0]?.slug ?? ""),
      item: newRegItem,
      statRanks: { attack: 0, spAtk: 0, defense: 0, spDef: 0 },
      fieldConditions: { ...DEFAULT_FIELD },
    };
    const text = formatPokemonText(state, newRegMoves);
    try {
      const copied = await copyText(text);
      if (!copied) throw new Error("copy failed");
      setSavedMessage("✅ コピーが完了しました");
      setTimeout(() => setSavedMessage(null), 2000);
    } catch {
      window.prompt("文字情報をコピーしてください", text);
    }
  };

  const totalEvs = Object.values(newRegEvs).reduce((a, b) => a + b, 0);
  const setEv = (key: keyof EVIVs, val: number) => {
    const other = totalEvs - (newRegEvs[key] ?? 0);
    const clamped = Math.max(0, Math.min(252, Math.min(val, 510 - other)));
    setNewRegEvs((prev) => ({ ...prev, [key]: clamped }));
  };

  const getActualStatForReg = (key: keyof EVIVs, ev: number, lv?: number): number => {
    if (!newRegPokemon) return 0;
    const base = newRegPokemon.baseStats[key as StatKey];
    const iv = 31;
    const level = lv ?? newRegLevel;
    if (key === 'hp') {
      return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
    }
    const rawStat = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;
    const nd = NATURE_DATA[newRegNature];
    const mod = nd.boosted === (key as StatKey) ? 1.1 : nd.reduced === (key as StatKey) ? 0.9 : 1.0;
    return Math.floor(rawStat * mod);
  };
  const evFromActualStatForReg = (key: keyof EVIVs, target: number, lv?: number): number => {
    for (let ev = 0; ev <= 252; ev++) {
      if (getActualStatForReg(key, ev, lv) >= target) return ev;
    }
    return 252;
  };
  const selectField = (key: keyof EVIVs, mode: 'ev' | 'stat', overrideVal?: number) => {
    const val = overrideVal !== undefined
      ? overrideVal.toString()
      : mode === 'ev'
        ? newRegEvs[key].toString()
        : getActualStatForReg(key, newRegEvs[key]).toString();
    setActiveField({ key, mode });
    setNumpadVal(val);
    setNumpadFresh(true);
  };
  const applyNumpadVal = (raw: string, field: { key: keyof EVIVs | 'level'; mode: 'ev' | 'stat' | 'level' } | null) => {
    if (!field) return;
    if (field.mode === 'level') {
      const v = Math.max(1, Math.min(100, parseInt(raw) || 1));
      setNewRegLevel(v);
      setNewRegLevelStr(String(v));
      return;
    }
    const n = Math.max(0, parseInt(raw) || 0);
    if (field.mode === 'ev') {
      setEv(field.key as keyof EVIVs, n);
    } else if (newRegPokemon) {
      const ev = evFromActualStatForReg(field.key as keyof EVIVs, n, newRegLevel);
      setEv(field.key as keyof EVIVs, ev);
    }
  };
  const handleNumpadDigit = (d: string) => {
    let next: string;
    if (numpadFresh) { next = d; setNumpadFresh(false); }
    else { next = numpadVal === "0" ? d : numpadVal + d; if (next.length > 3) return; }
    setNumpadVal(next);
    applyNumpadVal(next, activeField);
  };
  const handleNumpadBack = () => {
    const next = numpadVal.length > 1 ? numpadVal.slice(0, -1) : "0";
    setNumpadVal(next); setNumpadFresh(false); applyNumpadVal(next, activeField);
  };

  const handleDelete = (id: string) => syncEntries(deleteFromBox(id));

  const startEdit = (entry: BoxEntry) => {
    setEditingId(entry.id);
    setNewRegPokemon(entry.state.pokemon ?? null);
    setNewRegPokemonName(entry.state.pokemon?.japaneseName ?? "");
    setNewRegName(entry.name);
    setNewRegNature(entry.state.nature);
    setNewRegLevel(entry.state.level ?? 50);
    setNewRegLevelStr(String(entry.state.level ?? 50));
    setNewRegEvs({ ...entry.state.evs });
    setNewRegItem(entry.state.item ?? "");
    setNewRegTeraType(entry.state.teraType ?? null);
    setNewRegAbility(entry.state.ability ?? "");
    // 技: moves配列を4スロットに正規化
    const m = entry.moves ?? [];
    setNewRegMoves([m[0] ?? "", m[1] ?? "", m[2] ?? "", m[3] ?? ""]);
    setNewRegNatureOpen(false);
    setOpenMoveSlot(null);
    setMoveQuery("");
    setItemDropOpen(false);
    setItemQuery("");
    setActiveField(null);
    setNumpadVal("0");
    setNumpadFresh(true);
    // フォームが見えるようスクロール
    setTimeout(() => {
      document.querySelector("[data-newreg-form]")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  // PWA: Service Worker登録（開発時は必ず解除＋Cache Storage 掃除。/_next を古くキャッシュすると Webpack が落ちる）
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const host = window.location.hostname;
    const isLocalhost = host === "localhost" || host === "127.0.0.1";

    if (process.env.NODE_ENV !== "production" || isLocalhost) {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => {});
      if (typeof caches !== "undefined") {
        caches.keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          .catch(() => {});
      }
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);


  // ボックスから「編集」で開いた場合、自動でstartEditを呼ぶ
  useEffect(() => {
    if (initialEditEntry && !didAutoEdit) {
      setDidAutoEdit(true);
      startEdit(initialEditEntry);
    }
  }, [initialEditEntry, didAutoEdit]);

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center px-2 pt-2 pb-2">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[98vh] flex flex-col overflow-hidden" style={{borderRadius: '1rem'}}>
        {/* 保存完了トースト */}
        {savedMessage && (
          <div className="absolute inset-x-4 top-12 z-[400] flex items-center gap-2 bg-green-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-lg animate-pulse pointer-events-none">
            <span>✅</span>
            <span>{savedMessage}</span>
          </div>
        )}

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-green-600 to-emerald-500 text-white flex-shrink-0">
          <h2 className="font-bold text-base">{editingId ? "ポケモンを編集" : "ポケモンを登録する"}</h2>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/35 flex items-center justify-center font-bold transition-colors">✕</button>
          </div>
        </div>

        {/* ── 検索エリア（スクロール対象外・dropdownがここから溢れる） ── */}
        <div className="flex-shrink-0 px-4 pt-3 pb-3 bg-green-50 border-b border-green-100" style={{overflow: 'visible', position: 'relative', zIndex: 200}}>
          <PokemonSearch
            label="ポケモン検索"
            pokemonName={newRegPokemonName}
            onSelect={(poke) => {
              setNewRegPokemon(poke);
              setNewRegPokemonName(poke.japaneseName ?? poke.name);
              setNewRegName(poke.japaneseName ?? poke.name);
              setNewRegNature("hardy");
              setNewRegEvs({ hp: 0, attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 });
              setNewRegItem("");
              setNewRegTeraType(null);
              setNewRegMoves(["", "", "", ""]);
              setNewRegAbility(poke.abilities[0]?.slug ?? "");
              setNewRegNatureOpen(false);
              setOpenMoveSlot(null);
              setEditingId(null);
            }}
          />
          {newRegPokemon && (
            <div className="flex items-center gap-2 py-2">
              {newRegPokemon.spriteUrl && <img src={newRegPokemon.spriteUrl} alt="" className="w-8 h-8 object-contain" />}
              <span className="text-sm font-bold text-green-800">{newRegPokemon.japaneseName}</span>
              {editingId && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">編集中</span>}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* データ読み込みエリア */}
          <div className="border-b bg-gray-50 border-gray-200">
            <div className="px-4 py-3 space-y-2">
            <input
              ref={ocrFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void handleOcrFile(file);
                e.currentTarget.value = "";
              }}
            />
            <input
              ref={ocrCameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void handleOcrFile(file);
                e.currentTarget.value = "";
              }}
            />

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const file = Array.from(e.dataTransfer.files).find((entry) => entry.type.startsWith("image/"));
                if (file) {
                  void handleOcrFile(file);
                } else {
                  setOcrError("画像ファイルをドロップしてください");
                }
              }}
              className={`rounded-xl border-2 border-dashed p-4 transition-colors ${
                isDragOver
                  ? "border-emerald-400 bg-emerald-50"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <p className="hidden font-bold text-gray-700 sm:block">スクショをここにドラッグ&ドロップ</p>
              <p className="text-sm text-gray-500">育成画面の画像を入れると、ポケモン名・努力値・技・持ち物などを新規登録欄へ反映します</p>
              {ocrLoading && <p className="mt-2 text-emerald-600">画像を解析しています...</p>}
              {ocrError && <p className="mt-2 text-red-500">{ocrError}</p>}
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => ocrFileInputRef.current?.click()}
                  disabled={ocrLoading}
                  className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  写真を読み込む
                </button>
              </div>

              {ocrPreview && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-2">
                  <p className="text-[11px] font-medium text-gray-600 mb-2">読み取り画像</p>
                  <img src={ocrPreview} alt="OCR preview" className="max-h-40 w-auto mx-auto rounded-md object-contain" />
                </div>
              )}
            </div>

            <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-4">
              <p className="mb-2 text-xs text-gray-500">いろいろな書き方に対応しています</p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"名前: ポケモン名\n持物: もちもの名\nテラス: ノーマル\n特性: 特性名\n性格: 性格名\n努力値: H252 A0 B0 C252 D4 S0\n技: わざ1, わざ2, わざ3, わざ4"}
                className="min-h-[196px] w-full resize-none rounded-xl border-2 border-dashed border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-700 placeholder:text-[clamp(13px,3.2vw,17px)] placeholder:leading-6 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
                rows={7}
              />
              {pasteError && <p className="mt-2 text-xs text-red-500">{pasteError}</p>}
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    if (pasteLoading || !pasteText.trim()) return;
                    handleTextParse(pasteText);
                  }}
                  aria-disabled={pasteLoading || !pasteText.trim()}
                  className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50"
                >
                  {pasteLoading ? "解析中..." : "テキストを解析して自動入力"}
                </button>
              </div>
            </div>

            {/* ポケモン候補選択UI */}
            {pokeCandidates.length > 1 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-amber-800">該当するポケモンを選んでください</p>
                <div className="flex flex-wrap gap-1.5">
                  {pokeCandidates.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => handleCandidateSelect(c)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 active:bg-amber-200 transition-colors shadow-sm"
                    >
                      {c.ja}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {parseSuggestions && (
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-sky-800">読み取り候補</p>
                {parseSuggestions.pokemon && parseSuggestions.pokemon.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-sky-700">ポケモン候補</p>
                    <div className="flex flex-wrap gap-1.5">
                      {parseSuggestions.pokemon.map((candidate) => (
                        <button
                          key={`suggest-pokemon-${candidate.name}`}
                          onClick={() => handleCandidateSelect(candidate)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white border border-sky-300 text-sky-800 hover:bg-sky-100"
                        >
                          {candidate.ja}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {parseSuggestions.item && parseSuggestions.item.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-sky-700">持ち物候補</p>
                    <div className="flex flex-wrap gap-1.5">
                      {parseSuggestions.item.map((itemJa) => {
                        const item = ITEMS.find((entry) => entry.ja === itemJa);
                        if (!item) return null;
                        return (
                          <button
                            key={`suggest-item-${item.slug}`}
                            onClick={() => setNewRegItem(item.slug)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white border border-sky-300 text-sky-800 hover:bg-sky-100"
                          >
                            {itemJa}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {parseSuggestions.ability && parseSuggestions.ability.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-sky-700">特性候補</p>
                    <div className="flex flex-wrap gap-1.5">
                      {parseSuggestions.ability.map((abilityJa) => (
                        <button
                          key={`suggest-ability-${abilityJa}`}
                          onClick={() => {
                            if (!newRegPokemon) return;
                            const matched = newRegPokemon.abilities.find((entry) => getAbilityJaName(entry.slug) === abilityJa);
                            if (matched) setNewRegAbility(matched.slug);
                          }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white border border-sky-300 text-sky-800 hover:bg-sky-100"
                        >
                          {abilityJa}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {parseSuggestions.nature && parseSuggestions.nature.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-sky-700">性格候補</p>
                    <div className="flex flex-wrap gap-1.5">
                      {parseSuggestions.nature.map((natureKey) => (
                        <button
                          key={`suggest-nature-${natureKey}`}
                          onClick={() => setNewRegNature(natureKey)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white border border-sky-300 text-sky-800 hover:bg-sky-100"
                        >
                          {NATURE_DATA[natureKey].ja}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {parseSuggestions.teraType && parseSuggestions.teraType.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-sky-700">テラスタイプ候補</p>
                    <div className="flex flex-wrap gap-1.5">
                      {parseSuggestions.teraType.map((type) => (
                        <button
                          key={`suggest-tera-${type}`}
                          onClick={() => setNewRegTeraType(type)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white border border-sky-300 text-sky-800 hover:bg-sky-100"
                        >
                          {TYPE_NAMES_JA[type]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {parseSuggestions.moves && parseSuggestions.moves.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-sky-700">技候補</p>
                    <div className="space-y-1">
                      {parseSuggestions.moves.map((entry) => (
                        <div key={`suggest-move-${entry.index}`} className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-sky-700">技{entry.index + 1}</span>
                          {entry.options.map((slug) => (
                            <button
                              key={`suggest-move-${entry.index}-${slug}`}
                              onClick={() => {
                                const next = [...newRegMoves];
                                next[entry.index] = slug;
                                setNewRegMoves(next);
                              }}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white border border-sky-300 text-sky-800 hover:bg-sky-100"
                            >
                              {getMoveJa(slug)}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            </div>
          </div>

          {/* ── スクロール可能なフォーム本体 ── */}
          {/* 新規登録フォーム（常に表示） */}
          {newRegPokemon && (
            <div className="bg-green-50 border-b border-green-100" data-newreg-form>
              <div className="px-4 pt-2 pb-28 space-y-3">
                  <>
                    {/* 登録名 */}
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">登録名（型名）</label>
                      <input
                        value={newRegName}
                        onChange={(e) => setNewRegName(e.target.value)}
                        placeholder="例：いじっぱり型"
                        onCompositionStart={() => setIsComposing(true)}
                        onCompositionEnd={() => setIsComposing(false)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !isComposing) e.preventDefault(); }}
                        className="w-full border border-green-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                      />
                    </div>

                    {/* テラスタイプ */}
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1.5 block">テラスタイプ</label>
                      <div className="grid grid-cols-9 gap-1">
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setNewRegTeraType(null)}
                          className={`col-span-1 py-1 text-[9px] rounded border font-bold transition-colors ${
                            newRegTeraType === null ? "bg-gray-500 text-white border-gray-500" : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
                          }`}
                        >なし</button>
                        {ALL_TERA_TYPES.map((t) => (
                          <button
                            key={t}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setNewRegTeraType(t)}
                            className={`py-1 text-[9px] rounded border font-bold transition-colors ${
                              newRegTeraType === t
                                ? "bg-indigo-500 text-white border-indigo-500"
                                : "bg-white text-gray-600 border-gray-200 hover:bg-indigo-50 hover:border-indigo-300"
                            }`}
                          >
                            {TYPE_NAMES_JA[t]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 技 4スロット（インラインアコーディオン） */}
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1.5 block">わざ</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {([0, 1, 2, 3] as const).map((slotIdx) => {
                          const slug = newRegMoves[slotIdx];
                          const isActive = openMoveSlot === slotIdx;
                          return (
                            <button
                              key={slotIdx}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => { setOpenMoveSlot(isActive ? null : slotIdx); setMoveQuery(""); }}
                              className={`rounded-lg border px-2 py-1.5 text-left transition-colors ${
                                isActive ? "border-indigo-400 bg-indigo-50" : slug ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"
                              }`}
                            >
                              <p className="text-[9px] text-gray-400 leading-none mb-0.5">技{slotIdx + 1}</p>
                              <p className={`text-xs font-medium truncate leading-tight ${slug ? "text-blue-700" : "text-gray-300"}`}>
                                {slug ? getMoveJa(slug) : "なし"}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                      {/* 技選択パネル（インライン） */}
                      {openMoveSlot !== null && (() => {
                        const popularMoves = getPopularMovesForPokemon(newRegPokemon);
                        const allMoveSet = new Set(newRegPokemon.moveNames);
                        // 編集中の場合、登録済み技（現在のスロット以外）を優先表示
                        const registeredMovesForPanel = editingId
                          ? newRegMoves.filter((m, idx) => m && idx !== openMoveSlot)
                          : [];
                        const registeredSet = new Set(registeredMovesForPanel);
                        const basePopular = moveQuery
                          ? [...new Set([
                              ...popularMoves.filter((m) => getMoveJa(m).includes(moveQuery)),
                              ...newRegPokemon.moveNames.filter((m) => getMoveJa(m).includes(moveQuery)),
                              ...POPULAR_MOVE_SLUGS.filter((m) => getMoveJa(m).includes(moveQuery)),
                            ])]
                          : (popularMoves.length > 0 ? popularMoves : POPULAR_MOVE_SLUGS.slice(0, 40));
                        const displayMoves = moveQuery
                          ? basePopular
                          : basePopular.filter((m) => !registeredSet.has(m));
                        return (
                          <div className="mt-1.5 rounded-xl border border-indigo-200 bg-white shadow-md overflow-hidden">
                            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-indigo-50 border-b border-indigo-100">
                              <span className="text-[10px] font-bold text-indigo-600 flex-shrink-0">技{openMoveSlot + 1}</span>
                              <input
                                autoFocus
                                value={moveQuery}
                                onChange={(e) => setMoveQuery(e.target.value)}
                                placeholder="技を検索..."
                                className="flex-1 text-xs px-2 py-0.5 border border-indigo-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                              />
                              <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => { const m = [...newRegMoves]; m[openMoveSlot] = ""; setNewRegMoves(m); setOpenMoveSlot(null); }}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 flex-shrink-0"
                              >クリア</button>
                              <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => setOpenMoveSlot(null)}
                                className="text-gray-400 hover:text-gray-600 text-sm flex-shrink-0"
                              >✕</button>
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                              {/* 登録済みの技（編集中かつクエリなし時のみ最上部表示） */}
                              {!moveQuery && registeredMovesForPanel.length > 0 && (
                                <>
                                  <p className="text-[9px] text-green-600 font-bold px-2 py-1 bg-green-50 border-b">登録済みの技</p>
                                  {registeredMovesForPanel.map((ms) => (
                                    <button
                                      key={"reg-" + ms}
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => { const m = [...newRegMoves]; m[openMoveSlot] = ms; setNewRegMoves(m); setOpenMoveSlot(null); setMoveQuery(""); }}
                                      className={`w-full text-left px-3 py-1.5 text-xs border-b border-green-50 last:border-0 transition-colors ${
                                        newRegMoves[openMoveSlot] === ms ? "bg-green-100 text-green-700 font-bold" : "hover:bg-green-50 text-gray-700"
                                      }`}
                                    >{getMoveJa(ms)}</button>
                                  ))}
                                </>
                              )}
                              {!moveQuery && <p className="text-[9px] text-gray-400 px-2 py-1 bg-gray-50 border-b">よく使う技</p>}
                              {displayMoves.map((ms) => (
                                <button
                                  key={ms}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => { const m = [...newRegMoves]; m[openMoveSlot] = ms; setNewRegMoves(m); setOpenMoveSlot(null); setMoveQuery(""); }}
                                  className={`w-full text-left px-3 py-1.5 text-xs border-b border-gray-50 last:border-0 transition-colors ${
                                    newRegMoves[openMoveSlot] === ms ? "bg-indigo-100 text-indigo-700 font-bold" : "hover:bg-indigo-50 text-gray-700"
                                  }`}
                                >
                                  {getMoveJa(ms)}
                                  {!allMoveSet.has(ms) && <span className="ml-1 text-[9px] text-gray-300">*</span>}
                                </button>
                              ))}
                              {displayMoves.length === 0 && registeredMovesForPanel.length === 0 && <p className="text-xs text-gray-400 text-center py-4">見つかりません</p>}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* 性格 */}
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">性格補正</label>
                      <button
                        onClick={() => setNewRegNatureOpen((v) => !v)}
                        className={`w-full text-left px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          newRegNatureOpen
                            ? "bg-indigo-500 text-white border-indigo-500"
                            : "bg-white border-gray-300 text-gray-800 hover:border-indigo-400"
                        }`}
                      >
                        <span className="flex items-center justify-between">
                          <span>
                            {NATURE_DATA[newRegNature].ja}
                            {NATURE_DATA[newRegNature].boosted && (
                              <span className="ml-2 text-xs text-red-500 font-bold">
                                {STAT_NAMES_JA[NATURE_DATA[newRegNature].boosted!]}↑
                              </span>
                            )}
                            {NATURE_DATA[newRegNature].reduced && (
                              <span className="ml-1 text-xs text-blue-500 font-bold">
                                {STAT_NAMES_JA[NATURE_DATA[newRegNature].reduced!]}↓
                              </span>
                            )}
                          </span>
                          <span className="text-xs opacity-70">{newRegNatureOpen ? "▲" : "▼"}</span>
                        </span>
                      </button>
                      {/* 性格グリッド（縦=上昇↑ 横=下降↓） */}
                      {newRegNatureOpen && (
                        <div className="mt-1.5 rounded-xl border border-indigo-200 bg-white overflow-hidden shadow-lg">
                          <div className="grid grid-cols-6 border-b border-gray-100">
                            <div className="bg-gray-50" />
                            {NATURE_STAT_KEYS.map((key) => (
                              <div key={key} className="bg-indigo-50 px-0.5 py-1.5 text-center text-[10px] font-bold text-indigo-600 border-l border-gray-100">
                                {STAT_NAMES_JA[key]}<span className="text-blue-500 font-bold">↓</span>
                              </div>
                            ))}
                          </div>
                          {NATURE_GRID.map((row, ri) => (
                            <div key={ri} className="grid grid-cols-6">
                              <div className="bg-indigo-50 flex items-center justify-center px-0.5 py-1.5 border-t border-gray-100">
                                <span className="text-[10px] font-bold text-indigo-600">
                                  {STAT_NAMES_JA[NATURE_STAT_KEYS[ri]]}<span className="text-red-500 font-bold">↑</span>
                                </span>
                              </div>
                              {row.map((slug, ci) => {
                                const isNeutral = ri === ci;
                                const isSelected = newRegNature === slug;
                                return (
                                  <button
                                    key={slug}
                                    onClick={() => { setNewRegNature(slug as Nature); setNewRegNatureOpen(false); }}
                                    className={`py-1.5 text-[11px] font-medium border-t border-l border-gray-100 transition-colors ${
                                      isSelected ? "bg-green-500 text-white font-bold" : isNeutral ? "bg-gray-100 text-gray-400 hover:bg-gray-200" : "hover:bg-indigo-50 text-gray-700"
                                    }`}
                                  >
                                    {NATURE_DATA[slug as Nature].ja}
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 特性 */}
                    {newRegPokemon && newRegPokemon.abilities.length > 0 && (
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">特性</label>
                        <div className="flex flex-wrap gap-1.5">
                          {newRegPokemon.abilities.map((a) => {
                            const isSelected = newRegAbility === a.slug;
                            return (
                              <button
                                key={a.slug}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => setNewRegAbility(a.slug)}
                                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                                  isSelected
                                    ? "bg-purple-500 text-white border-purple-500 shadow-sm"
                                    : "bg-white text-gray-700 border-gray-300 hover:bg-purple-50 hover:border-purple-300"
                                }`}
                              >
                                {getAbilityJaName(a.slug)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 努力値・実数値 + MAX/MIN */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5 gap-1 flex-wrap">
                        <label className="text-xs font-semibold text-gray-600 flex-shrink-0">努力値 / 実数値</label>
                        <div className="flex items-center gap-1.5 ml-auto">
                          {/* レベル入力 */}
                          <div className="flex items-center gap-0.5">
                            <span className="text-[11px] text-gray-500 font-semibold">Lv.</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              readOnly
                              value={newRegLevelStr}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={() => {
                                setActiveField({ key: 'level', mode: 'level' });
                                setNumpadVal(String(newRegLevel));
                                setNumpadFresh(true);
                              }}
                              className={`w-12 text-xs border rounded px-1 py-0.5 text-center cursor-pointer focus:outline-none transition-colors ${
                                activeField?.mode === 'level'
                                  ? "border-indigo-400 ring-1 ring-indigo-400 bg-indigo-50"
                                  : "border-gray-300 hover:border-indigo-300"
                              }`}
                            />
                          </div>
                          {/* Lv.50変換ボタン（常時表示、Lv.50時はグレーアウト） */}
                          {newRegPokemon && (
                            <button
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => { setNewRegLevel(50); setNewRegLevelStr("50"); }}
                              disabled={newRegLevel === 50}
                              className={`text-[10px] px-2 py-0.5 rounded-lg font-bold border transition-colors whitespace-nowrap ${
                                newRegLevel === 50
                                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-default"
                                  : "bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200"
                              }`}
                            >
                              ⇩ Lv.50に変換
                            </button>
                          )}
                          <span className={`text-[11px] font-bold flex-shrink-0 ${totalEvs > 510 ? "text-red-500" : totalEvs === 510 ? "text-green-600" : "text-gray-400"}`}>
                            {totalEvs}/510
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["hp", "attack", "defense", "spAtk", "spDef", "speed"] as (keyof EVIVs)[]).map((key) => {
                          const isEvActive   = activeField?.key === key && activeField?.mode === 'ev';
                          const isStatActive = activeField?.key === key && activeField?.mode === 'stat';
                          const statVal = getActualStatForReg(key, newRegEvs[key]);
                          return (
                            <div key={key} className={`rounded-lg border-2 transition-colors overflow-hidden bg-white ${
                              activeField?.key === key ? "border-indigo-400 shadow-sm" : "border-gray-200"
                            }`}>
                              {/* ヘッダー行 */}
                              <div className="bg-gray-50 px-1.5 py-0.5 border-b border-gray-100 flex items-center justify-between">
                                <p className="text-[10px] font-bold text-gray-500">{STAT_NAMES_JA[key as StatKey]}</p>
                                <div className="flex gap-0.5">
                                  <button
                                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                    onClick={() => { const other = totalEvs - (newRegEvs[key] ?? 0); const clamped = Math.max(0, Math.min(252, 510 - other)); setEv(key, 252); selectField(key, 'ev', clamped); }}
                                    className="text-[8px] px-1 py-0.5 rounded bg-orange-100 text-orange-600 hover:bg-orange-200 font-bold leading-none"
                                  >MAX</button>
                                  <button
                                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                    onClick={() => { setEv(key, 0); selectField(key, 'ev', 0); }}
                                    className="text-[8px] px-1 py-0.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 font-bold leading-none"
                                  >MIN</button>
                                </div>
                              </div>
                              {/* 値ボタン行 */}
                              <div className="grid grid-cols-2 divide-x divide-gray-100">
                                <button
                                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                  onClick={() => selectField(key, 'ev')}
                                  className={`px-1.5 py-1.5 text-left transition-colors ${isEvActive ? "bg-indigo-50" : "hover:bg-gray-50"}`}
                                >
                                  <p className="text-[9px] text-gray-400 mb-0.5">努力値</p>
                                  <p className={`text-sm font-bold leading-none ${isEvActive ? "text-indigo-600" : "text-gray-800"}`}>
                                    {newRegEvs[key]}
                                  </p>
                                </button>
                                <button
                                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                  onClick={() => selectField(key, 'stat')}
                                  className={`px-1.5 py-1.5 text-left transition-colors ${isStatActive ? "bg-indigo-50" : "hover:bg-gray-50"}`}
                                >
                                  <p className="text-[9px] text-gray-400 mb-0.5">実数値</p>
                                  <p className={`text-sm font-bold leading-none ${isStatActive ? "text-indigo-600" : "text-gray-700"}`}>
                                    {statVal}
                                  </p>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 道具（インクリメンタルサーチ） */}
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">道具</label>
                      <button
                        onClick={() => setItemDropOpen((v) => !v)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-sm transition-colors ${
                          itemDropOpen ? "border-indigo-400 bg-indigo-50" : "border-gray-300 bg-white hover:border-indigo-300"
                        }`}
                      >
                        <span className="flex items-center justify-between">
                          <span>{newRegItem ? (ITEM_MAP[newRegItem]?.ja ?? newRegItem) : "もちものを選択（なし）"}</span>
                          <span className="text-gray-400 text-xs">{itemDropOpen ? "▲" : "▼"}</span>
                        </span>
                      </button>
                      {itemDropOpen && (
                        <div className="mt-1 rounded-xl border border-indigo-200 bg-white shadow-md overflow-hidden">
                          <div className="px-2 py-1.5 bg-indigo-50 border-b border-indigo-100 flex items-center gap-1.5">
                            <input
                              autoFocus
                              value={itemQuery}
                              onChange={(e) => setItemQuery(e.target.value)}
                              placeholder="道具を検索..."
                              className="flex-1 text-xs px-2 py-1 border border-indigo-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                            />
                            <button
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => setShowItemKana((v) => !v)}
                              className={`flex-shrink-0 text-[10px] px-2 py-1 rounded border transition-colors ${
                                showItemKana ? "bg-indigo-500 text-white border-indigo-500" : "bg-white text-indigo-500 border-indigo-300 hover:bg-indigo-50"
                              }`}
                            >キーボード</button>
                          </div>
                          {showItemKana && (
                            <div className="border-b border-indigo-100">
                              <KanaKeyboard
                                value={itemQuery}
                                onChange={(v) => setItemQuery(v)}
                                onClose={() => setShowItemKana(false)}
                                defaultMode="hiragana"
                              />
                            </div>
                          )}
                          <div className="max-h-40 overflow-y-auto">
                            {ITEMS.filter((it) => !itemQuery || it.ja.includes(itemQuery)).map((it) => (
                              <button
                                key={it.slug}
                                onClick={() => { setNewRegItem(it.slug); setItemDropOpen(false); setItemQuery(""); setShowItemKana(false); }}
                                className={`w-full text-left px-3 py-1.5 text-xs border-b border-gray-50 last:border-0 transition-colors ${
                                  newRegItem === it.slug ? "bg-indigo-100 text-indigo-700 font-bold" : "hover:bg-indigo-50 text-gray-700"
                                }`}
                              >
                                {it.ja}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <button
                        onClick={copyNewRegAsText}
                        disabled={!newRegPokemon}
                        className="w-full rounded-xl bg-gray-200 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-300 disabled:opacity-40"
                      >
                        文字情報に変換
                      </button>
                      <button
                        onClick={commitNewReg}
                        disabled={!newRegName.trim()}
                        className="w-full rounded-xl bg-green-500 py-2.5 text-sm font-bold text-white transition-colors shadow-sm hover:bg-green-600 disabled:opacity-40"
                      >
                        {editingId ? "上書き保存" : "登録する"}
                      </button>
                    </div>
                  </>
              </div>
            </div>
          )}

          {/* ボックス一覧はBOXマネージャーで管理するため非表示 */}
        </div>
        {/* テンキー (努力値・実数値入力用) */}
        {activeField && (
          <div className="flex-shrink-0 border-t-2 border-indigo-100 bg-gradient-to-b from-white to-indigo-50 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500">
                {activeField.mode === 'level'
                  ? 'レベルを入力（1〜100）'
                  : `${STAT_NAMES_JA[activeField.key as StatKey]}の${activeField.mode === 'ev' ? '努力値' : `Lv.${newRegLevel}実数値`}を入力`
                }
              </span>
              <span className="text-lg font-bold text-indigo-600 tabular-nums min-w-[3ch] text-right">{numpadVal}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {(["7","8","9","C","4","5","6","←","1","2","3","✓"] as const).map((k) => (
                <button
                  key={k}
                  onMouseDown={(e) => { e.preventDefault(); }}
                  onClick={() => {
                    if (k === "C") { setNumpadVal("0"); setNumpadFresh(false); applyNumpadVal("0", activeField); }
                    else if (k === "←") { handleNumpadBack(); }
                    else if (k === "✓") {
                      if (activeField?.mode === 'level') {
                        const v = Math.max(1, Math.min(100, parseInt(numpadVal) || 50));
                        setNewRegLevel(v);
                        setNewRegLevelStr(String(v));
                      }
                      setActiveField(null);
                    }
                    else { handleNumpadDigit(k); }
                  }}
                  className={`py-3 rounded-xl font-bold text-base transition-all active:scale-95 ${
                    k === "C"  ? "bg-red-100 text-red-600 hover:bg-red-200" :
                    k === "←" ? "bg-amber-100 text-amber-700 hover:bg-amber-200" :
                    k === "✓" ? "bg-green-500 text-white hover:bg-green-600 shadow-sm" :
                                 "bg-white border border-gray-200 text-gray-800 hover:bg-indigo-50 shadow-sm"
                  }`}
                >
                  {k}
                </button>
              ))}
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleNumpadDigit("0")}
                className="col-span-4 py-3 rounded-xl font-bold text-base bg-white border border-gray-200 text-gray-800 hover:bg-indigo-50 shadow-sm transition-all active:scale-95"
              >
                0
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────
// 現在HP入力（双方向バインディング）
// ───────────────────────────────────────
function CurrentHpEditor({
  maxHp,
  value,
  onChange,
}: {
  maxHp: number;
  value: number | null;   // null = 最大HP（100%）
  onChange: (v: number | null) => void;
}) {
  const effectiveVal = value ?? maxHp;
  const [hpStr, setHpStr]   = useState(String(effectiveVal));
  const [pctStr, setPctStr] = useState(
    value == null ? "100" : String(Math.round(value / maxHp * 1000) / 10)
  );

  // ポケモン変更時・maxHp変更時に同期リセット
  const prevMaxHp = useRef(maxHp);
  useEffect(() => {
    if (prevMaxHp.current !== maxHp || value == null) {
      prevMaxHp.current = maxHp;
      setHpStr(String(value ?? maxHp));
      setPctStr(value == null ? "100" : String(Math.round((value / maxHp) * 1000) / 10));
    }
  }, [maxHp, value]);

  // 実数値を確定して % を更新
  const commitHp = (n: number) => {
    if (Number.isFinite(n) && n >= 1 && n <= maxHp) {
      const pct = Math.round((n / maxHp) * 1000) / 10;
      setHpStr(String(n));
      setPctStr(String(pct));
      onChange(n >= maxHp ? null : n);
    }
  };

  const commitHpStr = (str: string) => { const n = parseInt(str, 10); commitHp(n); };

  // % を確定して実数値を更新
  const commitPct = (str: string) => {
    const p = parseFloat(str);
    if (Number.isFinite(p) && p > 0 && p <= 100) {
      const n = Math.max(1, Math.min(maxHp, Math.round((p / 100) * maxHp)));
      setPctStr(String(Math.round(p * 10) / 10));
      setHpStr(String(n));
      onChange(n >= maxHp ? null : n);
    }
  };

  // ─── テンキー (HP実数値) ───
  const [hpNumpadOpen, setHpNumpadOpen] = useState(false);
  const [hpNumpadStr, setHpNumpadStr] = useState("");
  const [hpNumpadPos, setHpNumpadPos] = useState<{ top: number; left: number } | null>(null);
  const hpInputRef = useRef<HTMLDivElement>(null);
  const hpKeyboardRef = useRef<HTMLInputElement>(null);

  const openHpNumpad = (e: React.MouseEvent<HTMLInputElement>) => {
    e.preventDefault();
    closePctNumpad();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHpNumpadPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
    setHpNumpadStr("");
    setHpNumpadOpen(true);
    requestAnimationFrame(() => hpKeyboardRef.current?.focus());
  };

  const handleHpDigit = (d: string) => {
    setHpNumpadStr((prev) => {
      const next = prev === "0" ? d : prev + d;
      if (next.length > 4) return prev;
      const n = parseInt(next, 10);
      if (!isNaN(n)) { setHpStr(next); commitHp(Math.min(n, maxHp)); }
      return next;
    });
  };

  const closeHpNumpad = () => { setHpNumpadOpen(false); setHpNumpadPos(null); };

  useEffect(() => {
    if (!hpNumpadOpen) return;
    const handler = (e: MouseEvent) => {
      if (hpInputRef.current && !hpInputRef.current.contains(e.target as Node)) closeHpNumpad();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [hpNumpadOpen]);

  // ─── テンキー (HP％) ───
  const [pctNumpadOpen, setPctNumpadOpen] = useState(false);
  const [pctNumpadStr, setPctNumpadStr] = useState("");
  const [pctNumpadPos, setPctNumpadPos] = useState<{ top: number; left: number } | null>(null);
  const pctInputRef = useRef<HTMLDivElement>(null);
  const pctKeyboardRef = useRef<HTMLInputElement>(null);

  const openPctNumpad = (e: React.MouseEvent<HTMLInputElement>) => {
    e.preventDefault();
    closeHpNumpad();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPctNumpadPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
    setPctNumpadStr("");
    setPctNumpadOpen(true);
    requestAnimationFrame(() => pctKeyboardRef.current?.focus());
  };

  const handlePctDigit = (d: string) => {
    setPctNumpadStr((prev) => {
      const next = prev === "0" ? d : prev + d;
      if (next.length > 3) return prev;
      const n = parseInt(next, 10);
      if (isNaN(n) || n > 100) return prev;
      const pStr = String(n);
      setPctStr(pStr);
      commitPct(pStr);
      return next;
    });
  };

  const closePctNumpad = () => { setPctNumpadOpen(false); setPctNumpadPos(null); };

  useEffect(() => {
    if (!pctNumpadOpen) return;
    const handler = (e: MouseEvent) => {
      if (pctInputRef.current && !pctInputRef.current.contains(e.target as Node)) closePctNumpad();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pctNumpadOpen]);

  const pctNum = Math.round((effectiveVal / maxHp) * 1000) / 10;
  const barColor =
    pctNum > 50 ? "bg-green-400" :
    pctNum > 25 ? "bg-yellow-400" : "bg-red-400";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500">現在HP（残りHP）</p>
        {value != null && (
          <button
            onClick={() => { onChange(null); setHpStr(String(maxHp)); setPctStr("100"); setHpNumpadOpen(false); setPctNumpadOpen(false); }}
            className="text-[11px] text-gray-400 hover:text-red-500 transition-colors flex items-center gap-0.5"
          >
            ↺ 最大HPに戻す
          </button>
        )}
      </div>

      {/* 双方向入力フィールド */}
      <div className="flex items-center gap-2">
        {/* 実数値: スマホ=ネイティブテンキー / PC=カスタムNumpadPopup */}
        <div className="flex-1 min-w-0 flex-shrink-0 relative" ref={hpInputRef}>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            className="md:hidden w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
            value={hpStr}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, "");
              setHpStr(raw);
              const n = parseInt(raw, 10);
              if (Number.isFinite(n)) {
                commitHp(Math.max(1, Math.min(maxHp, n)));
              }
            }}
            onBlur={() => {
              const n = parseInt(hpStr, 10);
              if (!Number.isFinite(n) || hpStr.trim() === "") {
                setHpStr(String(effectiveVal));
                return;
              }
              commitHp(Math.max(1, Math.min(maxHp, n)));
            }}
            onFocus={() => setHpStr("")}
          />
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={hpStr}
            ref={hpKeyboardRef}
            readOnly
            onClick={openHpNumpad}
            onFocus={(e) => { e.target.select(); }}
            onKeyDown={(e) => {
              if (/^[0-9]$/.test(e.key)) {
                e.preventDefault();
                if (!hpNumpadOpen) {
                  closePctNumpad();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHpNumpadPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
                  setHpNumpadOpen(true);
                  setHpNumpadStr("");
                }
                handleHpDigit(e.key);
                return;
              }
              if (e.key === "Backspace") {
                e.preventDefault();
                setHpNumpadStr((prev) => {
                  const next = prev.slice(0, -1);
                  if (!next) {
                    setHpStr("");
                    return "";
                  }
                  const n = parseInt(next, 10);
                  if (!isNaN(n)) {
                    setHpStr(next);
                    commitHp(Math.min(n, maxHp));
                  }
                  return next;
                });
                return;
              }
              if (e.key === "Escape" || e.key === "Enter") {
                e.preventDefault();
                closeHpNumpad();
              }
            }}
            className="hidden md:block w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-red-400 cursor-pointer"
          />
          <p className="text-[10px] text-gray-400 text-center mt-0.5">実数値 / 最大 {maxHp}</p>
          {hpNumpadOpen && (
            <div className="hidden md:block">
              <NumpadPopup
                value={hpNumpadStr}
                maxLabel={String(maxHp)}
                minLabel="1"
                onDigit={handleHpDigit}
                onClear={() => { setHpNumpadStr(""); setHpStr(""); }}
                onMax={() => { const s = String(maxHp); setHpNumpadStr(s); setHpStr(s); commitHp(maxHp); }}
                onMin={() => { setHpNumpadStr("1"); setHpStr("1"); commitHp(1); }}
                pos={hpNumpadPos ?? undefined}
                onClose={() => setHpNumpadOpen(false)}
              />
            </div>
          )}
        </div>

        <span className="text-gray-300 text-xl font-light flex-shrink-0">/</span>

        {/* 割合%: スマホ=ネイティブ / PC=カスタムNumpadPopup */}
        <div className="w-28 flex-shrink-0 relative" ref={pctInputRef}>
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className="md:hidden w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
              value={pctStr}
              onChange={(e) => {
                let raw = e.target.value.replace(/[^0-9.]/g, "");
                const d = raw.indexOf(".");
                if (d !== -1) {
                  raw = raw.slice(0, d + 1) + raw.slice(d + 1).replace(/\./g, "");
                  const [a, b = ""] = raw.split(".");
                  raw = a + (b !== "" ? `.${b.slice(0, 1)}` : raw.endsWith(".") ? "." : "");
                }
                setPctStr(raw);
                const p = parseFloat(raw);
                if (Number.isFinite(p) && p > 0 && p <= 100) {
                  commitPct(raw.replace(/\.$/, ""));
                }
              }}
              onBlur={() => {
                const p = parseFloat(pctStr);
                if (!Number.isFinite(p) || pctStr.trim() === "" || p <= 0 || p > 100) {
                  setPctStr(value == null ? "100" : String(Math.round((value / maxHp) * 1000) / 10));
                  return;
                }
                commitPct(pctStr.replace(/\.$/, ""));
              }}
              onFocus={() => setPctStr("")}
            />
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pctStr}
            ref={pctKeyboardRef}
            readOnly
            onClick={openPctNumpad}
            onFocus={(e) => { e.target.select(); }}
            onKeyDown={(e) => {
              if (/^[0-9]$/.test(e.key)) {
                e.preventDefault();
                if (!pctNumpadOpen) {
                  closeHpNumpad();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setPctNumpadPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
                  setPctNumpadOpen(true);
                  setPctNumpadStr("");
                }
                handlePctDigit(e.key);
                return;
              }
              if (e.key === "Backspace") {
                e.preventDefault();
                setPctNumpadStr((prev) => {
                  const next = prev.slice(0, -1);
                  if (!next) {
                    setPctStr("");
                    return "";
                  }
                  const n = parseInt(next, 10);
                  if (!isNaN(n) && n > 0 && n <= 100) {
                    const pStr = String(n);
                    setPctStr(pStr);
                    commitPct(pStr);
                  }
                  return next;
                });
                return;
              }
              if (e.key === "Escape" || e.key === "Enter") {
                e.preventDefault();
                closePctNumpad();
              }
            }}
            className="hidden md:block w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-red-400 cursor-pointer"
          />
            <span className="text-sm text-gray-500 flex-shrink-0 font-medium">%</span>
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-0.5">割合</p>
          {pctNumpadOpen && (
            <div className="hidden md:block">
              <NumpadPopup
                value={pctNumpadStr}
                maxLabel="100"
                minLabel="1"
                onDigit={handlePctDigit}
                onClear={() => { setPctNumpadStr(""); setPctStr(""); }}
                onMax={() => { setPctNumpadStr("100"); setPctStr("100"); commitPct("100"); }}
                onMin={() => { setPctNumpadStr("1"); setPctStr("1"); commitPct("1"); }}
                pos={pctNumpadPos ?? undefined}
                onClose={() => setPctNumpadOpen(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* HP バー */}
      <div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-150 ${barColor}`}
            style={{ width: `${pctNum}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] mt-0.5 text-gray-400">
          <span>0</span>
          <span className={`font-semibold ${
            pctNum <= 25 ? "text-red-500" : pctNum <= 50 ? "text-yellow-600" : "text-green-600"
          }`}>
            {pctNum}%
          </span>
          <span>{maxHp}</span>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────
// 逆算ツール（独立セクション）
// ───────────────────────────────────────
function ReverseDamageSection({ rolls, defenderHp, minDamage, maxDamage, defenderBaseDef, defenderBaseHp, defenderLevel = 50, defenderNatureMod = 1, moveCategory, defenseStat, onApplyDefEv,
  attackerBaseAtk, attackerLevel = 50, attackStat, onApplyAtkEv,
}: {
  rolls: number[]; defenderHp: number; minDamage: number; maxDamage: number;
  defenderBaseDef?: number; defenderBaseHp?: number; defenderLevel?: number; defenderNatureMod?: number;
  moveCategory?: "physical" | "special" | "status"; defenseStat?: number;
  onApplyDefEv?: (hpEv: number, defEv: number) => void;
  // 攻撃側EV逆算用
  attackerBaseAtk?: number;  // 攻撃側のこうげき/とくこう種族値
  attackerLevel?: number;
  attackStat?: number;       // 現在の攻撃側実数値
  onApplyAtkEv?: (ev: number, natureMod: number) => void; // EV + 性格補正を適用
}) {
  const [input, setInput] = useState("");
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcExpr, setCalcExpr] = useState("");
  const [calcPopupPos, setCalcPopupPos] = useState<{ top: number; left: number } | null>(null);
  const [damageNumpadOpen, setDamageNumpadOpen] = useState(false);
  const [damageNumpadStr, setDamageNumpadStr] = useState("");
  const [damageNumpadPos, setDamageNumpadPos] = useState<{ top: number; left: number } | null>(null);
  const calcButtonRef = useRef<HTMLButtonElement>(null);
  const damageInputRef = useRef<HTMLDivElement>(null);
  const damageKeyboardRef = useRef<HTMLInputElement>(null);
  const num = parseInt(input, 10);
  const boosts = useMemo(() => (Number.isFinite(num) && num > 0 ? inferBoosts(num, rolls) : []), [num, rolls]);
  const pct = Number.isFinite(num) && num > 0 ? `${Math.round((num / defenderHp) * 1000) / 10}%` : null;

  const updateCalcPopupPos = useCallback(() => {
    const button = calcButtonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setCalcPopupPos({ top: rect.top - 8, left: rect.right });
  }, []);

  // ダメージ数値は inputMode=numeric で携帯のテンキーのみ（アプリ内テンキーは使わない）
  const onDamageInputChange = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, "");
    let v = digits;
    const n = parseInt(v, 10);
    if (!isNaN(n) && n > 9999) v = "9999";
    else if (v.length > 4) v = v.slice(0, 4);
    setInput(v);
  };

  const closeDamageNumpad = useCallback(() => {
    setDamageNumpadOpen(false);
    setDamageNumpadPos(null);
  }, []);

  const openDamageNumpad = (e: React.MouseEvent<HTMLInputElement>) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDamageNumpadPos({ top: rect.top - 6, left: rect.left + rect.width / 2 });
    setDamageNumpadStr("");
    setDamageNumpadOpen(true);
    requestAnimationFrame(() => damageKeyboardRef.current?.focus());
  };

  const handleDamageDigit = useCallback((d: string) => {
    setDamageNumpadStr((prev) => {
      const next = prev === "0" ? d : prev + d;
      if (next.length > 4) return prev;
      const n = parseInt(next, 10);
      if (!isNaN(n)) setInput(String(n));
      return next;
    });
  }, []);

  useEffect(() => {
    if (!damageNumpadOpen) return;
    const handler = (e: MouseEvent) => {
      if (damageInputRef.current && !damageInputRef.current.contains(e.target as Node)) {
        closeDamageNumpad();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [damageNumpadOpen, closeDamageNumpad]);

  useEffect(() => {
    if (!calcOpen) return;
    updateCalcPopupPos();
    const handleViewportChange = () => updateCalcPopupPos();
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [calcOpen, updateCalcPopupPos]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-700">受けたダメージから相手の型を予測</p>
        <button
          ref={calcButtonRef}
          onClick={() => {
            if (!calcOpen) updateCalcPopupPos();
            setCalcOpen(!calcOpen);
          }}
          className={`text-[10px] px-2 py-0.5 rounded-md border font-medium transition-colors ${calcOpen ? "bg-gray-700 text-white border-gray-700" : "bg-white text-gray-500 border-gray-300 hover:bg-gray-50"}`}
        >🧮 電卓</button>
      </div>
      {/* 簡易電卓（スマホでは画面下、PCではボタン上に固定表示） */}
      {calcOpen && (
        <div className="relative">
        {/* 背景オーバーレイ: 電卓の外をタップで閉じる */}
        <div className="fixed inset-0 z-40" onClick={() => setCalcOpen(false)} />
        <div
          className="fixed bottom-4 left-1/2 z-[70] w-[min(20rem,calc(100vw-1.5rem))] -translate-x-1/2 bg-white border border-gray-300 rounded-xl shadow-2xl p-2.5 space-y-1.5 md:hidden"
        >
          <div className="text-right text-sm font-mono bg-white border border-gray-200 rounded px-2 py-1 min-h-[1.8rem] text-gray-800">
            {calcExpr || <span className="text-gray-300">0</span>}
          </div>
          <div className="grid grid-cols-4 gap-1">
            {["7","8","9","+","4","5","6","-","1","2","3","×","0","C","=","÷"].map((k) => (
              <button key={k}
                className={`text-sm font-bold rounded py-1.5 transition-colors ${
                  ["+","-","×","÷"].includes(k) ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                  : k === "=" ? "bg-green-500 text-white hover:bg-green-600"
                  : k === "C" ? "bg-red-100 text-red-600 hover:bg-red-200"
                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => {
                  if (k === "C") { setCalcExpr(""); }
                  else if (k === "=") {
                    try {
                      const expr = calcExpr.replace(/×/g, "*").replace(/÷/g, "/");
                      const result = Math.round(Function('"use strict"; return (' + expr + ')')());
                      if (Number.isFinite(result)) {
                        setInput(String(Math.abs(result)));
                        setCalcExpr("");
                        setCalcOpen(false);
                      }
                    } catch { /* 不正な式は無視 */ }
                  }
                  else { setCalcExpr((p) => p + k); }
                }}
              >{k}</button>
            ))}
          </div>
          <p className="text-[9px] text-gray-400 text-center">＝を押すと結果がダメージ欄に入ります</p>
        </div>
        <div
          className="hidden md:block fixed z-[70] w-52 -translate-x-full -translate-y-full bg-white border border-gray-300 rounded-xl shadow-2xl p-2.5 space-y-1.5"
          style={calcPopupPos ? { top: calcPopupPos.top, left: calcPopupPos.left } : undefined}
        >
          <div className="text-right text-sm font-mono bg-white border border-gray-200 rounded px-2 py-1 min-h-[1.8rem] text-gray-800">
            {calcExpr || <span className="text-gray-300">0</span>}
          </div>
          <div className="grid grid-cols-4 gap-1">
            {["7","8","9","+","4","5","6","-","1","2","3","×","0","C","=","÷"].map((k) => (
              <button key={k}
                className={`text-sm font-bold rounded py-1.5 transition-colors ${
                  ["+","-","×","÷"].includes(k) ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                  : k === "=" ? "bg-green-500 text-white hover:bg-green-600"
                  : k === "C" ? "bg-red-100 text-red-600 hover:bg-red-200"
                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => {
                  if (k === "C") { setCalcExpr(""); }
                  else if (k === "=") {
                    try {
                      const expr = calcExpr.replace(/×/g, "*").replace(/÷/g, "/");
                      const result = Math.round(Function('"use strict"; return (' + expr + ')')());
                      if (Number.isFinite(result)) {
                        setInput(String(Math.abs(result)));
                        setCalcExpr("");
                        setCalcOpen(false);
                      }
                    } catch { /* 不正な式は無視 */ }
                  }
                  else { setCalcExpr((p) => p + k); }
                }}
              >{k}</button>
            ))}
          </div>
          <p className="text-[9px] text-gray-400 text-center">＝を押すと結果がダメージ欄に入ります</p>
        </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="relative flex-1" ref={damageInputRef}>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            className="md:hidden w-full border rounded-lg px-2 py-1 text-sm transition-colors focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200 border-gray-300 hover:border-purple-300 text-gray-700"
            value={input}
            onChange={(e) => onDamageInputChange(e.target.value)}
            placeholder="ダメージ数値"
            onFocus={() => setInput("")}
          />
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={input}
            ref={damageKeyboardRef}
            readOnly
            onClick={openDamageNumpad}
            onFocus={(e) => { e.target.select(); }}
            onKeyDown={(e) => {
              if (/^[0-9]$/.test(e.key)) {
                e.preventDefault();
                if (!damageNumpadOpen) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setDamageNumpadPos({ top: rect.top - 6, left: rect.left + rect.width / 2 });
                  setDamageNumpadOpen(true);
                  setDamageNumpadStr("");
                }
                handleDamageDigit(e.key);
                return;
              }
              if (e.key === "Backspace") {
                e.preventDefault();
                setDamageNumpadStr((prev) => {
                  const next = prev.slice(0, -1);
                  setInput(next);
                  return next;
                });
                return;
              }
              if (e.key === "Escape" || e.key === "Enter") {
                e.preventDefault();
                closeDamageNumpad();
              }
            }}
            placeholder="ダメージ数値"
            className="hidden md:block w-full border rounded-lg px-2 py-1 text-sm transition-colors focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200 border-gray-300 hover:border-purple-300 text-gray-700 cursor-pointer"
          />
          {damageNumpadOpen && (
            <div className="hidden md:block">
              <NumpadPopup
                value={damageNumpadStr}
                maxLabel="9999"
                minLabel="1"
                onDigit={handleDamageDigit}
                onClear={() => { setDamageNumpadStr(""); setInput(""); }}
                onMax={() => { setDamageNumpadStr("9999"); setInput("9999"); }}
                onMin={() => { setDamageNumpadStr("1"); setInput("1"); }}
                pos={damageNumpadPos ?? undefined}
                placement="top"
                onClose={closeDamageNumpad}
              />
            </div>
          )}
        </div>
        {pct && <span className="text-xs font-medium text-gray-500 whitespace-nowrap">= {pct}</span>}
      </div>
      {input !== "" && Number.isFinite(num) && num > 0 && (
        <div className="rounded-lg bg-purple-50 border border-purple-100 p-2 space-y-1">
          {boosts.length === 0 ? (
            <p className="text-[11px] text-gray-500">該当する補正が見つかりません</p>
          ) : (
            <>
              <p className="text-[11px] text-gray-500">計算値（{minDamage}〜{maxDamage}）基準：タップで攻撃側EVに反映</p>
              {boosts.map(({ mult, desc }) => {
                // この倍率から攻撃側のEV・性格補正を逆算
                const handleClick = () => {
                  if (!attackerBaseAtk || !attackStat || !onApplyAtkEv || !rolls.length) return;
                  // 倍率に含まれる性格補正とアイテム補正を分離
                  // desc から性格(+)を含むか判定
                  const hasNaturePlus = desc.includes("性格(+)") || desc.includes("性格補正 (+10%)");
                  const hasNatureMinus = desc.includes("性格(-)") || desc.includes("性格補正 (-10%)");
                  const natMod = hasNaturePlus ? 1.1 : hasNatureMinus ? 0.9 : 1.0;
                  // 性格を除いたアイテム倍率
                  const itemMult = mult / natMod;
                  // 受けたダメージからアイテム補正を外した素ダメージ
                  const baseDmg = num / itemMult;
                  // 素ダメージ = rolls * (newAtkStat / currentAtkStat) なので
                  // 必要な攻撃実数値 = currentAtkStat * baseDmg / rollsMid
                  const rollsMid = (rolls[0] + rolls[rolls.length - 1]) / 2;
                  if (rollsMid <= 0) return;
                  const targetAtkStat = Math.round(attackStat * baseDmg / rollsMid);
                  // 攻撃実数値からEVを逆算（IV=31固定、性格補正natMod）
                  // stat = floor(floor((base*2+31+floor(ev/4))*lv/100+5) * natMod)
                  // → ev = (stat/natMod - 5) * 100/lv - base*2 - 31) * 4
                  const lv = attackerLevel;
                  const raw = targetAtkStat / natMod;
                  const ev = Math.round(((raw - 5) * 100 / lv - attackerBaseAtk * 2 - 31) * 4);
                  const clampedEv = Math.max(0, Math.min(252, Math.round(ev / 4) * 4)); // 4刻みに丸める
                  onApplyAtkEv(clampedEv, natMod);
                };
                return (
                  <button key={mult} onClick={handleClick}
                    className="flex items-center justify-between gap-2 text-xs w-full text-left rounded-md px-1.5 py-1 hover:bg-purple-100 active:bg-purple-200 transition-colors cursor-pointer">
                    <span className="text-purple-800 font-medium">{desc}</span>
                    <span className="text-[10px] text-gray-500 bg-white border border-purple-200 rounded px-1 py-0.5 font-mono">x{mult.toFixed(2)}</span>
                  </button>
                );
              })}
            </>
          )}

        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────
// フィールド状態スイッチ（防御側パネル用）
// ───────────────────────────────────────
function FieldConditionsPanel({
  field,
  onChange,
  isDoubles,
  gravity,
  onGravityChange,
  defenderFlowerGift,
  onDefenderFlowerGiftChange,
  friendGuard,
  onFriendGuardChange,
  canUseDisguise,
}: {
  field: FieldConditions;
  onChange: (next: FieldConditions) => void;
  isDoubles: boolean;
  gravity: boolean;
  onGravityChange: (next: boolean) => void;
  defenderFlowerGift: boolean;
  onDefenderFlowerGiftChange: (next: boolean) => void;
  friendGuard: boolean;
  onFriendGuardChange: (next: boolean) => void;
  canUseDisguise: boolean;
}) {
  const toggle = (key: keyof Omit<FieldConditions, "spikesLayers">) => {
    onChange({ ...field, [key]: !field[key] });
  };

  const wallActive = field.auroraVeil || field.lightScreen || field.reflect;

  return (
    <div className="border-t pt-3 space-y-2">
      <p className="text-xs font-semibold text-gray-500">防御側フィールド状態</p>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
          <input
            type="checkbox"
            checked={gravity}
            onChange={(e) => onGravityChange(e.target.checked)}
            className="rounded"
          />
          <span className="font-medium text-gray-600">じゅうりょく</span>
        </label>
        <Tooltip text={"じめん技がひこうタイプ・ふゆうにも当たる"} side="bottom" />
      </div>

      {isDoubles && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[11px] font-semibold text-gray-500">ダブル防御補助</span>
          <label className="flex items-center gap-1 text-[11px] cursor-pointer">
            <input
              type="checkbox"
              checked={defenderFlowerGift}
              onChange={(e) => onDefenderFlowerGiftChange(e.target.checked)}
              className="rounded w-3.5 h-3.5"
            />
            <span className="font-medium text-gray-600">フラワーギフト</span>
            <Tooltip text={"味方チェリムの特性。晴れのとき特防が1.5倍"} side="bottom" />
          </label>
          <label className="flex items-center gap-1 text-[11px] cursor-pointer">
            <input
              type="checkbox"
              checked={friendGuard}
              onChange={(e) => onFriendGuardChange(e.target.checked)}
              className="rounded w-3.5 h-3.5"
            />
            <span className="font-medium text-gray-600">ともだちガード</span>
            <Tooltip text={"味方の特性。受けるダメージが0.75倍"} side="bottom" />
          </label>
        </div>
      )}

      {/* 壁 */}
      <div className="space-y-1">
        <p className="text-[11px] text-gray-400">壁（物理・特殊ダメージ軽減）</p>
        <div className="flex gap-1.5 flex-wrap">
          {([
            { key: "lightScreen" as const, label: "ひかりの壁", color: "bg-yellow-100 border-yellow-400 text-yellow-800", tip: "特殊技のダメージを0.5倍\nシングル2〜5ターン持続\n急所時は無効" },
            { key: "reflect"     as const, label: "リフレクター", color: "bg-orange-100 border-orange-400 text-orange-800", tip: "物理技のダメージを0.5倍\nシングル2〜5ターン持続\n急所時は無効" },
            { key: "auroraVeil" as const, label: "オーロラベール", color: "bg-purple-100 border-purple-400 text-purple-800", tip: "物理・特殊両方を0.5倍\nあられ/雪天候時のみ使用可\n急所時は無効" },
          ] as const).map(({ key, label, color, tip }) => (
            <span key={key} className="inline-flex items-center gap-0.5">
              <button
                className={`text-[11px] px-2 py-1 rounded-lg border font-medium transition-colors ${
                  field[key] ? color : "border-gray-200 text-gray-400 hover:border-gray-300"
                }`}
                onClick={() => {
                  // 壁同士は排他的に (オーロラベールは単独で両方)
                  if (key === "auroraVeil") {
                    onChange({ ...field, auroraVeil: !field.auroraVeil, lightScreen: false, reflect: false });
                  } else {
                    onChange({ ...field, [key]: !field[key], auroraVeil: false });
                  }
                }}
              >
                {field[key] ? "✓ " : ""}{label}
              </button>
              <Tooltip text={tip} side="bottom" />
            </span>
          ))}
        </div>
        {wallActive && (
          <p className="text-[10px] text-gray-400">
            ※ 急所時は壁無効 / シングルバトルで 0.5 倍
          </p>
        )}
      </div>

      {/* ステルスロック */}
      <div className="flex items-center gap-2">
        <button
          className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-colors ${
            field.stealthRock ? "bg-stone-100 border-stone-400 text-stone-800" : "border-gray-200 text-gray-400 hover:border-gray-300"
          }`}
          onClick={() => toggle("stealthRock")}
        >
          {field.stealthRock ? "✓ " : ""}ステルスロック
        </button>
        <Tooltip text={"交代時タイプ相性でHP削れる\n等倍→1/8・弱点2倍→1/4\n弱点4倍→1/2（耐性は1/16）"} side="bottom" />
      </div>

      {canUseDisguise && (
        <div className="flex items-center gap-2">
          <button
            className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-colors ${
              field.disguiseBroken ? "bg-fuchsia-100 border-fuchsia-400 text-fuchsia-800" : "border-gray-200 text-gray-400 hover:border-gray-300"
            }`}
            onClick={() => toggle("disguiseBroken")}
          >
            {field.disguiseBroken ? "✓ " : ""}ばけのかわなし
          </button>
          <Tooltip text={"ミミッキュのばけのかわが剥がれた後の状態\nHPを最大値の1/8だけ減らして計算"} side="bottom" />
        </div>
      )}

      {/* まきびし */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-gray-500 font-medium flex-shrink-0">まきびし</span>
        <div className="flex gap-1">
          {([0, 1, 2, 3] as const).map((n) => (
            <button key={n}
              className={`text-[11px] w-8 py-1 rounded-lg border font-medium transition-colors ${
                field.spikesLayers === n
                  ? "bg-amber-100 border-amber-400 text-amber-800"
                  : "border-gray-200 text-gray-400 hover:border-gray-300"
              }`}
              onClick={() => onChange({ ...field, spikesLayers: n })}
            >
              {n === 0 ? "なし" : `${n}枚`}
            </button>
          ))}
        </div>
        <Tooltip text={"1枚: 交代時HP1/8削れる\n2枚: HP1/6 / 3枚: HP1/4\n飛行・浮遊は無効"} side="bottom" />
      </div>

      {/* みがわり・たべのこし */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
            <input
              type="checkbox"
              checked={field.substitute}
              onChange={(e) => onChange({ ...field, substitute: e.target.checked })}
              className="rounded"
            />
            <span className="font-medium text-gray-600">みがわり</span>
          </label>
          <Tooltip text={"HP1/4を消費して身代わり人形を設置\n音系の技・すりぬけは貫通"} side="bottom" />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
            <input
              type="checkbox"
              checked={field.leftovers}
              onChange={(e) => onChange({ ...field, leftovers: e.target.checked })}
              className="rounded"
            />
            <span className="font-medium text-gray-600">たべのこし</span>
          </label>
          <Tooltip text={"毎ターンHP 1/16回復\n確定数が変わる場合に影響"} side="bottom" />
        </div>
      </div>

      {/* 毒状態 */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-gray-500">毒</span>
          {(["none", "poison", "toxic"] as const).map((v) => (
            <button key={v} onClick={() => onChange({ ...field, poisonStatus: v, toxicTurns: v === "toxic" ? field.toxicTurns : 1 })}
              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                field.poisonStatus === v
                  ? v === "none" ? "bg-gray-500 text-white border-gray-500" : "bg-purple-500 text-white border-purple-500"
                  : "border-gray-200 text-gray-500 hover:border-purple-300"
              }`}>
              {v === "none" ? "なし" : v === "poison" ? "どく" : "もうどく"}
            </button>
          ))}
          <Tooltip text={"どく: 毎ターン最大HPの1/8ダメージ\nもうどく: 毎ターン最大HPのn/16ダメージ（n=経過ターン）\nポイズンヒール・マジックガードは無効"} side="bottom" />
        </div>
        {field.poisonStatus === "toxic" && (
          <div className="flex items-center gap-1.5 ml-4">
            <span className="text-[10px] text-gray-500">経過ターン</span>
            {[1,2,3,4,5,6].map((n) => (
              <button key={n} onClick={() => onChange({ ...field, toxicTurns: n })}
                className={`text-[10px] w-5 h-5 rounded-full border transition-colors ${
                  field.toxicTurns === n ? "bg-purple-500 text-white border-purple-500" : "border-gray-200 text-gray-500 hover:border-purple-300"
                }`}>
                {n}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────
// メインページ
// ───────────────────────────────────────
export default function Home() {
  const { user, loading: authLoading, sendMagicLink, signOut } = useAuth();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [attacker, setAttacker] = useState<PokemonState>(DEFAULT_STATE);
  const [defender, setDefender] = useState<PokemonState>(DEFAULT_STATE);
  const [selectedMove, setSelectedMove] = useState<MoveData | null>(null);
  const [isCritical, setIsCritical] = useState(false);
  const [hitCount, setHitCount] = useState(1);
  const [critCount, setCritCount] = useState(0);
  const [isPaybackDoubled, setIsPaybackDoubled] = useState(false);

  // 2回目の攻撃
  const [showSecondAttack, setShowSecondAttack] = useState(false);
  const [selectedMove2, setSelectedMove2] = useState<MoveData | null>(null);
  const [isCritical2, setIsCritical2] = useState(false);
  const [hitCount2, setHitCount2] = useState(1);
  const [critCount2, setCritCount2] = useState(0);

  // 技選択時に連続技・確定急所の初期値を自動設定
  const handleMoveSelect = useCallback((move: MoveData | null) => {
    setSelectedMove(move);
    if (!move) { setHitCount(1); setCritCount(0); setIsCritical(false); return; }
    const meta = MOVE_METADATA[move.name];
    if (meta?.hits) {
      // 連続技: スキルリンク=最大回数、いかさまダイス=4回、それ以外=最大回数
      const maxHit = meta.hits[1];
      const ability = attacker.ability;
      const item = attacker.item;
      let defaultHits: number;
      if (ability === "skill-link") {
        defaultHits = maxHit;
      } else if (item === "loaded-dice" && meta.hits[0] !== meta.hits[1]) {
        defaultHits = Math.min(4, maxHit); // いかさまダイス: 4〜5回の期待値で4をデフォルト
      } else {
        defaultHits = maxHit;
      }
      setHitCount(defaultHits);
      if (meta.alwaysCrit) {
        setCritCount(defaultHits);
        setIsCritical(true);
      } else {
        setCritCount(0);
        setIsCritical(false);
      }
    } else {
      setHitCount(1);
      if (meta?.alwaysCrit) {
        setCritCount(1);
        setIsCritical(true);
      } else {
        setCritCount(0);
        // isCriticalはユーザー設定を維持
      }
    }
  }, [attacker.ability, attacker.item]);

  // 2回目の技選択ハンドラ
  const handleMoveSelect2 = useCallback((move: MoveData | null) => {
    setSelectedMove2(move);
    if (!move) { setHitCount2(1); setCritCount2(0); setIsCritical2(false); return; }
    const meta = MOVE_METADATA[move.name];
    if (meta?.hits) {
      const maxHit = meta.hits[1];
      setHitCount2(maxHit);
      if (meta.alwaysCrit) { setCritCount2(maxHit); setIsCritical2(true); }
      else { setCritCount2(0); setIsCritical2(false); }
    } else {
      setHitCount2(1);
      if (meta?.alwaysCrit) { setCritCount2(1); setIsCritical2(true); }
      else { setCritCount2(0); }
    }
  }, []);

  const [weather, setWeather] = useState<WeatherCondition>("none");
  const [terrain, setTerrain] = useState<TerrainCondition>("none");
  const [isDoubles, setIsDoubles] = useState(false);
  const [helpingHand, setHelpingHand] = useState(false);
  const [steelworker, setSteelworker] = useState(false);
  const [powerSpot, setPowerSpot] = useState(false);
  const [flowerGift, setFlowerGift] = useState(false);
  const [defenderFlowerGift, setDefenderFlowerGift] = useState(false);
  const [friendGuard, setFriendGuard] = useState(false);
  const [gravity, setGravity] = useState(false);
  const [supremeOverlordFaintedAllies, setSupremeOverlordFaintedAllies] = useState(0);
  const [regModalOpen, setRegModalOpen] = useState(false);
  const [boxManagerOpen, setBoxManagerOpen] = useState(false);
  const [boxEntries, setBoxEntries] = useState<BoxEntry[]>(() => {
    // URL共有: ?box=... パラメータからボックスデータをインポート
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const boxParam = params.get("box");
      if (boxParam) {
        const imported = importBoxFromShareString(boxParam);
        if (imported && imported.length > 0) {
          const merged = mergeImportedBox(imported);
          // URLパラメータをクリア
          window.history.replaceState({}, "", window.location.pathname);
          return merged;
        }
      }
    }
    return loadBox();
  });
  const [battleTeams, setBattleTeams] = useState<BattleTeam[]>(() => loadTeams());
  // ポケモン検索履歴
  const [pokemonHistory, setPokemonHistory] = useState<HistoryEntry[]>(() => loadHistory());

  // Supabase同期: ログイン時にクラウドからデータを読み込み＆リアルタイム同期
  const syncInProgress = useRef(false);
  useEffect(() => {
    if (!user || syncInProgress.current) return;
    syncInProgress.current = true;
    // ログイン時: LocalStorageとクラウドをマージ
    migrateLocalToCloud(user.id).then((merged) => {
      setBoxEntries(merged.entries);
      setBattleTeams(merged.teams);
      if (merged.history) {
        setPokemonHistory(merged.history);
        localStorage.setItem("pokemon-dmg-history-v1", JSON.stringify(merged.history));
      }
      localStorage.setItem("pokemon-dmg-box-v1", JSON.stringify(merged.entries));
      localStorage.setItem("pokemon-dmg-teams-v1", JSON.stringify(merged.teams));
      syncInProgress.current = false;
    }).catch((err) => { console.error("[box-sync] migration failed:", err); syncInProgress.current = false; });

    // リアルタイム同期: 別デバイスからの変更を監視
    const unsubscribe = subscribeToCloudChanges(user.id, (cloudData) => {
      setBoxEntries(cloudData.entries);
      setBattleTeams(cloudData.teams);
      if (cloudData.history) {
        setPokemonHistory(cloudData.history);
        localStorage.setItem("pokemon-dmg-history-v1", JSON.stringify(cloudData.history));
      }
      localStorage.setItem("pokemon-dmg-box-v1", JSON.stringify(cloudData.entries));
      localStorage.setItem("pokemon-dmg-teams-v1", JSON.stringify(cloudData.teams));
    });
    return unsubscribe;
  }, [user]);

  // ボックス・バトルチーム・履歴の変更時にクラウドにも保存
  const prevSyncRef = useRef<string>("");
  useEffect(() => {
    if (!user || syncInProgress.current) return;
    const json = JSON.stringify({ entries: boxEntries, teams: battleTeams, history: pokemonHistory });
    if (json === prevSyncRef.current) return; // 同じデータはスキップ
    prevSyncRef.current = json;
    saveCloudDataToCloud(user.id, { entries: boxEntries, teams: battleTeams, history: pokemonHistory });
  }, [boxEntries, battleTeams, pokemonHistory, user]);

  useEffect(() => {
    localStorage.setItem("pokemon-dmg-box-v1", JSON.stringify(boxEntries));
  }, [boxEntries]);

  useEffect(() => {
    localStorage.setItem("pokemon-dmg-teams-v1", JSON.stringify(battleTeams));
  }, [battleTeams]);

  const [initialEditEntry, setInitialEditEntry] = useState<BoxEntry | null>(null);
  // 登録ポケモンから呼び出した場合の登録済み技（攻撃側のみ）
  const [attackerRegMoves, setAttackerRegMoves] = useState<string[]>([]);
  // 防御側の現在HP（null = 最大HP = 100%）
  const [defenderCurrentHp, setDefenderCurrentHp] = useState<number | null>(null);

  // 特性が変わったとき自動で天気・フィールドをセット
  useEffect(() => {
    const env = ABILITY_AUTO_ENV[attacker.ability];
    if (!env) return;
    if (env.weather !== undefined) setWeather(env.weather);
    if (env.terrain !== undefined) setTerrain(env.terrain);
  }, [attacker.ability]);

  useEffect(() => {
    const env = ABILITY_AUTO_ENV[defender.ability];
    if (!env) return;
    if (env.weather !== undefined) setWeather(env.weather);
    if (env.terrain !== undefined) setTerrain(env.terrain);
  }, [defender.ability]);

  // 防御側のポケモンが変わったら現在HPをリセット
  useEffect(() => {
    setDefenderCurrentHp(null);
  }, [defender.pokemon?.name]);

  const updateAttacker = useCallback(<K extends keyof PokemonState>(key: K, value: PokemonState[K]) => {
    setAttacker((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateDefender = useCallback(<K extends keyof PokemonState>(key: K, value: PokemonState[K]) => {
    setDefender((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateIV = (side: "attacker" | "defender", key: StatKey, value: number) => {
    const setter = side === "attacker" ? setAttacker : setDefender;
    setter((prev) => ({ ...prev, ivs: { ...prev.ivs, [key]: value } }));
  };

  const updateEV = (side: "attacker" | "defender", key: StatKey, value: number) => {
    const setter = side === "attacker" ? setAttacker : setDefender;
    setter((prev) => ({ ...prev, evs: { ...prev.evs, [key]: value } }));
  };

  // ポケモン切替時に前のポケモンの状態を履歴に保存する
  const saveCurrentToHistory = useCallback((state: PokemonState, moves?: string[]) => {
    if (!state.pokemon) return;
    const entry: HistoryEntry = {
      pokemonName: state.pokemon.name,
      state,
      moves: moves?.filter(Boolean),
      usedAt: Date.now(),
    };
    setPokemonHistory(saveHistory(entry));
  }, []);

  const applyAttackerStateWithRegisteredMoves = useCallback(async (state: PokemonState, moves?: string[]) => {
    setAttacker({
      ...DEFAULT_STATE,
      ...state,
      statRanks: { ...DEFAULT_STATE.statRanks, ...state.statRanks },
      fieldConditions: { ...DEFAULT_FIELD, ...state.fieldConditions },
    });

    const normalizedMoves = (moves ?? []).filter(Boolean);
    setAttackerRegMoves(normalizedMoves);

    const firstMoveSlug = normalizedMoves[0];
    if (!firstMoveSlug) {
      handleMoveSelect(null);
      return;
    }

    try {
      const move = await fetchMove(firstMoveSlug);
      const ja = getMoveJaName(firstMoveSlug);
      handleMoveSelect({ ...move, japaneseName: ja !== firstMoveSlug ? ja : move.japaneseName });
    } catch {
      handleMoveSelect(null);
    }
  }, [handleMoveSelect]);

  const handleAttackerSelect = useCallback(async (poke: PokemonData) => {
    // 選択した瞬間に履歴に保存する
    const newState: PokemonState = { ...DEFAULT_STATE, pokemon: poke, ability: poke.abilities[0]?.slug ?? "" };
    saveCurrentToHistory(newState);
    setAttacker(newState);

    // 自動技選択: 採用率1位のダメージ技を選ぶ（必ずそのポケモンが覚える技のみ）
    const learnset = new Set(poke.moveNames);

    // 1. Smogon採用率データから覚える技を探す
    const usageMoves = (POKEMON_MOVE_USAGE[poke.name] ?? []).filter((s) => learnset.has(s));
    // 2. フォールバック: グローバル人気技リストから覚える技を探す
    const globalMoves = POPULAR_MOVE_SLUGS.filter((s) => learnset.has(s));
    const candidates = usageMoves.length > 0 ? usageMoves : globalMoves;

    // 最初のダメージ技を選択
    const firstDamaging = candidates.find((s) => {
      const meta = MOVE_METADATA[s];
      return meta && meta.category !== "status";
    });
    if (firstDamaging) {
      try {
        const move = await fetchMove(firstDamaging);
        const ja = getMoveJaName(firstDamaging);
        handleMoveSelect({ ...move, japaneseName: ja !== firstDamaging ? ja : move.japaneseName });
      } catch { handleMoveSelect(null); }
    } else {
      handleMoveSelect(null);
    }
  }, [handleMoveSelect, saveCurrentToHistory]);

  const handleDefenderSelect = useCallback((poke: PokemonData) => {
    // 選択した瞬間に履歴に保存する
    const newState: PokemonState = { ...DEFAULT_STATE, pokemon: poke, ability: poke.abilities[0]?.slug ?? "" };
    saveCurrentToHistory(newState);
    setDefender(newState);
  }, [saveCurrentToHistory]);

  const defenderCanUseDisguise = useMemo(() => {
    if (!defender.pokemon) return false;
    return defender.pokemon.name === "mimikyu" || defender.ability === "disguise";
  }, [defender.pokemon, defender.ability]);

  const handleSwap = useCallback(() => {
    setAttacker(defender);
    setDefender(attacker);
    handleMoveSelect(null);
  }, [attacker, defender]);

  const attackerStats = useMemo(() => {
    if (!attacker.pokemon) return null;
    return calcAllStats(attacker.pokemon.baseStats, attacker.ivs, attacker.evs, attacker.level, attacker.nature);
  }, [attacker]);

  const defenderStats = useMemo(() => {
    if (!defender.pokemon) return null;
    return calcAllStats(defender.pokemon.baseStats, defender.ivs, defender.evs, defender.level, defender.nature);
  }, [defender]);

  /**
   * テラバースト専用: テラスタル中にタイプ・分類・威力を動的に解決する
   * - タイプ   → 攻撃側のテラスタイプ
   * - 物理/特殊 → ランク補正 + 特性補正を加味した「攻撃 vs 特攻」の高い方
   * - 威力     → 80（テラスタル時固定）
   * テラスタルしていない・テラバースト以外の場合は selectedMove をそのまま返す
   */
  const effectiveMove = useMemo((): MoveData | null => {
    if (!selectedMove) return null;
    if (selectedMove.name === "fling") {
      return {
        ...selectedMove,
        power: getFlingPower(attacker.item),
      };
    }
    if (selectedMove.name === "weather-ball") {
      let type: PokemonType = "normal";
      let power = 50;
      if (weather === "sun") { type = "fire"; power = 100; }
      else if (weather === "rain") { type = "water"; power = 100; }
      else if (weather === "sand") { type = "rock"; power = 100; }
      else if (weather === "snow") { type = "ice"; power = 100; }
      return {
        ...selectedMove,
        type,
        power,
        japaneseName: weather === "none" ? selectedMove.japaneseName : `${selectedMove.japaneseName}(${TYPE_NAMES_JA[type]})`,
      };
    }
    if (selectedMove.name !== "tera-blast") return selectedMove;
    if (!attacker.isTerastallized || !attacker.teraType) return selectedMove;
    if (!attackerStats) return selectedMove;

    // ランク補正係数
    const rm = (rank: number) => rank >= 0 ? (2 + rank) / 2 : 2 / (2 - rank);
    let atkEff   = attackerStats.attack * rm(attacker.statRanks.attack ?? 0);
    let spAtkEff = attackerStats.spAtk  * rm(attacker.statRanks.spAtk  ?? 0);

    // 特性による実数値補正（ひひいろのこどう, ハドロンエンジン, こだいかっせい等）
    const ab = attacker.ability;
    if (ab === "hustle")                                         atkEff   *= 1.5;
    if (ab === "huge-power" || ab === "pure-power")             atkEff   *= 2;
    if (ab === "guts"        && attacker.isBurned)              atkEff   *= 1.5;
    if (ab === "gorilla-tactics")                               atkEff   *= 1.5;
    if (ab === "orichalcum-pulse" && weather === "sun")         atkEff   *= 4 / 3;
    if (ab === "hadron-engine"    && terrain === "electric")    spAtkEff *= 4 / 3;
    const boostedStat = getAbilityBoostedStat(ab, attackerStats, weather, terrain);
    if (boostedStat === "attack") atkEff *= 1.3;
    if (boostedStat === "spAtk") spAtkEff *= 1.3;
    if (boostedStat === "attack" || boostedStat === "spAtk") {
      // 攻撃と特攻のどちらが実際にブーストされるかだけ反映する
    }

    const category: MoveCategory = atkEff > spAtkEff ? "physical" : "special";

    return {
      ...selectedMove,
      type:     attacker.teraType,
      category,
      power:    80,
    } satisfies MoveData;
  }, [selectedMove, attacker, attackerStats, weather, terrain]);

  // ダイマックス技変換
  const dynamaxEffectiveMove = useMemo((): MoveData | null => {
    if (!effectiveMove || !attacker.isDynamaxed) return effectiveMove;
    const dmax = getDynamaxMove(effectiveMove);
    return { ...effectiveMove, japaneseName: dmax.japaneseName, power: dmax.power, name: dmax.name };
  }, [effectiveMove, attacker.isDynamaxed]);

  // メガシンカ種族値/特性差替
  const megaAttackerStats = useMemo(() => {
    if (!attacker.isMegaEvolved || !attacker.megaForm || !attacker.pokemon || !attackerStats) return attackerStats;
    const mega = getMegaForms(attacker.pokemon.name).find((m) => m.slug === attacker.megaForm);
    if (!mega) return attackerStats;
    return calcAllStats(mega.baseStats, { hp: 31, attack: 31, defense: 31, spAtk: 31, spDef: 31, speed: 31 }, attacker.evs, attacker.level, attacker.nature);
  }, [attacker.isMegaEvolved, attacker.megaForm, attacker.pokemon, attacker.evs, attacker.level, attacker.nature, attackerStats]);

  const finalMove = dynamaxEffectiveMove;

  const damageResult = useMemo(() => {
    // finalMove を使用（テラバースト・ダイマックス技変換が解決済み）
    if (!attacker.pokemon || !defender.pokemon || !finalMove || !attackerStats || !defenderStats) return null;
    // 体重依存技（ヘビーボンバー・ヒートスタンプ）はpower=nullでも計算続行
    const isWeightMove = ["heavy-slam", "heat-crash", "grass-knot", "low-kick"].includes(finalMove.name);
    if (!finalMove.power && !isWeightMove) return null;
    const useStats = megaAttackerStats ?? attackerStats;
    const category = finalMove.category;
    const meta = MOVE_METADATA[effectiveMove?.name ?? ""];

    // 特殊参照技: ボディプレス=自分のB / イカサマ=相手のA
    let atkStat: number;
    let atkRank: number;
    if (meta?.statOverride === "body-press") {
      atkStat = useStats.defense;
      atkRank = attacker.statRanks.defense;
    } else if (meta?.statOverride === "foul-play") {
      atkStat = defenderStats.attack;
      atkRank = defender.statRanks.attack;
    } else {
      atkStat = category === "special" ? useStats.spAtk : useStats.attack;
      atkRank = attacker.statRanks[category === "special" ? "spAtk" : "attack"];
    }
    const defStat =
      meta?.defenseStatOverride === "defense"
        ? defenderStats.defense
        : category === "special"
          ? defenderStats.spDef
          : defenderStats.defense;

    const result = calcDamage({
      attackerLevel: attacker.level,
      move: finalMove,
      attackStat: atkStat,
      defenseStat: defStat,
      defenderHp: defenderStats.hp,
      attackerTypes: attacker.pokemon.types,
      defenderTypes: defender.pokemon.types,
      attackerTeraType: attacker.teraType,
      isTerastallized: attacker.isTerastallized,
      defenderTeraType: defender.teraType,
      defenderTerastallized: defender.isTerastallized,
      isCritical,
      isBurned: attacker.isBurned,
      weather,
      terrain,
      attackerItem: attacker.item,
      defenderItem: defender.item,
      attackerAbility: attacker.ability,
      defenderAbility: defender.ability,
      attackerRank: atkRank,
      defenderRank: defender.statRanks[meta?.defenseStatOverride === "defense" ? "defense" : category === "special" ? "spDef" : "defense"],
      isCharged: attacker.isCharged,
      defenderField: defender.fieldConditions,
      hitCount,
      critCount,
      isDefenderFullHp: defenderCurrentHp == null || defenderCurrentHp >= defenderStats.hp,
      isDefenderDynamaxed: defender.isDynamaxed,
      attackerWeight: attacker.pokemon?.weight,
      defenderWeight: defender.pokemon?.weight,
      isPaybackDoubled,
      attackerIsGrounded: isGrounded(attacker.pokemon.types, attacker.ability, attacker.item, attacker.teraType, attacker.isTerastallized),
      defenderIsGrounded: isGrounded(defender.pokemon.types, defender.ability, defender.item, defender.teraType, defender.isTerastallized),
      attackerAbilityBoostedStat: getAbilityBoostedStat(attacker.ability, useStats, weather, terrain),
      isDoubles,
      helpingHand,
      steelworker,
      powerSpot,
      flowerGift,
      defenderFlowerGift,
      friendGuard,
      gravity,
      supremeOverlordFaintedAllies,
    });

    // みがわりシミュレーション
    if (defender.fieldConditions.substitute && result) {
      const subHp = Math.floor(defenderStats.hp / 4);
      const isSoundMove = SOUND_MOVES.has(effectiveMove?.name ?? "");
      const isInfiltrator = attacker.ability === "infiltrator";
      const bypassed = isSoundMove || isInfiltrator;

      if (bypassed) {
        // 音系・すりぬけ: みがわりを無視して本体に直撃
        result.substituteInfo = {
          subHp,
          hitsToBreak: 0,
          bodyDamageMin: result.minDamage,
          bodyDamageMax: result.maxDamage,
          bypassed: true,
        };
      } else {
        // 1回あたりのダメージ(最小/最大)を取得
        const perHitMin = result.perHit?.min ?? result.minDamage;
        const perHitMax = result.perHit?.max ?? result.maxDamage;
        const hits = result.hitCount ?? 1;

        // みがわりを壊すのに必要なヒット数
        const hitsToBreakMin = Math.ceil(subHp / perHitMax); // 最大ダメ時は少ないヒットで壊れる
        const hitsToBreakMax = Math.ceil(subHp / perHitMin); // 最小ダメ時は多くのヒットが必要
        const hitsToBreak = hitsToBreakMax; // 最悪ケースを表示

        // 本体へのダメージ: 残りヒット数 × 1回ダメージ（余剰は入らない）
        const remainingHitsMin = Math.max(0, hits - hitsToBreakMin);
        const remainingHitsMax = Math.max(0, hits - hitsToBreakMax);
        const bodyDamageMin = remainingHitsMax * perHitMin;
        const bodyDamageMax = remainingHitsMin * perHitMax;

        result.substituteInfo = {
          subHp,
          hitsToBreak,
          bodyDamageMin,
          bodyDamageMax,
          bypassed: false,
        };
      }
    }

    return result;
  }, [attacker, defender, finalMove, effectiveMove, attackerStats, megaAttackerStats, defenderStats, isCritical, weather, terrain, hitCount, critCount, defenderCurrentHp, isPaybackDoubled, isDoubles, helpingHand, steelworker, powerSpot, flowerGift, defenderFlowerGift, friendGuard, gravity, supremeOverlordFaintedAllies]);

  // 2回目の攻撃のダメージ計算
  const damageResult2 = useMemo(() => {
    if (!showSecondAttack || !selectedMove2 || !attacker.pokemon || !defender.pokemon || !attackerStats || !defenderStats) return null;
    const isWeightMove2 = ["heavy-slam", "heat-crash", "grass-knot", "low-kick"].includes(selectedMove2.name);
    if (!selectedMove2.power && !isWeightMove2) return null;
    const useStats = megaAttackerStats ?? attackerStats;
    const category = selectedMove2.category;
    const meta2 = MOVE_METADATA[selectedMove2.name];
    let atkStat: number;
    let atkRank: number;
    if (meta2?.statOverride === "body-press") { atkStat = useStats.defense; atkRank = attacker.statRanks.defense; }
    else if (meta2?.statOverride === "foul-play") { atkStat = defenderStats.attack; atkRank = defender.statRanks.attack; }
    else { atkStat = category === "special" ? useStats.spAtk : useStats.attack; atkRank = attacker.statRanks[category === "special" ? "spAtk" : "attack"]; }
    return calcDamage({
      attackerLevel: attacker.level, move: selectedMove2,
      attackStat: atkStat,
      defenseStat: meta2?.defenseStatOverride === "defense" ? defenderStats.defense : category === "special" ? defenderStats.spDef : defenderStats.defense,
      defenderHp: defenderStats.hp, attackerTypes: attacker.pokemon.types, defenderTypes: defender.pokemon.types,
      attackerTeraType: attacker.teraType, isTerastallized: attacker.isTerastallized,
      defenderTeraType: defender.teraType, defenderTerastallized: defender.isTerastallized,
      isCritical: isCritical2, isBurned: attacker.isBurned, weather, terrain,
      attackerItem: attacker.item, defenderItem: defender.item,
      attackerAbility: attacker.ability, defenderAbility: defender.ability,
      attackerRank: atkRank, defenderRank: defender.statRanks[meta2?.defenseStatOverride === "defense" ? "defense" : category === "special" ? "spDef" : "defense"],
      isCharged: attacker.isCharged, defenderField: defender.fieldConditions,
      hitCount: hitCount2, critCount: critCount2,
      isDefenderFullHp: false, isDefenderDynamaxed: defender.isDynamaxed,
      attackerWeight: attacker.pokemon?.weight, defenderWeight: defender.pokemon?.weight,
      attackerIsGrounded: isGrounded(attacker.pokemon.types, attacker.ability, attacker.item, attacker.teraType, attacker.isTerastallized),
      defenderIsGrounded: isGrounded(defender.pokemon.types, defender.ability, defender.item, defender.teraType, defender.isTerastallized),
      attackerAbilityBoostedStat: getAbilityBoostedStat(attacker.ability, useStats, weather, terrain),
      isDoubles,
      helpingHand,
      steelworker,
      powerSpot,
      flowerGift,
      defenderFlowerGift,
      friendGuard,
      gravity,
      supremeOverlordFaintedAllies,
    });
  }, [showSecondAttack, selectedMove2, attacker, defender, attackerStats, megaAttackerStats, defenderStats, isCritical2, weather, terrain, hitCount2, critCount2, isDoubles, helpingHand, steelworker, powerSpot, flowerGift, defenderFlowerGift, friendGuard, gravity, supremeOverlordFaintedAllies]);

  // ステルスロック・まきびしダメージの計算
  const hazardInfo = useMemo(() => {
    if (!defender.pokemon || !defenderStats) return null;
    const f = defender.fieldConditions;
    const srDmg = f.stealthRock
      ? calcStealthRockHp(defenderStats.hp, defender.pokemon.types, defender.teraType, defender.isTerastallized)
      : null;
    const disguiseDmg = defenderCanUseDisguise && f.disguiseBroken
      ? Math.floor(defenderStats.hp / 8)
      : null;
    const spDmg = f.spikesLayers > 0
      ? calcSpikesHp(defenderStats.hp, f.spikesLayers, defender.pokemon.types, defender.ability, defender.item, defender.teraType, defender.isTerastallized)
      : null;
    if (srDmg == null && disguiseDmg == null && spDmg == null) return null;
    // spikesLayers > 0 だがダメージ0（ひこうタイプ等）の場合もspikesImmuneフラグを立てる
    const spikesImmune = f.spikesLayers > 0 && (spDmg === 0 || spDmg === null);
    return { stealthRockHp: srDmg ?? undefined, disguiseHp: disguiseDmg ?? undefined, spikesHp: spDmg ?? undefined, spikesImmune };
  }, [defender, defenderStats, defenderCanUseDisguise]);

  // 毒ダメージ計算
  const poisonDmg = useMemo(() => {
    if (!defender.pokemon || !defenderStats) return 0;
    const f = defender.fieldConditions;
    if (f.poisonStatus === "none") return 0;
    const ab = defender.ability;
    // ポイズンヒール・マジックガードは毒ダメージ無効
    if (ab === "poison-heal" || ab === "magic-guard") return 0;
    const maxHp = defenderStats.hp;
    if (f.poisonStatus === "poison") return Math.floor(maxHp / 8);
    // もうどく: maxHp * n/16
    return Math.floor(maxHp * f.toxicTurns / 16);
  }, [defender, defenderStats]);

  const mobileDamageSummary = useMemo(() => {
    if (!damageResult || !defenderStats) return null;

    const effectiveHp = (defenderCurrentHp != null && defenderCurrentHp >= 1) ? defenderCurrentHp : defenderStats.hp;
    const totalHazardDmg = (hazardInfo?.stealthRockHp ?? 0) + (hazardInfo?.disguiseHp ?? 0) + (hazardInfo?.spikesHp ?? 0);
    const leftoversRecovery = defender.fieldConditions.leftovers || defender.item === "leftovers" || defender.item === "black-sludge"
      ? Math.floor(damageResult.defenderHp / 16)
      : 0;
    const minDamage = Math.max(0, damageResult.minDamage - leftoversRecovery);
    const maxDamage = Math.max(0, damageResult.maxDamage - leftoversRecovery);
    const minPercent = Math.round((minDamage / effectiveHp) * 1000) / 10;
    const maxPercent = Math.round((maxDamage / effectiveHp) * 1000) / 10;
    const rawBarMin = (minDamage / effectiveHp) * 100;
    const rawBarMax = (maxDamage / effectiveHp) * 100;
    const barMin = Math.min(rawBarMin, 100);
    const barMax = Math.min(rawBarMax, 100);
    const rangeBarPct = Math.max(0, barMax - barMin);
    const hazardBarPct = Math.min((totalHazardDmg / effectiveHp) * 100, 100);
    const poisonBarPct = Math.min((poisonDmg / effectiveHp) * 100, 100);
    const remainBarPct = Math.max(0, 100 - barMax - hazardBarPct - poisonBarPct);
    const displayKoLabel = damageResult.rolls.length > 0 && effectiveHp < damageResult.defenderHp
      ? computeMobileKoLabel(damageResult.rolls, effectiveHp)
      : damageResult.koLabel;
    const exceedsHp = maxPercent > 100;
    const barColors = getMobileBarColors(displayKoLabel, exceedsHp);

    return {
      displayKoLabel,
      minDamage,
      maxDamage,
      minPercent,
      maxPercent,
      barMin,
      barMax,
      rangeBarPct,
      hazardBarPct,
      poisonBarPct,
      remainBarPct,
      barColors,
    };
  }, [damageResult, defenderStats, defenderCurrentHp, hazardInfo, defender.fieldConditions.leftovers, defender.item, poisonDmg]);

  // Escキーでモーダルを閉じる
  useEffect(() => {
    if (!regModalOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setRegModalOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [regModalOpen]);

  return (
    <div className="min-h-screen">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm" style={{ borderBottom: "1px solid #e0e0e0" }}>
        <div className="max-w-7xl mx-auto px-3 py-3 flex items-center justify-between gap-2 sm:px-4">
          <button
            onClick={() => {
              setAttacker(DEFAULT_STATE);
              setDefender(DEFAULT_STATE);
              handleMoveSelect(null);
              setWeather("none");
              setTerrain("none");
              setDefenderCurrentHp(null);
              setAttackerRegMoves([]);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="min-w-0 flex-1 text-left hover:opacity-80 active:opacity-60 transition-opacity"
          >
            <h1 className="text-[11px] sm:text-xl font-extrabold tracking-tight leading-tight whitespace-nowrap" style={{ color: "#1a1a1a" }}><span className="hidden sm:inline">ポケモン </span>ダメージ計算機</h1>
            <p className="text-[9px] sm:text-[11px] font-medium tracking-wide" style={{ color: "#aaa" }}>Pokémon Champions</p>
          </button>
          <div className="flex items-center justify-end gap-1 sm:gap-2 flex-shrink-0">
            {/* ヘッダー共通ボタン */}
            {/* ボックスボタン */}
            <button
              onClick={() => { if (!user) setBoxEntries(loadBox()); setBoxManagerOpen(true); }}
              className="flex items-center gap-1 px-1 sm:px-4 py-1 sm:py-1.5 rounded-md text-[9px] sm:text-sm font-medium transition-colors whitespace-nowrap hover:bg-gray-100 active:bg-gray-100 border"
              style={{ backgroundColor: "#fff", color: "#1e88e5", borderColor: "#1e88e5" }}
            >
              ボックス
            </button>
            {/* 常設ポケモン登録ボタン */}
            <button
              onClick={() => setRegModalOpen(true)}
              className="flex items-center gap-1 px-1 sm:px-4 py-1 sm:py-1.5 rounded-md text-[8px] sm:text-xs font-medium transition-colors whitespace-nowrap hover:bg-gray-100 active:bg-gray-100 border"
              style={{ backgroundColor: "#fff", color: "#1e88e5", borderColor: "#1e88e5" }}
            >
              ポケモン登録＋
            </button>
            {/* ログイン/ログアウト（一番右） */}
            {!authLoading && (
              user ? (
                <button
                  onClick={signOut}
                  className="flex items-center gap-1 px-1 sm:px-3 py-1 sm:py-1.5 rounded-md text-[8px] sm:text-xs font-medium transition-colors whitespace-nowrap hover:bg-gray-100 active:bg-gray-100 border"
                  style={{ backgroundColor: "#fff", color: "#1e88e5", borderColor: "#1e88e5" }}
                  title={user.email ?? ""}
                >
                  ログアウト
                </button>
              ) : (
                <button
                  onClick={() => setLoginOpen(true)}
                  className="flex items-center gap-1 px-1 sm:px-3 py-1 sm:py-1.5 rounded-md text-[8px] sm:text-xs font-medium transition-colors whitespace-nowrap hover:bg-gray-100 active:bg-gray-100 border"
                  style={{ backgroundColor: "#fff", color: "#1e88e5", borderColor: "#1e88e5" }}
                >
                  ログイン
                </button>
              )
            )}
            {/* マジックリンクログインモーダル */}
            {loginOpen && !user && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setLoginOpen(false)}>
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-3" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-sm font-bold text-gray-700">メールでログイン</h3>
                  <p className="text-[11px] text-gray-500">メールアドレスにログインリンクを送信します。パスワード不要です。</p>
                  <p className="whitespace-pre-line rounded-lg bg-blue-50 px-3 py-2 text-[11px] leading-relaxed text-blue-700">
                    同じメールアドレスでログインすると、
                    {"\n"}
                    複数の端末でデータが共有されます。
                    {"\n\n"}
                    同期は自動で行われます。
                  </p>
                  <input
                    type="email"
                    placeholder="メールアドレス"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    autoFocus
                  />
                  {loginError && <p className="text-xs text-red-500">{loginError}</p>}
                  {loginMessage && <p className="text-xs text-green-600">{loginMessage}</p>}
                  <button
                    onClick={async () => {
                      if (!loginEmail) return;
                      setLoginError(null);
                      setLoginMessage(null);
                      const { error } = await sendMagicLink(loginEmail);
                      if (error) {
                        setLoginError(error);
                      } else {
                        setLoginMessage("ログインリンクを送信しました。メールを確認してください。");
                      }
                    }}
                    className="w-full py-2 rounded-lg text-sm font-bold text-white transition-colors hover:opacity-90" style={{ backgroundColor: "#1e88e5" }}
                  >
                    ログインリンクを送る
                  </button>
                  <button onClick={() => { setLoginOpen(false); setLoginError(null); setLoginMessage(null); }}
                    className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">
                    閉じる
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 登録モーダル */}
      {regModalOpen && (
        <RegistrationModal
          attacker={attacker}
          defender={defender}
          onClose={() => { setRegModalOpen(false); setInitialEditEntry(null); }}
          onEntriesChange={setBoxEntries}
          initialEditEntry={initialEditEntry}
        />
      )}

      {/* ボックスマネージャー */}
      {boxManagerOpen && (
        <BoxManager
          entries={boxEntries}
          teams={battleTeams}
          onSelectAttacker={(s, moves) => { void applyAttackerStateWithRegisteredMoves(s, moves); }}
          onSelectDefender={(s) => { setDefender(s); setDefenderCurrentHp(null); }}
          onEdit={(entry) => { setBoxManagerOpen(false); setInitialEditEntry(entry); setRegModalOpen(true); }}
          onDelete={(id) => {
            const next = deleteFromBox(id);
            setBoxEntries(next);
            setBattleTeams((prev) =>
              prev.map((team) => ({
                ...team,
                memberIds: team.memberIds.filter((memberId) => memberId !== id),
                updatedAt: Date.now(),
              }))
            );
          }}
          onTeamsChange={setBattleTeams}
          onClose={() => setBoxManagerOpen(false)}
        />
      )}

      <main className="max-w-[1400px] mx-auto px-2 py-2 pb-24 lg:pb-2 space-y-2">
        {/* 攻守入れ替え + 対戦形式 */}
        <div className="flex items-center justify-start gap-2">
          <button
            onClick={handleSwap}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors bg-white hover:bg-gray-50 active:bg-gray-100" style={{ border: "1px solid #e0e0e0", color: "#555", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}
          >
            ⇄ 攻守入れ替え
          </button>
          <div
            className="inline-flex items-center rounded-md overflow-hidden bg-white"
            style={{ border: "1px solid #e0e0e0", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}
          >
            <button
              onClick={() => setIsDoubles(false)}
              className={`px-3 lg:px-4 py-1.5 text-xs font-semibold transition-colors ${!isDoubles ? "bg-sky-500 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
            >
              シングル
            </button>
            <button
              onClick={() => setIsDoubles(true)}
              className={`px-3 lg:px-4 py-1.5 text-xs font-semibold transition-colors ${isDoubles ? "bg-sky-500 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
            >
              ダブル
            </button>
          </div>
        </div>

        {/* メイン2カラム + 結果 */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] xl:grid-cols-[1fr_1fr_minmax(320px,380px)] gap-2">
          {/* 攻撃側 */}
          <PokemonPanel
            title="攻撃側"
            state={attacker}
            computedStats={attackerStats}
            onPokemonSelect={handleAttackerSelect}
            onUpdate={updateAttacker}
            onIvChange={(k, v) => updateIV("attacker", k, v)}
            onEvChange={(k, v) => updateEV("attacker", k, v)}
            onStatRankChange={(k, v) => setAttacker((p) => ({ ...p, statRanks: { ...p.statRanks, [k]: v } }))}
            showMoveSelector={true}
            selectedMove={effectiveMove}
            onMoveSelect={handleMoveSelect}
            isCritical={isCritical}
            onCriticalChange={setIsCritical}
            hitCount={hitCount}
            onHitCountChange={setHitCount}
            critCount={critCount}
            onCritCountChange={setCritCount}
            onLoadFromBox={(s, moves) => { saveCurrentToHistory(attacker, attackerRegMoves); void applyAttackerStateWithRegisteredMoves(s, moves); }}
            pokemonHistory={pokemonHistory}
            boxEntries={boxEntries}
            battleTeams={battleTeams}
            registeredMoves={attackerRegMoves}
            weather={weather}
            onWeatherChange={setWeather}
            terrain={terrain}
            onTerrainChange={setTerrain}
            attackerWeight={attacker.pokemon?.weight}
            defenderWeight={defender.pokemon?.weight}
            isPaybackDoubled={isPaybackDoubled}
            onPaybackDoubledChange={setIsPaybackDoubled}
            isDoubles={isDoubles}
            helpingHand={helpingHand}
            onHelpingHandChange={setHelpingHand}
            steelworker={steelworker}
            onSteelworkerChange={setSteelworker}
              powerSpot={powerSpot}
              onPowerSpotChange={setPowerSpot}
              flowerGift={flowerGift}
              onFlowerGiftChange={setFlowerGift}
              supremeOverlordFaintedAllies={supremeOverlordFaintedAllies}
              onSupremeOverlordFaintedAlliesChange={setSupremeOverlordFaintedAllies}
              secondAttack={{
              show: showSecondAttack,
              onToggle: setShowSecondAttack,
              selectedMove: selectedMove2,
              onMoveSelect: handleMoveSelect2,
              isCritical: isCritical2,
              onCriticalChange: setIsCritical2,
              hitCount: hitCount2,
              onHitCountChange: setHitCount2,
              critCount: critCount2,
              onCritCountChange: setCritCount2,
            }}
          />

          {/* 環境設定（天気・フィールド）— スマホのみ攻撃側の直後に表示 */}
          <div className="lg:hidden flex items-center gap-1.5 flex-wrap bg-white rounded-lg border border-gray-200 shadow-sm px-3 py-1.5">
            <span className="text-[10px] font-semibold text-gray-400">天気</span>
            {([
              { value: "none" as WeatherCondition, label: "なし", tip: "" },
              { value: "sun" as WeatherCondition, label: "晴れ", tip: "ほのお技×1.5倍・みず技×0.5倍" },
              { value: "rain" as WeatherCondition, label: "雨", tip: "みず技×1.5倍・ほのお技×0.5倍" },
              { value: "sand" as WeatherCondition, label: "砂嵐", tip: "岩タイプ特防+50%" },
              { value: "snow" as WeatherCondition, label: "雪", tip: "氷タイプ防御+50%" },
            ]).map((w) => (
              <span key={w.value} className="inline-flex items-center">
                <button onClick={() => setWeather(w.value)}
                  className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
                    weather === w.value ? "bg-sky-500 text-white border-sky-500" : "border-gray-200 text-gray-500 hover:border-sky-300"
                  }`}>
                  {w.label}
                </button>
              </span>
            ))}
            <span className="text-[10px] font-semibold text-gray-400 ml-2">フィールド</span>
            {([
              { value: "none" as TerrainCondition, label: "なし" },
              { value: "electric" as TerrainCondition, label: "エレキ" },
              { value: "grassy" as TerrainCondition, label: "グラス" },
              { value: "misty" as TerrainCondition, label: "ミスト" },
              { value: "psychic" as TerrainCondition, label: "サイコ" },
            ]).map((t) => (
              <span key={t.value} className="inline-flex items-center">
                <button onClick={() => setTerrain(t.value)}
                  className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
                    terrain === t.value ? "bg-sky-500 text-white border-sky-500" : "border-gray-200 text-gray-500 hover:border-sky-300"
                  }`}>
                  {t.label}
                </button>
              </span>
            ))}
          </div>

          {/* 防御側 + 逆算ツール */}
          <div className="space-y-2">
            <PokemonPanel
              title="防御側"
              state={defender}
              computedStats={defenderStats}
              onPokemonSelect={handleDefenderSelect}
              onUpdate={updateDefender}
              onIvChange={(k, v) => updateIV("defender", k, v)}
              onEvChange={(k, v) => updateEV("defender", k, v)}
              onStatRankChange={(k, v) => setDefender((p) => ({ ...p, statRanks: { ...p.statRanks, [k]: v } }))}
              showMoveSelector={false}
              showFieldConditions={true}
              selectedMove={effectiveMove}
              onLoadFromBox={(s) => { saveCurrentToHistory(defender); setDefender({ ...DEFAULT_STATE, ...s, statRanks: { ...DEFAULT_STATE.statRanks, ...s.statRanks }, fieldConditions: { ...DEFAULT_FIELD, ...s.fieldConditions } }); setDefenderCurrentHp(null); }}
              pokemonHistory={pokemonHistory}
              boxEntries={boxEntries}
              battleTeams={battleTeams}
              currentHp={defenderCurrentHp}
              onCurrentHpChange={setDefenderCurrentHp}
              isDoubles={isDoubles}
              gravity={gravity}
              onGravityChange={setGravity}
              defenderFlowerGift={defenderFlowerGift}
              onDefenderFlowerGiftChange={setDefenderFlowerGift}
              friendGuard={friendGuard}
              onFriendGuardChange={setFriendGuard}
              canUseDisguise={defenderCanUseDisguise}
            />
            {damageResult && effectiveMove && <ReverseDamageSection
              rolls={damageResult.rolls} defenderHp={damageResult.defenderHp}
              minDamage={damageResult.minDamage} maxDamage={damageResult.maxDamage}
              defenderBaseDef={defender.pokemon ? (effectiveMove.category === "special" ? defender.pokemon.baseStats.spDef : defender.pokemon.baseStats.defense) : undefined}
              defenderBaseHp={defender.pokemon?.baseStats.hp}
              defenderLevel={defender.level}
              defenderNatureMod={(() => { const nd = NATURE_DATA[defender.nature]; const dk = effectiveMove.category === "special" ? "spDef" : "defense"; return nd.boosted === dk ? 1.1 : nd.reduced === dk ? 0.9 : 1; })()}
              moveCategory={effectiveMove.category}
              defenseStat={damageResult.defenseStat}
              onApplyDefEv={(hpEv, defEv) => {
                const dk = effectiveMove.category === "special" ? "spDef" : "defense";
                setDefender((prev) => ({ ...prev, evs: { ...prev.evs, hp: hpEv, [dk]: defEv } }));
              }}
              attackerBaseAtk={attacker.pokemon ? (effectiveMove.category === "special" ? attacker.pokemon.baseStats.spAtk : attacker.pokemon.baseStats.attack) : undefined}
              attackerLevel={attacker.level}
              attackStat={damageResult.attackStat}
              onApplyAtkEv={(ev, natMod) => {
                const ak = effectiveMove.category === "special" ? "spAtk" : "attack";
                setAttacker((prev) => ({ ...prev, evs: { ...prev.evs, [ak]: ev } }));
                // 性格も反映（natModに合う性格を探す）
                if (natMod === 1.1) {
                  // 攻撃up性格に変更
                  const upNature = Object.entries(NATURE_DATA).find(([, d]) => d.boosted === ak)?.[0];
                  if (upNature) setAttacker((prev) => ({ ...prev, nature: upNature as Nature }));
                } else if (natMod === 0.9) {
                  const downNature = Object.entries(NATURE_DATA).find(([, d]) => d.reduced === ak)?.[0];
                  if (downNature) setAttacker((prev) => ({ ...prev, nature: downNature as Nature }));
                } else {
                  // 補正なし性格（該当ステを上げも下げもしない）
                  const neutralNature = Object.entries(NATURE_DATA).find(([, d]) => d.boosted !== ak && d.reduced !== ak)?.[0];
                  if (neutralNature) setAttacker((prev) => ({ ...prev, nature: neutralNature as Nature }));
                }
              }}
            />}
          </div>
          {/* 計算結果 (sticky, xl時3列目 / lg時2列目下に折り返し) */}
          <div className="lg:col-span-2 xl:col-span-1 xl:sticky xl:top-0 xl:self-start space-y-2">

        {/* ダメージ結果 */}
        {damageResult && finalMove ? (
          <div className="space-y-2">
            <div
              className="px-4 py-2 text-sm font-bold rounded-t-lg"
              style={{ backgroundColor: "#fdecec", color: "#d84c4c" }}
            >
              計算結果 — {attacker.pokemon?.japaneseName} の {finalMove.japaneseName}
              {/* 体重依存技の威力表示 */}
              {(finalMove.name === "heavy-slam" || finalMove.name === "heat-crash") && attacker.pokemon?.weight && defender.pokemon?.weight && (
                <span className="ml-1 text-xs font-normal text-gray-300">
                  （威力: {(() => {
                    const r = attacker.pokemon.weight / defender.pokemon.weight;
                    if (r >= 5) return 120; if (r >= 4) return 100; if (r >= 3) return 80; if (r >= 2) return 60; return 40;
                  })()}）
                </span>
              )}
              {(finalMove.name === "grass-knot" || finalMove.name === "low-kick") && defender.pokemon?.weight && (
                <span className="ml-1 text-xs font-normal text-gray-300">
                  （威力: {(() => {
                    const kg = defender.pokemon.weight / 10;
                    if (kg >= 200) return 120; if (kg >= 100) return 100; if (kg >= 50) return 80; if (kg >= 25) return 60; if (kg >= 10) return 40; return 20;
                  })()}）
                </span>
              )}
              {(defender.fieldConditions.lightScreen || defender.fieldConditions.reflect || defender.fieldConditions.auroraVeil) && (
                <span className="ml-2 text-xs font-normal text-purple-600">
                  {defender.fieldConditions.auroraVeil ? "（オーロラベール中）" :
                   defender.fieldConditions.lightScreen && finalMove?.category === "special" ? "（ひかりの壁中）" :
                   defender.fieldConditions.reflect && finalMove?.category === "physical" ? "（リフレクター中）" : ""}
                </span>
              )}
            </div>
            <DamageResultPanel
              result={damageResult}
              stealthRockHp={hazardInfo?.stealthRockHp}
              disguiseHp={hazardInfo?.disguiseHp}
              spikesHp={hazardInfo?.spikesHp}
              currentHp={defenderCurrentHp ?? undefined}
              hideReverseCalc
              poisonDmg={poisonDmg}
              defenderItem={defender.item}
              hasLeftovers={defender.fieldConditions.leftovers}
              defenderBaseDefense={defender.pokemon ? (effectiveMove?.category === "special" ? defender.pokemon.baseStats.spDef : defender.pokemon.baseStats.defense) : undefined}
              defenderBaseHp={defender.pokemon?.baseStats.hp}
              defenderLevel={defender.level}
              defenderNatureMod={(() => {
                const nd = NATURE_DATA[defender.nature];
                const defKey = effectiveMove?.category === "special" ? "spDef" : "defense";
                return nd.boosted === defKey ? 1.1 : nd.reduced === defKey ? 0.9 : 1;
              })()}
              moveCategory={effectiveMove?.category}
              onApplyDefEv={(hpEv, defEv) => {
                const defKey = effectiveMove?.category === "special" ? "spDef" : "defense";
                setDefender((prev) => ({
                  ...prev,
                  evs: { ...prev.evs, hp: hpEv, [defKey]: defEv },
                }));
              }}
            />

            {/* 2回目の攻撃結果（1回目のダメージ後の残HPで計算） */}
            {showSecondAttack && damageResult2 && selectedMove2 && damageResult && (
              <div className="mt-2">
                <h2 className="font-semibold text-gray-700 text-sm px-1">
                  2回目 — {attacker.pokemon?.japaneseName} の {selectedMove2.japaneseName}
                  <span className="text-xs font-normal text-gray-400 ml-1">（1回目ダメージ後）</span>
                </h2>
                <DamageResultPanel
                  result={damageResult2}
                  currentHp={Math.max(1, damageResult.defenderHp - Math.floor((damageResult.minDamage + damageResult.maxDamage) / 2))}
                  disguiseHp={hazardInfo?.disguiseHp}
                  stealthRockHp={hazardInfo?.stealthRockHp}
                  spikesHp={hazardInfo?.spikesHp}
                  hideReverseCalc
                  defenderItem={defender.item}
                />
              </div>
            )}
          </div>
        ) : hazardInfo && defenderStats ? (
          /* 技未選択時の設置技ダメージ表示 */
          <div className="space-y-2">
            <h2 className="font-semibold text-gray-700 text-sm px-1">
              設置技ダメージ — {defender.pokemon?.japaneseName ?? "防御側"}
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
              {/* HP バー（設置技のみ） */}
              {(() => {
                const hp = (defenderCurrentHp != null && defenderCurrentHp >= 1) ? defenderCurrentHp : defenderStats.hp;
                const totalHazard = (hazardInfo.stealthRockHp ?? 0) + (hazardInfo.disguiseHp ?? 0) + (hazardInfo.spikesHp ?? 0);
                const hazardPct = Math.min((totalHazard / hp) * 100, 100);
                const remainPct = Math.max(0, 100 - hazardPct);
                return (
                  <>
                    {totalHazard > 0 && (
                      <>
                        <div className="text-center">
                          {hp < defenderStats.hp && (
                            <p className="text-[11px] text-blue-500 font-medium mb-1">
                              現在HP {hp}/{defenderStats.hp} ({Math.round(hp/defenderStats.hp*1000)/10}%) 基準
                            </p>
                          )}
                          <span className="text-2xl font-extrabold text-amber-700">
                            合計 -{totalHazard} ({(totalHazard / hp * 100).toFixed(1)}%)
                          </span>
                        </div>
                        <div>
                          <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
                            <div className="absolute left-0 top-0 h-full bg-green-400 transition-all" style={{ width: `${remainPct}%` }} />
                            <div className="absolute top-0 h-full bg-yellow-400 transition-all opacity-80" style={{ left: `${remainPct}%`, width: `${hazardPct}%` }} />
                            <div className="absolute left-1/2 top-0 w-px h-full bg-gray-400 opacity-60" />
                          </div>
                          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                            <span>0%</span>
                            <span>50%</span>
                            <span>100%</span>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
              {/* 内訳 */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-600">事前ダメージ</p>
                {hazardInfo.stealthRockHp != null && hazardInfo.stealthRockHp > 0 && (
                  <div className="flex justify-between text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                    <span className="text-amber-800 font-medium">ステルスロック</span>
                    <span className="font-bold text-amber-900">
                      -{hazardInfo.stealthRockHp} ({Math.round(hazardInfo.stealthRockHp / defenderStats.hp * 1000) / 10}% / 最大HP比)
                    </span>
                  </div>
                )}
                {hazardInfo.disguiseHp != null && hazardInfo.disguiseHp > 0 && (
                  <div className="flex justify-between text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                    <span className="text-amber-800 font-medium">ばけのかわなし</span>
                    <span className="font-bold text-amber-900">
                      -{hazardInfo.disguiseHp} ({Math.round(hazardInfo.disguiseHp / defenderStats.hp * 1000) / 10}% / 最大HP比)
                    </span>
                  </div>
                )}
                {hazardInfo.spikesHp != null && hazardInfo.spikesHp > 0 && (
                  <div className="flex justify-between text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                    <span className="text-amber-800 font-medium">まきびし ({defender.fieldConditions.spikesLayers}層)</span>
                    <span className="font-bold text-amber-900">
                      -{hazardInfo.spikesHp} ({Math.round(hazardInfo.spikesHp / defenderStats.hp * 1000) / 10}% / 最大HP比)
                    </span>
                  </div>
                )}
                {hazardInfo.spikesImmune && (
                  <div className="flex justify-between text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                    <span className="text-gray-500">まきびし</span>
                    <span className="text-gray-400">ひこうタイプ / ふゆうのため無効</span>
                  </div>
                )}
              </div>
              {!selectedMove && (
                <p className="text-xs text-gray-400 text-center">技を選択すると技ダメージ＋事前ダメージ込みの結果が表示されます</p>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
            {!attacker.pokemon ? "攻撃側のポケモンを選択してください"
              : !defender.pokemon ? "防御側のポケモンを選択してください"
              : !selectedMove ? "技を選択するとダメージが計算されます"
              : "威力がない技です"}
          </div>
        )}

          </div>
        </div>

        {/* 環境設定（天気・フィールド） — PC用：カード下部にフルワイド / スマホでは上部に表示済みなので非表示 */}
        <div className="hidden lg:flex items-center gap-1.5 flex-wrap bg-white rounded-lg border border-gray-200 shadow-sm px-3 py-1.5">
          <span className="text-[10px] font-semibold text-gray-400">天気</span>
          {([
            { value: "none" as WeatherCondition, label: "なし", tip: "" },
            { value: "sun" as WeatherCondition, label: "晴れ", tip: "ほのお技×1.5倍・みず技×0.5倍\nソーラービームが即発動" },
            { value: "rain" as WeatherCondition, label: "雨", tip: "みず技×1.5倍・ほのお技×0.5倍\nかみなりの命中率100%" },
            { value: "sand" as WeatherCondition, label: "砂嵐", tip: "岩・鋼・地面以外が毎ターンHP1/16削れる\n岩タイプ特防+50%" },
            { value: "snow" as WeatherCondition, label: "雪", tip: "氷タイプの防御+50%（SV仕様）" },
          ]).map((w) => (
            <span key={w.value} className="inline-flex items-center">
              <button onClick={() => setWeather(w.value)}
                className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
                  weather === w.value ? "bg-sky-500 text-white border-sky-500" : "border-gray-200 text-gray-500 hover:border-sky-300"
                }`}>
                {w.label}
              </button>
              {w.tip && <Tooltip text={w.tip} side="bottom" />}
            </span>
          ))}
          <span className="text-[10px] font-semibold text-gray-400 ml-2">フィールド</span>
          {([
            { value: "none" as TerrainCondition, label: "なし", tip: "" },
            { value: "electric" as TerrainCondition, label: "エレキ", tip: "電気技×1.3倍\n地面にいる側がねむり状態にならない" },
            { value: "grassy" as TerrainCondition, label: "グラス", tip: "草技×1.3倍\nじしん・マグニチュード×0.5倍" },
            { value: "misty" as TerrainCondition, label: "ミスト", tip: "状態異常技が無効（地面にいる側）\nドラゴン技×0.5倍" },
            { value: "psychic" as TerrainCondition, label: "サイコ", tip: "エスパー技×1.3倍\n優先度マイナス技が無効（地面にいる側）" },
          ]).map((t) => (
            <span key={t.value} className="inline-flex items-center">
              <button onClick={() => setTerrain(t.value)}
                className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
                  terrain === t.value ? "bg-sky-500 text-white border-sky-500" : "border-gray-200 text-gray-500 hover:border-sky-300"
                }`}>
                {t.label}
              </button>
              {t.tip && <Tooltip text={t.tip} side="bottom" />}
            </span>
          ))}
        </div>

      </main>

      {damageResult && finalMove && attacker.pokemon && defender.pokemon && defenderStats && mobileDamageSummary && (
        <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden border-t border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 shadow-[0_-8px_24px_rgba(15,23,42,0.12)]">
          <div className="px-3 py-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
              <div className="min-w-0 text-left">
                <p className="text-[10px] font-semibold text-red-500">攻撃側</p>
                <p className="truncate text-sm font-bold text-gray-900">{attacker.pokemon.japaneseName}</p>
                <p className="text-[11px] text-gray-500">{finalMove.japaneseName}</p>
              </div>

              <div className="min-w-0">
                <div className="flex items-center justify-between text-[11px] font-semibold text-gray-700">
                  <span className={mobileDamageSummary.barColors.text}>{mobileDamageSummary.displayKoLabel}</span>
                  <span>{mobileDamageSummary.minDamage}〜{mobileDamageSummary.maxDamage}</span>
                </div>
                <div className="relative mt-1 h-4 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="absolute left-0 top-0 h-full bg-green-400 transition-all"
                    style={{ width: `${mobileDamageSummary.remainBarPct}%` }}
                  />
                  {mobileDamageSummary.hazardBarPct > 0 && (
                    <div
                      className="absolute top-0 h-full bg-yellow-400 opacity-80 transition-all"
                      style={{
                        left: `${mobileDamageSummary.remainBarPct}%`,
                        width: `${Math.min(mobileDamageSummary.hazardBarPct, 100)}%`,
                      }}
                    />
                  )}
                  {mobileDamageSummary.poisonBarPct > 0 && (
                    <div
                      className="absolute top-0 h-full bg-purple-400 opacity-80 transition-all"
                      style={{
                        left: `${mobileDamageSummary.remainBarPct + mobileDamageSummary.hazardBarPct}%`,
                        width: `${Math.min(mobileDamageSummary.poisonBarPct, 100)}%`,
                      }}
                    />
                  )}
                  {mobileDamageSummary.rangeBarPct > 0 && (
                    <div
                      className={`absolute top-0 h-full transition-all ${mobileDamageSummary.barColors.range}`}
                      style={{
                        left: `${Math.max(0, 100 - mobileDamageSummary.barMax)}%`,
                        width: `${mobileDamageSummary.rangeBarPct}%`,
                      }}
                    />
                  )}
                  <div
                    className={`absolute right-0 top-0 h-full transition-all ${mobileDamageSummary.barColors.solid}`}
                    style={{ width: `${mobileDamageSummary.barMin}%` }}
                  />
                </div>
                <div className="mt-1 text-center text-[12px] font-bold text-gray-900">
                  {mobileDamageSummary.minPercent.toFixed(1)}〜{mobileDamageSummary.maxPercent.toFixed(1)}%
                </div>
              </div>

              <div className="min-w-0 text-right">
                <p className="text-[10px] font-semibold text-sky-500">防御側</p>
                <p className="truncate text-sm font-bold text-gray-900">{defender.pokemon.japaneseName}</p>
                <p className="text-[11px] text-gray-500">HP {defenderStats.hp}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="text-center py-6 px-4 space-y-2" style={{ color: "#888" }}>
        <p className="text-xs">ポケモンデータ: PokéAPI | 画像認識: Claude API (Anthropic)</p>
        <p className="text-xs">このサイトはポケモン対戦向けの非公式ファンツールです。</p>
        <p className="text-xs">
          不具合報告・ご要望は
          {" "}
          <a
            href="https://x.com/poketool2"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-600 hover:text-sky-700 underline underline-offset-2"
          >
            X @poketool2
          </a>
          {" "}
          までお願いします。
        </p>
        <p className="text-xs leading-relaxed">
          当サイトは任天堂、株式会社ポケモン及び関係各社とは一切関係ありません。<br />
          ポケットモンスター・ポケモン・Pokémonは任天堂・クリーチャーズ・ゲームフリークの登録商標です。
        </p>
      </footer>
    </div>
  );
}

// ───────────────────────────────────────
// PokemonPanel
// ───────────────────────────────────────
interface PanelProps {
  title: string;
  state: PokemonState;
  computedStats: ReturnType<typeof calcAllStats> | null;
  onPokemonSelect: (poke: PokemonData) => void;
  onUpdate: <K extends keyof PokemonState>(key: K, value: PokemonState[K]) => void;
  onIvChange: (k: StatKey, v: number) => void;
  onEvChange: (k: StatKey, v: number) => void;
  onStatRankChange: (key: 'attack' | 'spAtk' | 'defense' | 'spDef', value: number) => void;
  showMoveSelector?: boolean;
  showFieldConditions?: boolean;
  selectedMove?: MoveData | null;
  onMoveSelect?: (m: MoveData) => void;
  isCritical?: boolean;
  onCriticalChange?: (v: boolean) => void;
  hitCount?: number;
  onHitCountChange?: (v: number) => void;
  critCount?: number;
  onCritCountChange?: (v: number) => void;
  onLoadFromBox?: (state: PokemonState, moves?: string[]) => void;
  boxEntries?: BoxEntry[];
  battleTeams?: BattleTeam[];
  registeredMoves?: string[];   // 登録済み技（登録ポケモンから呼び出した場合）
  weather?: WeatherCondition;
  onWeatherChange?: (v: WeatherCondition) => void;
  terrain?: TerrainCondition;
  onTerrainChange?: (v: TerrainCondition) => void;
  // 防御側 現在HP
  currentHp?: number | null;
  onCurrentHpChange?: (v: number | null) => void;
  // 体重（ヘビーボンバー威力計算用）
  attackerWeight?: number;
  defenderWeight?: number;
  // しっぺがえし後攻フラグ
  isPaybackDoubled?: boolean;
  onPaybackDoubledChange?: (v: boolean) => void;
  // 2回目の攻撃（攻撃側のみ）
  secondAttack?: {
    show: boolean;
    onToggle: (v: boolean) => void;
    selectedMove: MoveData | null;
    onMoveSelect: (m: MoveData | null) => void;
    isCritical: boolean;
    onCriticalChange: (v: boolean) => void;
    hitCount: number;
    onHitCountChange: (v: number) => void;
    critCount: number;
    onCritCountChange: (v: number) => void;
  };
  isDoubles?: boolean;
  helpingHand?: boolean;
  onHelpingHandChange?: (v: boolean) => void;
  steelworker?: boolean;
  onSteelworkerChange?: (v: boolean) => void;
  powerSpot?: boolean;
  onPowerSpotChange?: (v: boolean) => void;
  flowerGift?: boolean;
  onFlowerGiftChange?: (v: boolean) => void;
  gravity?: boolean;
  onGravityChange?: (v: boolean) => void;
  defenderFlowerGift?: boolean;
  onDefenderFlowerGiftChange?: (v: boolean) => void;
  friendGuard?: boolean;
  onFriendGuardChange?: (v: boolean) => void;
  canUseDisguise?: boolean;
  supremeOverlordFaintedAllies?: number;
  onSupremeOverlordFaintedAlliesChange?: (v: number) => void;
  pokemonHistory?: HistoryEntry[];
}

function PokemonPanel({
  title, state, computedStats, onPokemonSelect, onUpdate,
  onIvChange, onEvChange, onStatRankChange,
  showMoveSelector, showFieldConditions, selectedMove, onMoveSelect,
  isCritical, onCriticalChange, hitCount, onHitCountChange, critCount, onCritCountChange,
  onLoadFromBox, boxEntries, battleTeams, registeredMoves,
  weather, onWeatherChange, terrain, onTerrainChange,
  currentHp, onCurrentHpChange, attackerWeight, defenderWeight,
  isPaybackDoubled: panelPaybackDoubled, onPaybackDoubledChange, secondAttack,
  isDoubles, helpingHand, onHelpingHandChange, steelworker, onSteelworkerChange,
  powerSpot, onPowerSpotChange, flowerGift, onFlowerGiftChange, gravity, onGravityChange,
  defenderFlowerGift, onDefenderFlowerGiftChange, friendGuard, onFriendGuardChange, canUseDisguise,
  supremeOverlordFaintedAllies, onSupremeOverlordFaintedAlliesChange,
  pokemonHistory,
}: PanelProps) {
  const { pokemon, level, nature, ivs, evs, teraType, isTerastallized, isDynamaxed, isMegaEvolved, megaForm, isBurned, isCharged, ability, item, fieldConditions } = state;
  const availableMegaForms = pokemon ? getMegaForms(pokemon.name) : [];
  const activeMegaForm = useMemo(() => {
    if (!isMegaEvolved || availableMegaForms.length === 0) return null;
    return availableMegaForms.find((m) => m.slug === megaForm) ?? availableMegaForms[0];
  }, [isMegaEvolved, megaForm, availableMegaForms]);

  useEffect(() => {
    if (!pokemon) return;

    if (activeMegaForm) {
      if (megaForm !== activeMegaForm.slug) onUpdate("megaForm", activeMegaForm.slug);
      if (ability !== activeMegaForm.ability) onUpdate("ability", activeMegaForm.ability);
      if (item !== activeMegaForm.megaStone) onUpdate("item", activeMegaForm.megaStone);
      return;
    }

    if (megaForm !== null) onUpdate("megaForm", null);
    if (pokemon.abilities.length > 0 && !pokemon.abilities.some((entry) => entry.slug === ability)) {
      onUpdate("ability", pokemon.abilities[0].slug);
    }
  }, [pokemon, activeMegaForm, megaForm, ability, item, onUpdate]);

  // 技のカテゴリに基づいて表示するステータスを決定
  const visibleStats = (() => {
    if (showMoveSelector) {
      // 攻撃側
      if (!selectedMove) return ["attack"] as StatKey[]; // 技未選択時はこうげきのみ
      const override = MOVE_METADATA[selectedMove.name]?.statOverride;
      if (override === "foul-play") return [] as StatKey[];
      if (override === "body-press") return ["defense"] as StatKey[];
      return selectedMove.category === "special"
        ? ["spAtk"] as StatKey[]
        : ["attack"] as StatKey[];
    } else {
      // 防御側
      if (!selectedMove) return ["hp", "defense"] as StatKey[]; // 技未選択時はHP+ぼうぎょ
      if (MOVE_METADATA[selectedMove.name]?.defenseStatOverride === "defense") {
        return ["hp", "defense"] as StatKey[];
      }
      return selectedMove.category === "special"
        ? ["hp", "spDef"] as StatKey[]
        : ["hp", "defense"] as StatKey[];
    }
  })();

  const panelTone = showMoveSelector
    ? {
        headerBackground: "#fdecec",
        headerText: "#d84c4c",
      }
    : {
        headerBackground: "#eaf3ff",
        headerText: "#4c88d8",
      };

  return (
    <div className="bg-white rounded-lg" style={{ border: "1px solid #e0e0e0", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
      {/* パネルヘッダー */}
      <div
        className="px-4 py-2 text-sm font-bold rounded-t-lg"
        style={{ backgroundColor: panelTone.headerBackground, color: panelTone.headerText }}
      >
        {title}
      </div>

      <div className="p-3 space-y-2">
        <PokemonSearch
          onSelect={onPokemonSelect}
          label="ポケモン検索"
          pokemonName={pokemon?.japaneseName ?? ""}
          placeholder={showMoveSelector ? "クリックして攻撃するポケモンを選択" : "クリックして防御するポケモンを選択"}
          onBoxSelect={onLoadFromBox}
          boxEntries={boxEntries}
          teams={battleTeams}
          pokemonHistory={pokemonHistory}
          isDoubles={isDoubles}
        />

        {pokemon && (
          <>
            <div className="flex items-center gap-3">
              {(() => {
                const displaySprite = activeMegaForm?.spriteUrl || pokemon.spriteUrl;
                const displayName = activeMegaForm?.jaName ?? pokemon.japaneseName;
                const displayTypes = activeMegaForm?.types ?? pokemon.types;
                return (
                  <>
                    {displaySprite && (
                      <img src={displaySprite} alt={displayName} className="w-16 h-16 object-contain" />
                    )}
                    <div>
                      <p className="font-bold text-lg text-gray-900">
                        {displayName}
                        {activeMegaForm && <span className="ml-1.5 text-[10px] font-bold text-purple-600 bg-purple-100 rounded px-1.5 py-0.5 align-middle">MEGA</span>}
                        {isDynamaxed && <span className="ml-1.5 text-[10px] font-bold text-red-600 bg-red-100 rounded px-1.5 py-0.5 align-middle">D-MAX</span>}
                      </p>
                      <div className="flex gap-1 mt-1">
                        {displayTypes.map((t) => <TypeBadge key={t} type={t} size="sm" />)}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* フォームスイッチ: テラスタル / ダイマックス / メガシンカ */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 text-sm flex-wrap">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" checked={isTerastallized}
                    onChange={(e) => {
                      onUpdate("isTerastallized", e.target.checked);
                      if (e.target.checked) { onUpdate("isDynamaxed", false); onUpdate("isMegaEvolved", false); onUpdate("megaForm", null); }
                    }} className="rounded w-3.5 h-3.5" />
                  <span className="font-medium text-xs">テラスタル</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" checked={isDynamaxed}
                    onChange={(e) => {
                      onUpdate("isDynamaxed", e.target.checked);
                      if (e.target.checked) { onUpdate("isTerastallized", false); onUpdate("isMegaEvolved", false); onUpdate("megaForm", null); }
                    }} className="rounded w-3.5 h-3.5" />
                  <span className="font-medium text-xs">ダイマックス</span>
                </label>
                {availableMegaForms.length > 0 ? (
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input type="checkbox" checked={isMegaEvolved}
                      onChange={(e) => {
                        const on = e.target.checked;
                        onUpdate("isMegaEvolved", on);
                        if (on) {
                          onUpdate("isTerastallized", false);
                          onUpdate("isDynamaxed", false);
                          const first = availableMegaForms[0];
                          onUpdate("megaForm", first.slug);
                          onUpdate("item", first.megaStone);
                          onUpdate("ability", first.ability);
                        } else {
                          onUpdate("megaForm", null);
                          // メガシンカ解除時、元の特性に戻す
                          if (pokemon.abilities[0]) onUpdate("ability", pokemon.abilities[0].slug);
                        }
                      }} className="rounded w-3.5 h-3.5" />
                    <span className="font-medium text-xs">メガシンカ</span>
                  </label>
                ) : (
                  <span className="flex items-center gap-1.5 select-none opacity-40 cursor-not-allowed" title="このポケモンはメガシンカできません">
                    <input type="checkbox" disabled className="rounded w-3.5 h-3.5" />
                    <span className="font-medium text-xs">メガシンカ</span>
                  </span>
                )}
              </div>
              {isTerastallized && (
                <div className="ml-5">
                  <select value={teraType ?? ""}
                    onChange={(e) => onUpdate("teraType", (e.target.value as PokemonType) || null)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
                    <option value="">テラタイプを選択</option>
                    {ALL_TERA_TYPES.map((t) => <option key={t} value={t}>{TYPE_NAMES_JA[t]}</option>)}
                  </select>
                  {teraType && <div className="mt-1"><TypeBadge type={teraType} size="sm" /></div>}
                </div>
              )}
              {isDynamaxed && (
                <p className="text-[11px] text-red-600 font-medium ml-5">HP 2倍 / 技がダイマックス技に変換</p>
              )}
              {isMegaEvolved && availableMegaForms.length > 1 && (
                <div className="ml-5">
                  <select value={megaForm ?? ""} onChange={(e) => {
                    const form = availableMegaForms.find((m) => m.slug === e.target.value);
                    if (form) { onUpdate("megaForm", form.slug); onUpdate("item", form.megaStone); onUpdate("ability", form.ability); }
                  }} className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
                    {availableMegaForms.map((m) => <option key={m.slug} value={m.slug}>{m.jaName}</option>)}
                  </select>
                </div>
              )}
              {isMegaEvolved && megaForm && (
                <p className="text-[11px] text-purple-600 font-medium ml-5">
                  MEGA — {availableMegaForms.find((m) => m.slug === megaForm)?.jaName} / {availableMegaForms.find((m) => m.slug === megaForm)?.megaStoneJa}
                </p>
              )}
            </div>

            {showMoveSelector && onMoveSelect && (
              <div className="border-b pb-3">
                <MoveSelector
                  moveNames={pokemon.moveNames}
                  pokemonSlug={pokemon.name}
                  pokemonTypes={pokemon.types}
                  registeredMoves={registeredMoves}
                  selectedMove={selectedMove ?? null}
                  onMoveSelect={onMoveSelect}
                  isCritical={isCritical ?? false}
                  onCriticalChange={onCriticalChange ?? (() => {})}
                  hitCount={hitCount ?? 1}
                  onHitCountChange={onHitCountChange ?? (() => {})}
                  critCount={critCount ?? 0}
                  onCritCountChange={onCritCountChange ?? (() => {})}
                  attackerAbility={ability}
                  attackerItem={item}
                  isBurned={isBurned}
                  onBurnedChange={(v) => onUpdate("isBurned", v)}
                  isCharged={isCharged}
                  onChargedChange={(v) => onUpdate("isCharged", v)}
                  weather={weather ?? "none"}
                  onWeatherChange={onWeatherChange ?? (() => {})}
                  terrain={terrain ?? "none"}
                  onTerrainChange={onTerrainChange ?? (() => {})}
                  attackerWeight={attackerWeight}
                  defenderWeight={defenderWeight}
                  isPaybackDoubled={panelPaybackDoubled}
                  onPaybackDoubledChange={onPaybackDoubledChange}
                />
              </div>
            )}

            <StatEditor
              baseStats={pokemon.baseStats}
              level={level} nature={nature} ivs={ivs} evs={evs}
              abilities={(() => {
                // メガシンカ中は元特性ではなく、メガ形態の特性だけを選択肢にする
                if (activeMegaForm) {
                  return [{ slug: activeMegaForm.ability, isHidden: false, slot: 1 }];
                }
                return pokemon.abilities;
              })()}
              selectedAbility={ability} selectedItem={item} pokemonSlug={pokemon.name}
              statRanks={state.statRanks}
              onLevelChange={(v) => onUpdate("level", v)}
              onNatureChange={(v) => onUpdate("nature", v as Nature)}
              onIvChange={onIvChange} onEvChange={onEvChange}
              onAbilityChange={(v) => onUpdate("ability", v)}
              onItemChange={(v) => onUpdate("item", v)}
              onStatRankChange={onStatRankChange}
              hpSlot={showFieldConditions && computedStats && onCurrentHpChange ? (
                <CurrentHpEditor
                  maxHp={computedStats.hp}
                  value={currentHp ?? null}
                  onChange={onCurrentHpChange}
                />
              ) : undefined}
              visibleStats={visibleStats}
            />

            {/* コンディション（急所・やけど・じゅうでん）— 攻撃側のみ */}
            {showMoveSelector && (
              <div className="space-y-1 pt-1">
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <label className="flex items-center gap-1 text-[11px] cursor-pointer">
                    <input type="checkbox" checked={isCritical ?? false}
                      onChange={(e) => onCriticalChange?.(e.target.checked)} className="rounded w-3.5 h-3.5" />
                    <span className="font-medium text-gray-600">急所</span>
                    <Tooltip text={"ダメージ×1.5倍\n防御側のランクアップ・壁効果を無視"} />
                  </label>
                  <label className="flex items-center gap-1 text-[11px] cursor-pointer">
                    <input type="checkbox" checked={isBurned}
                      onChange={(e) => onUpdate("isBurned", e.target.checked)} className="rounded w-3.5 h-3.5" />
                    <span className="font-medium text-gray-600">やけど</span>
                    <Tooltip text={"物理技のダメージが0.5倍\n毎ターンHP1/16削れる"} />
                  </label>
                  <label className="flex items-center gap-1 text-[11px] cursor-pointer">
                    <input type="checkbox" checked={isCharged}
                      onChange={(e) => onUpdate("isCharged", e.target.checked)} className="rounded w-3.5 h-3.5" />
                    <span className="font-medium text-gray-600">じゅうでん</span>
                    <Tooltip text={"でんき技の威力が2倍"} />
                  </label>
                </div>
                {isDoubles && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-[11px] font-semibold text-gray-500">ダブル補助</span>
                    <label className="flex items-center gap-1 text-[11px] cursor-pointer">
                      <input type="checkbox" checked={helpingHand ?? false}
                        onChange={(e) => onHelpingHandChange?.(e.target.checked)} className="rounded w-3.5 h-3.5" />
                      <span className="font-medium text-gray-600">てだすけ</span>
                      <Tooltip text={"味方の攻撃を補助\n選んだ技の威力が1.5倍"} />
                    </label>
                    <label className="flex items-center gap-1 text-[11px] cursor-pointer">
                      <input type="checkbox" checked={steelworker ?? false}
                        onChange={(e) => onSteelworkerChange?.(e.target.checked)} className="rounded w-3.5 h-3.5" />
                      <span className="font-medium text-gray-600">はがねのせいしん</span>
                      <Tooltip text={"味方のはがね技を強化\nはがね技の威力が1.5倍"} />
                    </label>
                    <label className="flex items-center gap-1 text-[11px] cursor-pointer">
                      <input type="checkbox" checked={powerSpot ?? false}
                        onChange={(e) => onPowerSpotChange?.(e.target.checked)} className="rounded w-3.5 h-3.5" />
                      <span className="font-medium text-gray-600">パワースポット</span>
                      <Tooltip text={"味方の技の威力を底上げ\nすべての攻撃技が1.3倍"} />
                    </label>
                    <label className="flex items-center gap-1 text-[11px] cursor-pointer">
                      <input type="checkbox" checked={flowerGift ?? false}
                        onChange={(e) => onFlowerGiftChange?.(e.target.checked)} className="rounded w-3.5 h-3.5" />
                      <span className="font-medium text-gray-600">フラワーギフト</span>
                      <Tooltip text={"晴れのとき味方を強化\n物理技の攻撃が1.5倍"} />
                    </label>
                  </div>
                )}
                {ability === "supreme-overlord" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-gray-500">そうだいしょう</span>
                    <span className="text-[11px] text-gray-500">ひんし味方数</span>
                    <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
                      {[0, 1, 2, 3, 4, 5].map((count) => {
                        const active = (supremeOverlordFaintedAllies ?? 0) === count;
                        return (
                          <button
                            key={count}
                            type="button"
                            onClick={() => onSupremeOverlordFaintedAlliesChange?.(count)}
                            className={`text-[11px] min-w-8 px-2 py-1 font-medium border-r last:border-r-0 ${
                              active ? "bg-slate-700 text-white border-slate-700" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            {count}
                          </button>
                        );
                      })}
                    </div>
                    <Tooltip text={"ドドゲザンの特性。ひんしの味方1体ごとに攻撃技の威力が1.1倍、最大1.5倍"} side="bottom" />
                  </div>
                )}
              </div>
            )}

            {/* 2回目の攻撃（攻撃側のみ、急所・やけど・じゅうでんの直後） */}
            {showMoveSelector && secondAttack && pokemon && (
              <div className="border-t pt-2">
                {!secondAttack.show ? (
                  <button
                    onClick={() => secondAttack.onToggle(true)}
                    className="text-xs px-3 py-1.5 rounded-md border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50 hover:border-gray-400 transition-colors w-full"
                  >
                    ＋ 2回目の攻撃を追加
                  </button>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-600">2回目の攻撃</span>
                      <button onClick={() => { secondAttack.onToggle(false); secondAttack.onMoveSelect(null); }}
                        className="text-[10px] text-gray-400 hover:text-red-500">× 削除</button>
                    </div>
                    <MoveSelector
                      moveNames={pokemon.moveNames}
                      pokemonSlug={pokemon.name}
                      pokemonTypes={pokemon.types}
                      selectedMove={secondAttack.selectedMove}
                      onMoveSelect={secondAttack.onMoveSelect}
                      isCritical={secondAttack.isCritical}
                      onCriticalChange={secondAttack.onCriticalChange}
                      hitCount={secondAttack.hitCount}
                      onHitCountChange={secondAttack.onHitCountChange}
                      critCount={secondAttack.critCount}
                      onCritCountChange={secondAttack.onCritCountChange}
                      attackerAbility={ability}
                      attackerItem={item}
                      isBurned={isBurned}
                      onBurnedChange={(v) => onUpdate("isBurned", v)}
                      isCharged={isCharged}
                      onChargedChange={(v) => onUpdate("isCharged", v)}
                      weather={weather ?? "none"}
                      onWeatherChange={onWeatherChange ?? (() => {})}
                      terrain={terrain ?? "none"}
                      onTerrainChange={onTerrainChange ?? (() => {})}
                      attackerWeight={attackerWeight}
                      defenderWeight={defenderWeight}
                    />
                  </div>
                )}
              </div>
            )}

            {showFieldConditions && (
              <FieldConditionsPanel
                field={fieldConditions}
                onChange={(next) => onUpdate("fieldConditions", next)}
                isDoubles={isDoubles ?? false}
                gravity={gravity ?? false}
                onGravityChange={onGravityChange ?? (() => {})}
                defenderFlowerGift={defenderFlowerGift ?? false}
                onDefenderFlowerGiftChange={onDefenderFlowerGiftChange ?? (() => {})}
                friendGuard={friendGuard ?? false}
                onFriendGuardChange={onFriendGuardChange ?? (() => {})}
                canUseDisguise={canUseDisguise ?? false}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
