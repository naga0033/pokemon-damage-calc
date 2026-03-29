"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { fetchPokemon } from "@/lib/pokeapi";
import type { PokemonData, PokemonState } from "@/lib/types";
import { searchByJaName, getEnSlug, EN_TO_JA } from "@/lib/pokemon-names";
import { USAGE_RANKING } from "@/lib/usage-ranking";
import { POKEMON_IDS } from "@/lib/pokemon-ids";
import { loadBox, loadTeams, BoxEntry, BattleTeam } from "@/lib/box-storage";
import { NATURE_DATA, calcAllStats } from "@/lib/stats";
import { KanaKeyboard } from "@/components/KanaKeyboard";
import { MOVE_NAMES_JA } from "@/lib/move-names";
import { getAbilityJaName } from "@/lib/ability-names";
import { TYPE_COLORS, TYPE_NAMES_JA } from "@/lib/type-chart";
import { ITEM_MAP } from "@/lib/items";

interface Props {
  onSelect: (pokemon: PokemonData) => void;
  label: string;
  pokemonName?: string;
  placeholder?: string;
  onBoxSelect?: (state: PokemonState, moves?: string[]) => void;
}

interface SearchResult {
  name: string;
  ja: string;
  id?: number;
  boxEntry?: BoxEntry;
}

