import type { PokemonData, MoveData, PokemonType, AbilityEntry } from "./types";
import { POKEMON_MASTER_DATA } from "./pokemon-master-data";
import { getEnSlug, findPokemonCandidates, EN_TO_JA } from "./pokemon-names";

const BASE = "https://pokeapi.co/api/v2";

/**
 * PokeAPI のバージョングループに登録されていないが
 * SVで実際に使用可能な技を補完するオーバーライド
 */
const LEARNSET_OVERRIDES: Record<string, string[]> = {
  "calyrex-shadow":        ["astral-barrage"],  // アストラルビット（ゴースト・特殊・威力120）
  "calyrex-ice":           ["glacial-lance"],   // こおりのやり（こおり・物理・威力130）
  "ursaluna-bloodmoon":    ["blood-moon"],      // ブラッドムーン（ノーマル・特殊・威力140）
  "ogerpon":               ["ivy-cudgel"],      // ツタこんぼう（くさ・物理・威力100）
  "ogerpon-wellspring":    ["ivy-cudgel"],
  "ogerpon-hearthflame":   ["ivy-cudgel"],
  "ogerpon-cornerstone":   ["ivy-cudgel"],
  "eternatus":             ["dynamax-cannon"],  // ダイマックスほう（ドラゴン・特殊・威力120）
  "chien-pao":             ["icicle-crash"],    // つらら落とし（安全ネット）
  "ting-lu":               ["rock-tomb"],       // がんせきふうじ（安全ネット）
  "sneasler":              ["dire-claw"],       // スラッシュクロー（どく・物理・威力60）
  "lunala":                ["moongeist-beam"],  // ムーンジェストビーム（ゴースト・特殊・威力100）
};

/**
 * PokeAPIの特性データが不正確なポケモンを固定値で上書き
 * S40（レギュレーションF）上位30匹対応
 */
