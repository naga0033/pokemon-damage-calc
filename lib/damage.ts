import type { PokemonType, MoveData, WeatherCondition, TerrainCondition, DamageResult, FieldConditions, DamageModifier } from "./types";
import { getTypeEffectiveness } from "./type-chart";
import { ITEM_MAP } from "./items";
import { SOUND_MOVES } from "./move-metadata";

interface DamageInput {
  attackerLevel: number;
  move: MoveData;
  /** 計算済みの最終攻撃ステータス */
  attackStat: number;
  /** 計算済みの最終防御ステータス */
  defenseStat: number;
  defenderHp: number;
  attackerTypes: PokemonType[];
  defenderTypes: PokemonType[];
  /** テラスタル中の攻撃側テラタイプ */
  attackerTeraType: PokemonType | null;
  isTerastallized: boolean;
  /** テラスタル中の防御側テラタイプ */
  defenderTeraType: PokemonType | null;
  defenderTerastallized: boolean;
  isCritical: boolean;
  isBurned: boolean;
  weather: WeatherCondition;
  terrain: TerrainCondition;
  /** 攻撃側の持ち物slug */
  attackerItem: string;
  /** 防御側の持ち物slug */
  defenderItem: string;
  /** 攻撃側の特性slug */
  attackerAbility: string;
  /** 防御側の特性slug */
  defenderAbility: string;
  attackerRank: number;
  defenderRank: number;
  isCharged: boolean;
  /** 防御側フィールド（壁・設置技） */
  defenderField?: FieldConditions;
  /** 連続技のヒット回数（1なら通常） */
  hitCount?: number;
  /** 連続技のうち急所になる回数 */
  critCount?: number;
  /** 防御側HP満タンか（マルチスケイル・ファントムガード判定用） */
  isDefenderFullHp?: boolean;
  /** 防御側がダイマックス中か */
  isDefenderDynamaxed?: boolean;
  /** 攻撃側の体重（ヘクトグラム） */
  attackerWeight?: number;
  /** 防御側の体重（ヘクトグラム） */
  defenderWeight?: number;
  /** しっぺがえし後攻フラグ（威力2倍） */
  isPaybackDoubled?: boolean;
  /** 攻撃側が地面に接しているか */
  attackerIsGrounded?: boolean;
  /** 防御側が地面に接しているか */
  defenderIsGrounded?: boolean;
  /** こだいかっせい/クォークチャージが攻撃・特攻に適用されるか */
  attackerAbilityBoostedStat?: "attack" | "spAtk" | "defense" | "spDef" | "speed" | null;
}

const PUNCH_MOVES = new Set([
  "bullet-punch", "comet-punch", "dizzy-punch", "double-iron-bash", "drain-punch",
  "dynamic-punch", "fire-punch", "focus-punch", "hammer-arm", "ice-punch",
  "jet-punch", "mach-punch", "mega-punch", "meteor-mash", "plasma-fists",
  "power-up-punch", "shadow-punch", "sky-uppercut", "surging-strikes", "thunder-punch",
  "wicked-blow",
]);

const BITE_MOVES = new Set([
  "bite", "bug-bite", "crunch", "fire-fang", "fishious-rend", "hyper-fang",
  "ice-fang", "jaw-lock", "poison-fang", "psychic-fangs", "thunder-fang",
]);

const PULSE_MOVES = new Set([
  "aura-sphere", "dark-pulse", "dragon-pulse", "heal-pulse", "origin-pulse",
  "terrain-pulse", "water-pulse",
]);

const SLICING_MOVES = new Set([
  "air-cutter", "aerial-ace", "air-slash", "behemoth-blade", "bitter-blade",
  "ceaseless-edge", "cross-poison", "cut", "fury-cutter", "ivy-cudgel",
  "kowtow-cleave", "leaf-blade", "night-slash", "population-bomb", "psyblade",
  "psycho-cut",
  "razor-leaf", "sacred-sword", "secret-sword", "slash", "solar-blade",
  "stone-axe", "x-scissor",
]);

const BULLET_MOVES = new Set([
  "acid-spray", "aura-sphere", "bullet-seed", "electro-shot", "egg-bomb",
  "energy-ball", "focus-blast", "gyro-ball", "ice-ball", "magnet-bomb",
  "mist-ball", "mud-ball", "octazooka", "pyro-ball", "rock-blast", "seed-bomb",
  "shadow-ball", "sludge-bomb", "weather-ball", "zap-cannon",
]);

const ABILITY_IGNORING_MOVES = new Set([
  "moongeist-beam",
  "sunsteel-strike",
  "photon-geyser",
  "light-that-burns-the-sky",
]);

