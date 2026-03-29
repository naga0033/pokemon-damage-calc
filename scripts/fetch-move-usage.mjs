/**
 * Smogon Chaos JSON から全ポケモンの技採用率データを取得し、
 * lib/move-usage.ts を自動生成するスクリプト
 *
 * 全Gen9ティアを統合して最大カバーを実現:
 * AG → Ubers → OU → UU → RU → NU → PU
 * (先に見つかったティアのデータを優先)
 *
 * 実行: node scripts/fetch-move-usage.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- 設定 ----
const MONTH = "2026-02";
const STATS_BASE = `https://www.smogon.com/stats/${MONTH}/chaos`;

// 優先順位: 上位ティアが優先 (AG→Ubers→OU→UU→RU→NU→PU)
const TIERS = [
  { name: "gen9anythinggoes", cutoffs: [1630, 1500, 0] },
  { name: "gen9ubers",        cutoffs: [1630, 1500, 0] },
  { name: "gen9ou",            cutoffs: [1630, 1500, 0] },
  { name: "gen9uu",            cutoffs: [1630, 1500, 0] },
  { name: "gen9ru",            cutoffs: [1630, 1500, 0] },
  { name: "gen9nu",            cutoffs: [1630, 1500, 0] },
  { name: "gen9pu",            cutoffs: [1630, 1500, 0] },
];

const TOP_MOVES = 10;
const MIN_RAW_COUNT = 30;
const OUTPUT_PATH = path.join(__dirname, "../lib/move-usage.ts");

// ---- Smogon 技名 → PokeAPI slug 変換マップ ----
function loadMoveSlugMap() {
  const src = fs.readFileSync(path.join(__dirname, "../lib/move-names.ts"), "utf8");
  const slugs = [...src.matchAll(/"([a-z][a-z0-9\-]*)"\s*:/g)].map(m => m[1]);
  const map = new Map();
  for (const slug of slugs) {
    map.set(slug.replace(/-/g, ""), slug);
  }
  return map;
}

// ---- Smogon ポケモン名 → PokeAPI slug ----
const POKEMON_NAME_OVERRIDES = {
  "Zacian-Crowned":        "zacian",
  "Zamazenta-Crowned":     "zamazenta",
  "Urshifu-Rapid-Strike":  "urshifu-rapid-strike",
  "Calyrex-Shadow":        "calyrex-shadow",
  "Calyrex-Ice":           "calyrex-ice",
  "Ursaluna-Blood-Moon":   "ursaluna-bloodmoon",
  "Landorus-Therian":      "landorus-therian",
  "Tornadus-Therian":      "tornadus-therian",
  "Thundurus-Therian":     "thundurus-therian",
  "Thundurus-Incarnate":   "thundurus",
  "Landorus-Incarnate":    "landorus",
  "Tornadus-Incarnate":    "tornadus",
  "Ogerpon-Wellspring":    "ogerpon-wellspring",
  "Ogerpon-Hearthflame":   "ogerpon-hearthflame",
  "Ogerpon-Cornerstone":   "ogerpon-cornerstone",
  "Kyurem-White":          "kyurem-white",
  "Kyurem-Black":          "kyurem-black",
  "Necrozma-Dusk-Mane":    "necrozma-dusk-mane",
  "Necrozma-Dawn-Wings":   "necrozma-dawn-wings",
  "Giratina-Origin":       "giratina-origin",
  "Dialga-Origin":         "dialga-origin",
  "Palkia-Origin":         "palkia-origin",
  "Deoxys-Attack":         "deoxys-attack",
  "Deoxys-Speed":          "deoxys-speed",
  "Deoxys-Defense":        "deoxys-defense",
  "Palafin-Hero":          "palafin-hero",
  "Slowking-Galar":        "slowking-galar",
  "Indeedee-F":            "indeedee-female",
  "Basculegion-F":         "basculegion-female",
  "Meowstic-F":            "meowstic-female",
  "Oinkologne-F":          "oinkologne-female",
};

function smogonNameToSlug(name) {
  if (POKEMON_NAME_OVERRIDES[name] !== undefined) {
    return POKEMON_NAME_OVERRIDES[name];
  }
  if (name.startsWith("Arceus-")) return null;
  if (name.includes("-Droopy") || name.includes("-Stretchy")) return null;
  if (name.includes("-Totem")) return null;
  return name.toLowerCase().replace(/ /g, "-");
}

// ---- メイン処理 ----
async function main() {
  const smogonToSlug = loadMoveSlugMap();
  console.log(`技slug マッピング数: ${smogonToSlug.size}`);

  const allPokemonData = new Map();

  for (const tier of TIERS) {
    let fetched = false;
    for (const cutoff of tier.cutoffs) {
      const url = `${STATS_BASE}/${tier.name}-${cutoff}.json`;
      console.log(`\n${tier.name}-${cutoff} を取得中...`);

      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.log(`  → HTTP ${res.status}, スキップ`);
          continue;
        }

        const json = await res.json();
        let added = 0;

        for (const [smogonName, pokemonData] of Object.entries(json.data)) {
          const slug = smogonNameToSlug(smogonName);
          if (!slug) continue;
          if (allPokemonData.has(slug)) continue;

          const rawCount = pokemonData["Raw count"] || 0;
          if (rawCount < MIN_RAW_COUNT) continue;

          const moves = pokemonData.Moves || {};
          const sortedMoves = Object.entries(moves)
            .map(([smogonMove, count]) => {
              const moveSlug = smogonToSlug.get(smogonMove);
              return moveSlug ? { slug: moveSlug, count } : null;
            })
            .filter(Boolean)
            .sort((a, b) => b.count - a.count)
            .slice(0, TOP_MOVES)
            .map(m => m.slug);

          if (sortedMoves.length > 0) {
            allPokemonData.set(slug, { moves: sortedMoves, rawCount, tier: tier.name });
            added++;
          }
        }

        console.log(`  → ${added}体追加（累計: ${allPokemonData.size}体）`);
        fetched = true;
        break; // このティアは最初に成功したcutoffを使う
      } catch (e) {
        console.log(`  → エラー: ${e.message}`);
      }
    }
  }

  console.log(`\n=== 統合結果 ===`);
  console.log(`全ポケモン数: ${allPokemonData.size}体`);

  // 使用率降順でソート
  const sorted = [...allPokemonData.entries()]
    .sort(([, a], [, b]) => b.rawCount - a.rawCount);

  // ---- lib/move-usage.ts を生成 ----
  const entries = sorted
    .map(([slug, { moves }]) => `  "${slug}": [${moves.map(m => `"${m}"`).join(", ")}],`)
    .join("\n");

  const output = `/**
 * ポケモン別 技採用率ランキング（変化技含む・上位${TOP_MOVES}技）
 * Source: Smogon全Gen9ティア統合 (${MONTH})
 *   AG → Ubers → OU → UU → RU → NU → PU
 * Auto-generated by scripts/fetch-move-usage.mjs
 * 登録数: ${sorted.length}体
 */
export const POKEMON_MOVE_USAGE: Record<string, string[]> = {
${entries}
};
`;

  fs.writeFileSync(OUTPUT_PATH, output, "utf8");
  console.log(`\n✅ ${OUTPUT_PATH} を生成（${sorted.length}体）`);

  // サンプル
  console.log("\n--- サンプル ---");
  for (const s of ["calyrex-shadow", "koraidon", "ting-lu", "pikachu", "magikarp"]) {
    const d = allPokemonData.get(s);
    if (d) console.log(`  ${s} (${d.tier}): [${d.moves.join(", ")}]`);
    else console.log(`  ${s}: データなし`);
  }
}

main().catch(e => { console.error("エラー:", e); process.exit(1); });
