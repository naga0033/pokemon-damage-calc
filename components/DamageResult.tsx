"use client";
import { useState, useMemo } from "react";
import type { DamageResult, PokemonType, TerrainCondition, WeatherCondition } from "@/lib/types";
import { getKoLabelWithLeftovers } from "@/lib/damage";
import { ABILITY_NAMES_JA } from "@/lib/ability-names";
import { ITEM_MAP } from "@/lib/items";
import { TYPE_NAMES_JA } from "@/lib/type-chart";

/** 逆算用: 受けたダメージから考えられる攻撃側の補正を推定 */
const REVERSE_CANDIDATES: Array<{ mult: number; desc: string }> = [
  { mult: 0.9,  desc: "性格補正 (-10%)" },
  { mult: 1.0,  desc: "補正なし（計算通り）" },
  { mult: 1.1,  desc: "性格補正 (+10%)" },
  { mult: 1.2,  desc: "タイプ強化系アイテム" },
  { mult: 1.3,  desc: "いのちのたま" },
  { mult: 1.32, desc: "性格(+) × タイプ強化系" },
  { mult: 1.35, desc: "性格(-) × こだわり" },
  { mult: 1.43, desc: "性格(+) × いのちのたま" },
  { mult: 1.5,  desc: "こだわりハチマキ / メガネ" },
  { mult: 1.65, desc: "性格(+) × こだわり" },
];

function inferBoosts(received: number, rolls: number[]): Array<{ mult: number; desc: string }> {
  if (rolls.length === 0) return [];
  const minRoll = rolls[0];
  const maxRoll = rolls[rolls.length - 1];
  return REVERSE_CANDIDATES.filter(({ mult }) => {
    const implied = received / mult;
    return implied >= minRoll - 1 && implied <= maxRoll + 1;
  });
}

export { inferBoosts, REVERSE_CANDIDATES };

const WEATHER_LABELS: Record<WeatherCondition, string> = {
  none: "なし",
  sun: "晴れ",
  rain: "雨",
  sand: "砂嵐",
  snow: "雪",
};

const TERRAIN_LABELS: Record<TerrainCondition, string> = {
  none: "なし",
  electric: "エレキ",
  grassy: "グラス",
  misty: "ミスト",
  psychic: "サイコ",
};

const MODIFIER_DETAIL_LABELS: Record<string, string> = {
  ...ABILITY_NAMES_JA,
  ...Object.fromEntries(Object.entries(ITEM_MAP).filter(([slug]) => Boolean(slug)).map(([slug, item]) => [slug, item.ja])),
  ...Object.fromEntries(Object.entries(TYPE_NAMES_JA).map(([slug, ja]) => [slug, ja])),
  ...WEATHER_LABELS,
  ...TERRAIN_LABELS,
};

const MODIFIER_DETAIL_KEYS = Object.keys(MODIFIER_DETAIL_LABELS).filter(Boolean).sort((a, b) => b.length - a.length);

function formatModifierDetail(detail?: string): string | undefined {
  if (!detail) return detail;

  let translated = detail;
  for (const key of MODIFIER_DETAIL_KEYS) {
    translated = translated.split(key).join(MODIFIER_DETAIL_LABELS[key]);
  }

  return translated.replace(/\s*->\s*/g, " → ");
}

interface Props {
  result: DamageResult;
  stealthRockHp?: number;   // damage from stealth rock as HP amount
  disguiseHp?: number;      // ばけのかわ消費ダメージ as HP amount
  spikesHp?: number;        // damage from spikes as HP amount
  currentHp?: number;       // 現在HP（残りHP）。未指定なら最大HP扱い
  hideReverseCalc?: boolean; // 逆算ツールを非表示にする
  poisonDmg?: number;       // 毒/猛毒によるスリップダメージ
  defenderItem?: string;    // 防御側の持ち物slug（たべのこし判定用）
  hasLeftovers?: boolean;   // たべのこしチェックボックス（fieldConditions経由）
  // 防御側EV逆算用
  defenderBaseDefense?: number;  // 防御側の種族値（ぼうぎょorとくぼう）
  defenderBaseHp?: number;       // 防御側のHP種族値
  defenderLevel?: number;        // 防御側のレベル
  defenderNatureMod?: number;    // 防御側の性格補正（1.1/1.0/0.9）
  moveCategory?: "physical" | "special" | "status"; // 技の分類
  onApplyDefEv?: (hpEv: number, defEv: number) => void; // EV適用コールバック
}

