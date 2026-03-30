"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_TERA_TYPES = exports.ALL_TYPES = exports.TYPE_NAMES_JA = exports.TYPE_COLORS = void 0;
exports.getSingleEffectiveness = getSingleEffectiveness;
exports.getTypeEffectiveness = getTypeEffectiveness;
exports.TYPE_COLORS = {
    normal: "#A8A878",
    fire: "#F08030",
    water: "#6890F0",
    electric: "#F8D030",
    grass: "#78C850",
    ice: "#98D8D8",
    fighting: "#C03028",
    poison: "#A040A0",
    ground: "#E0C068",
    flying: "#A890F0",
    psychic: "#F85888",
    bug: "#A8B820",
    rock: "#B8A038",
    ghost: "#705898",
    dragon: "#7038F8",
    dark: "#705848",
    steel: "#B8B8D0",
    fairy: "#EE99AC",
    stellar: "#5A9FD4", // ステラ（スカイブルー系）
};
exports.TYPE_NAMES_JA = {
    normal: "ノーマル",
    fire: "ほのお",
    water: "みず",
    electric: "でんき",
    grass: "くさ",
    ice: "こおり",
    fighting: "かくとう",
    poison: "どく",
    ground: "じめん",
    flying: "ひこう",
    psychic: "エスパー",
    bug: "むし",
    rock: "いわ",
    ghost: "ゴースト",
    dragon: "ドラゴン",
    dark: "あく",
    steel: "はがね",
    fairy: "フェアリー",
    stellar: "ステラ", // ステラテラスタイプ
};
exports.ALL_TYPES = [
    "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison",
    "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy",
    "stellar", // ステラ：テラスタイプ専用（先頭に表示するため別処理を推奨）
];
/** テラタイプ選択用リスト（通常18タイプ＋ステラ）*/
exports.ALL_TERA_TYPES = [
    "stellar",
    "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison",
    "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy",
];
/**
 * タイプ相性テーブル: effectiveness[攻撃タイプ][防御タイプ] = 倍率
 * デフォルト = 1 (記載なし = 等倍)
 */
const CHART = {
    normal: { rock: 0.5, steel: 0.5, ghost: 0 },
    fire: { fire: 0.5, water: 0.5, rock: 0.5, dragon: 0.5, grass: 2, ice: 2, bug: 2, steel: 2 },
    water: { water: 0.5, grass: 0.5, dragon: 0.5, fire: 2, ground: 2, rock: 2 },
    electric: { electric: 0.5, grass: 0.5, dragon: 0.5, ground: 0, water: 2, flying: 2 },
    grass: { fire: 0.5, grass: 0.5, poison: 0.5, flying: 0.5, bug: 0.5, steel: 0.5, dragon: 0.5, water: 2, ground: 2, rock: 2 },
    ice: { water: 0.5, ice: 0.5, fire: 0.5, steel: 0.5, grass: 2, ground: 2, flying: 2, dragon: 2 },
    fighting: { poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, fairy: 0.5, ghost: 0, normal: 2, ice: 2, rock: 2, dark: 2, steel: 2 },
    poison: { poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, grass: 2, fairy: 2 },
    ground: { grass: 0.5, bug: 0.5, flying: 0, fire: 2, electric: 2, poison: 2, rock: 2, steel: 2 },
    flying: { electric: 0.5, rock: 0.5, steel: 0.5, grass: 2, fighting: 2, bug: 2 },
    psychic: { psychic: 0.5, steel: 0.5, dark: 0, fighting: 2, poison: 2 },
    bug: { fire: 0.5, fighting: 0.5, flying: 0.5, ghost: 0.5, steel: 0.5, fairy: 0.5, poison: 0.5, grass: 2, psychic: 2, dark: 2 },
    rock: { fighting: 0.5, ground: 0.5, steel: 0.5, fire: 2, ice: 2, flying: 2, bug: 2 },
    ghost: { normal: 0, dark: 0.5, ghost: 2, psychic: 2 },
    dragon: { steel: 0.5, fairy: 0, dragon: 2 },
    dark: { fighting: 0.5, dark: 0.5, fairy: 0.5, ghost: 2, psychic: 2 },
    steel: { fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5, ice: 2, rock: 2, fairy: 2 },
    fairy: { fire: 0.5, poison: 0.5, steel: 0.5, dragon: 2, fighting: 2, dark: 2 },
};
/** 攻撃タイプ vs 防御タイプ1体分の相性倍率 */
function getSingleEffectiveness(atk, def) {
    return CHART[atk]?.[def] ?? 1;
}
/** 攻撃タイプ vs 防御タイプ（複数）の合計相性倍率 */
function getTypeEffectiveness(atk, defTypes) {
    return defTypes.reduce((acc, def) => acc * getSingleEffectiveness(atk, def), 1);
}
