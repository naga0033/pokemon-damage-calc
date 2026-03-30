"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.countParsedFields = countParsedFields;
exports.mergeParsedResults = mergeParsedResults;
exports.inferNatureAndEvsFromActualStats = inferNatureAndEvsFromActualStats;
const stats_1 = require("./stats");
function countParsedFields(parsed) {
    let filledCount = 0;
    if (parsed.pokemonName)
        filledCount++;
    if (parsed.item)
        filledCount++;
    if (parsed.teraType)
        filledCount++;
    if (parsed.nature)
        filledCount++;
    if (parsed.ability)
        filledCount++;
    if (Object.values(parsed.evs).some((value) => value > 0))
        filledCount++;
    if (parsed.moves.length > 0)
        filledCount++;
    return filledCount;
}
function mergeParsedResults(primary, fallback) {
    const mergedMoves = [...primary.moves];
    for (const move of fallback.moves) {
        if (!move || mergedMoves.includes(move))
            continue;
        mergedMoves.push(move);
        if (mergedMoves.length >= 4)
            break;
    }
    const primaryHasEvs = Object.values(primary.evs).some((value) => value > 0);
    const merged = {
        pokemonName: primary.pokemonName || fallback.pokemonName,
        item: primary.item || fallback.item,
        teraType: primary.teraType || fallback.teraType,
        nature: primary.nature || fallback.nature,
        ability: primary.ability || fallback.ability,
        evs: primaryHasEvs ? primary.evs : fallback.evs,
        actualStats: Object.keys(primary.actualStats).length > 0 ? primary.actualStats : fallback.actualStats,
        moves: mergedMoves,
        isChampionsLayout: primary.isChampionsLayout || fallback.isChampionsLayout,
    };
    return {
        ...merged,
        filledCount: countParsedFields(merged),
    };
}
function inferNatureAndEvsFromActualStats(pokemon, stats, preferredNature) {
    const knownStats = Object.entries(stats).filter(([, value]) => typeof value === "number" && value > 0);
    if (knownStats.length === 0)
        return null;
    const natureOrder = preferredNature
        ? [preferredNature, ...Object.keys(stats_1.NATURE_DATA).filter((nature) => nature !== preferredNature)]
        : Object.keys(stats_1.NATURE_DATA);
    let best = null;
    for (const nature of natureOrder) {
        const candidateEvs = { hp: 0, attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 };
        let valid = true;
        for (const [statKey, target] of knownStats) {
            let matched = false;
            for (let ev = 0; ev <= 252; ev += 4) {
                const testEvs = { ...candidateEvs, [statKey]: ev };
                const calculated = (0, stats_1.calcAllStats)(pokemon.baseStats, stats_1.DEFAULT_IVS, testEvs, 50, nature);
                if (calculated[statKey] === target) {
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
        if (!valid)
            continue;
        const calculated = (0, stats_1.calcAllStats)(pokemon.baseStats, stats_1.DEFAULT_IVS, candidateEvs, 50, nature);
        if (knownStats.some(([statKey, target]) => calculated[statKey] !== target))
            continue;
        const total = Object.values(candidateEvs).reduce((sum, value) => sum + value, 0);
        if (total > 510)
            continue;
        if (!best || total < best.total || (preferredNature && nature === preferredNature)) {
            best = { nature, evs: candidateEvs, total };
            if (preferredNature && nature === preferredNature)
                break;
        }
    }
    return best ? { nature: best.nature, evs: best.evs } : null;
}