const EFF_LABEL: Record<number, { label: string; color: string }> = {
  0:    { label: "効果なし (×0)",     color: "bg-gray-100 text-gray-500" },
  0.25: { label: "効果は今ひとつ (×1/4)", color: "bg-blue-50 text-blue-600" },
  0.5:  { label: "効果は今ひとつ (×1/2)", color: "bg-blue-100 text-blue-700" },
  1:    { label: "等倍 (×1)",         color: "bg-gray-50 text-gray-600" },
  2:    { label: "効果は抜群！ (×2)",  color: "bg-orange-100 text-orange-700" },
  4:    { label: "効果は抜群！ (×4)",  color: "bg-red-100 text-red-700 font-bold" },
};

function koColor(label: string): string {
  if (label.startsWith("確定1発")) return "text-red-600";
  if (label.startsWith("乱数1発")) return "text-orange-500";
  if (label.startsWith("確定2発")) return "text-yellow-600";
  if (label.startsWith("乱数2発")) return "text-yellow-500";
  if (label === "効果なし") return "text-gray-400";
  return "text-blue-600";
}

function rollColor(damage: number, hp: number): string {
  const pct = damage / hp;
  if (pct >= 1)    return "bg-red-500 text-white";
  if (pct >= 0.5)  return "bg-orange-400 text-white";
  if (pct >= 0.33) return "bg-yellow-400 text-gray-900";
  return "bg-blue-100 text-gray-700";
}

/** rolls と HP から確定数ラベルを計算（damage.ts の getKoLabel と同等） */
function computeKoLabel(rolls: number[], hp: number): string {
  for (let n = 1; n <= 6; n++) {
    const minTotal = rolls[0] * n;
    const maxTotal = rolls[rolls.length - 1] * n;
    if (minTotal >= hp) return `確定${["1","2","3","4","5","6"][n-1]}発`;
    if (maxTotal >= hp) {
      const koCount = rolls.filter((r) => r * n >= hp).length;
      return `乱数${["1","2","3","4","5","6"][n-1]}発 (${koCount}/16)`;
    }
  }
  return "7発以上";
}

/** 設置技込みKOラベルを計算 */
function getHazardKoLabel(rolls: number[], hp: number, hazardDmg: number): string | null {
  if (hazardDmg <= 0) return null;
  const effectiveHp = Math.max(1, hp - hazardDmg);
  for (let n = 1; n <= 6; n++) {
    const minTotal = rolls[0] * n;
    const maxTotal = rolls[15] * n;
    if (minTotal >= effectiveHp) return `確定${["1","2","3","4","5","6"][n-1]}発`;
    if (maxTotal >= effectiveHp) {
      const koCount = rolls.filter((r) => r * n >= effectiveHp).length;
      return `乱数${["1","2","3","4","5","6"][n-1]}発 (${koCount}/16)`;
    }
  }
  return "7発以上";
}

