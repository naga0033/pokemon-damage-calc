/**
 * PokeAPI から全技の日本語名を取得し、move-names.ts を完全更新するスクリプト
 * 実行: node scripts/fetch-all-moves.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "https://pokeapi.co/api/v2";
const MOVE_NAMES_PATH = path.join(__dirname, "../lib/move-names.ts");

// ---- 現在の move-names.ts から登録済みキー一覧を抽出 ----
const existingContent = fs.readFileSync(MOVE_NAMES_PATH, "utf8");
const existingKeys = new Set(
  [...existingContent.matchAll(/"([a-z][a-z0-9\-]*)"\s*:/g)].map(m => m[1])
);
console.log(`現在の登録数: ${existingKeys.size}`);

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

async function getJaName(slug) {
  try {
    const data = await fetchJSON(`${BASE}/move/${slug}`);
    const jaEntry = data.names.find(
      n => n.language.name === "ja-Hrkt" || n.language.name === "ja"
    );
    return jaEntry?.name ?? null;
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log("PokeAPI から全技リストを取得中...");
  const listData = await fetchJSON(`${BASE}/move?limit=2000`);
  const allMoves = listData.results;
  console.log(`PokeAPI 総技数: ${allMoves.length}`);

  // 未登録の技のみ抽出
  const missing = allMoves.filter(m => !existingKeys.has(m.name));
  console.log(`未登録技数: ${missing.length}`);

  if (missing.length === 0) {
    console.log("✅ 未登録の技はありません。");
    return;
  }

  // バッチ処理（5並列）
  const BATCH = 5;
  const results = [];
  let done = 0;

  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    const names = await Promise.all(batch.map(m => getJaName(m.name)));
    for (let j = 0; j < batch.length; j++) {
      const slug = batch[j].name;
      const ja = names[j];
      results.push({ slug, ja: ja ?? slug });
      if (!ja) console.warn(`  ⚠️ 日本語名未取得: ${slug}`);
    }
    done += batch.length;
    if (done % 50 === 0 || done === missing.length) {
      process.stdout.write(`  進捗: ${done}/${missing.length}\r`);
    }
    await sleep(100);
  }

  console.log(`\n取得完了: ${results.length}件`);

  // move-names.ts の }; の直前に追記する
  // 既存の "};" を見つけて、その前に新しいエントリを挿入
  const insertLines = [
    "",
    "  // === PokeAPI 全技補完（自動生成）===",
    ...results.map(({ slug, ja }) => `  "${slug}": "${ja}",`),
  ].join("\n");

  // MOVE_NAMES_JA の閉じ括弧の直前に挿入
  // 最後の }; を探して置き換え
  const closingPattern = /\n\};\s*\n\n\/\*\* 技のslug/;
  if (!closingPattern.test(existingContent)) {
    console.error("❌ move-names.ts の構造が想定外です。手動確認が必要です。");
    // デバッグ用に追加分だけ保存
    fs.writeFileSync(
      path.join(__dirname, "move-names-missing.ts"),
      insertLines,
      "utf8"
    );
    console.log("  → scripts/move-names-missing.ts に追加分を出力しました");
    return;
  }

  const updatedContent = existingContent.replace(
    closingPattern,
    `${insertLines}\n};\n\n/** 技のslug`
  );

  fs.writeFileSync(MOVE_NAMES_PATH, updatedContent, "utf8");
  console.log(`✅ move-names.ts を更新しました（${results.length}件追加）`);

  // デバッグ用JSON保存
  fs.writeFileSync(
    path.join(__dirname, "move-names-added.json"),
    JSON.stringify(results, null, 2),
    "utf8"
  );
}

main().catch(e => {
  console.error("エラー:", e);
  process.exit(1);
});