const ABILITY_OVERRIDES: Record<string, AbilityEntry[]> = {
  // ──── パラドックス・準伝説（特性1つ）────
  "calyrex-shadow":      [{ slug: "as-one-spectrier",   isHidden: false, slot: 1 }],
  "calyrex-ice":         [{ slug: "as-one-glastrier",   isHidden: false, slot: 1 }],
  "urshifu-single-strike": [{ slug: "unseen-fist",      isHidden: false, slot: 1 }],
  "urshifu-rapid-strike":  [{ slug: "unseen-fist",      isHidden: false, slot: 1 }],
  "koraidon":            [{ slug: "orichalcum-pulse",   isHidden: false, slot: 1 }],
  "miraidon":            [{ slug: "hadron-engine",      isHidden: false, slot: 1 }],
  "lunala":              [{ slug: "shadow-shield",      isHidden: false, slot: 1 }],
  "flutter-mane":        [{ slug: "protosynthesis",     isHidden: false, slot: 1 }],
  "iron-hands":          [{ slug: "quark-drive",        isHidden: false, slot: 1 }],
  "iron-valiant":        [{ slug: "quark-drive",        isHidden: false, slot: 1 }],
  "iron-moth":           [{ slug: "quark-drive",        isHidden: false, slot: 1 }],
  "iron-crown":          [{ slug: "quark-drive",        isHidden: false, slot: 1 }],
  "iron-leaves":         [{ slug: "quark-drive",        isHidden: false, slot: 1 }],
  "iron-boulder":        [{ slug: "quark-drive",        isHidden: false, slot: 1 }],
  "chien-pao":           [{ slug: "sword-of-ruin",      isHidden: false, slot: 1 }],
  "chi-yu":              [{ slug: "beads-of-ruin",      isHidden: false, slot: 1 }],
  "ting-lu":             [{ slug: "vessel-of-ruin",     isHidden: false, slot: 1 }],
  "wo-chien":            [{ slug: "tablets-of-ruin",    isHidden: false, slot: 1 }],
  "ursaluna-bloodmoon":  [{ slug: "minds-eye",          isHidden: false, slot: 1 }],
  "palafin-hero":        [{ slug: "zero-to-hero",       isHidden: false, slot: 1 }],
  "ogerpon":             [{ slug: "embody-aspect-teal",    isHidden: false, slot: 1 }],
  "ogerpon-wellspring":  [{ slug: "embody-aspect-wellspring", isHidden: false, slot: 1 }],
  "ogerpon-hearthflame": [{ slug: "embody-aspect-hearthflame", isHidden: false, slot: 1 }],
  "ogerpon-cornerstone": [{ slug: "embody-aspect-cornerstone", isHidden: false, slot: 1 }],
  "mimikyu":             [{ slug: "disguise",           isHidden: false, slot: 1 }],
  // ──── 通常ポケモン（特性複数）────
  "gliscor": [
    // S40: ポイズンヒール98.9% > かいりきバサミ1.0% > すながくれ0.2%
    { slug: "poison-heal",  isHidden: true,  slot: 3 },
    { slug: "hyper-cutter", isHidden: false, slot: 1 },
    { slug: "sand-veil",    isHidden: false, slot: 2 },
  ],
  "tinkaton": [
    { slug: "mold-breaker", isHidden: false, slot: 1 },
    { slug: "own-tempo",    isHidden: false, slot: 2 },
    { slug: "pickpocket",   isHidden: true,  slot: 3 },
  ],
  "dragonite": [
    // S40: マルチスケイル99.3% > せいしんりょく0.7%
    { slug: "multiscale",   isHidden: true,  slot: 3 },
    { slug: "inner-focus",  isHidden: false, slot: 1 },
  ],
  "landorus-therian": [
    { slug: "intimidate",   isHidden: false, slot: 1 },
    { slug: "sand-force",   isHidden: true,  slot: 3 },
  ],
  "garganacl": [
    { slug: "purifying-salt", isHidden: false, slot: 1 },
    { slug: "sturdy",         isHidden: false, slot: 2 },
    { slug: "clear-body",     isHidden: true,  slot: 3 },
  ],
  "kingambit": [
    // S40: ぐんとうのまもり63.6% > まけんき35.2% > プレッシャー1.2%
    { slug: "supreme-overlord", isHidden: false, slot: 2 },
    { slug: "defiant",          isHidden: false, slot: 1 },
    { slug: "pressure",         isHidden: true,  slot: 3 },
  ],
  "annihilape": [
    { slug: "vital-spirit",  isHidden: false, slot: 1 },
    { slug: "inner-focus",   isHidden: false, slot: 2 },
    { slug: "defiant",       isHidden: true,  slot: 3 },
  ],
  "clodsire": [
    // S40: ちょすい84.7% > てんねん15.2% > どくのとげ0.1%
    { slug: "water-absorb",  isHidden: false, slot: 2 },
    { slug: "unaware",       isHidden: true,  slot: 3 },
    { slug: "poison-point",  isHidden: false, slot: 1 },
  ],
  "garchomp": [
    { slug: "sand-veil",     isHidden: false, slot: 1 },
    { slug: "rough-skin",    isHidden: false, slot: 2 },
    { slug: "sand-force",    isHidden: true,  slot: 3 },
  ],
  "alomomola": [
    // S40: さいせいりょく99.4% > いやしのこころ0.4% > うるおいボディ0.2%
    { slug: "regenerator",   isHidden: true,  slot: 3 },
    { slug: "healer",        isHidden: false, slot: 1 },
    { slug: "hydration",     isHidden: false, slot: 2 },
  ],
  "scizor": [
    { slug: "swarm",         isHidden: false, slot: 1 },
    { slug: "technician",    isHidden: false, slot: 2 },
    { slug: "light-metal",   isHidden: true,  slot: 3 },
  ],
  "meowscarada": [
    { slug: "overgrow",      isHidden: false, slot: 1 },
    { slug: "protean",       isHidden: false, slot: 2 },
    { slug: "pickpocket",    isHidden: true,  slot: 3 },
  ],
  "sneasler": [
    // S40: かるわざ92.7% > どくしゅ7.1% > プレッシャー0.2%
    { slug: "unburden",      isHidden: false, slot: 2 },
    { slug: "poison-touch",  isHidden: true,  slot: 3 },
    { slug: "pressure",      isHidden: false, slot: 1 },
  ],
  // ──── S40上位30匹・追加分 ────
  "ho-oh": [
    // S40: さいせいりょく99.7% > プレッシャー0.3%
    { slug: "regenerator",   isHidden: true,  slot: 3 },
    { slug: "pressure",      isHidden: false, slot: 1 },
  ],
  "dondozo": [
    // S40: てんねん99.2% > みずのベール0.4% > うかつ0.3%
    { slug: "unaware",       isHidden: false, slot: 1 },
    { slug: "water-veil",    isHidden: true,  slot: 3 },
    { slug: "oblivious",     isHidden: false, slot: 2 },
  ],
  "zacian-crowned": [{ slug: "intrepid-sword",  isHidden: false, slot: 1 }],
  "kyogre":         [{ slug: "drizzle",          isHidden: false, slot: 1 }],
  "glimmora": [
    // S40: どくのトゲ97.5% > ふしょく2.5%
    { slug: "toxic-debris",  isHidden: false, slot: 1 },
    { slug: "corrosion",     isHidden: true,  slot: 2 },
  ],
  "grimmsnarl": [
    // S40: いたずらごころ99.1% > すりぬけ0.8% > かっぱらい0.1%
    { slug: "prankster",     isHidden: false, slot: 1 },
    { slug: "frisk",         isHidden: false, slot: 2 },
    { slug: "pickpocket",    isHidden: true,  slot: 3 },
  ],
  "iron-treads": [{ slug: "quark-drive",        isHidden: false, slot: 1 }],
  "archaludon": [
    // S40: たいりょく55.5% > がんじょう44.5% > ちからずく~0%
    { slug: "stamina",       isHidden: false, slot: 1 },
    { slug: "sturdy",        isHidden: false, slot: 2 },
    { slug: "stalwart",      isHidden: true,  slot: 3 },
  ],
};