function rankMult(rank: number): number {
  if (rank >= 0) return (2 + rank) / 2;
  return 2 / (2 - rank);
}

function moveMatches(move: MoveData, ...candidates: string[]): boolean {
  return candidates.includes(move.name) || candidates.includes(move.japaneseName);
}

/**
 * SV準拠のダメージ計算
 * Damage = floor(floor(floor(2*Lv/5+2) * Power * A/D / 50) + 2) * Modifier
 */
export function calcDamage(input: DamageInput): DamageResult {
  const {
    attackerLevel, move, defenderHp,
    attackerTypes, defenderTypes,
    attackerTeraType, isTerastallized,
    defenderTeraType, defenderTerastallized,
    isCritical, isBurned, weather, terrain,
    attackerItem, defenderItem,
    attackerAbility, defenderAbility,
    attackerRank, defenderRank, isCharged,
  } = input;

  let { attackStat, defenseStat } = input;
  const modifiers: DamageModifier[] = [];
  const attackerIsGrounded = input.attackerIsGrounded ?? true;
  const defenderIsGrounded = input.defenderIsGrounded ?? true;
  const ignoresDefenderAbility = ABILITY_IGNORING_MOVES.has(move.name);

  // ダイマックス: 防御側のHPを2倍
  const effectiveDefenderHp = input.isDefenderDynamaxed ? defenderHp * 2 : defenderHp;

  // 体重依存技（ヘビーボンバー・ヒートスタンプ）は power=null でも計算を続行
  const isWeightMove = move.name === "heavy-slam" || move.name === "heat-crash" || move.name === "grass-knot" || move.name === "low-kick";
  if (!move.power && !isWeightMove) {
    return {
      minDamage: 0, maxDamage: 0,
      minPercent: 0, maxPercent: 0,
      koLabel: "—",
      typeEffectiveness: 0,
      attackStat, defenseStat, defenderHp: effectiveDefenderHp,
      rolls: [],
      modifiers,
    };
  }

  // 防御側のタイプ（テラスタル考慮）
  // ★ステラテラスは防御タイプを変えない（元のタイプ相性で計算）
  const effectiveDefTypes =
    defenderTerastallized && defenderTeraType && defenderTeraType !== "stellar"
      ? [defenderTeraType]
      : defenderTypes;

  // スキン系特性: ノーマル技のタイプを変換 + 威力1.2倍
  let effectiveMoveType = move.type;
  let skinMod = 1;
  if (move.type === "normal" && move.category !== "status") {
    if (attackerAbility === "dragon-skin")  { effectiveMoveType = "dragon";  skinMod = 1.2; } // ドラゴンスキン
    if (attackerAbility === "aerilate")     { effectiveMoveType = "flying";  skinMod = 1.2; } // スカイスキン
    if (attackerAbility === "pixilate")     { effectiveMoveType = "fairy";   skinMod = 1.2; } // フェアリースキン
    if (attackerAbility === "refrigerate")  { effectiveMoveType = "ice";     skinMod = 1.2; } // フリーズスキン
    if (attackerAbility === "galvanize")    { effectiveMoveType = "electric"; skinMod = 1.2; } // エレキスキン
  }

  // タイプ相性
  let typeEff = getTypeEffectiveness(effectiveMoveType, effectiveDefTypes);

  if (moveMatches(move, "freeze-dry", "フリーズドライ") && effectiveDefTypes.includes("water")) {
    typeEff *= 4;
    modifiers.push({ label: "フリーズドライ", value: 2, detail: "みずタイプへ最終的に抜群" });
  }

  // 防御側特性によるタイプ無効化
  const ignoresGroundImmunity = move.name === "thousand-arrows";
  if (defenderAbility === "levitate" && effectiveMoveType === "ground" && !ignoresGroundImmunity && !ignoresDefenderAbility) typeEff = 0;
  if (defenderAbility === "volt-absorb" && effectiveMoveType === "electric" && !ignoresDefenderAbility) typeEff = 0;
  if (defenderAbility === "water-absorb" && effectiveMoveType === "water" && !ignoresDefenderAbility) typeEff = 0;
  if (defenderAbility === "flash-fire" && effectiveMoveType === "fire" && !ignoresDefenderAbility) typeEff = 0;
  if (defenderAbility === "sap-sipper" && effectiveMoveType === "grass" && !ignoresDefenderAbility) typeEff = 0;
  if (defenderAbility === "storm-drain" && effectiveMoveType === "water" && !ignoresDefenderAbility) typeEff = 0;
  if (defenderAbility === "lightning-rod" && effectiveMoveType === "electric" && !ignoresDefenderAbility) typeEff = 0;
  if (defenderAbility === "wonder-guard" && !ignoresDefenderAbility) {
    // ふしぎなまもり: 弱点以外無効
    typeEff = typeEff > 1 ? typeEff : 0;
  }
  if (defenderAbility === "thick-fat" && (effectiveMoveType === "fire" || effectiveMoveType === "ice") && !ignoresDefenderAbility) {
    typeEff *= 0.5;
    modifiers.push({ label: "あついしぼう", value: 0.5, detail: "ほのお/こおり半減" });
  }
  if (defenderAbility === "dry-skin" && effectiveMoveType === "water" && !ignoresDefenderAbility) {
    typeEff = 0;
  }
  if (defenderAbility === "dry-skin" && effectiveMoveType === "fire" && !ignoresDefenderAbility) {
    typeEff *= 1.25;
    modifiers.push({ label: "かんそうはだ", value: 1.25, detail: "ほのお被ダメージ増加" });
  }
  if (defenderAbility === "earth-eater" && effectiveMoveType === "ground" && !ignoresDefenderAbility) typeEff = 0;
  if (defenderAbility === "bulletproof" && BULLET_MOVES.has(move.name) && !ignoresDefenderAbility) typeEff = 0;
  if (ignoresGroundImmunity && typeEff === 0 && effectiveMoveType === "ground") {
    typeEff = 1;
    modifiers.push({ label: "サウザンアロー", value: 1, detail: "じめん無効を貫通" });
  }
  if (terrain === "psychic" && move.priority > 0 && defenderIsGrounded) {
    return {
      minDamage: 0, maxDamage: 0,
      minPercent: 0, maxPercent: 0,
      koLabel: "サイコフィールドで無効",
      typeEffectiveness: 0,
      attackStat, defenseStat, defenderHp: effectiveDefenderHp,
      rolls: [],
      modifiers: [{ label: "サイコフィールド", value: 0, detail: "優先度+1以上の技を無効化" }],
    };
  }

  if (typeEff === 0) {
    return {
      minDamage: 0, maxDamage: 0,
      minPercent: 0, maxPercent: 0,
      koLabel: "効果なし",
      typeEffectiveness: 0,
      attackStat, defenseStat, defenderHp: effectiveDefenderHp,
      rolls: [],
      modifiers,
    };
  }

  // 攻撃側持ち物によるステータス補正
  const atkItem = ITEM_MAP[attackerItem];
  if (atkItem?.effect === "choice-band" && move.category === "physical") {
    attackStat = Math.floor(attackStat * 1.5);
    modifiers.push({ label: "こだわりハチマキ", value: 1.5 });
  }
  if (atkItem?.effect === "choice-specs" && move.category === "special") {
    attackStat = Math.floor(attackStat * 1.5);
    modifiers.push({ label: "こだわりメガネ", value: 1.5 });
  }

  // 防御側持ち物によるステータス補正
  const defItem = ITEM_MAP[defenderItem];
  if (defItem?.effect === "assault-vest" && move.category === "special") {
    defenseStat = Math.floor(defenseStat * 1.5);
    modifiers.push({ label: "とつげきチョッキ", value: 1.5 });
  }
  if (defItem?.effect === "eviolite") {
    defenseStat = Math.floor(defenseStat * 1.5);
    modifiers.push({ label: "しんかのきせき", value: 1.5 });
  }

  // 攻撃側特性補正
  let abilityAtkMod = 1;
  if (attackerAbility === "hustle" && move.category === "physical") abilityAtkMod = 1.5;
  if (attackerAbility === "huge-power" || attackerAbility === "pure-power") {
    if (move.category === "physical") abilityAtkMod = 2;
  }
  if (attackerAbility === "guts" && isBurned && move.category === "physical") abilityAtkMod = 1.5;
  if (attackerAbility === "gorilla-tactics" && move.category === "physical") abilityAtkMod = 1.5;

  // ひひいろのこどう（コライドン）: 晴れ下で物理攻撃×4/3
  if (attackerAbility === "orichalcum-pulse" && weather === "sun" && move.category === "physical") {
    abilityAtkMod *= 4 / 3;
  }
  // ハドロンエンジン（ミライドン）: エレキフィールド下で特殊攻撃×4/3
  if (attackerAbility === "hadron-engine" && terrain === "electric" && move.category === "special") {
    abilityAtkMod *= 4 / 3;
  }
  // こだいかっせい（パラドックス古代）: 晴れ下で最も高いステータス×1.3（攻撃系に適用）
  if (attackerAbility === "protosynthesis" && weather === "sun") {
    if (input.attackerAbilityBoostedStat === "attack" && move.category === "physical") abilityAtkMod *= 1.3;
    else if (input.attackerAbilityBoostedStat === "spAtk" && move.category === "special") abilityAtkMod *= 1.3;
  }
  // クォークチャージ（パラドックス未来）: エレキフィールド下で最も高いステータス×1.3
  if (attackerAbility === "quark-drive" && terrain === "electric") {
    if (input.attackerAbilityBoostedStat === "attack" && move.category === "physical") abilityAtkMod *= 1.3;
    else if (input.attackerAbilityBoostedStat === "spAtk" && move.category === "special") abilityAtkMod *= 1.3;
  }
  if (attackerAbility === "iron-fist" && PUNCH_MOVES.has(move.name)) abilityAtkMod *= 1.2;
  if (attackerAbility === "strong-jaw" && BITE_MOVES.has(move.name)) abilityAtkMod *= 1.5;
  if (attackerAbility === "mega-launcher" && PULSE_MOVES.has(move.name)) abilityAtkMod *= 1.5;
  if (attackerAbility === "sharpness" && SLICING_MOVES.has(move.name)) abilityAtkMod *= 1.5;
  if (attackerAbility === "punk-rock" && move.category !== "status" && SOUND_MOVES.has(move.name)) abilityAtkMod *= 1.3;
  // こんじょう（やけど時、物理攻撃×1.5）※ すでに burnMod で 0.5 がかかるが、こんじょうなら打ち消し+1.5倍
  // ※ burnMod は後段で処理済みなのでここでは対応なし（別途burnModで対処）

  if (abilityAtkMod !== 1) {
    modifiers.push({ label: "攻撃側特性", value: abilityAtkMod, detail: attackerAbility });
  }
  attackStat = Math.floor(attackStat * abilityAtkMod);

  // 災いの特性（Ruin Abilities）
  // わざわいのつるぎ（sword-of-ruin）: 相手のぼうぎょ×0.75
  if (attackerAbility === "sword-of-ruin" && move.category === "physical") {
    defenseStat = Math.floor(defenseStat * 0.75);
    modifiers.push({ label: "わざわいのつるぎ", value: 1 / 0.75, detail: "相手の防御を25%低下" });
  }
  // わざわいのおふだ（tablets-of-ruin）: 相手のこうげき×0.75
  if (defenderAbility === "tablets-of-ruin" && move.category === "physical") {
    attackStat = Math.floor(attackStat * 0.75);
    modifiers.push({ label: "わざわいのおふだ", value: 0.75, detail: "攻撃を25%低下" });
  }
  // わざわいのたま（beads-of-ruin）: 相手のとくぼう×0.75
  if (attackerAbility === "beads-of-ruin" && move.category === "special") {
    defenseStat = Math.floor(defenseStat * 0.75);
    modifiers.push({ label: "わざわいのたま", value: 1 / 0.75, detail: "相手の特防を25%低下" });
  }
  // わざわいのうつわ（vessel-of-ruin）: 相手のとくこう×0.75
  if (defenderAbility === "vessel-of-ruin" && move.category === "special") {
    attackStat = Math.floor(attackStat * 0.75);
    modifiers.push({ label: "わざわいのうつわ", value: 0.75, detail: "特攻を25%低下" });
  }

  // ★ステラテラスタル用: テラバースト威力を100に上書き
  let effectivePower = move.power ?? 0;
  if (move.name === "tera-blast" && isTerastallized && attackerTeraType === "stellar") {
    effectivePower = 100;
  }
  // ヘビーボンバー・ヒートスタンプ: 攻撃側÷防御側の体重比で威力が変動
  if (move.name === "heavy-slam" || move.name === "heat-crash") {
    const atkW = input.attackerWeight ?? 0;
    const defW = input.defenderWeight ?? 0;
    if (atkW > 0 && defW > 0) {
      const ratio = atkW / defW;
      if (ratio >= 5)      effectivePower = 120;
      else if (ratio >= 4) effectivePower = 100;
      else if (ratio >= 3) effectivePower = 80;
      else if (ratio >= 2) effectivePower = 60;
      else                 effectivePower = 40;
    } else {
      effectivePower = 60;
    }
  }
  // くさむすび・けたぐり: 防御側の体重で威力が変動
  if (move.name === "grass-knot" || move.name === "low-kick") {
    const defW = input.defenderWeight ?? 0;
    if (defW > 0) {
      const kg = defW / 10; // PokeAPIはヘクトグラム→kgに変換
      if (kg >= 200)      effectivePower = 120;
      else if (kg >= 100) effectivePower = 100;
      else if (kg >= 50)  effectivePower = 80;
      else if (kg >= 25)  effectivePower = 60;
      else if (kg >= 10)  effectivePower = 40;
      else                effectivePower = 20;
    } else {
      effectivePower = 60;
    }
  }
  // しっぺがえし: 後攻時に威力2倍
  if (move.name === "payback" && input.isPaybackDoubled) {
    effectivePower = effectivePower * 2;
    modifiers.push({ label: "しっぺがえし", value: 2, detail: "後攻で威力2倍" });
  }
  if (move.name === "facade" && isBurned) {
    effectivePower *= 2;
    modifiers.push({ label: "からげんき", value: 2, detail: "状態異常で威力2倍" });
  }
  if (move.name === "expanding-force" && terrain === "psychic" && attackerIsGrounded) {
    effectivePower = Math.floor(effectivePower * 1.5);
    modifiers.push({ label: "ワイドフォース", value: 1.5, detail: "サイコフィールドで威力上昇" });
  }
  if (move.name === "rising-voltage" && terrain === "electric" && defenderIsGrounded) {
    effectivePower *= 2;
    modifiers.push({ label: "ライジングボルト", value: 2, detail: "接地相手に威力2倍" });
  }
  if ((move.name === "solar-beam" || move.name === "solar-blade") && weather !== "none" && weather !== "sun") {
    effectivePower = Math.floor(effectivePower / 2);
    modifiers.push({ label: "ソーラービーム", value: 0.5, detail: `${weather}で威力半減` });
  }
  if (move.name === "knock-off" && defenderItem) {
    effectivePower = Math.floor(effectivePower * 1.5);
    modifiers.push({ label: "はたきおとす", value: 1.5, detail: "持ち物ありで威力上昇" });
  }
  // スキン系特性の威力補正（1.2倍）
  if (skinMod !== 1) {
    effectivePower = Math.floor(effectivePower * skinMod);
    modifiers.push({ label: "スキン特性", value: skinMod, detail: `${move.type} -> ${effectiveMoveType}` });
  }

  // STAB計算（テラスタル対応）
  let stab = 1;
  let stellarBoost = 1; // ステラテラスブースト（1.2倍）
  const isAdaptability = attackerAbility === "adaptability";
  const stabMultiplier = isAdaptability ? 2 : 1.5;
  const residualStab = isAdaptability ? 1.5 : 1.2;

  if (isTerastallized && attackerTeraType === "stellar") {
    // ★ステラテラス攻撃: STABは元のタイプで判定（テラスタル前と同じ）
    stab = attackerTypes.includes(effectiveMoveType) ? stabMultiplier : 1;
    // ステラブースト: 元タイプに一致する技に1.2倍
    if (attackerTypes.includes(effectiveMoveType)) {
      stellarBoost = 1.2;
    }
    // テラバーストはすべての元タイプに対してステラブーストが適用
    if (move.name === "tera-blast") {
      stellarBoost = 1.2;
      stab = attackerTypes.length > 0 ? stabMultiplier : 1; // 元タイプのSTAB適用
    }
  } else if (isTerastallized && attackerTeraType) {
    if (effectiveMoveType === attackerTeraType) {
      stab = attackerTypes.includes(effectiveMoveType) ? (isAdaptability ? 2.25 : 2) : stabMultiplier;
    } else if (attackerTypes.includes(effectiveMoveType)) {
      stab = residualStab;
    }
  } else {
    stab = attackerTypes.includes(effectiveMoveType) ? stabMultiplier : 1;
  }
  if (stab !== 1) {
    modifiers.push({ label: "タイプ一致", value: stab });
  }
  if (stellarBoost !== 1) {
    modifiers.push({ label: "ステラブースト", value: stellarBoost });
  }

  // 天気補正
  let weatherMod = 1;
  if (weather === "sun") {
    if (effectiveMoveType === "fire") weatherMod = 1.5;
    if (effectiveMoveType === "water") weatherMod = move.name === "hydro-steam" ? 1.5 : 0.5;
  } else if (weather === "rain") {
    if (effectiveMoveType === "water") weatherMod = 1.5;
    if (effectiveMoveType === "fire") weatherMod = 0.5;
  }
  if (weatherMod !== 1) {
    modifiers.push({ label: "天気", value: weatherMod, detail: weather });
  }

  // フィールド補正（地面にいるポケモンのみ）
  const GRASSY_HALVED = ["earthquake", "bulldoze", "magnitude", "stomping-tantrum", "high-horsepower"];
  let terrainMod = 1;
  if (terrain === "electric" && effectiveMoveType === "electric" && attackerIsGrounded) terrainMod = 1.3;
  if (terrain === "grassy" && effectiveMoveType === "grass" && attackerIsGrounded) terrainMod = 1.3;
  if (terrain === "grassy" && GRASSY_HALVED.includes(move.name) && defenderIsGrounded) terrainMod = 0.5;
  if (terrain === "misty" && effectiveMoveType === "dragon" && defenderIsGrounded) terrainMod = 0.5;
  if (terrain === "psychic" && effectiveMoveType === "psychic" && attackerIsGrounded) terrainMod = 1.3;
  if (terrainMod !== 1) {
    modifiers.push({ label: "フィールド", value: terrainMod, detail: terrain });
  }

  // 急所 (1.5倍)
  const critMod = isCritical ? (attackerAbility === "sniper" ? 2.25 : 1.5) : 1;
  if (critMod !== 1) {
    modifiers.push({ label: "急所", value: critMod });
  }

  // やけど (物理技が0.5倍、こんじょうは除く)
  const burnMod = (isBurned && move.category === "physical" && attackerAbility !== "guts") ? 0.5 : 1;
  if (burnMod !== 1) {
    modifiers.push({ label: "やけど", value: burnMod });
  }

  // 攻撃側持ち物のダメージ補正
  let itemDmgMod = 1;
  if (atkItem?.effect === "life-orb") itemDmgMod = 1.3;
  if (atkItem?.effect === "expert-belt" && typeEff > 1) itemDmgMod = 1.2;
  if (atkItem?.effect === "type-boost" && atkItem.boostType === effectiveMoveType) itemDmgMod = 1.2;
  if (itemDmgMod !== 1) {
    modifiers.push({ label: "攻撃側持ち物", value: itemDmgMod, detail: attackerItem });
  }

  // 防御側特性のダメージ補正（Filter/SolidRock）
  let defAbilityMod = 1;
  if ((defenderAbility === "filter" || defenderAbility === "solid-rock" || defenderAbility === "prism-armor") && typeEff > 1 && !ignoresDefenderAbility) {
    defAbilityMod = 0.75;
  }
  if (defenderAbility === "punk-rock" && move.category !== "status" && SOUND_MOVES.has(move.name) && !ignoresDefenderAbility) {
    defAbilityMod *= 0.5;
  }
  if (defenderAbility === "ice-scales" && move.category === "special" && !ignoresDefenderAbility) {
    defAbilityMod *= 0.5;
  }
  if (defenderAbility === "fur-coat" && move.category === "physical" && !ignoresDefenderAbility) {
    defenseStat = Math.floor(defenseStat * 2);
    modifiers.push({ label: "ファーコート", value: 0.5, detail: "物理耐久2倍" });
  }
  if (defenderAbility === "heatproof" && effectiveMoveType === "fire" && !ignoresDefenderAbility) {
    defAbilityMod *= 0.5;
  }
  // マルチスケイル / ファントムガード: HP満タン時のみ0.5倍（連続技は初撃のみ適用）
  const hasMultiscale = !ignoresDefenderAbility && (defenderAbility === "multiscale" || defenderAbility === "shadow-shield" || defenderAbility === "tera-shell") && (input.isDefenderFullHp ?? true);
  const multiscaleMod = hasMultiscale ? 0.5 : 1;
  if (defAbilityMod !== 1) {
    modifiers.push({ label: "防御側特性", value: defAbilityMod, detail: defenderAbility });
  }
  if (multiscaleMod !== 1) {
    modifiers.push({ label: "満タン時軽減", value: multiscaleMod, detail: defenderAbility });
  }

  // ランクボーナス
  let effectiveAttackerRank = attackerRank ?? 0;
  let effectiveDefenderRank = defenderRank ?? 0;
  if (defenderAbility === "unaware" && !ignoresDefenderAbility) {
    effectiveAttackerRank = 0;
  }
  if (attackerAbility === "unaware") {
    effectiveDefenderRank = 0;
  }
  attackStat = Math.floor(attackStat * rankMult(effectiveAttackerRank));
  defenseStat = Math.floor(defenseStat * rankMult(effectiveDefenderRank));

  // 天候による防御側能力上昇
  if (weather === "sand" && move.category === "special" && effectiveDefTypes.includes("rock")) {
    defenseStat = Math.floor(defenseStat * 1.5);
    modifiers.push({ label: "砂嵐", value: 2 / 3, detail: "いわタイプの特防1.5倍" });
  }
  if (weather === "snow" && move.category === "physical" && effectiveDefTypes.includes("ice")) {
    defenseStat = Math.floor(defenseStat * 1.5);
    modifiers.push({ label: "雪", value: 2 / 3, detail: "こおりタイプの防御1.5倍" });
  }

  if (attackerAbility === "tinted-lens" && typeEff > 0 && typeEff < 1) {
    typeEff *= 2;
    modifiers.push({ label: "いろめがね", value: 2, detail: "今ひとつを補強" });
  }
  if (attackerAbility === "punk-rock" && move.category !== "status" && SOUND_MOVES.has(move.name)) {
    modifiers.push({ label: "パンクロック", value: 1.3, detail: "音技強化" });
  }

  // じゅうでん (充電)
  const chargeMod = (isCharged && effectiveMoveType === "electric") ? 2 : 1;
  if (chargeMod !== 1) {
    modifiers.push({ label: "じゅうでん", value: chargeMod });
  }

  // 壁（ひかりの壁・リフレクター・オーロラベール）— 急所時は無効
  let screenMod = 1;
  if (!isCritical) {
    const f = input.defenderField;
    if (f?.auroraVeil) {
      screenMod = 0.5;
    } else if (f?.lightScreen && move.category === "special") {
      screenMod = 0.5;
    } else if (f?.reflect && move.category === "physical") {
      screenMod = 0.5;
    }
  }
  if (screenMod !== 1) {
    modifiers.push({ label: "壁", value: screenMod });
  }

  // ベースダメージ（ステラテラスバーストは effectivePower=100 を使用）
  const base = Math.floor(
    Math.floor(Math.floor(2 * attackerLevel / 5 + 2) * effectivePower * attackStat / defenseStat / 50) + 2
  );

  // 16乱数ロール（1回あたり）
  // extraMod: マルチスケイルなど初撃のみの補正を外部から渡す
  const calcFinal = (rand: number, crit: boolean, extraMod = 1) => {
    const thisCritMod = crit ? critMod : 1;
    let d = Math.floor(base * rand / 100);
    d = Math.floor(d * thisCritMod);
    d = Math.floor(d * stab);
    d = Math.floor(d * typeEff);
    d = Math.floor(d * weatherMod);
    d = Math.floor(d * terrainMod);
    d = Math.floor(d * burnMod);
    d = Math.floor(d * chargeMod);
    d = Math.floor(d * itemDmgMod);
    d = Math.floor(d * defAbilityMod);
    d = Math.floor(d * screenMod);
    d = Math.floor(d * stellarBoost);
    d = Math.floor(d * extraMod); // マルチスケイル等
    return Math.max(1, d);
  };

  const hitCount = input.hitCount ?? 1;
  const critCount = input.critCount ?? (isCritical ? hitCount : 0);

  if (hitCount <= 1) {
    // 単発技: マルチスケイルを直接適用
    const rolls: number[] = [];
    for (let rand = 85; rand <= 100; rand++) {
      rolls.push(calcFinal(rand, isCritical, multiscaleMod));
    }
    const minDamage = rolls[0];
    const maxDamage = rolls[15];
    const minPercent = Math.round((minDamage / effectiveDefenderHp) * 1000) / 10;
    const maxPercent = Math.round((maxDamage / effectiveDefenderHp) * 1000) / 10;
    const koLabel = getKoLabel(rolls, effectiveDefenderHp);
    return {
      minDamage, maxDamage, minPercent, maxPercent,
      koLabel, typeEffectiveness: typeEff,
      attackStat, defenseStat, defenderHp: effectiveDefenderHp, rolls, modifiers,
    };
  }

  // 連続技: 初撃のみマルチスケイル適用、2撃目以降は通常
  // 4パターンのロール: 初撃急所/初撃通常/後撃急所/後撃通常
  const firstCritRolls: number[] = [];
  const firstNormalRolls: number[] = [];
  const laterCritRolls: number[] = [];
  const laterNormalRolls: number[] = [];
  for (let rand = 85; rand <= 100; rand++) {
    firstCritRolls.push(calcFinal(rand, true, multiscaleMod));
    firstNormalRolls.push(calcFinal(rand, false, multiscaleMod));
    laterCritRolls.push(calcFinal(rand, true, 1));
    laterNormalRolls.push(calcFinal(rand, false, 1));
  }

  const normalHits = hitCount - critCount;
  const totalRolls: number[] = [];
  for (let i = 0; i < 16; i++) {
    // 初撃が急所かどうか: 確定急所技なら初撃も急所
    let total: number;
    if (critCount >= hitCount) {
      // 全弾急所: 初撃(急所+MS) + 残り(急所)
      total = firstCritRolls[i] + laterCritRolls[i] * (hitCount - 1);
    } else if (critCount > 0) {
      // 一部急所: 初撃は通常+MS、後撃に急所を振り分け
      total = firstNormalRolls[i] + laterNormalRolls[i] * (normalHits - 1) + laterCritRolls[i] * critCount;
    } else {
      // 全弾通常: 初撃(通常+MS) + 残り(通常)
      total = firstNormalRolls[i] + laterNormalRolls[i] * (hitCount - 1);
    }
    totalRolls.push(total);
  }

  const minDamage = totalRolls[0];
  const maxDamage = totalRolls[15];
  const minPercent = Math.round((minDamage / effectiveDefenderHp) * 1000) / 10;
  const maxPercent = Math.round((maxDamage / effectiveDefenderHp) * 1000) / 10;
  const koLabel = getMultiHitKoLabel(totalRolls, effectiveDefenderHp);

  // 1回あたりのダメージ参考表示（マルチスケイルなしの通常/急所）
  const perHitMin = critCount > 0 ? laterCritRolls[0] : laterNormalRolls[0];
  const perHitMax = critCount > 0 ? laterCritRolls[15] : laterNormalRolls[15];

  return {
    minDamage, maxDamage, minPercent, maxPercent,
    koLabel, typeEffectiveness: typeEff,
    attackStat, defenseStat, defenderHp: effectiveDefenderHp,
    rolls: totalRolls,
    modifiers,
    perHit: { min: perHitMin, max: perHitMax },
    hitCount,
  };
}

