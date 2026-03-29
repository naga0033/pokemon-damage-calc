"use client";
import { useState, useEffect, useRef } from "react";
import type { PokemonState } from "@/lib/types";
import { loadBox, saveToBox, deleteFromBox, BoxEntry } from "@/lib/box-storage";

interface Props {
  currentState: PokemonState;
  onLoad: (state: PokemonState) => void;
}

export default function PokemonBox({ currentState, onLoad }: Props) {
  const [entries, setEntries] = useState<BoxEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const saveInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (saving) saveInputRef.current?.focus();
  }, [saving]);

  useEffect(() => {
    setEntries(loadBox());
  }, [open]);

  const handleSave = () => {
    if (!currentState.pokemon || !saveName.trim()) return;
    const next = saveToBox(saveName.trim(), currentState);
    setEntries(next);
    setSaveName("");
    setSaving(false);
  };

  const handleDelete = (id: string) => {
    setEntries(deleteFromBox(id));
  };

  if (!currentState.pokemon && !open) return null;

  return (
    <div className="border-t pt-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-600">📦 ボックス</p>
        <div className="flex gap-2">
          {currentState.pokemon && (
            <button
              onClick={() => setSaving((v) => !v)}
              className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
            >
              ＋ この個体を保存
            </button>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            {open ? "▲ 閉じる" : `▼ 呼び出す (${loadBox().length})`}
          </button>
        </div>
      </div>

      {saving && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="型名（例: しんそく型, こだわりメガネ型）"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            ref={saveInputRef}
            className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          <button
            onClick={handleSave}
            disabled={!saveName.trim()}
            className="text-xs px-3 py-1 rounded bg-green-500 text-white hover:bg-green-600 disabled:opacity-40 transition-colors"
          >
            保存
          </button>
        </div>
      )}

      {open && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {entries.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">保存済み個体はありません</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors">
                {entry.state.pokemon?.spriteUrl && (
                  <img src={entry.state.pokemon.spriteUrl} alt="" className="w-8 h-8 object-contain flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">{entry.name}</p>
                  <p className="text-xs text-gray-400 truncate">{entry.state.pokemon?.japaneseName} / {entry.state.nature} / Lv{entry.state.level}</p>
                </div>
                <button
                  onClick={() => onLoad(entry.state)}
                  className="text-xs px-2 py-0.5 rounded bg-blue-500 text-white hover:bg-blue-600 flex-shrink-0 transition-colors"
                >
                  呼び出す
                </button>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 hover:bg-red-200 flex-shrink-0 transition-colors"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