export default function DamageResultPanel({ result, stealthRockHp, disguiseHp, spikesHp, currentHp, hideReverseCalc, poisonDmg = 0, defenderItem, hasLeftovers, defenderBaseDefense, defenderBaseHp, defenderLevel = 50, defenderNatureMod = 1, moveCategory, onApplyDefEv }: Props) {
  const { minDamage: rawMinDamage, maxDamage: rawMaxDamage, koLabel, typeEffectiveness, defenderHp, rolls } = result;
  const activeModifiers = (result.modifiers ?? []).filter((modifier) => modifier.value !== 1);
  // たべのこし回復量（ON時のみ）
  const isLeftoversActive = hasLeftovers || defenderItem === "leftovers" || defenderItem === "black-sludge";
  const leftoversRecovery = isLeftoversActive ? Math.floor(defenderHp / 16) : 0;
  // 実効ダメージ（回復分を差し引き、最低0）
  const minDamage = Math.max(0, rawMinDamage - leftoversRecovery);
  const maxDamage = Math.max(0, rawMaxDamage - leftoversRecovery);
  // 現在HP（指定がなければ最大HP）
  const effectiveHp = (currentHp != null && currentHp >= 1) ? currentHp : defenderHp;
  const isReducedHp = effectiveHp < defenderHp;
  // 現在HPベースでパーセントを再計算
  const minPercent = Math.round((minDamage / effectiveHp) * 1000) / 10;
  const maxPercent = Math.round((maxDamage / effectiveHp) * 1000) / 10;
  // KOラベルを現在HPベースで再計算
  const displayKoLabel = (rolls.length > 0 && isReducedHp)
    ? computeKoLabel(rolls, effectiveHp)
    : koLabel;
  const [receivedInput, setReceivedInput] = useState("");

  const effInfo = EFF_LABEL[typeEffectiveness] ?? { label: `×${typeEffectiveness}`, color: "bg-gray-50 text-gray-600" };

  // 設置技合計ダメージ
  const totalHazardDmg = (stealthRockHp ?? 0) + (disguiseHp ?? 0) + (spikesHp ?? 0);
  // 設置技込みKO: 現在HPからさらに設置ダメージを引いた残量で計算
  const hazardKoLabel = useMemo(
    () => (rolls.length > 0 && totalHazardDmg > 0 ? getHazardKoLabel(rolls, effectiveHp, totalHazardDmg) : null),
    [rolls, effectiveHp, totalHazardDmg]
  );

  // HPに対する実際の割合（100%超えもそのまま）— effectiveHp基準
  const rawBarMin = (minDamage / effectiveHp) * 100;
  const rawBarMax = (maxDamage / effectiveHp) * 100;
  // バー表示用（100%にクランプ）
  const barMin = Math.min(rawBarMin, 100);
  const barMax = Math.min(rawBarMax, 100);
  const rangeBarPct = Math.max(0, barMax - barMin);
  // 100%超えフラグ
  const exceedsHp = rawBarMax > 100;
  // 設置技のバー幅（設置技は最大HPベースで計算されるため defenderHp を使用）
  const hazardBarPct = Math.min((totalHazardDmg / effectiveHp) * 100, 100);
  // 設置技込み合計（バー左端側に黄色で表示）
  const hazardTotalBarPct = Math.min(((minDamage + totalHazardDmg) / effectiveHp) * 100, 100);
  // たべのこし回復のバー幅（ダメージバーの右に緑で表示）
  const leftoversBarPct = leftoversRecovery > 0 ? Math.min((leftoversRecovery / effectiveHp) * 100, 100) : 0;
  // 毒ダメージのバー幅
  const poisonBarPct = poisonDmg > 0 ? Math.min((poisonDmg / effectiveHp) * 100, 100) : 0;
  const remainBarPct = Math.max(0, 100 - barMax - hazardBarPct - poisonBarPct);
  // 毒込みKOラベル
  const totalSlipDmg = totalHazardDmg + poisonDmg;
  const slipKoLabel = useMemo(
    () => (rolls.length > 0 && totalSlipDmg > 0 ? getHazardKoLabel(rolls, effectiveHp, totalSlipDmg) : null),
    [rolls, effectiveHp, totalSlipDmg]
  );

  // たべのこし / くろいヘドロ込みKOラベル（チェックボックスまたは持ち物で発動）
  const leftoversKoLabel = useMemo(
    () => {
      if (!rolls || rolls.length === 0) return null;
      const isLeftovers = hasLeftovers || defenderItem === "leftovers" || defenderItem === "black-sludge";
      if (!isLeftovers) return null;
      return getKoLabelWithLeftovers(rolls, effectiveHp);
    },
    [rolls, effectiveHp, defenderItem, hasLeftovers]
  );

  const receivedNum = parseInt(receivedInput, 10);
  const inferredBoosts = useMemo(
    () => (Number.isFinite(receivedNum) && receivedNum > 0 ? inferBoosts(receivedNum, rolls) : []),
    [receivedNum, rolls]
  );
  const receivedPct =
    Number.isFinite(receivedNum) && receivedNum > 0
      ? `${Math.round((receivedNum / defenderHp) * 1000) / 10}%`
      : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* タイプ相性 */}
      <div className={`px-4 py-2 text-sm font-medium text-center rounded-t-xl ${effInfo.color}`}>
        {effInfo.label}
      </div>

      <div className="p-4 space-y-4">
        {typeEffectiveness === 0 ? (
          <p className="text-center text-gray-400 text-sm">ダメージなし</p>
        ) : (
          <>
            {/* KO判定 (大きく表示) */}
            <div className="text-center">
              {isReducedHp && (
                <p className="text-[11px] text-blue-500 font-medium mb-1">
                  現在HP {effectiveHp}/{defenderHp} ({Math.round(effectiveHp/defenderHp*1000)/10}%) 基準
                </p>
              )}
              <span className={`text-3xl font-extrabold ${koColor(displayKoLabel)}`}>
                {displayKoLabel}
              </span>
              {hazardKoLabel && hazardKoLabel !== displayKoLabel && (
                <div className="mt-1">
                  <span className={`text-sm font-semibold ${koColor(hazardKoLabel)} bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5`}>
                    設置技込み: {hazardKoLabel}
                  </span>
                </div>
              )}
              {poisonDmg > 0 && slipKoLabel && slipKoLabel !== displayKoLabel && slipKoLabel !== hazardKoLabel && (
                <div className="mt-1">
                  <span className={`text-sm font-semibold ${koColor(slipKoLabel)} bg-purple-50 border border-purple-200 rounded-full px-2.5 py-0.5`}>
                    毒込み: {slipKoLabel}
                  </span>
                </div>
              )}
              {leftoversKoLabel && leftoversKoLabel !== displayKoLabel && (
                <div className="mt-1">
                  <span className={`text-sm font-semibold ${koColor(leftoversKoLabel)} bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5`}>
                    🍎 {leftoversKoLabel}
                  </span>
                </div>
              )}
            </div>

            {/* ダメージ数値 */}
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {minDamage}
                {minDamage !== maxDamage && <span className="text-gray-500"> 〜 {maxDamage}</span>}
                <span className="text-base font-normal text-gray-500 ml-1">ダメージ</span>
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                ({minPercent}% 〜 {maxPercent}%)
              </p>
              {result.perHit && result.hitCount && result.hitCount > 1 && (
                <p className="text-xs text-amber-600 mt-0.5">
                  🔄 {result.hitCount}回 × {result.perHit.min}〜{result.perHit.max}/1回
                </p>
              )}
            </div>

            {/* みがわり情報 */}
            {result.substituteInfo && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-sm space-y-1">
                <div className="flex items-center gap-2 font-medium text-purple-800">
                  <span>🧸 みがわり</span>
                  <span className="text-xs font-normal text-purple-600">HP: {result.substituteInfo.subHp}</span>
                </div>
                {result.substituteInfo.bypassed ? (
                  <p className="text-xs text-purple-600">
                    ✨ 音系技 / すりぬけ → みがわりを貫通して本体に直撃
                  </p>
                ) : (
                  <div className="text-xs text-purple-700 space-y-0.5">
                    {result.substituteInfo.hitsToBreak <= 0 ? (
                      <p>みがわりにダメージなし</p>
                    ) : result.hitCount && result.hitCount > 1 ? (
                      <>
                        <p>
                          {result.substituteInfo.hitsToBreak === 1
                            ? "1ヒット目でみがわり破壊"
                            : `${result.substituteInfo.hitsToBreak}ヒットでみがわり破壊`}
                          {result.substituteInfo.hitsToBreak < result.hitCount && (
                            <span className="ml-1">→ {result.substituteInfo.hitsToBreak + 1}ヒット目から本体へ</span>
                          )}
                        </p>
                        {result.substituteInfo.bodyDamageMax > 0 ? (
                          <p className="font-medium">
                            本体ダメージ: {result.substituteInfo.bodyDamageMin}〜{result.substituteInfo.bodyDamageMax}
                            <span className="font-normal ml-1">
                              ({Math.round(result.substituteInfo.bodyDamageMin / result.defenderHp * 1000) / 10}%〜{Math.round(result.substituteInfo.bodyDamageMax / result.defenderHp * 1000) / 10}%)
                            </span>
                          </p>
                        ) : (
                          <p>全ヒットみがわりに吸収（本体ダメージなし）</p>
                        )}
                      </>
                    ) : (
                      <p>
                        みがわりへ: {result.minDamage}〜{result.maxDamage}ダメージ
                        {result.minDamage >= result.substituteInfo.subHp
                          ? " → 確定破壊"
                          : result.maxDamage >= result.substituteInfo.subHp
                            ? " → 乱数破壊"
                            : " → 破壊不可"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ダメージバー */}
            <div>
              <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
                {/* HP残量（左から、緑） */}
                <div
                  className="absolute left-0 top-0 h-full bg-green-400 transition-all"
                  style={{ width: `${remainBarPct}%` }}
                />
                {/* 設置技ダメージ（緑の右隣に黄色で表示） */}
                {totalHazardDmg > 0 && (
                  <div
                    className="absolute top-0 h-full bg-yellow-400 transition-all opacity-80"
                    style={{
                      left: `${remainBarPct}%`,
                      width: `${hazardBarPct}%`,
                    }}
                  />
                )}
                {/* 毒ダメージ（紫色で表示） */}
                {poisonDmg > 0 && (
                  <div
                    className="absolute top-0 h-full bg-purple-400 transition-all opacity-80"
                    style={{
                      left: `${remainBarPct + hazardBarPct}%`,
                      width: `${poisonBarPct}%`,
                    }}
                  />
                )}
                {/* 乱数ぶれ幅（最大-最小） */}
                {rangeBarPct > 0 && (
                  <div
                    className="absolute top-0 h-full bg-orange-200 transition-all"
                    style={{
                      left: `${Math.max(0, 100 - barMax)}%`,
                      width: `${rangeBarPct}%`,
                    }}
                  />
                )}
                {/* 確定ダメージ（最小） */}
                <div
                  className={`absolute right-0 top-0 h-full transition-all ${exceedsHp ? "bg-red-500" : "bg-orange-400"}`}
                  style={{ width: `${barMin}%` }}
                />
                {/* たべのこし回復（ダメージ範囲内に緑で表示） */}
                {leftoversRecovery > 0 && barMax > 0 && (
                  <div
                    className="absolute top-0 h-full bg-emerald-400 transition-all opacity-70"
                    style={{
                      left: `${Math.max(0, 100 - barMax)}%`,
                      width: `${Math.min(leftoversBarPct, barMax)}%`,
                    }}
                  />
                )}
                {/* 50%ライン */}
                <div className="absolute left-1/2 top-0 w-px h-full bg-gray-400 opacity-60" />
                {/* 100%ライン */}
                <div className="absolute right-0 top-0 w-px h-full bg-gray-500" />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>0%</span>
                <span>50%</span>
                <span className={exceedsHp ? "text-red-500 font-semibold" : ""}>
                  {exceedsHp ? `100%超 (最大${rawBarMax.toFixed(1)}%)` : "100%"}
                </span>
              </div>
              {/* min〜max のパーセント表示バー下 */}
              <div className="flex items-center gap-1 mt-1 text-xs text-gray-500 flex-wrap">
                <span className={`inline-block w-3 h-3 rounded-sm flex-shrink-0 ${exceedsHp ? "bg-red-500" : "bg-orange-400"}`} />
                <span className={exceedsHp ? "text-red-600 font-semibold" : ""}>最小 {rawBarMin.toFixed(1)}%</span>
                <span className="inline-block w-3 h-3 rounded-sm bg-orange-200 flex-shrink-0 ml-2" />
                <span>最大 {rawBarMax.toFixed(1)}%</span>
                {totalHazardDmg > 0 && (
                  <>
                    <span className="inline-block w-3 h-3 rounded-sm bg-yellow-400 flex-shrink-0 ml-2" />
                    <span className="text-amber-700 font-medium">
                      設置技 {((totalHazardDmg / effectiveHp) * 100).toFixed(1)}%
                    </span>
                  </>
                )}
                {poisonDmg > 0 && (
                  <>
                    <span className="inline-block w-3 h-3 rounded-sm bg-purple-400 flex-shrink-0 ml-2" />
                    <span className="text-purple-700 font-medium">
                      毒 {((poisonDmg / effectiveHp) * 100).toFixed(1)}%
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* 16乱数ロール */}
            {rolls.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5 font-medium">乱数 (85%〜100%, 全16通り)</p>
                <div className="grid grid-cols-8 gap-1">
                  {rolls.map((r, i) => (
                    <div
                      key={i}
                      className={`text-center text-xs font-bold rounded py-1 px-0.5 ${rollColor(r, effectiveHp)}`}
                      title={`${Math.round((r / effectiveHp) * 1000) / 10}%`}
                    >
                      {r}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  赤=確定1発 / 橙=50%以上 / 黄=33%以上
                </p>
              </div>
            )}

            {/* 詳細 */}
            <div className="grid grid-cols-3 gap-2 text-xs text-center text-gray-500 border-t pt-3">
              <div>
                <p className="font-medium text-gray-700 text-sm">{result.attackStat}</p>
                <p>攻撃</p>
              </div>
              <div>
                <p className="font-medium text-gray-700 text-sm">{result.defenseStat}</p>
                <p>防御</p>
              </div>
              <div>
                <p className="font-medium text-gray-700 text-sm">{defenderHp}</p>
                <p>HP</p>
              </div>
            </div>

            {/* 適用補正 */}
            {activeModifiers.length > 0 && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold text-gray-600">適用された補正</p>
                <div className="flex flex-wrap gap-1.5">
                  {activeModifiers.map((modifier, index) => (
                    <span
                      key={`${modifier.label}-${modifier.detail ?? ""}-${index}`}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700"
                      title={formatModifierDetail(modifier.detail)}
                    >
                      <span className="font-semibold">{modifier.label}</span>
                      {modifier.value != null && (
                        <span className={`font-mono ${modifier.value > 1 ? "text-red-600" : modifier.value < 1 ? "text-blue-600" : "text-gray-500"}`}>
                          ×{modifier.value.toFixed(2)}
                        </span>
                      )}
                      {modifier.detail && <span className="text-slate-400">{formatModifierDetail(modifier.detail)}</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 逆算ツール */}
            {!hideReverseCalc && (<div className="border-t pt-3 space-y-2">
              <p className="text-xs font-medium text-gray-600">受けたダメージから相手の型を予測</p>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    className="w-full border rounded-lg px-3 py-1.5 text-sm text-left transition-colors focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-200 border-gray-300 hover:border-purple-300 text-gray-700 bg-white"
                    value={receivedInput}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^0-9]/g, "");
                      let v = digits;
                      const n = parseInt(v, 10);
                      if (!isNaN(n) && n > 9999) v = "9999";
                      else if (v.length > 4) v = v.slice(0, 4);
                      setReceivedInput(v);
                    }}
                    placeholder="受けたダメージ数値を入力"
                  />
                </div>
                {receivedPct && (
                  <span className="text-sm font-medium text-gray-600 whitespace-nowrap">= {receivedPct}</span>
                )}
              </div>
              {receivedInput !== "" && Number.isFinite(receivedNum) && receivedNum > 0 && (
                <div className="rounded-lg bg-purple-50 border border-purple-100 p-3 space-y-1.5">
                  {inferredBoosts.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      該当する補正が見つかりません（アイテム・特性・性格の設定が既に反映されている場合は計算済みです）
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500 mb-1">
                        現在の計算値（{minDamage}〜{maxDamage}）を基準に、以下の補正が考えられます：
                      </p>
                      {inferredBoosts.map(({ mult, desc }) => (
                        <div key={mult} className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-purple-800 font-medium">{desc}</span>
                          <span className="text-xs text-gray-500 bg-white border border-purple-200 rounded px-1.5 py-0.5 font-mono">
                            ×{mult.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

            </div>)}

            {/* 事前ダメージ */}
            {(stealthRockHp != null || disguiseHp != null || spikesHp != null) && (
              <div className="border-t pt-3 space-y-1">
                <p className="text-xs font-semibold text-gray-600">事前ダメージ</p>
                {stealthRockHp != null && stealthRockHp > 0 && (
                  <div className="flex justify-between text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                    <span className="text-amber-800 font-medium">ステルスロック</span>
                    <span className="font-bold text-amber-900">
                      -{stealthRockHp} ({Math.round(stealthRockHp / defenderHp * 1000) / 10}% / 最大HP比)
                    </span>
                  </div>
                )}
                {disguiseHp != null && disguiseHp > 0 && (
                  <div className="flex justify-between text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                    <span className="text-amber-800 font-medium">ばけのかわなし</span>
                    <span className="font-bold text-amber-900">
                      -{disguiseHp} ({Math.round(disguiseHp / defenderHp * 1000) / 10}% / 最大HP比)
                    </span>
                  </div>
                )}
                {spikesHp != null && spikesHp > 0 && (
                  <div className="flex justify-between text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                    <span className="text-amber-800 font-medium">まきびし</span>
                    <span className="font-bold text-amber-900">
                      -{spikesHp} ({Math.round(spikesHp / defenderHp * 1000) / 10}% / 最大HP比)
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
