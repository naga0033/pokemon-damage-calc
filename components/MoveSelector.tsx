"use client";
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { fetchMove } from "@/lib/pokeapi";
import type { MoveData, WeatherCondition, TerrainCondition } from "@/lib/types";
import TypeBadge from "./TypeBadge";
import { getMoveJaName } from "@/lib/move-names";
import { MOVE_METADATA, POPULAR_MOVE_SLUGS, POKEMON_MOVE_PRIORITY, type MoveMeta } from "@/lib/move-metadata";
import { POKEMON_MOVE_USAGE } from "@/lib/move-usage";
import { KanaKeyboard } from "@/components/KanaKeyboard";

// ───────────────────────────────────────
// ツールチップコンポーネント
// ───────────────────────────────────────
function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative inline-block ml-0.5 cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="text-[10px] text-gray-400 hover:text-blue-500 select-none font-bold border border-gray-300 rounded-full w-3.5 h-3.5 inline-flex items-center justify-center leading-none">i</span>
      {show && (
        <span className="absolute z-[500] bottom-full left-1/2 -translate-x-1/2 mb-1 w-52 bg-gray-800 text-white text-[11px] rounded-lg px-3 py-2 pointer-events-none shadow-xl leading-relaxed whitespace-pre-wrap">
          {text}
        </span>
      )}
    </span>
  );
}

const WEATHER_TIPS: Record<string, string> = {
  sun:  "ほのお技×1.5倍・みず技×0.5倍\nソーラービームが即発動",
  rain: "みず技×1.5倍・ほのお技×0.5倍\nかみなりの命中率100%",
  sand: "岩・鋼・地面以外が毎ターンHP1/16削れる\n岩タイプ特防+50%",
  snow: "氷タイプの防御+50%（SV仕様）",
};
const TERRAIN_TIPS: Record<string, string> = {
  electric: "電気技×1.3倍\n地面にいる側がねむり状態にならない",
  grassy:   "草技×1.3倍\nねこだまし・じしん・マグニチュード×0.5倍",
  misty:    "状態異常技が無効（地面にいる側）\nドラゴン技×0.5倍",
  psychic:  "エスパー技×1.3倍\n優先度マイナス技が無効（地面にいる側）",
};

const WEATHER_OPTIONS: { value: WeatherCondition; label: string }[] = [
  { value: "none", label: "なし" },
  { value: "sun",  label: "晴れ" },
  { value: "rain", label: "雨" },
  { value: "sand", label: "砂嵐" },
  { value: "snow", label: "雪" },
];
const TERRAIN_OPTIONS: { value: TerrainCondition; label: string }[] = [
  { value: "none",     label: "なし" },
  { value: "electric", label: "エレキ" },
  { value: "grassy",   label: "グラス" },
  { value: "misty",    label: "ミスト" },
  { value: "psychic",  label: "サイコ" },
];

interface Props {
  moveNames: string[];
  pokemonSlug?: string;         // ポケモンのスラッグ（採用率順表示に使用）
  pokemonTypes?: string[];      // ポケモンのタイプ（ヒューリスティック並び順に使用）
  registeredMoves?: string[];   // 登録個体から呼び出した場合の優先表示技
  selectedMove: MoveData | null;
  onMoveSelect: (move: MoveData) => void;
  isCritical: boolean;
  onCriticalChange: (v: boolean) => void;
  hitCount: number;
  onHitCountChange: (v: number) => void;
  critCount: number;
  onCritCountChange: (v: number) => void;
  attackerAbility?: string;
  attackerItem?: string;
  isBurned: boolean;
  onBurnedChange: (v: boolean) => void;
  isCharged: boolean;
  onChargedChange: (v: boolean) => void;
  weather: WeatherCondition;
  onWeatherChange: (v: WeatherCondition) => void;
  terrain: TerrainCondition;
  onTerrainChange: (v: TerrainCondition) => void;
}

