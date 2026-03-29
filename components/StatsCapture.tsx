"use client";
import { useState, useRef } from "react";
import type { StatKey } from "@/lib/types";

interface StatValues {
  hp:      { ev: number; iv: number; actual: number | null };
  attack:  { ev: number; iv: number; actual: number | null };
  defense: { ev: number; iv: number; actual: number | null };
  spAtk:   { ev: number; iv: number; actual: number | null };
  spDef:   { ev: number; iv: number; actual: number | null };
  speed:   { ev: number; iv: number; actual: number | null };
}

interface Props {
  onApply: (evs: Record<StatKey, number>, ivs: Record<StatKey, number>) => void;
}

const STAT_LABELS: Record<StatKey, string> = {
  hp: "HP", attack: "こうげき", defense: "ぼうぎょ",
  spAtk: "とくこう", spDef: "とくぼう", speed: "すばやさ",
};

export default function StatsCapture({ onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<StatValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      const [header, base64] = dataUrl.split(",");
      const mediaType = header.match(/data:([^;]+)/)?.[1] ?? "image/png";
      setLoading(true);
      try {
        const res = await fetch("/api/analyze-stats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mediaType }),
        });
        const json = await res.json();
        if (json.error) { setError(json.error); return; }
        setResult(json as StatValues);
      } catch {
        setError("通信エラーが発生しました");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApply = () => {
    if (!result) return;
    const keys: StatKey[] = ["hp", "attack", "defense", "spAtk", "spDef", "speed"];
    const evs = Object.fromEntries(keys.map((k) => [k, result[k]?.ev ?? 0])) as Record<StatKey, number>;
    const ivs = Object.fromEntries(keys.map((k) => [k, result[k]?.iv ?? 31])) as Record<StatKey, number>;
    onApply(evs, ivs);
    setOpen(false);
    setResult(null);
    setPreview(null);
  };

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs px-2.5 py-1 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors flex items-center gap-1"
      >
        📊 スクショから実数値読み取り
      </button>

      {open && (
        <div className="mt-2 space-y-2 p-3 rounded-xl bg-purple-50 border border-purple-200">
          <div
            className="border-2 border-dashed border-purple-300 rounded-lg p-3 text-center cursor-pointer hover:border-purple-500 hover:bg-purple-100 transition-colors"
            onClick={() => inputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) handleFile(f); }}
            onDragOver={(e) => e.preventDefault()}
          >
            {preview ? (
              <img src={preview} alt="" className="max-h-24 mx-auto rounded object-contain" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl">📊</div>
                <p className="text-xs text-purple-600">努力値・実数値が写ったスクショをアップロード</p>
              </div>
            )}
            {loading && (
              <div className="mt-2 flex items-center justify-center gap-2 text-xs text-purple-600">
                <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                Claude が数値を読み取り中...
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          {result && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-1 text-xs">
                {(["hp", "attack", "defense", "spAtk", "spDef", "speed"] as StatKey[]).map((k) => (
                  <div key={k} className="bg-white rounded p-1.5 border border-purple-100">
                    <p className="text-gray-500 text-[10px]">{STAT_LABELS[k]}</p>
                    <p className="font-bold text-gray-800">{result[k]?.actual ?? "?"}</p>
                    <p className="text-gray-400 text-[10px]">EV:{result[k]?.ev ?? 0} IV:{result[k]?.iv ?? 31}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={handleApply}
                className="w-full py-1.5 rounded-lg bg-purple-500 text-white text-sm font-medium hover:bg-purple-600 transition-colors"
              >
                ✓ この数値をスライダーに反映
              </button>
            </div>
          )}

          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      )}
    </div>
  );
}