export default function PokemonSearch({ onSelect, label, pokemonName, placeholder, onBoxSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const [boxEntries, setBoxEntries] = useState<BoxEntry[]>([]);
  const [teams, setTeams] = useState<BattleTeam[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [showKanaKb, setShowKanaKb] = useState(false);

  // 登録ポケモン専用パネル
  const [boxPanelOpen, setBoxPanelOpen] = useState(false);
  const [boxPanelTab, setBoxPanelTab] = useState<"team" | "box">("team");

  const itemRefs    = useRef<(HTMLButtonElement | null)[]>([]);
  const inputRef    = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const kanaKbRef   = useRef<HTMLDivElement>(null);   // キーボードパネル ref（close-handler 除外用）
  const boxBtnRef   = useRef<HTMLButtonElement>(null);
  const boxPanelRef = useRef<HTMLDivElement>(null);
  const isFirstKbKey = useRef(false); // キーボードを開いた直後の最初のキー入力でクリア

  // pokemonName が外部から変わったとき（ポケモン選択後）に query を同期
  useEffect(() => {
    if (pokemonName !== undefined) {
      setQuery(pokemonName);
      setOpen(false);
      setShowRanking(false);
    }
  }, [pokemonName]);

  // 検索ドロップダウンの外側クリックで閉じる
  // ※ カナキーボードパネル内のクリックは除外（インクリメンタルサーチを維持）
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node) &&
        !kanaKbRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
        setShowRanking(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // 登録ポケモンパネルの外側クリックで閉じる
  useEffect(() => {
    if (!boxPanelOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        boxPanelRef.current  && !boxPanelRef.current.contains(e.target as Node) &&
        boxBtnRef.current    && !boxBtnRef.current.contains(e.target as Node)
      ) {
        setBoxPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [boxPanelOpen]);

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    setShowRanking(false);
    setFocusedIndex(-1);

    if (!value.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    const isJa = /[ぁ-ん|ァ-ヶ|一-龠々]/.test(value);
    if (isJa) {
      const found = searchByJaName(value);
      setResults(found.map((f) => ({ name: f.name, ja: f.ja })));
    } else {
      const q = value.toLowerCase().replace(/\s+/g, "-");
      const matched: SearchResult[] = [];
      for (const [en, ja] of Object.entries(EN_TO_JA)) {
        if (en.startsWith(q)) matched.push({ name: en, ja });
      }
      for (const [en, ja] of Object.entries(EN_TO_JA)) {
        if (!en.startsWith(q) && en.includes(q)) matched.push({ name: en, ja });
      }
      setResults(matched.slice(0, 8));
    }
    setOpen(true);
  }, []);

  const handleFocus = useCallback(() => {
    inputRef.current?.select();
    // 常にランキング（全一覧）を表示して即座に選べるようにする
    setShowRanking(true);
    setOpen(true);
    setFocusedIndex(-1);
    setBoxEntries(loadBox());
    setTeams(loadTeams());
  }, [query]);

  const handleSelect = useCallback(async (entry: SearchResult) => {
    setOpen(false);
    setShowRanking(false);
    setShowKanaKb(false);
    setQuery(entry.ja || entry.name);
    setLoading(true);
    try {
      const poke = await fetchPokemon(entry.name);
      setQuery(poke.japaneseName || poke.name);
      onSelect(poke);
      (document.activeElement as HTMLElement)?.blur();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [onSelect]);

  const handleBoxSelect = useCallback((entry: BoxEntry) => {
    setOpen(false);
    setShowRanking(false);
    setShowKanaKb(false);
    setBoxPanelOpen(false);
    const jaName = entry.state.pokemon?.japaneseName || "";
    setQuery(jaName);
    if (onBoxSelect) {
      onBoxSelect(entry.state, entry.moves);
    } else if (entry.state.pokemon) {
      onSelect(entry.state.pokemon);
    }
    (document.activeElement as HTMLElement)?.blur();
  }, [onBoxSelect, onSelect]);

  // 登録ポケモンボタンをクリック
  const handleBoxBtnClick = useCallback(() => {
    const fresh = loadBox();
    setBoxEntries(fresh);
    setTeams(loadTeams());
    setBoxPanelOpen((prev) => !prev);
    setOpen(false);
    setShowRanking(false);
  }, []);

  const rankingList: SearchResult[] = USAGE_RANKING.map((r) => ({ name: r.name, ja: r.ja, id: r.id }));
  const rankingNames = new Set(USAGE_RANKING.map((r) => r.name));
  const remainingSorted: SearchResult[] = Object.entries(EN_TO_JA)
    .filter(([en]) => !rankingNames.has(en))
    .sort(([, jaA], [, jaB]) => jaA.localeCompare(jaB, "ja"))
    .map(([en, ja]) => ({ name: en, ja }));
  const fullRankingList: SearchResult[] = [...rankingList, ...remainingSorted];
  const displayList: SearchResult[] = showRanking ? fullRankingList : results;

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => {
        const next = Math.min(prev + 1, displayList.length - 1);
        setTimeout(() => itemRefs.current[next]?.scrollIntoView({ block: "nearest" }), 0);
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => {
        const next = Math.max(prev - 1, -1);
        if (next >= 0) setTimeout(() => itemRefs.current[next]?.scrollIntoView({ block: "nearest" }), 0);
        return next;
      });
    } else if (e.key === "Enter") {
      if (focusedIndex >= 0 && focusedIndex < displayList.length) {
        e.preventDefault();
        handleSelect(displayList[focusedIndex]);
        setFocusedIndex(-1);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setShowRanking(false);
      setFocusedIndex(-1);
    }
  }, [open, focusedIndex, displayList, handleSelect]);

  return (
    <div className="relative w-full">

      {/* ラベル行 + 登録ポケモンボタン */}
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>

        {/* 登録ポケモン専用ボタン（onBoxSelect がある側のみ表示）*/}
        {onBoxSelect && (
          <div className="relative">
            <button
              ref={boxBtnRef}
              onClick={handleBoxBtnClick}
              className={`flex items-center gap-1 text-[11px] px-3 py-1 rounded-md font-medium transition-colors ${
                boxPanelOpen
                  ? "text-white shadow-sm"
                  : "hover:opacity-90"
              }`}
              style={{ backgroundColor: boxPanelOpen ? "#1e88e5" : "#fff", color: boxPanelOpen ? "#fff" : "#1e88e5", border: "1px solid #1e88e5" }}
            >
              登録済のポケモンから選ぶ
            </button>

            {/* 登録ポケモン フルスクリーンパネル */}
            {boxPanelOpen && (
              <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 pt-4" onClick={() => setBoxPanelOpen(false)}>
                <div
                  ref={boxPanelRef}
                  className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col mx-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* ヘッダー */}
                  <div className="bg-gradient-to-r from-amber-500 to-amber-400 text-white px-5 py-3 flex items-center justify-between flex-shrink-0">
                    <h2 className="text-base font-bold">ダメージ計算するポケモンを選ぶ</h2>
                    <button onClick={() => setBoxPanelOpen(false)} className="text-white/80 hover:text-white text-xl">✕</button>
                  </div>

                  {/* タブ */}
                  <div className="flex border-b flex-shrink-0">
                    <button
                      className={`flex-1 py-2.5 text-sm font-bold ${boxPanelTab === "team" ? "bg-white text-purple-600 border-b-2 border-purple-600" : "bg-gray-50 text-gray-500"}`}
                      onClick={() => setBoxPanelTab("team")}
                    >
                      バトルチーム ({teams.filter(t => t.memberIds.length > 0).length})
                    </button>
                    <button
                      className={`flex-1 py-2.5 text-sm font-bold ${boxPanelTab === "box" ? "bg-white text-amber-600 border-b-2 border-amber-600" : "bg-gray-50 text-gray-500"}`}
                      onClick={() => setBoxPanelTab("box")}
                    >
                      ボックス ({boxEntries.length})
                    </button>
                  </div>

                  {/* コンテンツ */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {/* ── チームタブ ── */}
                    {boxPanelTab === "team" && (
                      <div>
                        {teams.filter(t => t.memberIds.length > 0).length === 0 ? (
                          <div className="text-center py-12 text-gray-400">
                            <p className="text-sm mb-2 text-gray-300">--</p>
                            <p className="text-sm">バトルチームがありません</p>
                            <p className="text-xs mt-1">ヘッダーの「ボックス」からチームを作成できます</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {teams.filter(t => t.memberIds.length > 0).map((team) => {
                              const members = team.memberIds
                                .map((id) => boxEntries.find((e) => e.id === id))
                                .filter((e): e is BoxEntry => e != null && e.state.pokemon != null);
                              if (members.length === 0) return null;
                              return (
                                <div key={team.id} className="border rounded-xl p-4 hover:shadow-md transition-shadow">
                                  <div className="font-bold text-sm mb-3 text-gray-800">{team.name}</div>
                                  <div className="flex gap-2 flex-wrap">
                                    {members.map((m) => (
                                      <button
                                        key={m.id}
                                        onClick={() => handleBoxSelect(m)}
                                        className="flex flex-col items-center hover:bg-purple-50 rounded-lg p-1.5 transition-colors"
                                        title={`${m.name}を適用`}
                                      >
                                        <img src={m.state.pokemon!.spriteUrl} alt="" className="w-12 h-12 object-contain" />
                                        <span className="text-[9px] font-bold text-gray-600 truncate max-w-[60px]">{m.name}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── ボックスタブ ── */}
                    {boxPanelTab === "box" && (
                      <div>
                        {boxEntries.length === 0 ? (
                          <div className="text-center py-12 text-gray-400">
                            <p className="text-sm mb-2 text-gray-300">--</p>
                            <p className="text-sm">登録済みポケモンはありません</p>
                            <p className="text-xs mt-1">ヘッダーの「+ 登録」から保存できます</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {boxEntries.map((entry) => {
                              const poke = entry.state.pokemon;
                              if (!poke) return null;
                              const stats = calcAllStats(poke.baseStats, entry.state.ivs, entry.state.evs, entry.state.level, entry.state.nature);
                              const abilityJa = getAbilityJaName(entry.state.ability) || entry.state.ability;
                              const itemJa = entry.state.item ? (ITEM_MAP[entry.state.item]?.ja || entry.state.item) : "";
                              const moves = (entry.moves ?? []).filter(Boolean);
                              return (
                                <button
                                  key={entry.id}
                                  onClick={() => handleBoxSelect(entry)}
                                  className="text-left border rounded-xl p-3 hover:border-amber-400 hover:shadow-md transition-all group"
                                >
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <img src={poke.spriteUrl} alt="" className="w-10 h-10 object-contain flex-shrink-0" />
                                    <div className="min-w-0">
                                      <div className="font-bold text-sm text-gray-900 truncate">{entry.name}</div>
                                      <div className="flex gap-0.5 mt-0.5">
                                        {poke.types.map((t) => (
                                          <span key={t} className="px-1.5 py-0 rounded text-[9px] font-bold text-white" style={{ backgroundColor: TYPE_COLORS[t] }}>
                                            {TYPE_NAMES_JA[t]}
                                          </span>
                                        ))}
                                        {entry.state.teraType && (
                                          <span className="px-1.5 py-0 rounded text-[9px] font-bold text-white border border-white/30" style={{ backgroundColor: TYPE_COLORS[entry.state.teraType] }}>
                                            T
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {/* 特性 & 持ち物 */}
                                  <div className="flex gap-2 text-[10px] text-gray-500 mb-1.5">
                                    <span>{abilityJa}</span>
                                    {itemJa && <span className="text-gray-400">/ {itemJa}</span>}
                                  </div>
                                  {/* 技 */}
                                  {moves.length > 0 && (
                                    <div className="grid grid-cols-2 gap-0.5 mb-1.5">
                                      {moves.map((slug, i) => (
                                        <span key={i} className="text-[9px] px-1.5 py-0.5 bg-gray-100 rounded truncate text-gray-600">
                                          {MOVE_NAMES_JA[slug] || slug}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {/* ステ */}
                                  <div className="text-[9px] text-gray-400 flex gap-1">
                                    <span>{stats.hp}</span>-
                                    <span className={entry.state.evs.attack >= 200 ? "text-red-500 font-bold" : ""}>{stats.attack}</span>-
                                    <span className={entry.state.evs.defense >= 200 ? "text-blue-500 font-bold" : ""}>{stats.defense}</span>-
                                    <span className={entry.state.evs.spAtk >= 200 ? "text-red-500 font-bold" : ""}>{stats.spAtk}</span>-
                                    <span className={entry.state.evs.spDef >= 200 ? "text-blue-500 font-bold" : ""}>{stats.spDef}</span>-
                                    <span className={entry.state.evs.speed >= 200 ? "text-green-500 font-bold" : ""}>{stats.speed}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 検索入力 */}
      <div className="relative w-full">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "クリックしてポケモンを選んでね"}
          className="w-full min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 pr-16"
        />
        {/* カタカナキーボード トグルボタン */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowKanaKb((v) => {
              // 開くときに input にフォーカス（以降 key ハンドラで focus() 不要）
              if (!v) {
                setTimeout(() => inputRef.current?.focus(), 0);
                isFirstKbKey.current = true; // 開いた直後の最初のキーで既存文字をクリア
              }
              return !v;
            });
          }}
          className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 rounded font-bold transition-colors hidden md:inline-block ${
            showKanaKb
              ? "bg-indigo-500 text-white"
              : "bg-gray-100 text-gray-500 hover:bg-indigo-100 hover:text-indigo-600"
          }`}
          title="カタカナ入力キーボード"
        >⌨ キーボード</button>
        {loading && (
          <div className="absolute right-12 top-2.5">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Switch風かなキーボード */}
      {showKanaKb && (
        <div ref={kanaKbRef}>
          <KanaKeyboard
            value={query}
            onChange={handleChange}
            onClose={() => setShowKanaKb(false)}
            defaultMode="katakana"
            freshRef={isFirstKbKey}
          />
        </div>
      )}

      {/* 検索ドロップダウン */}
      {open && (showRanking ? true : displayList.length > 0) && (
        <div
          ref={dropdownRef}
          className="absolute z-[250] left-0 w-full min-w-[280px] bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-[65vh] overflow-y-auto"
        >
          {/* ランキングヘッダー */}
          {showRanking && (
            <div className="px-3 py-1.5 text-xs text-gray-500 bg-gray-50 border-b border-gray-100 font-semibold sticky top-0">
              🏆 使用率ランキング → アイウエオ順 全ポケモン
            </div>
          )}

          {/* ランキング or 検索結果 */}
          {displayList.map((entry, idx) => (
            <button
              key={entry.name}
              ref={(el) => { itemRefs.current[idx] = el; }}
              className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-3 transition-colors border-b border-gray-50 last:border-0 ${
                idx === focusedIndex
                  ? "bg-blue-100 text-blue-900"
                  : "hover:bg-blue-50 active:bg-blue-100"
              }`}
              onMouseDown={() => { setFocusedIndex(idx); handleSelect(entry); }}
              onMouseEnter={() => setFocusedIndex(idx)}
            >
              {(() => {
                const pid = entry.id || POKEMON_IDS[entry.name];
                return pid ? (
                  <img
                    src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pid}.png`}
                    alt=""
                    className="w-8 h-8 object-contain flex-shrink-0"
                    loading="lazy"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                  />
                ) : <div className="w-8 h-8 flex-shrink-0" />;
              })()}
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-gray-900 block">{entry.ja}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
