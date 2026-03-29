"use client";
import { useState } from "react";
import type React from "react";

// ───────────────────────────────────────
// Switch風かなキーボード
// 右→左に五十音順（ア・カ・サ…）で並ぶ特殊配列
// ───────────────────────────────────────

const KATAKANA_GRID: (string | null)[][] = [
  ["「", "ワ", "ラ", "ヤ", "マ", "ハ", "ナ", "タ", "サ", "カ", "ア"],
  ["」", "ヲ", "リ", null, "ミ", "ヒ", "ニ", "チ", "シ", "キ", "イ"],
  ["ー", "ン", "ル", "ユ", "ム", "フ", "ヌ", "ツ", "ス", "ク", "ウ"],
  ["?",  "、", "レ", null, "メ", "ヘ", "ネ", "テ", "セ", "ケ", "エ"],
  ["!",  "。", "ロ", "ヨ", "モ", "ホ", "ノ", "ト", "ソ", "コ", "オ"],
];

const HIRAGANA_GRID: (string | null)[][] = [
  ["「", "わ", "ら", "や", "ま", "は", "な", "た", "さ", "か", "あ"],
  ["」", "を", "り", null, "み", "ひ", "に", "ち", "し", "き", "い"],
  ["ー", "ん", "る", "ゆ", "む", "ふ", "ぬ", "つ", "す", "く", "う"],
  ["?",  "、", "れ", null, "め", "へ", "ね", "て", "せ", "け", "え"],
  ["!",  "。", "ろ", "よ", "も", "ほ", "の", "と", "そ", "こ", "お"],
];

/** 濁点変換マップ */
const DAKUTEN: Record<string, string> = {
  "か": "が", "き": "ぎ", "く": "ぐ", "け": "げ", "こ": "ご",
  "さ": "ざ", "し": "じ", "す": "ず", "せ": "ぜ", "そ": "ぞ",
  "た": "だ", "ち": "ぢ", "つ": "づ", "て": "で", "と": "ど",
  "は": "ば", "ひ": "び", "ふ": "ぶ", "へ": "べ", "ほ": "ぼ",
  "カ": "ガ", "キ": "ギ", "ク": "グ", "ケ": "ゲ", "コ": "ゴ",
  "サ": "ザ", "シ": "ジ", "ス": "ズ", "セ": "ゼ", "ソ": "ゾ",
  "タ": "ダ", "チ": "ヂ", "ツ": "ヅ", "テ": "デ", "ト": "ド",
  "ハ": "バ", "ヒ": "ビ", "フ": "ブ", "ヘ": "ベ", "ホ": "ボ",
  "う": "ゔ", "ウ": "ヴ",
};

/** 半濁点変換マップ */
const HANDAKUTEN: Record<string, string> = {
  "は": "ぱ", "ひ": "ぴ", "ふ": "ぷ", "へ": "ぺ", "ほ": "ぽ",
  "ハ": "パ", "ヒ": "ピ", "フ": "プ", "ヘ": "ペ", "ホ": "ポ",
};

/** 小文字変換マップ */
const KOMOJI: Record<string, string> = {
  "あ": "ぁ", "い": "ぃ", "う": "ぅ", "え": "ぇ", "お": "ぉ",
  "つ": "っ", "や": "ゃ", "ゆ": "ゅ", "よ": "ょ", "わ": "ゎ",
  "ア": "ァ", "イ": "ィ", "ウ": "ゥ", "エ": "ェ", "オ": "ォ",
  "ツ": "ッ", "ヤ": "ャ", "ユ": "ュ", "ヨ": "ョ", "ワ": "ヮ",
};

/** 逆引きマップ（濁点・半濁点・小文字→元の文字） */
const REVERSE: Record<string, string> = {};
for (const map of [DAKUTEN, HANDAKUTEN, KOMOJI]) {
  for (const [k, v] of Object.entries(map)) REVERSE[v] = k;
}

/** 最後の文字に濁点/半濁点/小文字を適用（サイクル） */
function toggleLastChar(text: string, mode: "dakuten" | "handakuten" | "komoji"): string {
  if (text.length === 0) return text;
  const last = text[text.length - 1];
  const base = text.slice(0, -1);
  const map = mode === "dakuten" ? DAKUTEN : mode === "handakuten" ? HANDAKUTEN : KOMOJI;
  // 既に変換済み → 元に戻す
  if (REVERSE[last]) {
    const original = REVERSE[last];
    // 同じ変換カテゴリなら戻す、違うなら新たに変換
    if (map[original] === last) return base + original;
    if (map[original]) return base + map[original];
    if (map[last]) return base + map[last];
    return text;
  }
  // 未変換 → 変換
  if (map[last]) return base + map[last];
  return text;
}

