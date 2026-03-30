"use client";
import { useState, useMemo, useRef } from "react";
import type { BoxEntry, BattleTeam } from "@/lib/box-storage";
import { createTeam, updateTeam, deleteTeam, exportBoxToShareString } from "@/lib/box-storage";
import { TYPE_COLORS, TYPE_NAMES_JA } from "@/lib/type-chart";
import { calcAllStats, NATURE_DATA } from "@/lib/stats";
import type { PokemonType, PokemonState } from "@/lib/types";
import { KanaKeyboard } from "@/components/KanaKeyboard";
import { formatPokemonText } from "@/lib/pokemon-text";
import { copyText } from "@/lib/clipboard";

/* ── ソート ── */
type SortMode = "newest" | "dex" | "speed";

function sortEntries(entries: BoxEntry[], mode: SortMode): BoxEntry[] {
  const copy = [...entries];
  switch (mode) {
    case "newest":
      return copy.sort((a, b) => b.createdAt - a.createdAt);
    case "dex":
      return copy.sort((a, b) => (a.state.pokemon?.id ?? 0) - (b.state.pokemon?.id ?? 0));
    case "speed": {
      const getSpd = (e: BoxEntry) => {
        if (!e.state.pokemon) return 0;
        const stats = calcAllStats(e.state.pokemon.baseStats, e.state.ivs, e.state.evs, e.state.level, e.state.nature);
        return stats.speed;
      };
      return copy.sort((a, b) => getSpd(b) - getSpd(a));
    }
  }
}

/* ── Props ── */
interface BoxManagerProps {
  entries: BoxEntry[];
  teams: BattleTeam[];
  onSelectAttacker: (state: PokemonState, moves?: string[]) => void;
  onSelectDefender: (state: PokemonState, moves?: string[]) => void;
  onEdit: (entry: BoxEntry) => void;
  onDelete: (id: string) => void;
  onTeamsChange: (teams: BattleTeam[]) => void;
  onClose: () => void;
}