/** フォーム固有の日本語名オーバーライド */
const FORM_JAPANESE_NAMES: Record<string, string> = {
  // バドレックス系
  "calyrex-shadow":            "黒馬バドレックス",
  "calyrex-ice":               "白馬バドレックス",
  // ウーラオス
  "urshifu-single-strike":    "ウーラオス（一撃）",
  "urshifu-rapid-strike":     "ウーラオス（連撃）",
  // ランドロス・トルネロス・ボルトロス
  "landorus-therian":          "ランドロス（霊獣）",
  "landorus-incarnate":        "ランドロス（化身）",
  "tornadus-therian":          "トルネロス（霊獣）",
  "tornadus-incarnate":        "トルネロス（化身）",
  "thundurus-therian":         "ボルトロス（霊獣）",
  "thundurus-incarnate":       "ボルトロス（化身）",
  "enamorus-therian":          "エナモリ（霊獣）",
  "enamorus-incarnate":        "エナモリ（化身）",
  // ガラルフォーム
  "slowpoke-galar":            "ガラルヤドン",
  "slowbro-galar":             "ガラルヤドラン",
  "slowking-galar":            "ガラルヤドキング",
  "corsola-galar":             "ガラルサニーゴ",
  "darumaka-galar":            "ガラルヒヒダルマ（だるまモード）",
  "darmanitan-galar":          "ガラルヒヒダルマ",
  "darmanitan-galar-zen":      "ガラルヒヒダルマ（禅モード）",
  "rapidash-galar":            "ガラルギャロップ",
  "weezing-galar":             "ガラルマタドガス",
  "farfetchd-galar":           "ガラルカモネギ",
  "zigzagoon-galar":           "ガラルジグザグマ",
  "linoone-galar":             "ガラルマッスグマ",
  "meowth-galar":              "ガラルニャース",
  "ponyta-galar":              "ガラルポニータ",
  "yamask-galar":              "ガラルデスマス",
  "stunfisk-galar":            "ガラルマッギョ",
  "mr-mime-galar":             "ガラルバリヤード",
  "articuno-galar":            "ガラルフリーザー",
  "zapdos-galar":              "ガラルサンダー",
  "moltres-galar":             "ガラルファイヤー",
  // ヒスイフォーム
  "typhlosion-hisui":          "ヒスイバクフーン",
  "samurott-hisui":            "ヒスイオオスバメ",
  "decidueye-hisui":           "ヒスイジュナイパー",
  "electrode-hisui":           "ヒスイマルマイン",
  "arcanine-hisui":            "ヒスイウインディ",
  "growlithe-hisui":           "ヒスイガーディ",
  "lilligant-hisui":           "ヒスイドレディア",
  "braviary-hisui":            "ヒスイウォーグル",
  "sliggoo-hisui":             "ヒスイヌメイル",
  "goodra-hisui":              "ヒスイヌメルゴン",
  "voltorb-hisui":             "ヒスイビリリダマ",
  "avalugg-hisui":             "ヒスイクレベース",
  "zorua-hisui":               "ヒスイゾロア",
  "zoroark-hisui":             "ヒスイゾロアーク",
  "sneasel-hisui":             "ヒスイニューラ",
  "qwilfish-hisui":            "ヒスイハリーセン",
  "overqwil":                  "ハリーマン",
  // パルデアフォーム
  "tauros-paldea-combat":      "パルデアケンタロス（格闘）",
  "tauros-paldea-blaze":       "パルデアケンタロス（炎）",
  "tauros-paldea-aqua":        "パルデアケンタロス（水）",
  "wooper-paldea":             "パルデアウパー",
  // イルカマン
  "palafin-hero":              "イルカマン（英雄）",
  "palafin":                   "イルカマン（零）",
  // ロトム
  "rotom-heat":                "ロトム（ヒート）",
  "rotom-wash":                "ロトム（ウォッシュ）",
  "rotom-frost":               "ロトム（フロスト）",
  "rotom-fan":                 "ロトム（スピン）",
  "rotom-mow":                 "ロトム（カット）",
  // シャリタツ
  "tatsugiri-droopy":          "シャリタツ（うなだれ）",
  "tatsugiri-stretchy":        "シャリタツ（のびのび）",
  // オーガポン
  "ogerpon-wellspring":        "オーガポン（水）",
  "ogerpon-hearthflame":       "オーガポン（炎）",
  "ogerpon-cornerstone":       "オーガポン（岩）",
  // ウーサルナ
  "ursaluna-bloodmoon":        "ウーサルナ（血月）",
  // テツノ系（未来のパラドックス）
  "iron-leaves":               "テツノイサハ",
  "iron-crown":                "テツノカシラ",
  "iron-boulder":              "テツノコブシ",
  // ミライドン・コライドン フォルム
  "koraidon":                  "コライドン",
  "miraidon":                  "ミライドン",
};