const CATEGORY_LABEL: Record<string, string> = {
  physical: "物理",
  special:  "特殊",
  status:   "変化",
};

const CATEGORY_COLOR: Record<string, string> = {
  physical: "bg-orange-100 text-orange-700",
  special:  "bg-blue-100 text-blue-700",
  status:   "bg-gray-200 text-gray-600",
};

const TOP_MOVES = 10; // 採用率セクションに表示する技数

export default function MoveSelector({
  moveNames, pokemonSlug, pokemonTypes, registeredMoves, selectedMove, onMoveSelect,
  isCritical, onCriticalChange,
  hitCount, onHitCountChange, critCount, onCritCountChange,
  attackerAbility, attackerItem,
  isBurned, onBurnedChange,
  isCharged, onChargedChange,
  weather, onWeatherChange, terrain, onTerrainChange,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showKanaKb, setShowKanaKb] = useState(false);
  const inputRef    = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);
  const kanaKbRef   = useRef<HTMLDivElement>(null);
  const isFirstKbKey = useRef(false);

  // activeIndex が変わったらスクロール
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // queryが変わったらactivaIndexをリセット
  useEffect(() => { setActiveIndex(-1); }, [query]);

  // 外部から selectedMove が変わった場合、query を同期
  useEffect(() => {
    if (selectedMove) {
      setQuery(selectedMove.japaneseName);
      setOpen(false);
    } else {
      setQuery("");
    }
  }, [selectedMove]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node) &&
        !kanaKbRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const moveList = useMemo(() => {
    return moveNames.map((slug) => ({ slug, ja: getMoveJaName(slug) }));
  }, [moveNames]);

  // 3段階フォールバック: Smogon採用率 → タイプ一致ヒューリスティック → グローバルリスト
  const perPokemonPriority = useMemo(() => {
    if (!pokemonSlug) return null;

    // 1. 手動オーバーライド + Smogon採用率データ
    const signatureMoves = POKEMON_MOVE_PRIORITY[pokemonSlug] ?? [];
    const usageMoves = POKEMON_MOVE_USAGE[pokemonSlug] ?? [];
    if (signatureMoves.length > 0 || usageMoves.length > 0) {
      const signatureSet = new Set(signatureMoves);
      return [...signatureMoves, ...usageMoves.filter((m) => !signatureSet.has(m))];
    }

    // 2. データがない場合: タイプ一致技 → 高威力技 のヒューリスティック
    if (pokemonTypes && pokemonTypes.length > 0 && moveNames.length > 0) {
      const typeSet = new Set(pokemonTypes);
      const scored = moveNames
        .map((slug) => {
          const meta = MOVE_METADATA[slug];
          if (!meta) return { slug, score: 0 };
          // STAB(タイプ一致) = +200, 攻撃技 = +100, 威力ボーナス
          const isStab = typeSet.has(meta.type) ? 200 : 0;
          const isAttack = meta.category !== "status" ? 100 : 0;
          const power = meta.power ?? 0;
          return { slug, score: isStab + isAttack + power };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP_MOVES);

      if (scored.length > 0 && scored[0].score > 0) {
        return scored.map((s) => s.slug);
      }
    }

    return null;
  }, [pokemonSlug, pokemonTypes, moveNames]);
  const hasPriority = perPokemonPriority !== null;

  // 2層構造: { popularItems, allItems, isFiltered }
  const { displayItems, popularCount, isFiltered } = useMemo(() => {
    const q = query.trim().toLowerCase();

    // 変化技を除外するヘルパー（物理・特殊の攻撃技のみ表示）
    const isDamaging = (slug: string) => {
      const meta = MOVE_METADATA[slug];
      return !meta || meta.category !== "status";
    };

    if (q) {
      // 検索クエリあり：前方一致 → 部分一致で絞り込む（フラット）
      const isJa = /[ぁ-ん|ァ-ヶ]/.test(q);
      const filtered = moveList.filter((m) => isDamaging(m.slug));
      let results: typeof moveList;
      if (isJa) {
        const prefix   = filtered.filter((m) => m.ja.startsWith(query.trim()));
        const contains = filtered.filter((m) => !m.ja.startsWith(query.trim()) && m.ja.includes(query.trim()));
        results = [...prefix, ...contains].slice(0, 40);
      } else {
        const prefix   = filtered.filter((m) => m.slug.startsWith(q));
        const contains = filtered.filter((m) => !m.slug.startsWith(q) && m.slug.includes(q));
        results = [...prefix, ...contains].slice(0, 40);
      }
      return { displayItems: results, popularCount: 0, isFiltered: true };
    }

    // 採用率優先リスト（ポケモン専用 or グローバル）
    const priorityList = perPokemonPriority ?? POPULAR_MOVE_SLUGS;
    const prioritySet   = new Set(priorityList);
    const priorityIndex = new Map(priorityList.map((s, i) => [s, i]));

    // 採用率セクション: 変化技も含めてそのまま表示（Smogon採用率順）
    const popular = moveList
      .filter((m) => prioritySet.has(m.slug))
      .sort((a, b) => (priorityIndex.get(a.slug) ?? 9999) - (priorityIndex.get(b.slug) ?? 9999));

    // その他セクション: 攻撃技のみ（五十音順）
    const rest = moveList
      .filter((m) => !prioritySet.has(m.slug) && isDamaging(m.slug))
      .sort((a, b) => a.ja.localeCompare(b.ja, "ja"));

    return {
      displayItems: [...popular, ...rest],
      popularCount: popular.length,
      isFiltered: false,
    };
  }, [query, moveList, perPokemonPriority]);

  const handleSelect = useCallback(async (slug: string) => {
    setOpen(false);
    setShowKanaKb(false);
    setQuery(getMoveJaName(slug));
    setLoading(true);
    try {
      const move = await fetchMove(slug);
      const cachedJa = getMoveJaName(slug);
      onMoveSelect({ ...move, japaneseName: cachedJa !== slug ? cachedJa : move.japaneseName });
      (document.activeElement as HTMLElement)?.blur();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [onMoveSelect]);

  return (
    <div className="space-y-3">
      {/* 技検索 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">使用する技</label>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder="技名を入力（例：じしん、りゅうせいぐん）"
            onFocus={() => setOpen(true)}
            onClick={() => { setQuery(""); setOpen(true); setActiveIndex(-1); }}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onKeyDown={(e) => {
              if (!open || displayItems.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, displayItems.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, -1));
              } else if (e.key === "Enter" && activeIndex >= 0) {
                e.preventDefault();
                handleSelect(displayItems[activeIndex].slug);
              } else if (e.key === "Escape") {
                setOpen(false);
                setActiveIndex(-1);
              }
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 pr-20"
          />
          {/* かなキーボード トグルボタン */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowKanaKb((v) => {
                if (!v) {
                  setTimeout(() => inputRef.current?.focus(), 0);
                  isFirstKbKey.current = true;
                }
                return !v;
              });
            }}
            className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 rounded font-bold transition-colors hidden md:inline-block ${
              showKanaKb
                ? "bg-indigo-500 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-indigo-100 hover:text-indigo-600"
            }`}
            title="かな入力キーボード"
          >キーボード</button>
          {loading && (
            <div className="absolute right-16 top-2.5">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Switch風かなキーボード */}
          {showKanaKb && (
            <div ref={kanaKbRef}>
              <KanaKeyboard
                value={query}
                onChange={(v) => { setQuery(v); setOpen(true); }}
                onClose={() => setShowKanaKb(false)}
                defaultMode="hiragana"
                freshRef={isFirstKbKey}
              />
            </div>
          )}

          {open && displayItems.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-72 overflow-y-auto"
            >
              {/* 登録済みの技セクション（registeredMoves があり、クエリなし時のみ） */}
              {!isFiltered && registeredMoves && registeredMoves.length > 0 && (
                <>
                  <div className="px-3 py-1 text-[11px] text-gray-600 bg-gray-50 border-b border-gray-200 font-bold sticky top-0">
                    📌 登録済みの技
                  </div>
                  {registeredMoves.filter(Boolean).filter((slug) => { const m = MOVE_METADATA[slug]; return !m || m.category !== "status"; }).map((slug) => {
                    const ja = getMoveJaName(slug);
                    const meta = MOVE_METADATA[slug];
                    return (
                      <button
                        key={"reg-" + slug}
                        className="w-full text-left px-3 py-1.5 flex items-center gap-2 transition-colors border-b border-gray-50 hover:bg-gray-50 active:bg-gray-100"
                        onMouseDown={() => handleSelect(slug)}
                      >
                        {meta ? <TypeBadge type={meta.type} size="sm" /> : <span className="inline-block w-10 h-5 bg-gray-100 rounded-full flex-shrink-0" />}
                        <span className="font-medium text-gray-900 text-sm flex-1 min-w-0 truncate">{ja}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {meta && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CATEGORY_COLOR[meta.category]}`}>{CATEGORY_LABEL[meta.category]}</span>}
                          <span className="text-xs text-gray-500 font-mono w-8 text-right">{meta?.power != null ? meta.power : meta ? "—" : ""}</span>
                        </div>
                      </button>
                    );
                  })}
                  <div className="px-3 py-0.5 text-[10px] text-gray-600 bg-gray-50 border-b border-gray-200 font-bold">
                    ⭐ よく使う技
                  </div>
                </>
              )}
              {/* 検索クエリなし：2層セクション表示 */}
              {!isFiltered && (!registeredMoves || registeredMoves.length === 0) && (
                <div className="px-3 py-1 text-[11px] text-gray-600 bg-gray-50 border-b border-gray-200 font-bold sticky top-0 flex items-center gap-1">
                  {hasPriority ? "📊 採用率順" : "⭐ よく使う技"}
                  <span className="font-normal text-gray-400">({popularCount})</span>
                </div>
              )}
              {/* 検索クエリあり：ヘッダー */}
              {isFiltered && (
                <div className="px-3 py-1 text-[11px] text-gray-400 bg-gray-50 border-b border-gray-100 font-semibold sticky top-0">
                  🔍 「{query.trim()}」の検索結果 ({displayItems.length}件)
                </div>
              )}

              {displayItems.map((m, idx) => {
                const meta = MOVE_METADATA[m.slug];
                const isActive = idx === activeIndex;
                // 「すべての技」セクション見出し（クエリなし時のみ）
                const showAllHeader = !isFiltered && idx === popularCount;
                return (
                  <div key={m.slug}>
                    {showAllHeader && (
                      <div className="px-3 py-1 text-[11px] text-gray-500 bg-gray-50 border-y border-gray-200 font-bold sticky top-[28px] flex items-center gap-1">
                        📚 その他の攻撃技（五十音順）<span className="font-normal text-blue-400">({displayItems.length - popularCount})</span>
                      </div>
                    )}
                    <button
                      ref={isActive ? activeItemRef : null}
                      className={`w-full text-left px-3 py-1.5 flex items-center gap-2 transition-colors border-b border-gray-50 last:border-0 ${
                        isActive ? "bg-gray-100 outline-none" : "hover:bg-gray-50 active:bg-gray-100"
                      }`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onMouseDown={() => handleSelect(m.slug)}
                    >
                      {meta ? (
                        <TypeBadge type={meta.type} size="sm" />
                      ) : (
                        <span className="inline-block w-10 h-5 bg-gray-100 rounded-full flex-shrink-0" />
                      )}
                      <span className="font-medium text-gray-900 text-sm flex-1 min-w-0 truncate">{m.ja}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {meta && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CATEGORY_COLOR[meta.category]}`}>
                            {CATEGORY_LABEL[meta.category]}
                          </span>
                        )}
                        <span className="text-xs text-gray-500 font-mono w-8 text-right">
                          {meta?.power != null ? meta.power : meta ? "—" : ""}
                        </span>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 技詳細 */}
      {selectedMove && (
        <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-800">{selectedMove.japaneseName}</span>
            <TypeBadge type={selectedMove.type} size="sm" />
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLOR[selectedMove.category] ?? "bg-gray-200 text-gray-600"}`}>
              {CATEGORY_LABEL[selectedMove.category] ?? selectedMove.category}
            </span>
          </div>
          <div className="flex gap-4 text-sm text-gray-600 flex-wrap">
            <span>威力: <strong className="text-gray-900">{selectedMove.power ?? "—"}</strong></span>
            <span>命中: <strong className="text-gray-900">{selectedMove.accuracy ?? "—"}</strong></span>
            {(selectedMove as MoveData & { pp?: number }).pp != null && (
              <span>PP: <strong className="text-gray-900">{(selectedMove as MoveData & { pp?: number }).pp}</strong></span>
            )}
            {selectedMove.priority !== 0 && (
              <span>優先度: <strong className="text-gray-900">{selectedMove.priority > 0 ? `+${selectedMove.priority}` : selectedMove.priority}</strong></span>
            )}
          </div>
        </div>
      )}

      {/* 特殊参照技の注記（技詳細の直下） */}
      {selectedMove && MOVE_METADATA[selectedMove.name]?.statOverride === "body-press" && (
        <div className="text-xs bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 text-orange-700">
          ボディプレス: 自分の<strong>防御（B）</strong>の実数値とランク補正を攻撃力として計算
        </div>
      )}
      {selectedMove && MOVE_METADATA[selectedMove.name]?.statOverride === "foul-play" && (
        <div className="text-xs bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5 text-purple-700">
          イカサマ: 相手の<strong>攻撃（A）</strong>の実数値とランク補正を参照して計算
        </div>
      )}

      {/* 連続技セレクター（技詳細の直下） */}
      {(() => {
        const meta: MoveMeta | undefined = selectedMove ? MOVE_METADATA[selectedMove.name] : undefined;
        if (!meta?.hits) return null;
        const [minH, maxH] = meta.hits;
        const maxDisplay = Math.min(maxH, 10);
        // 攻撃回数: 1回 〜 最大回数
        const hitOptions = Array.from({ length: maxDisplay }, (_, i) => i + 1);
        return (
          <div className="flex flex-wrap items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <span className="text-sm font-medium text-gray-700">🔄 連続技</span>
            <label className="flex items-center gap-1.5 text-sm">
              <span className="text-gray-600">攻撃回数</span>
              <select
                value={hitCount}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  onHitCountChange(v);
                  if (critCount > v) onCritCountChange(v);
                }}
                className="border rounded px-2 py-0.5 text-sm bg-white"
              >
                {hitOptions.map((n) => <option key={n} value={n}>{n}回</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <span className="text-gray-600">急所回数</span>
              <select
                value={critCount}
                onChange={(e) => onCritCountChange(Number(e.target.value))}
                className="border rounded px-2 py-0.5 text-sm bg-white"
              >
                {Array.from({ length: hitCount + 1 }, (_, i) => i).map((n) => (
                  <option key={n} value={n}>{n}回</option>
                ))}
              </select>
            </label>
            {meta.alwaysCrit && (
              <span className="text-xs text-red-600 font-medium">※確定急所</span>
            )}
            {attackerAbility === "skill-link" && (
              <span className="text-xs text-gray-500 font-medium">スキルリンク: 最大回数</span>
            )}
            {attackerItem === "loaded-dice" && minH !== maxH && (
              <span className="text-xs text-green-600 font-medium">いかさまダイス: 4〜5回</span>
            )}
          </div>
        );
      })()}

    </div>
  );
}