interface Props {
  value: string;
  onChange: (newValue: string) => void;
  onClose: () => void;
  /** デフォルトモード: "katakana" (ポケモン名検索用) | "hiragana" (技名検索用) */
  defaultMode?: "katakana" | "hiragana";
  /** 最初のキー入力で既存テキストをクリアするか */
  freshRef?: React.MutableRefObject<boolean>;
}

export function KanaKeyboard({ value, onChange, onClose, defaultMode = "katakana", freshRef }: Props) {
  const [mode, setMode] = useState<"katakana" | "hiragana">(defaultMode);
  const grid = mode === "katakana" ? KATAKANA_GRID : HIRAGANA_GRID;

  const md = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };

  const handleChar = (ch: string) => {
    if (freshRef?.current) {
      freshRef.current = false;
      onChange(ch);
    } else {
      onChange(value + ch);
    }
  };

  const handleBackspace = () => {
    if (freshRef?.current) {
      freshRef.current = false;
      onChange("");
    } else {
      onChange(value.slice(0, -1));
    }
  };

  const handleToggle = (type: "dakuten" | "handakuten" | "komoji") => {
    if (freshRef?.current) freshRef.current = false;
    onChange(toggleLastChar(value, type));
  };

  const btnBase = "flex items-center justify-center rounded text-sm font-medium transition-colors select-none cursor-pointer";
  const btnKey = `${btnBase} bg-white border border-gray-200 text-gray-800 hover:bg-indigo-50 hover:border-indigo-300 active:bg-indigo-100`;
  const btnMode = `${btnBase} border text-xs`;
  const btnAction = `${btnBase} border text-xs font-bold`;

  return (
    <div className="mt-1 rounded-xl border border-gray-300 bg-gray-100 shadow-lg overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-2.5 py-1 bg-gray-200 border-b border-gray-300">
        <span className="text-[10px] font-bold text-gray-600">⌨️ かなキーボード</span>
        <button type="button" onMouseDown={md(onClose)}
          className="text-xs text-gray-400 hover:text-gray-600 font-bold px-1">✕</button>
      </div>

      <div className="flex gap-1 p-1.5">
        {/* 左サイド: モード切替 */}
        <div className="flex flex-col gap-0.5 flex-shrink-0 w-10">
          <button type="button" onMouseDown={md(() => setMode("hiragana"))}
            className={`${btnMode} h-8 ${mode === "hiragana" ? "bg-indigo-500 text-white border-indigo-600" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >あ</button>
          <button type="button" onMouseDown={md(() => setMode("katakana"))}
            className={`${btnMode} h-8 ${mode === "katakana" ? "bg-indigo-500 text-white border-indigo-600" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >ア</button>
          <button type="button" onMouseDown={md(() => handleToggle("dakuten"))}
            className={`${btnMode} h-8 bg-yellow-50 border-yellow-200 text-yellow-800 hover:bg-yellow-100`}
          >゛</button>
          <button type="button" onMouseDown={md(() => handleToggle("handakuten"))}
            className={`${btnMode} h-8 bg-yellow-50 border-yellow-200 text-yellow-800 hover:bg-yellow-100`}
          >゜</button>
          <button type="button" onMouseDown={md(() => handleToggle("komoji"))}
            className={`${btnMode} h-8 bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100`}
          >小字</button>
        </div>

        {/* メイングリッド: 11列×5行 */}
        <div className="flex-1 grid grid-cols-11 gap-0.5">
          {grid.map((row, ri) =>
            row.map((ch, ci) =>
              ch === null ? (
                <span key={`e-${ri}-${ci}`} className="h-8" />
              ) : (
                <button key={`${ri}-${ci}`} type="button"
                  onMouseDown={md(() => handleChar(ch))}
                  className={`${btnKey} h-8 text-xs`}
                >{ch}</button>
              )
            )
          )}
        </div>

        {/* 右サイド: アクションボタン */}
        <div className="flex flex-col gap-0.5 flex-shrink-0 w-10">
          <button type="button" onMouseDown={md(handleBackspace)}
            className={`${btnAction} h-8 bg-red-50 border-red-200 text-red-600 hover:bg-red-100`}
          >⌫</button>
          <button type="button" onMouseDown={md(() => { if (freshRef) freshRef.current = false; onChange(value + " "); })}
            className={`${btnAction} h-8 bg-white border-gray-200 text-gray-600 hover:bg-gray-50`}
          >空白</button>
          <button type="button" onMouseDown={md(() => onChange(""))}
            className={`${btnAction} h-8 bg-white border-gray-200 text-gray-500 hover:bg-gray-50`}
          >CLR</button>
          <button type="button" onMouseDown={md(onClose)}
            className={`${btnAction} h-12 bg-blue-500 border-blue-600 text-white hover:bg-blue-600 col-span-1`}
          >検索</button>
        </div>
      </div>
    </div>
  );
}
