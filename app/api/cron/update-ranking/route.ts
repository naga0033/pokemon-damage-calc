import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { EN_TO_JA } from "@/lib/pokemon-names";
import { POKEMON_IDS } from "@/lib/pokemon-ids";

// Smogon ポケモン名 → PokeAPI slug 変換
const NAME_OVERRIDES: Record<string, string> = {
  "Zacian-Crowned": "zacian",
  "Zamazenta-Crowned": "zamazenta",
  "Urshifu-Rapid-Strike": "urshifu-rapid-strike",
  "Calyrex-Shadow": "calyrex-shadow",
  "Calyrex-Ice": "calyrex-ice",
  "Ursaluna-Blood-Moon": "ursaluna-bloodmoon",
  "Landorus-Therian": "landorus-therian",
  "Tornadus-Therian": "tornadus-therian",
  "Thundurus-Therian": "thundurus-therian",
  "Thundurus-Incarnate": "thundurus",
  "Landorus-Incarnate": "landorus",
  "Tornadus-Incarnate": "tornadus",
  "Ogerpon-Wellspring": "ogerpon-wellspring",
  "Ogerpon-Hearthflame": "ogerpon-hearthflame",
  "Ogerpon-Cornerstone": "ogerpon-cornerstone",
  "Kyurem-White": "kyurem-white",
  "Kyurem-Black": "kyurem-black",
  "Necrozma-Dusk-Mane": "necrozma-dusk-mane",
  "Necrozma-Dawn-Wings": "necrozma-dawn-wings",
  "Giratina-Origin": "giratina-origin",
  "Dialga-Origin": "dialga-origin",
  "Palkia-Origin": "palkia-origin",
  "Deoxys-Attack": "deoxys-attack",
  "Deoxys-Speed": "deoxys-speed",
  "Deoxys-Defense": "deoxys-defense",
  "Palafin-Hero": "palafin-hero",
  "Slowking-Galar": "slowking-galar",
  "Indeedee-F": "indeedee-female",
  "Basculegion-F": "basculegion-female",
  "Meowstic-F": "meowstic-female",
  "Oinkologne-F": "oinkologne-female",
  "Tatsugiri-Droopy": "tatsugiri",
  "Tatsugiri-Stretchy": "tatsugiri",
};

function smogonNameToSlug(name: string): string | null {
  if (NAME_OVERRIDES[name] !== undefined) return NAME_OVERRIDES[name];
  if (name.startsWith("Arceus-")) return null;
  if (name.includes("-Totem")) return null;
  return name.toLowerCase().replace(/ /g, "-");
}

interface UsageEntry {
  name: string;
  ja: string;
  id: number;
}

/** Smogon chaos JSON から使用率トップN のポケモンを取得 */
async function fetchRanking(format: string, topN: number): Promise<UsageEntry[]> {
  // レーティングの高い方から試す
  const cutoffs = [1760, 1630, 1500, 0];

  for (const cutoff of cutoffs) {
    const url = `https://www.smogon.com/stats/${getLatestMonth()}/chaos/${format}-${cutoff}.json`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;

      const json = await res.json();
      const entries: { slug: string; rawCount: number }[] = [];

      for (const [smogonName, pokemonData] of Object.entries(json.data as Record<string, { "Raw count"?: number }>)) {
        const slug = smogonNameToSlug(smogonName);
        if (!slug) continue;
        // 日本語名が存在するポケモンのみ（未知のポケモンを除外）
        if (!EN_TO_JA[slug]) continue;
        const rawCount = pokemonData["Raw count"] ?? 0;
        if (rawCount < 10) continue;
        entries.push({ slug, rawCount });
      }

      // 使用率降順でソートして重複を除去
      entries.sort((a, b) => b.rawCount - a.rawCount);
      const seen = new Set<string>();
      const result: UsageEntry[] = [];

      for (const e of entries) {
        if (seen.has(e.slug)) continue;
        seen.add(e.slug);
        result.push({
          name: e.slug,
          ja: EN_TO_JA[e.slug] ?? e.slug,
          id: POKEMON_IDS[e.slug] ?? 0,
        });
        if (result.length >= topN) break;
      }

      console.log(`[update-ranking] ${format}-${cutoff}: ${result.length} entries fetched`);
      return result;
    } catch (e) {
      console.log(`[update-ranking] ${format}-${cutoff}: failed`, e);
      continue;
    }
  }

  return [];
}

/** 利用可能な最新月を推定（Smogon は翌月中旬に前月データを公開） */
function getLatestMonth(): string {
  const now = new Date();
  // 前月のデータを取得（15日以前なら前々月）
  const target = new Date(now.getFullYear(), now.getMonth() - (now.getDate() < 16 ? 2 : 1), 1);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export async function GET(request: Request) {
  // Cronジョブの認証（Vercel Cron Secretまたは手動実行用）
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const month = getLatestMonth();

  // シングル: BSS レギュレーションI
  // ダブル: VGC 2026 レギュレーションI
  // フォーマット名が変わる可能性があるので複数試す
  const singlesFormats = [`gen9bssregi`, `gen9bssregh`, `gen9bssregg`];
  const doublesFormats = [`gen9vgc2026regi`, `gen9vgc2026regh`, `gen9vgc2026regg`];

  let singles: UsageEntry[] = [];
  let doubles: UsageEntry[] = [];

  // シングルを取得
  for (const fmt of singlesFormats) {
    singles = await fetchRanking(fmt, 50);
    if (singles.length > 0) break;
  }

  // ダブルを取得
  for (const fmt of doublesFormats) {
    doubles = await fetchRanking(fmt, 50);
    if (doubles.length > 0) break;
  }

  if (singles.length === 0 && doubles.length === 0) {
    console.log(`[update-ranking] No data found for ${month}`);
    return NextResponse.json({ error: "No data available", month }, { status: 404 });
  }

  // Supabase に保存（upsert）
  const { error } = await supabase
    .from("usage_ranking")
    .upsert(
      { id: "latest", singles, doubles, month, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );

  if (error) {
    console.error("[update-ranking] Supabase error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[update-ranking] Saved: singles=${singles.length}, doubles=${doubles.length}, month=${month}`);
  return NextResponse.json({
    success: true,
    month,
    singles: singles.length,
    doubles: doubles.length,
    singlesTop5: singles.slice(0, 5).map((e) => e.ja),
    doublesTop5: doubles.slice(0, 5).map((e) => e.ja),
  });
}
