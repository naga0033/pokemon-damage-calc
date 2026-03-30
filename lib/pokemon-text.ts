import { ITEM_MAP } from "./items";
import { getMoveJaName } from "./move-names";
import { getAbilityJaName } from "./ability-names";
import { TYPE_NAMES_JA } from "./type-chart";
import { calcAllStats, NATURE_DATA } from "./stats";
import type { PokemonState, StatKey } from "./types";

const STAT_ORDER: Array<keyof PokemonState["evs"]> = ["hp", "attack", "defense", "spAtk", "spDef", "speed"];
const EXPORT_ABILITY_NAMES: Record<string, string> = {
  "as-one-shadow": "じんばいったい",
  "as-one-spectrier": "じんばいったい",
  "as-one-ice": "じんばいったい",
  "as-one-glastrier": "じんばいったい",
  "minds-eye": "しんがん",
};

export function formatPokemonText(state: PokemonState, moves: string[] = []): string {
  if (!state.pokemon) return "";

  const pokemonName = state.pokemon.japaneseName || state.pokemon.name;
  const itemName = state.item ? (ITEM_MAP[state.item]?.ja || state.item) : "";
  const teraTypeName = state.teraType ? TYPE_NAMES_JA[state.teraType] : "";
  const abilityName = state.ability
    ? (EXPORT_ABILITY_NAMES[state.ability] || getAbilityJaName(state.ability) || state.ability)
    : "";
  const natureName = NATURE_DATA[state.nature]?.ja || state.nature;
  const stats = calcAllStats(state.pokemon.baseStats, state.ivs, state.evs, state.level, state.nature);

  const statsLine = STAT_ORDER.map((key) => {
    const statValue = stats[key as StatKey];
    const evValue = state.evs[key];
    return evValue > 0 ? `${statValue}(${evValue})` : `${statValue}`;
  }).join("-");

  const moveLine = moves
    .filter(Boolean)
    .slice(0, 4)
    .map((slug) => getMoveJaName(slug))
    .join(" / ");

  return [
    itemName ? `${pokemonName}@${itemName}` : pokemonName,
    teraTypeName ? `テラスタイプ: ${teraTypeName}` : "",
    abilityName ? `特性: ${abilityName}` : "",
    natureName ? `性格: ${natureName}` : "",
    statsLine,
    moveLine,
  ].filter(Boolean).join("\n");
}
