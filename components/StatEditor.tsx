"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type React from "react";
import type { BaseStats, EVIVs, Nature, StatKey } from "@/lib/types";
import type { AbilityEntry } from "@/lib/types";
import { NATURE_DATA, STAT_NAMES_JA, calcAllStats, calcHp, calcStat } from "@/lib/stats";
import { getAbilityJaName } from "@/lib/ability-names";
import { ITEMS, type ItemEntry } from "@/lib/items";
import { POKEMON_ITEM_USAGE } from "@/lib/item-usage";
import { NumpadPopup } from "@/components/NumpadPopup";

/** 個体値は常にV（31）固定 — ポケモン チャンピオンズ仕様 */
const FIXED_IVS: EVIVs = { hp: 31, attack: 31, defense: 31, spAtk: 31, spDef: 31, speed: 31 };

interface Props {
  baseStats: BaseStats;
  level: number;
  nature: Nature;
  ivs: EVIVs;          // 後方互換のため保持（内部では未使用）
  evs: EVIVs;
  abilities: AbilityEntry[];
  selectedAbility: string;
  selectedItem: string;
  pokemonSlug?: string; // ポケモン別アイテム採用率に使用
  statRanks: { attack: number; spAtk: number; defense: number; spDef: number };
  onLevelChange: (v: number) => void;
  onNatureChange: (v: Nature) => void;
  onIvChange: (key: StatKey, v: number) => void; // 後方互換のため保持（内部では未使用）
  onEvChange: (key: StatKey, v: number) => void;
  onAbilityChange: (slug: string) => void;
  onItemChange: (slug: string) => void;
  onStatRankChange: (key: "attack" | "spAtk" | "defense" | "spDef", value: number) => void;
  /** 特性・もちものの直下に挿入するスロット（防御側HP入力など） */
  hpSlot?: React.ReactNode;
  /** 表示するステータスを制限（未指定時は全表示） */
  visibleStats?: StatKey[];
}

const STAT_KEYS: StatKey[] = ["hp", "attack", "defense", "spAtk", "spDef", "speed"];
const NATURE_MOD_KEYS: StatKey[] = ["attack", "defense", "spAtk", "spDef", "speed"];
const RANK_KEYS = ["attack", "spAtk", "defense", "spDef"] as const;
type RankKey = typeof RANK_KEYS[number];

/** EV逆算：IV=31固定 */
function calcEvForTarget(
  target: number, base: number, level: number, nature: Nature, statKey: StatKey
): number {
  for (let ev = 0; ev <= 252; ev++) {
    const val = statKey === "hp"
      ? calcHp(base, 31, ev, level)
      : calcStat(base, 31, ev, level, nature, statKey);
    if (val >= target) return ev;
  }
  return 252;
}

function pickNatureForMod(stat: StatKey, mod: "up" | "neutral" | "down", currentNature: Nature): Nature {
  const current = NATURE_DATA[currentNature];
  if (mod === "up") {
    const preferReduced = current.reduced !== null && current.reduced !== stat ? current.reduced : null;
    for (const [n, d] of Object.entries(NATURE_DATA) as [Nature, (typeof NATURE_DATA)[Nature]][]) {
      if (d.boosted === stat && d.reduced === preferReduced) return n;
    }
    for (const [n, d] of Object.entries(NATURE_DATA) as [Nature, (typeof NATURE_DATA)[Nature]][]) {
      if (d.boosted === stat) return n;
    }
  } else if (mod === "down") {
    const preferBoosted = current.boosted !== null && current.boosted !== stat ? current.boosted : null;
    for (const [n, d] of Object.entries(NATURE_DATA) as [Nature, (typeof NATURE_DATA)[Nature]][]) {
      if (d.reduced === stat && d.boosted === preferBoosted) return n;
    }
    for (const [n, d] of Object.entries(NATURE_DATA) as [Nature, (typeof NATURE_DATA)[Nature]][]) {
      if (d.reduced === stat) return n;
    }
  } else {
    const keepBoosted = current.boosted !== stat ? current.boosted : null;
    const keepReduced = current.reduced !== stat ? current.reduced : null;
    if (keepBoosted === null && keepReduced === null) return "hardy";
    for (const [n, d] of Object.entries(NATURE_DATA) as [Nature, (typeof NATURE_DATA)[Nature]][]) {
      if (d.boosted !== stat && d.reduced !== stat && d.boosted === keepBoosted && d.reduced === keepReduced) return n;
    }
    for (const [n, d] of Object.entries(NATURE_DATA) as [Nature, (typeof NATURE_DATA)[Nature]][]) {
      if (d.boosted !== stat && d.reduced !== stat && d.boosted === keepBoosted) return n;
    }
    for (const [n, d] of Object.entries(NATURE_DATA) as [Nature, (typeof NATURE_DATA)[Nature]][]) {
      if (d.boosted !== stat && d.reduced !== stat) return n;
    }
  }
  return currentNature;
}

