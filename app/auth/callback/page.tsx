"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [showManualButton, setShowManualButton] = useState(false);

  useEffect(() => {
    // Supabaseの認証トークンをURLから取得してセッション確立
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const searchParams = new URLSearchParams(window.location.search);
    const accessToken = hashParams.get("access_token") || searchParams.get("access_token");

    // カスタムスキームでアプリに戻す
    const deepLink = `pokedamagecalc://auth/callback${window.location.search}${window.location.hash}`;

    // アプリに戻す試行
    const tryOpenApp = () => {
      window.location.href = deepLink;
    };

    // 少し待ってからアプリを開く（ページ読み込み完了を待つ）
    const openTimer = setTimeout(tryOpenApp, 300);

    // 2秒後にまだこのページにいたら手動ボタンを表示
    const fallbackTimer = setTimeout(() => {
      setShowManualButton(true);
    }, 2000);

    // 5秒後にまだこのページにいたらWebアプリのトップに飛ばす
    const redirectTimer = setTimeout(() => {
      router.replace("/");
    }, 8000);

    return () => {
      clearTimeout(openTimer);
      clearTimeout(fallbackTimer);
      clearTimeout(redirectTimer);
    };
  }, [router]);

  const handleOpenApp = () => {
    const deepLink = `pokedamagecalc://auth/callback${window.location.search}${window.location.hash}`;
    window.location.href = deepLink;
    // 1秒後にWebに戻す
    setTimeout(() => router.replace("/"), 1500);
  };

  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-3xl border border-red-100 bg-gradient-to-br from-red-50 via-white to-orange-50 p-8 text-center shadow-lg">
        <div className="mx-auto mb-5 h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-[6px] border-red-500 border-b-white bg-white animate-spin" />
        </div>
        <h1 className="text-xl font-extrabold text-gray-900">ログインを確認中</h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">
          このままアプリへ戻ります...
        </p>
        {showManualButton && (
          <button
            onClick={handleOpenApp}
            className="mt-5 inline-flex rounded-full border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
          >
            アプリに戻る
          </button>
        )}
      </div>
    </main>
  );
}