/** PokeAPIのタイプ名 → アプリ内タイプ名変換 */
function toType(name: string): PokemonType {
  return name as PokemonType;
}

/** PokeAPIのレスポンスから日本語名を取得 */
function getJaName(names: Array<{ language: { name: string }; name: string }>): string {
  return (
    names.find((n) => n.language.name === "ja")?.name ||
    names.find((n) => n.language.name === "ja-Hrkt")?.name ||
    names.find((n) => n.language.name === "ja-Hrkt" || n.language.name === "ja")?.name ||
    ""
  );
}

/** ポケモンデータを取得 (英語slug or ID) */
export async function fetchPokemon(nameOrId: string | number): Promise<PokemonData> {
  let slug: string;
  if (typeof nameOrId === "number") {
    slug = String(nameOrId);
  } else {
    // 日本語名の場合、英語slugに変換してから検索
    const trimmed = nameOrId.trim().replace(/\s/g, "");
    const enSlug = getEnSlug(trimmed);
    slug = enSlug ?? trimmed.toLowerCase().replace(/\s+/g, "-");
  }

  // フォーム固有の日本語名オーバーライドをチェック
  const formNameOverride = FORM_JAPANESE_NAMES[slug];

  const pokeRes = await fetch(`${BASE}/pokemon/${slug}`);
  if (!pokeRes.ok) throw new Error(`ポケモン「${slug}」が見つかりません`);
  const poke = await pokeRes.json();

  // species.url を使って正確な種族データを取得（フォームでも基本種の日本語名が取れる）
  const speciesRes = await fetch(poke.species.url).catch(() => null);

  // 日本語名の優先順位: 1. フォーム固有名 > 2. 静的マッピング(EN_TO_JA) > 3. PokeAPI species > 4. slug
  let japaneseName = poke.name;
  if (formNameOverride) {
    japaneseName = formNameOverride;
  } else if (EN_TO_JA[slug]) {
    japaneseName = EN_TO_JA[slug];
  } else if (speciesRes?.ok) {
    const species = await speciesRes.json();
    japaneseName = getJaName(species.names) || poke.name;
  }

  const stats = poke.stats as Array<{ base_stat: number; stat: { name: string } }>;
  const getBase = (name: string) => stats.find((s) => s.stat.name === name)?.base_stat ?? 0;

  const spriteUrl =
    poke.sprites?.other?.["official-artwork"]?.front_default ||
    poke.sprites?.front_default ||
    "";

  // マスターデータがあればそちらを優先（S40上位ポケモン）
  const master = POKEMON_MASTER_DATA[slug];

  let finalMoveNames: string[];
  let abilities: AbilityEntry[];

  if (master) {
    // マスターデータから技・特性を取得（API不使用）
    const masterMoveSlugs = master.moves.map((m) => m.slug);
    // マスター技 + PokeAPI技を結合（マスター技を先頭に、残りをアルファベット順）
    type MoveEntry = {
      move: { name: string };
      version_group_details: Array<{
        version_group: { name: string };
        move_learn_method: { name: string };
      }>;
    };
    const SV_GROUPS = ["scarlet-violet", "the-teal-mask", "the-indigo-disk"];
    const apiMoves: string[] = (poke.moves as MoveEntry[])
      .filter((m) =>
        m.version_group_details.some((d) =>
          SV_GROUPS.includes(d.version_group.name) &&
          ["level-up", "machine", "egg", "tutor"].includes(d.move_learn_method.name)
        )
      )
      .map((m) => m.move.name);
    const extraMoves = LEARNSET_OVERRIDES[slug] ?? [];
    const allApiMoves = [...new Set([...apiMoves, ...extraMoves])];
    const masterSet = new Set(masterMoveSlugs);
    const remainingMoves = allApiMoves.filter((m) => !masterSet.has(m)).sort();
    finalMoveNames = [...masterMoveSlugs, ...remainingMoves];
    abilities = master.abilities;
  } else {
    // 従来のAPI + オーバーライド方式
    type MoveEntry = {
      move: { name: string };
      version_group_details: Array<{
        version_group: { name: string };
        move_learn_method: { name: string };
      }>;
    };
    const SV_GROUPS = ["scarlet-violet", "the-teal-mask", "the-indigo-disk"];
    const moveNames: string[] = (poke.moves as MoveEntry[])
      .filter((m) =>
        m.version_group_details.some((d) =>
          SV_GROUPS.includes(d.version_group.name) &&
          ["level-up", "machine", "egg", "tutor"].includes(d.move_learn_method.name)
        )
      )
      .map((m) => m.move.name);
    const extraMoves = LEARNSET_OVERRIDES[slug] ?? [];
    finalMoveNames = [...new Set([...moveNames, ...extraMoves])].sort();
    abilities =
      ABILITY_OVERRIDES[slug] ??
      (poke.abilities as Array<{ ability: { name: string }; is_hidden: boolean; slot: number }>).map((a) => ({
        slug: a.ability.name,
        isHidden: a.is_hidden,
        slot: a.slot,
      }));
  }

  return {
    id: poke.id,
    name: poke.name,
    japaneseName,
    types: (poke.types as Array<{ slot: number; type: { name: string } }>)
      .sort((a, b) => a.slot - b.slot)
      .map((t) => toType(t.type.name)),
    baseStats: {
      hp:      getBase("hp"),
      attack:  getBase("attack"),
      defense: getBase("defense"),
      spAtk:   getBase("special-attack"),
      spDef:   getBase("special-defense"),
      speed:   getBase("speed"),
    },
    spriteUrl,
    moveNames: finalMoveNames,
    abilities,
    weight: poke.weight ?? undefined, // PokeAPIの体重（ヘクトグラム単位）
  };
}

