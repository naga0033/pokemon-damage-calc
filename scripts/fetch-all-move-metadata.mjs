/**
 * PokeAPI から全技のメタデータ（type / power / category）を取得し、
 * move-metadata.ts の MOVE_METADATA を完全版に上書きするスクリプト
 *
 * 既存の特殊プロパティ（hits, alwaysCrit, statOverride, isSound）は保持する。
 *
 * 実行: node scripts/fetch-all-move-metadata.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "https://pokeapi.co/api/v2";
const META_PATH = path.join(__dirname, "../lib/move-metadata.ts");

// PokeAPI damage_class → MoveCategory mapping
const CLASS_MAP = { physical: "physical", special: "special", status: "status" };

// PokeAPI type name is already what we use (normal, fire, water, etc.)
const VALID_TYPES = new Set([
  "normal","fire","water","electric","grass","ice",
  "fighting","poison","ground","flying","psychic","bug",
  "rock","ghost","dragon","dark","steel","fairy",
]);

// ---- 既存の MOVE_METADATA から特殊プロパティを抽出 ----
function parseExistingSpecials() {
  const src = fs.readFileSync(META_PATH, "utf8");
  const specials = {};

  // hits / alwaysCrit / statOverride / isSound を含む行を探す
  const entryRegex = /"([a-z][a-z0-9\-]*)"\s*:\s*\{([^}]+)\}/g;
  let m;
  while ((m = entryRegex.exec(src)) !== null) {
    const slug = m[1];
    const body = m[2];
    const extra = {};
    if (/hits\s*:/.test(body)) {
      const hm = body.match(/hits\s*:\s*\[(\d+)\s*,\s*(\d+)\]/);
      if (hm) extra.hits = [parseInt(hm[1]), parseInt(hm[2])];
    }
    if (/alwaysCrit\s*:\s*true/.test(body)) extra.alwaysCrit = true;
    if (/statOverride\s*:/.test(body)) {
      const sm = body.match(/statOverride\s*:\s*"([^"]+)"/);
      if (sm) extra.statOverride = sm[1];
    }
    if (/isSound\s*:\s*true/.test(body)) extra.isSound = true;
    if (Object.keys(extra).length > 0) specials[slug] = extra;
  }
  return specials;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log("既存の特殊プロパティを解析中...");
  const specials = parseExistingSpecials();
  console.log(`  特殊プロパティ保持対象: ${Object.keys(specials).length}件`);

  console.log("PokeAPI から全技リストを取得中...");
  const listData = await fetchJSON(`${BASE}/move?limit=2000`);
  const allMoves = listData.results;
  console.log(`  総技数: ${allMoves.length}`);

  // バッチでメタデータを取得（10並列）
  const BATCH = 10;
  const results = []; // {slug, type, power, category, ...specials}
  let done = 0;
  let skipped = 0;

  for (let i = 0; i < allMoves.length; i += BATCH) {
    const batch = allMoves.slice(i, i + BATCH);
    const fetched = await Promise.all(batch.map(async (m) => {
      try {
        const data = await fetchJSON(`${BASE}/move/${m.name}`);
        const type = data.type?.name;
        const power = data.power;
        const dmgClass = data.damage_class?.name;
        const category = CLASS_MAP[dmgClass] || "status";

        if (!VALID_TYPES.has(type)) {
          return null; // shadow type etc.
        }

        return {
          slug: m.name,
          type,
          power: power || null,
          category,
        };
      } catch {
        return null;
      }
    }));

    for (const r of fetched) {
      if (r) {
        // 特殊プロパティをマージ
        if (specials[r.slug]) {
          Object.assign(r, specials[r.slug]);
        }
        results.push(r);
      } else {
        skipped++;
      }
    }

    done += batch.length;
    if (done % 100 === 0 || done === allMoves.length) {
      process.stdout.write(`  進捗: ${done}/${allMoves.length} (有効: ${results.length})\r`);
    }
    await sleep(80);
  }

  console.log(`\n取得完了: ${results.length}件 (スキップ: ${skipped}件)`);

  // --- move-metadata.ts を生成 ---
  // 既存ファイルの先頭部分（import, interface, SOUND_MOVES, POPULAR_MOVE_SLUGS）を保持
  const existingSrc = fs.readFileSync(META_PATH, "utf8");

  // MOVE_METADATA の宣言以前のすべてを保持
  const splitIdx = existingSrc.indexOf("/** 技スラッグ → メタデータ */");
  if (splitIdx === -1) {
    console.error("❌ '/** 技スラッグ → メタデータ */' が見つかりません");
    process.exit(1);
  }
  const header = existingSrc.substring(0, splitIdx);

  // MOVE_METADATA 以降の部分（最後の }; 以降に他のexportがないか確認）
  const afterMetadata = existingSrc.substring(splitIdx);
  const lastClosingBrace = afterMetadata.lastIndexOf("};");
  const tail = afterMetadata.substring(lastClosingBrace + 2).trim();

  // エントリを生成
  function formatEntry(r) {
    let line = `  "${r.slug}": { type: "${r.type}", power: ${r.power === null ? 'null' : r.power}, category: "${r.category}"`;
    if (r.hits) line += `, hits: [${r.hits[0]}, ${r.hits[1]}]`;
    if (r.alwaysCrit) line += `, alwaysCrit: true`;
    if (r.statOverride) line += `, statOverride: "${r.statOverride}"`;
    if (r.isSound) line += `, isSound: true`;
    line += ` },`;
    return line;
  }

  // タイプ別にソート
  const typeOrder = [
    "normal","fire","water","electric","grass","ice",
    "fighting","poison","ground","flying","psychic","bug",
    "rock","ghost","dragon","dark","steel","fairy"
  ];
  results.sort((a, b) => {
    const ta = typeOrder.indexOf(a.type);
    const tb = typeOrder.indexOf(b.type);
    if (ta !== tb) return ta - tb;
    return a.slug.localeCompare(b.slug);
  });

  const entries = results.map(formatEntry).join("\n");

  const newFile = `${header}/** 技スラッグ → メタデータ（PokeAPI全技自動生成: ${results.length}件） */
export const MOVE_METADATA: Record<string, MoveMeta> = {
${entries}
};
${tail ? "\n" + tail + "\n" : ""}`;

  fs.writeFileSync(META_PATH, newFile, "utf8");
  console.log(`✅ move-metadata.ts を更新しました（${results.length}件）`);

  // 整合性チェック: type が空の技がないか
  const noType = results.filter(r => !r.type);
  if (noType.length > 0) {
    console.warn(`⚠️ タイプ未設定: ${noType.map(r => r.slug).join(", ")}`);
  } else {
    console.log("✅ 全技にタイプが設定されています");
  }
}

main().catch(e => { console.error("エラー:", e); process.exit(1); });
