"use client";
import type React from "react";

export function NumpadPopup({
  value, maxLabel, minLabel, onDigit, onClear, onMax, onMin, pos, onClose,
}: {
  value: string;
  maxLabel: string;
  minLabel: string;
  onDigit: (d: string) => void;
  onClear: () => void;
  onMax: () => void;
  onMin: () => void;
  pos?: { top: number; left: number };
  onClose?: () => void;
}) {
  const base = "flex items-center justify-center rounded-lg border font-semibold text-sm transition-colors select-none h-9 cursor-pointer";
  const md = (fn: () => void) => (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); fn(); };

  const style: React.CSSProperties = pos
    ? { position: "fixed", top: pos.top, left: pos.left, transform: "translateX(-50%)", zIndex: 9999 }
    : {};
  const className = pos
    ? "bg-white border border-gray-300 rounded-xl shadow-2xl p-2.5 w-44"
    : "absolute z-[200] bg-white border border-gray-300 rounded-xl shadow-2xl p-2.5 w-44 top-full mt-1 left-0";

  return (
    <>
      {/* 背景オーバーレイ（テンキー外タップで閉じる + スクロール/タッチ完全ブロック） */}
      {onClose && <div className="fixed inset-0 z-[199]"
        onMouseDown={onClose}
        onTouchStart={(e) => { e.preventDefault(); onClose(); }}
        onTouchMove={(e) => e.preventDefault()}
        onWheel={(e) => e.preventDefault()}
      />}
      <div className={className} style={style} onTouchMove={(e) => e.preventDefault()}>
      <div className="text-center text-lg font-bold text-gray-800 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 mb-2 min-h-[2.25rem] leading-snug">
        {value !== "" ? value : <span className="text-gray-300 text-sm">入力してください</span>}
      </div>
      <div className="grid grid-cols-3 gap-1 mb-1">
        {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((d) => (
          <button key={d} className={`${base} border-gray-200 bg-white hover:bg-gray-100`} onMouseDown={md(() => onDigit(String(d)))}>{d}</button>
        ))}
        <button className={`${base} border-gray-200 bg-white hover:bg-gray-100`} onMouseDown={md(() => onDigit("0"))}>0</button>
        <button className={`${base} col-span-2 border-red-200 bg-red-50 text-red-600 hover:bg-red-100`} onMouseDown={md(onClear)}>CLR</button>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <button className="flex flex-col items-center justify-center rounded-lg border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 py-1.5 cursor-pointer select-none" onMouseDown={md(onMax)}>
          <span className="font-bold text-sm">MAX</span><span className="text-[10px] opacity-70">{maxLabel}</span>
        </button>
        <button className="flex flex-col items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 py-1.5 cursor-pointer select-none" onMouseDown={md(onMin)}>
          <span className="font-bold text-sm">MIN</span><span className="text-[10px] opacity-70">{minLabel}</span>
        </button>
      </div>
    </div>
    </>
  );
}