/** 技データを取得 */
export async function fetchMove(name: string): Promise<MoveData> {
  const res = await fetch(`${BASE}/move/${name}`);
  if (!res.ok) throw new Error(`技「${name}」が見つかりません`);
  const move = await res.json();

  const category = move.damage_class?.name as "physical" | "special" | "status";
  const japaneseName = getJaName(
    (move.names as Array<{ language: { name: string }; name: string }>) || []
  ) || move.name;

  return {
    name: move.name,
    japaneseName,
    type: toType(move.type?.name ?? "normal"),
    category,
    power: move.power ?? null,
    accuracy: move.accuracy ?? null,
    priority: move.priority ?? 0,
    pp: move.pp ?? null,
  };
}

/** ポケモン一覧を取得 (検索用) */
export async function fetchPokemonList(): Promise<Array<{ name: string; url: string }>> {
  const res = await fetch(`${BASE}/pokemon?limit=1025&offset=0`);
  if (!res.ok) throw new Error("一覧取得に失敗しました");
  const data = await res.json();
  return data.results as Array<{ name: string; url: string }>;
}

/** 名前からIDを取り出すユーティリティ */
export function extractIdFromUrl(url: string): number {
  const parts = url.split("/").filter(Boolean);
  return parseInt(parts[parts.length - 1], 10);
}
