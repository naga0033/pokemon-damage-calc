import { calcAllStats, DEFAULT_IVS, NATURE_DATA } from "./stats";
import type { EVIVs, Nature, PokemonData, PokemonType, StatKey } from "./types";

export interface ParseSuggestions {
  pokemon?: Array<{ name: string; ja: string }>;
  item?: string[];
  teraType?: PokemonType[];
  nature?: Nature[];
  ability?: string[];
  moves?: Array<{ index: number; options: string[] }>;
}

export interface ParsedPokeText {
  pokemonName: string;
  item: string;
  teraType: string;
  nature: string;
  ability: string;
  evs: EVIVs;
  actualStats: Partial<EVIVs>;
  moves: string[];
  isChampionsLayout: boolean;
  filledCount: number;
}

export function countParsedFields(parsed: Pick<ParsedPokeText, "pokemonName" | "item" | "teraType" | "nature" | "ability" | "evs" | "moves">): number {
  let filledCount = 0;
  if (parsed.pokemonName) filledCount++;
  if (parsed.item) filledCount++;
  if (parsed.teraType) filledCount++;
  if (parsed.nature) filledCount++;
  if (parsed.ability) filledCount++;
  if (Object.values(parsed.evs).some((value) => value > 0)) filledCount++;
  if (parsed.moves.length > 0) filledCount++;
  return filledCount;
}

export function mergeParsedResults(primary: ParsedPokeText, fallback: ParsedPokeText): ParsedPokeText {
  const mergedMoves = [...primary.moves];
  for (const move of fallback.moves) {
    if (!move || mergedMoves.includes(move)) continue;
    mergedMoves.push(move);
    if (mergedMoves.length >= 4) break;
  }

  const mergedEvs: EVIVs = {
    hp: primary.evs.hp > 0 ? primary.evs.hp : fallback.evs.hp,
    attack: primary.evs.attack > 0 ? primary.evs.attack : fallback.evs.attack,
    defense: primary.evs.defense > 0 ? primary.evs.defense : fallback.evs.defense,
    spAtk: primary.evs.spAtk > 0 ? primary.evs.spAtk : fallback.evs.spAtk,
    spDef: primary.evs.spDef > 0 ? primary.evs.spDef : fallback.evs.spDef,
    speed: primary.evs.speed > 0 ? primary.evs.speed : fallback.evs.speed,
  };

  const mergedActualStats: Partial<EVIVs> = {
    hp: primary.actualStats.hp ?? fallback.actualStats.hp,
    attack: primary.actualStats.attack ?? fallback.actualStats.attack,
    defense: primary.actualStats.defense ?? fallback.actualStats.defense,
    spAtk: primary.actualStats.spAtk ?? fallback.actualStats.spAtk,
    spDef: primary.actualStats.spDef ?? fallback.actualStats.spDef,
    speed: primary.actualStats.speed ?? fallback.actualStats.speed,
  };
  const merged = {
    pokemonName: primary.pokemonName || fallback.pokemonName,
    item: primary.item || fallback.item,
    teraType: primary.teraType || fallback.teraType,
    nature: primary.nature || fallback.nature,
    ability: primary.ability || fallback.ability,
    evs: mergedEvs,
    actualStats: mergedActualStats,
    moves: mergedMoves,
    isChampionsLayout: primary.isChampionsLayout || fallback.isChampionsLayout,
  };

  return {
    ...merged,
    filledCount: countParsedFields(merged),
  };
}

export function inferNatureAndEvsFromActualStats(
  pokemon: PokemonData,
  stats: Partial<EVIVs>,
  preferredNature?: Nature,
): { nature: Nature; evs: EVIVs } | null {
  const knownStats = Object.entries(stats).filter(([, value]) => typeof value === "number" && value > 0) as Array<[keyof EVIVs, number]>;
  if (knownStats.length === 0) return null;

  const natureOrder = preferredNature
    ? [preferredNature, ...Object.keys(NATURE_DATA).filter((nature) => nature !== preferredNature) as Nature[]]
    : Object.keys(NATURE_DATA) as Nature[];

  let best: { nature: Nature; evs: EVIVs; total: number } | null = null;

  for (const nature of natureOrder) {
    const candidateEvs: EVIVs = { hp: 0, attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 };
    let valid = true;

    for (const [statKey, target] of knownStats) {
      let matched = false;
      for (let ev = 0; ev <= 252; ev += 4) {
        const testEvs = { ...candidateEvs, [statKey]: ev };
        const calculated = calcAllStats(pokemon.baseStats, DEFAULT_IVS, testEvs, 50, nature);
        if (calculated[statKey as StatKey] === target) {
          candidateEvs[statKey] = ev;
          matched = true;
          break;
        }
      }
      if (!matched) {
        valid = false;
        break;
      }
    }

    if (!valid) continue;

    const calculated = calcAllStats(pokemon.baseStats, DEFAULT_IVS, candidateEvs, 50, nature);
    if (knownStats.some(([statKey, target]) => calculated[statKey as StatKey] !== target)) continue;

    const total = Object.values(candidateEvs).reduce((sum, value) => sum + value, 0);
    if (total > 510) continue;

    if (!best || total < best.total || (preferredNature && nature === preferredNature)) {
      best = { nature, evs: candidateEvs, total };
      if (preferredNature && nature === preferredNature) break;
    }
  }

  return best ? { nature: best.nature, evs: best.evs } : null;
}

export function inferNatureFromActualStatsAndEvs(
  pokemon: PokemonData,
  stats: Partial<EVIVs>,
  evs: EVIVs,
  preferredNature?: Nature,
): Nature | null {
  const knownStats = Object.entries(stats).filter(([, value]) => typeof value === "number" && value > 0) as Array<[keyof EVIVs, number]>;
  if (knownStats.length === 0) return null;

  const natureOrder = preferredNature
    ? [preferredNature, ...Object.keys(NATURE_DATA).filter((nature) => nature !== preferredNature) as Nature[]]
    : Object.keys(NATURE_DATA) as Nature[];

  for (const nature of natureOrder) {
    const calculated = calcAllStats(pokemon.baseStats, DEFAULT_IVS, evs, 50, nature);
    if (knownStats.every(([statKey, target]) => calculated[statKey as StatKey] === target)) {
      return nature;
    }
  }

  return null;
}