type NumpadType = "ev" | "final";
type NumpadTarget = { key: StatKey; type: NumpadType };

export default function StatEditor(props: Props) {
  const {
    baseStats, level, nature, evs,
    abilities, selectedAbility, selectedItem, pokemonSlug, statRanks,
    onLevelChange, onNatureChange, onEvChange,
    onAbilityChange, onItemChange, onStatRankChange,
    hpSlot, visibleStats,
  } = props;

  // ポケモン別にアイテムをソート（推奨アイテムを上位に）
  const sortedItems = useMemo((): ItemEntry[] => {
    const recommended = pokemonSlug ? (POKEMON_ITEM_USAGE[pokemonSlug] ?? []) : [];
    if (recommended.length === 0) return ITEMS;
    const recSet = new Set(recommended);
    const recIndex = new Map(recommended.map((s, i) => [s, i]));
    // 「なし」を先頭、推奨アイテムを次、残りを元の順序で
    const none = ITEMS.filter((i) => i.slug === "");
    const rec = ITEMS.filter((i) => recSet.has(i.slug)).sort((a, b) => (recIndex.get(a.slug) ?? 99) - (recIndex.get(b.slug) ?? 99));
    const rest = ITEMS.filter((i) => i.slug !== "" && !recSet.has(i.slug));
    return [...none, ...rec, ...rest];
  }, [pokemonSlug]);

  // 個体値31固定で実数値計算
  const finals = calcAllStats(baseStats, FIXED_IVS, evs, level, nature);
  const { boosted, reduced } = NATURE_DATA[nature];
  const totalEv = Object.values(evs).reduce((a, b) => a + b, 0);

  const [activeTarget, setActiveTarget] = useState<NumpadTarget | null>(null);
  const [numpadStr, setNumpadStr] = useState("");
  const [numpadPos, setNumpadPos] = useState<{ top: number; left: number } | null>(null);

  // スマホ/PC出し分けはCSSクラス(md:hidden / hidden md:block)で行う

  const latestRef = useRef({ activeTarget, numpadStr, totalEv, evs, baseStats, level, nature });
  latestRef.current = { activeTarget, numpadStr, totalEv, evs, baseStats, level, nature };
  const containerRef = useRef<HTMLDivElement>(null);

  const applyAndClose = useCallback(() => {
    const { activeTarget, numpadStr, totalEv, evs, baseStats, level, nature } = latestRef.current;
    if (activeTarget && numpadStr !== "") {
      const val = parseInt(numpadStr, 10);
      if (!isNaN(val)) {
        if (activeTarget.type === "ev") {
          const clamped = Math.min(252, Math.max(0, val));
          const others = totalEv - evs[activeTarget.key];
          onEvChange(activeTarget.key, Math.min(clamped, 510 - others));
        } else {
          // final → EV逆算（IV=31固定）
          const ev = calcEvForTarget(val, baseStats[activeTarget.key], level, nature, activeTarget.key);
          const others = totalEv - evs[activeTarget.key];
          onEvChange(activeTarget.key, Math.min(ev, 510 - others));
        }
      }
    }
    setActiveTarget(null);
    setNumpadStr("");
    setNumpadPos(null);
  }, [onEvChange]);

  useEffect(() => {
    if (!activeTarget) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) applyAndClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [activeTarget, applyAndClose]);

  /** テンキーを開く。0ベース入力（常にクリアして開始） */
  const openNumpad = (key: StatKey, type: NumpadType, _val: number, triggerEl?: HTMLButtonElement | null) => {
    if (triggerEl) {
      const rect = triggerEl.getBoundingClientRect();
      setNumpadPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
    }
    setActiveTarget({ key, type });
    setNumpadStr("");
  };

  /** 数字ボタン押下 */
  const handleDigit = (d: string) => {
    setNumpadStr((prev) => {
      const next = prev === "0" ? d : prev + d;
      const num = parseInt(next, 10);
      if (isNaN(num)) return prev;
      const { activeTarget } = latestRef.current;
      if (!activeTarget) return prev;
      if (activeTarget.type === "ev" && num > 252) return prev;
      if (activeTarget.type === "final" && num > 9999) return prev;
      return next;
    });
  };

  const handleMax = () => {
    const { activeTarget, baseStats, level, nature } = latestRef.current;
    if (!activeTarget) return;
    if (activeTarget.type === "ev") { setNumpadStr("252"); return; }
    const v = activeTarget.key === "hp"
      ? calcHp(baseStats[activeTarget.key], 31, 252, level)
      : calcStat(baseStats[activeTarget.key], 31, 252, level, nature, activeTarget.key);
    setNumpadStr(String(v));
  };

  const handleMin = () => {
    const { activeTarget, baseStats, level, nature } = latestRef.current;
    if (!activeTarget) return;
    if (activeTarget.type === "ev") { setNumpadStr("0"); return; }
    const v = activeTarget.key === "hp"
      ? calcHp(baseStats[activeTarget.key], 31, 0, level)
      : calcStat(baseStats[activeTarget.key], 31, 0, level, nature, activeTarget.key);
    setNumpadStr(String(v));
  };

  const getMaxLabel = (type: NumpadType, key: StatKey): string => {
    if (type === "ev") return "252";
    return String(key === "hp" ? calcHp(baseStats[key], 31, 252, level) : calcStat(baseStats[key], 31, 252, level, nature, key));
  };
  const getMinLabel = (type: NumpadType, key: StatKey): string => {
    if (type === "ev") return "0";
    return String(key === "hp" ? calcHp(baseStats[key], 31, 0, level) : calcStat(baseStats[key], 31, 0, level, nature, key));
  };

  const hasAnyRank = Object.values(statRanks).some((r) => r !== 0);

  return (
    <div className="space-y-1" ref={containerRef}>
      {/* 特性・持ち物（コンパクト） */}
      <div className="flex gap-2">
        <div className="flex-1 min-w-0">
          <select value={selectedAbility} onChange={(e) => onAbilityChange(e.target.value)}
            className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="">特性を選択</option>
            {abilities.map((a) => (
              <option key={a.slug} value={a.slug}>{getAbilityJaName(a.slug)}{a.isHidden ? " (夢)" : ""}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {selectedItem && (
              <img
                src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${selectedItem}.png`}
                alt=""
                className="w-5 h-5 object-contain flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <select value={selectedItem} onChange={(e) => onItemChange(e.target.value)}
              className="flex-1 min-w-0 border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
              {sortedItems.map((item) => (
                <option key={item.slug} value={item.slug}>{item.ja}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 特性・もちもの直下スロット（防御側HP入力など） */}
      {hpSlot && <div className="border-t pt-2">{hpSlot}</div>}

      {/* ステータス表 — 2段構成 */}
      <div className="space-y-0">
        {/* ヘッダーラベル行 */}
        <div className="grid items-end gap-1 mb-0.5" style={{ gridTemplateColumns: "3rem 1.5rem 1fr 2.8rem 3.2rem" }}>
          <span className="text-[9px] text-gray-400">能力</span>
          <span className="text-[9px] text-gray-400 text-center">種族</span>
          <span className="text-[9px] text-gray-400 text-center">努力値</span>
          <span className="text-[9px] text-gray-400 text-center">努力値</span>
          <span className="text-[9px] text-gray-400 text-center">実数値</span>
        </div>
        {STAT_KEYS.filter((key) => !visibleStats || visibleStats.includes(key)).map((key) => {
          const isUp   = boosted === key;
          const isDown = reduced === key;
          const finalColor = isUp ? "text-red-600 font-bold" : isDown ? "text-blue-600 font-bold" : "text-gray-900 font-semibold";

          const isEvActive    = activeTarget?.key === key && activeTarget.type === "ev";
          const isFinalActive = activeTarget?.key === key && activeTarget.type === "final";

          const displayEv    = isEvActive    ? (numpadStr || "") : String(evs[key]);
          const displayFinal = isFinalActive ? (numpadStr || "") : String(finals[key]);

          const hasNatureMod = NATURE_MOD_KEYS.includes(key);
          const curMod: "up" | "neutral" | "down" = isUp ? "up" : isDown ? "down" : "neutral";

          const isRankKey = (RANK_KEYS as readonly string[]).includes(key);
          const curRank   = isRankKey ? statRanks[key as RankKey] : 0;
          const rankLabel = curRank === 0 ? "±0" : curRank > 0 ? `+${curRank}` : String(curRank);

          return (
            <div key={key} className="border-b border-gray-100 py-1">
              {/* 1段目: 能力名 + 種族値 + スライダー + EV + 実数値 */}
              <div className="grid items-center gap-1" style={{ gridTemplateColumns: "3rem 1.5rem 1fr 2.8rem 3.2rem" }}>
                <span className="text-gray-600 font-medium text-xs whitespace-nowrap">{STAT_NAMES_JA[key]}</span>
                <span className="text-[10px] text-gray-400 text-center">{baseStats[key]}</span>
                <div className="flex items-center gap-0.5 min-w-0">
                  <button className="text-[9px] px-0.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold flex-shrink-0"
                    onMouseDown={(e) => { e.preventDefault(); onEvChange(key, 0); }}>0</button>
                  <input type="range" min={0} max={252} step={4} value={evs[key]}
                    onChange={(e) => { const v = Math.min(252, Math.max(0, +e.target.value)); const others = totalEv - evs[key]; onEvChange(key, Math.min(v, 510 - others)); }}
                    className="flex-1 h-1 accent-blue-500 min-w-0" />
                  <button className="text-[9px] px-0.5 py-0.5 rounded bg-orange-100 hover:bg-orange-200 text-orange-700 font-bold flex-shrink-0"
                    onMouseDown={(e) => { e.preventDefault(); const others = totalEv - evs[key]; onEvChange(key, Math.min(252, 510 - others)); }}>252</button>
                </div>
                <div className="relative">
                  <button
                    className={`w-full border rounded text-center text-[11px] py-0.5 transition-colors ${isEvActive ? "border-blue-400 ring-1 ring-blue-200 bg-blue-50 text-blue-800" : "border-gray-200 hover:border-blue-300 text-gray-700"}`}
                    onMouseDown={(e) => { e.preventDefault(); isEvActive ? applyAndClose() : openNumpad(key, "ev", evs[key], e.currentTarget); }}
                  >{displayEv !== "" ? displayEv : "—"}</button>
                  {isEvActive && <NumpadPopup value={numpadStr} maxLabel={getMaxLabel("ev", key)} minLabel={getMinLabel("ev", key)} onDigit={handleDigit} onClear={() => setNumpadStr("")} onMax={handleMax} onMin={handleMin} pos={numpadPos ?? undefined} />}
                </div>
                <div className="relative">
                  <button
                    className={`w-full text-center text-sm rounded-lg py-0.5 border-2 transition-colors ${finalColor} ${isFinalActive ? "border-blue-400 ring-1 ring-blue-200 bg-blue-50" : "border-transparent hover:border-gray-300 hover:bg-gray-50"}`}
                    onMouseDown={(e) => { e.preventDefault(); isFinalActive ? applyAndClose() : openNumpad(key, "final", finals[key], e.currentTarget); }}
                    title="クリック→EV逆算"
                  >{displayFinal !== "" ? displayFinal : "—"}</button>
                  {isFinalActive && <NumpadPopup value={numpadStr} maxLabel={getMaxLabel("final", key)} minLabel={getMinLabel("final", key)} onDigit={handleDigit} onClear={() => setNumpadStr("")} onMax={handleMax} onMin={handleMin} pos={numpadPos ?? undefined} />}
                </div>
              </div>

              {/* 2段目: 性格補正 + ランク */}
              {(hasNatureMod || isRankKey) && (
                <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1 ml-8">
                  {/* 性格補正 */}
                  {hasNatureMod && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400 flex-shrink-0">性格</span>
                      <div className="flex gap-1">
                        {(["down", "neutral", "up"] as const).map((mod) => {
                          const active = curMod === mod;
                          const label  = mod === "up" ? "↑1.1" : mod === "down" ? "↓0.9" : "1.0";
                          const cls = active
                            ? mod === "up" ? "bg-red-500 text-white border-red-500 shadow-sm"
                              : mod === "down" ? "bg-blue-500 text-white border-blue-500 shadow-sm"
                              : "bg-gray-400 text-white border-gray-400 shadow-sm"
                            : mod === "up" ? "border-red-200 text-red-300 hover:bg-red-50 hover:text-red-500"
                              : mod === "down" ? "border-blue-200 text-blue-300 hover:bg-blue-50 hover:text-blue-500"
                              : "border-gray-200 text-gray-300 hover:bg-gray-50 hover:text-gray-500";
                          return (
                            <button key={mod}
                              className={`text-[11px] px-2 py-1 rounded-lg border font-bold transition-colors cursor-pointer select-none min-w-[2.2rem] text-center ${cls}`}
                              onMouseDown={(e) => { e.preventDefault(); if (!active) onNatureChange(pickNatureForMod(key, mod, nature)); }}
                            >{label}</button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ランク */}
                  {isRankKey && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400 flex-shrink-0">ランク</span>
                      <button
                        className="w-7 h-7 rounded-lg border-2 border-blue-200 bg-blue-50 hover:bg-blue-200 active:bg-blue-300 text-blue-700 text-sm font-bold flex items-center justify-center transition-colors"
                        onMouseDown={(e) => { e.preventDefault(); onStatRankChange(key as RankKey, Math.max(-6, curRank - 1)); }}
                      >−</button>
                      <span
                        className={`min-w-[2rem] text-center text-xs font-bold py-1 px-1 rounded-lg cursor-pointer select-none ${
                          curRank > 0 ? "text-red-700 bg-red-100 ring-2 ring-red-300" :
                          curRank < 0 ? "text-blue-700 bg-blue-100 ring-2 ring-blue-300" :
                          "text-gray-400 bg-gray-50"
                        }`}
                        onDoubleClick={() => onStatRankChange(key as RankKey, 0)}
                        title="ダブルクリックでリセット"
                      >{rankLabel}</span>
                      <button
                        className="w-7 h-7 rounded-lg border-2 border-red-200 bg-red-50 hover:bg-red-200 active:bg-red-300 text-red-700 text-sm font-bold flex items-center justify-center transition-colors"
                        onMouseDown={(e) => { e.preventDefault(); onStatRankChange(key as RankKey, Math.min(6, curRank + 1)); }}
                      >＋</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* フッター */}
        <div className="flex items-center justify-between mt-1.5 pt-1">
          <p className="text-[10px] text-gray-400">
            努力値合計: <span className={totalEv > 510 ? "text-red-500 font-bold" : ""}>{totalEv}</span>/510
          </p>
          {hasAnyRank && (
            <button
              className="text-[10px] text-gray-400 underline hover:text-gray-600"
              onClick={() => {
                onStatRankChange("attack", 0); onStatRankChange("spAtk", 0);
                onStatRankChange("defense", 0); onStatRankChange("spDef", 0);
              }}
            >ランクリセット</button>
          )}
        </div>
      </div>
    </div>
  );
}