export function isGrounded(
  types: PokemonType[],
  ability: string,
  item: string,
  teraType: PokemonType | null,
  isTerastallized: boolean
): boolean {
  const effectiveTypes =
    isTerastallized && teraType && teraType !== "stellar"
      ? [teraType]
      : types;

  if (item === "iron-ball") return true;
  if (item === "air-balloon") return false;
  if (ability === "levitate") return false;
  if (effectiveTypes.includes("flying")) return false;
  return true;
}

function getKoLabel(rolls: number[], hp: number): string {
  for (let n = 1; n <= 6; n++) {
    const minTotal = rolls[0] * n;
    const maxTotal = rolls[15] * n;
    if (minTotal >= hp) return `確定${toKanji(n)}発`;
    if (maxTotal >= hp) {
      // 何ロールでKOできるか
      const koCount = rolls.filter((r) => r * n >= hp).length;
      return `乱数${toKanji(n)}発 (${koCount}/16)`;
    }
  }
  return "7発以上";
}

function toKanji(n: number): string {
  return ["1", "2", "3", "4", "5", "6"][n - 1] ?? String(n);
}

/** たべのこし込み確定数を計算（毎ターンHP 1/16回復） */
export function getKoLabelWithLeftovers(rolls: number[], hp: number): string | null {
  if (!rolls || rolls.length === 0 || hp <= 0) return null;
  const recovery = Math.floor(hp / 16);
  if (recovery <= 0) return null;

  for (let n = 1; n <= 8; n++) {
    // n発分のダメージ - (n-1)ターン分の回復
    const minNet = rolls[0] * n - recovery * (n - 1);
    const maxNet = rolls[15] * n - recovery * (n - 1);
    if (minNet >= hp) return `たべのこし込み確定${toKanji(n)}発`;
    if (maxNet >= hp) {
      const koCount = rolls.filter((r) => r * n - recovery * (n - 1) >= hp).length;
      return `たべのこし込み乱数${toKanji(n)}発 (${koCount}/16)`;
    }
  }
  return "たべのこし込み9発以上";
}

/** 連続技の合計ダメージロールでKO判定（連続技は1ターン分がすでに合計されている） */
function getMultiHitKoLabel(totalRolls: number[], hp: number): string {
  // 連続技の合計ダメージがすでにrollsに入っているので、n=1で判定
  if (totalRolls[0] >= hp) return "確定1発";
  if (totalRolls[15] >= hp) {
    const koCount = totalRolls.filter((r) => r >= hp).length;
    return `乱数1発 (${koCount}/16)`;
  }
  // 2回以上繰り返す（次のターンも含む）
  for (let n = 2; n <= 6; n++) {
    const minTotal = totalRolls[0] * n;
    const maxTotal = totalRolls[15] * n;
    if (minTotal >= hp) return `確定${toKanji(n)}発`;
    if (maxTotal >= hp) {
      const koCount = totalRolls.filter((r) => r * n >= hp).length;
      return `乱数${toKanji(n)}発 (${koCount}/16)`;
    }
  }
  return "7発以上";
}