/* ── メインコンポーネント ── */
export default function BoxManager({ entries, teams, onSelectAttacker, onSelectDefender, onEdit, onDelete, onTeamsChange, onClose }: BoxManagerProps) {
  const [tab, setTab] = useState<"box" | "team">("box");
  const [sort, setSort] = useState<SortMode>("newest");
  const [typeFilter, setTypeFilter] = useState<PokemonType | "all">("all");
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamNameInput, setTeamNameInput] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showKanaKb, setShowKanaKb] = useState(false);
  const isFirstKbKey = useRef(true);

  /* フィルタ済み & ソート済み */
  const filtered = useMemo(() => {
    let list = entries;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) =>
        e.name.toLowerCase().includes(q) ||
        (e.state.pokemon?.japaneseName ?? "").toLowerCase().includes(q)
      );
    }
    if (typeFilter !== "all") {
      list = list.filter((e) => e.state.pokemon?.types.includes(typeFilter));
    }
    return sortEntries(list, sort);
  }, [entries, sort, typeFilter, searchQuery]);

  /* 選択中のポケモン詳細 */
  const selectedEntry = useMemo(
    () => entries.find((e) => e.id === selectedEntryId) ?? null,
    [entries, selectedEntryId]
  );

  /* チーム作成 */
  const handleCreateTeam = () => {
    const name = teamNameInput.trim() || `チーム${teams.length + 1}`;
    const newTeams = createTeam(name);
    onTeamsChange(newTeams);
    setTeamNameInput("");
    // 即座に編集モードに入る
    const created = newTeams[newTeams.length - 1];
    if (created) setEditingTeamId(created.id);
  };

  /* チームにメンバー追加/削除 */
  const toggleTeamMember = (teamId: string, entryId: string) => {
    const team = teams.find((t) => t.id === teamId);
    if (!team) return;
    const has = team.memberIds.includes(entryId);
    const newIds = has
      ? team.memberIds.filter((id) => id !== entryId)
      : team.memberIds.length < 6
        ? [...team.memberIds, entryId]
        : team.memberIds;
    onTeamsChange(updateTeam(teamId, { memberIds: newIds }));
  };

  /* 素早さ計算 */
  const getSpeed = (entry: BoxEntry) => {
    if (!entry.state.pokemon) return 0;
    return calcAllStats(entry.state.pokemon.baseStats, entry.state.ivs, entry.state.evs, entry.state.level, entry.state.nature).speed;
  };

  const copyEntryAsText = async (entry: BoxEntry) => {
    const text = formatPokemonText(entry.state, entry.moves ?? []);
    try {
      const copied = await copyText(text);
      if (!copied) throw new Error("copy failed");
      alert("コピーが完了しました");
    } catch {
      prompt("文字情報をコピーしてください", text);
    }
  };

  /* タイプ一覧 */
  const allTypes: PokemonType[] = [
    "normal","fire","water","electric","grass","ice","fighting","poison",
    "ground","flying","psychic","bug","rock","ghost","dragon","dark","steel","fairy"
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-5 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">📦 ポケモンボックス</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (entries.length === 0) return;
                const encoded = exportBoxToShareString(entries);
                const url = `${window.location.origin}?box=${encoded}`;
                navigator.clipboard.writeText(url).then(() => {
                  alert(`共有URLをコピーしました（${entries.length}体）\n別のデバイスでこのURLを開くとデータがインポートされます`);
                }).catch(() => {
                  // クリップボードAPIが使えない場合
                  prompt("共有URLをコピーしてください:", url);
                });
              }}
              className="text-xs px-3 py-1 rounded-md font-medium transition-colors"
              style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
              title="ボックスデータを共有URLにエクスポート"
            >
              📤 共有
            </button>
            <button onClick={onClose} className="text-white/80 hover:text-white text-xl">✕</button>
          </div>
        </div>

        {/* タブ */}
        <div className="flex border-b">
          <button
            className={`flex-1 py-2.5 text-sm font-bold ${tab === "team" ? "bg-white text-blue-600 border-b-2 border-blue-600" : "bg-gray-100 text-gray-500"}`}
            onClick={() => setTab("team")}
          >
            ⚔️ バトルチーム ({teams.length})
          </button>
          <button
            className={`flex-1 py-2.5 text-sm font-bold ${tab === "box" ? "bg-white text-blue-600 border-b-2 border-blue-600" : "bg-gray-100 text-gray-500"}`}
            onClick={() => setTab("box")}
          >
            📦 ボックス ({entries.length})
          </button>
        </div>

        {/* ── ボックスタブ ── */}
        {tab === "box" && (
          <div className="flex-1 overflow-y-auto p-4">
            {/* 検索バー */}
            <div className="relative mb-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="🔍 名前で検索..."
                    className="w-full px-3 py-1.5 border rounded-lg text-sm pr-16"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    readOnly={showKanaKb}
                    onClick={() => { if (!showKanaKb) { setShowKanaKb(true); isFirstKbKey.current = true; } }}
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-gray-600 text-xs px-1">✕</button>
                    )}
                    <button
                      onClick={() => { setShowKanaKb(!showKanaKb); isFirstKbKey.current = true; }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${showKanaKb ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"}`}
                    >
                      キーボード
                    </button>
                  </div>
                </div>
              </div>
              {showKanaKb && (
                <div className="mt-1">
                  <KanaKeyboard
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onClose={() => setShowKanaKb(false)}
                    defaultMode="katakana"
                    freshRef={isFirstKbKey}
                  />
                </div>
              )}
            </div>

            {/* ソート & フィルタ */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="flex gap-1">
                {([["newest", "新着順"], ["dex", "図鑑No."], ["speed", "素早さ"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${sort === key ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600 hover:bg-gray-300"}`}
                    onClick={() => setSort(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <select
                className="px-2 py-1 rounded border text-xs"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as PokemonType | "all")}
              >
                <option value="all">全タイプ</option>
                {allTypes.map((t) => (
                  <option key={t} value={t}>{TYPE_NAMES_JA[t]}</option>
                ))}
              </select>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                {entries.length === 0 ? "まだポケモンが登録されていません" : "条件に一致するポケモンがいません"}
              </div>
            ) : (
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                {filtered.map((entry) => {
                  const poke = entry.state.pokemon;
                  if (!poke) return null;
                  const isSelected = selectedEntryId === entry.id;
                  return (
                    <button
                      key={entry.id}
                      onClick={() => setSelectedEntryId(isSelected ? null : entry.id)}
                      className={`relative flex flex-col items-center p-1.5 rounded-xl border-2 transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 shadow-md"
                          : "border-gray-200 bg-white hover:border-blue-300 hover:shadow"
                      }`}
                    >
                      {/* スプライト */}
                      <img
                        src={poke.spriteUrl}
                        alt={poke.japaneseName}
                        className="w-14 h-14 object-contain"
                        loading="lazy"
                      />
                      {/* 名前 */}
                      <span className="text-[10px] font-bold text-gray-700 truncate w-full text-center leading-tight">
                        {entry.name}
                      </span>
                      {/* タイプドット */}
                      <div className="flex gap-0.5 mt-0.5">
                        {poke.types.map((t) => (
                          <span
                            key={t}
                            className="w-3 h-3 rounded-full border border-white"
                            style={{ backgroundColor: TYPE_COLORS[t] }}
                            title={TYPE_NAMES_JA[t]}
                          />
                        ))}
                      </div>
                      {/* テラスタイプアイコン */}
                      {entry.state.teraType && (
                        <span
                          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-sm flex items-center justify-center text-[8px] text-white font-bold"
                          style={{ backgroundColor: TYPE_COLORS[entry.state.teraType] }}
                          title={`テラス: ${TYPE_NAMES_JA[entry.state.teraType]}`}
                        >
                          T
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 選択中の詳細パネル */}
            {selectedEntry && selectedEntry.state.pokemon && (
              <div className="mt-4 p-4 bg-gray-50 rounded-xl border">
                <div className="flex items-start gap-3">
                  <img
                    src={selectedEntry.state.pokemon.spriteUrl}
                    alt=""
                    className="w-20 h-20 object-contain"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-lg">{selectedEntry.name}</span>
                      <span className="text-xs text-gray-500">
                        {selectedEntry.state.pokemon.japaneseName} / Lv.{selectedEntry.state.level}
                      </span>
                    </div>
                    <div className="flex gap-1 mt-1">
                      {selectedEntry.state.pokemon.types.map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                          style={{ backgroundColor: TYPE_COLORS[t] }}
                        >
                          {TYPE_NAMES_JA[t]}
                        </span>
                      ))}
                      {selectedEntry.state.teraType && (
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white border border-white/50"
                          style={{ backgroundColor: TYPE_COLORS[selectedEntry.state.teraType] }}
                        >
                          テラス:{TYPE_NAMES_JA[selectedEntry.state.teraType]}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {NATURE_DATA[selectedEntry.state.nature].ja} / S実数値: {getSpeed(selectedEntry)}
                    </div>
                    {/* アクションボタン */}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <button
                        onClick={() => { onEdit(selectedEntry); onClose(); }}
                        className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-300"
                      >
                        ✏️ 編集
                      </button>
                      <button
                        onClick={() => void copyEntryAsText(selectedEntry)}
                        className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-300"
                      >
                        文字情報に変換
                      </button>
                      <button
                        onClick={() => { onDelete(selectedEntry.id); setSelectedEntryId(null); }}
                        className="px-3 py-1.5 bg-gray-200 text-red-500 rounded-lg text-xs font-bold hover:bg-red-100"
                      >
                        🗑️ 削除
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── チームタブ ── */}
        {tab === "team" && (
          <div className="flex-1 overflow-y-auto p-4">
            {/* チーム作成 */}
            {teams.length < 3 && (
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="チーム名（例：シーズン40・ガチ構築）"
                  className="flex-1 px-3 py-2 border rounded-lg text-sm"
                  value={teamNameInput}
                  onChange={(e) => setTeamNameInput(e.target.value)}
                  maxLength={30}
                />
                <button
                  onClick={handleCreateTeam}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 whitespace-nowrap"
                >
                  + チーム作成
                </button>
              </div>
            )}

            {teams.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                バトルチームを作成してポケモンを編成しましょう
              </div>
            ) : (
              teams.map((team) => {
                const members = team.memberIds
                  .map((id) => entries.find((e) => e.id === id))
                  .filter((e): e is BoxEntry => e != null);
                const isEditing = editingTeamId === team.id;

                return (
                  <div key={team.id} className="mb-6 border rounded-xl overflow-hidden">
                    {/* チームヘッダー */}
                    <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <input
                            type="text"
                            className="bg-white/20 text-white font-bold px-2 py-0.5 rounded text-sm border border-white/30 placeholder-white/50"
                            value={team.name}
                            onChange={(e) => onTeamsChange(updateTeam(team.id, { name: e.target.value }))}
                            placeholder="チーム名"
                          />
                        ) : (
                          <span className="font-bold">{team.name}</span>
                        )}
                        <span className="text-purple-200 text-xs">{members.length}/6</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingTeamId(isEditing ? null : team.id)}
                          className={`px-2.5 py-1 rounded text-xs font-bold ${isEditing ? "bg-white text-purple-600" : "bg-purple-400 text-white hover:bg-purple-300"}`}
                        >
                          {isEditing ? "完了" : "編集"}
                        </button>
                        <button
                          onClick={() => { onTeamsChange(deleteTeam(team.id)); }}
                          className="px-2.5 py-1 rounded text-xs font-bold bg-purple-400 text-white hover:bg-red-400"
                        >
                          削除
                        </button>
                      </div>
                    </div>

                    {/* メンバー6枠 */}
                    <div className="p-3 bg-white">
                      <div className="grid grid-cols-6 gap-2">
                        {Array.from({ length: 6 }).map((_, i) => {
                          const member = members[i];
                          if (!member || !member.state.pokemon) {
                            return (
                              <div
                                key={i}
                                className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 text-xl"
                              >
                                +
                              </div>
                            );
                          }
                          const poke = member.state.pokemon;
                          const spd = getSpeed(member);
                          return (
                            <div key={i} className="relative group">
                              <div className="aspect-square rounded-xl border-2 border-gray-200 bg-gray-50 flex flex-col items-center justify-center p-1 hover:border-blue-300 transition-colors">
                                <img src={poke.spriteUrl} alt="" className="w-10 h-10 object-contain" />
                                <span className="text-[9px] font-bold text-gray-700 truncate w-full text-center">{member.name}</span>
                                <span className="text-[9px] text-gray-400">S{spd}</span>
                              </div>
                              {/* 編集中のみホバーで外すボタン */}
                              {isEditing && (
                                <div className="absolute inset-0 rounded-xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <button
                                    onClick={() => toggleTeamMember(team.id, member.id)}
                                    className="px-2 py-0.5 bg-gray-500 text-white rounded text-[9px] font-bold"
                                  >
                                    外す
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* チームサマリー */}
                      {members.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="text-xs font-bold text-gray-500 mb-1.5">チームサマリー</div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-[10px]">
                              <thead>
                                <tr className="text-gray-400">
                                  <th className="text-left py-0.5">名前</th>
                                  <th>HP</th>
                                  <th>攻撃</th>
                                  <th>防御</th>
                                  <th>特攻</th>
                                  <th>特防</th>
                                  <th>素早</th>
                                </tr>
                              </thead>
                              <tbody>
                                {members.map((m) => {
                                  if (!m.state.pokemon) return null;
                                  const st = calcAllStats(m.state.pokemon.baseStats, m.state.ivs, m.state.evs, m.state.level, m.state.nature);
                                  return (
                                    <tr key={m.id} className="text-center text-gray-700">
                                      <td className="text-left font-bold py-0.5">{m.name}</td>
                                      <td>{st.hp}</td>
                                      <td>{st.attack}</td>
                                      <td>{st.defense}</td>
                                      <td>{st.spAtk}</td>
                                      <td>{st.spDef}</td>
                                      <td className="font-bold text-blue-600">{st.speed}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          {/* 素早さ順 */}
                          <div className="mt-2 flex items-center gap-1 flex-wrap">
                            <span className="text-[10px] text-gray-400 font-bold">S順:</span>
                            {[...members]
                              .sort((a, b) => getSpeed(b) - getSpeed(a))
                              .map((m) => (
                                <span key={m.id} className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">
                                  {m.name}({getSpeed(m)})
                                </span>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* 編集中: ボックスからメンバー追加 */}
                      {isEditing && members.length < 6 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="text-xs font-bold text-gray-500 mb-2">ボックスから追加</div>
                          <div className="flex gap-1.5 flex-wrap">
                            {entries
                              .filter((e) => !team.memberIds.includes(e.id) && e.state.pokemon)
                              .map((e) => (
                                <button
                                  key={e.id}
                                  onClick={() => toggleTeamMember(team.id, e.id)}
                                  className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg hover:bg-blue-100 transition-colors"
                                >
                                  <img src={e.state.pokemon!.spriteUrl} alt="" className="w-6 h-6" />
                                  <span className="text-[10px] font-bold">{e.name}</span>
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
