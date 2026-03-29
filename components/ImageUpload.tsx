"use client";
import { useState, useRef } from "react";

interface RecognizeResult {
  attacker: { en: string; ja: string } | null;
  defender: { en: string; ja: string } | null;
}

interface Props {
  onRecognize: (result: RecognizeResult) => void;
}

export default function ImageUpload({ onRecognize }: Props) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);

      // base64部分を取り出す
      const [header, base64] = dataUrl.split(",");
      const mediaType = header.match(/data:([^;]+)/)?.[1] ?? "image/png";

      setLoading(true);
      try {
        const res = await fetch("/api/recognize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mediaType }),
        });
        const json = await res.json();
        if (json.error) {
          setError(json.error);
        } else {
          onRecognize(json as RecognizeResult);
        }
      } catch (err) {
        setError("通信エラーが発生しました");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  };

  return (
    <div className="space-y-2">
      <div
        className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt="preview" className="max-h-32 mx-auto rounded object-contain" />
        ) : (
          <div className="space-y-1">
            <div className="text-3xl">📷</div>
            <p className="text-sm text-gray-500">バトル画面のスクリーンショットをアップロード</p>
            <p className="text-xs text-gray-400">クリックまたはドラッグ＆ドロップ</p>
          </div>
        )}
        {loading && (
          <div className="mt-2 flex items-center justify-center gap-2 text-sm text-blue-500">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span>Claude が認識中...</span>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
