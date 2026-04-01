"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const customSchemeUrl = (() => {
      const deepLink = new URL("pokedamagecalc://auth/callback");
      deepLink.search = window.location.search;
      deepLink.hash = window.location.hash;
      return deepLink.toString();
    })();

    const isInAppWebView = (navigator.userAgent || "").includes("PokeDamageCalcApp");

    if (!isInAppWebView) {
      window.location.replace(customSchemeUrl);
    }

    const timeoutId = window.setTimeout(() => {
      router.replace("/");
    }, isInAppWebView ? 1200 : 2500);

    return () => window.clearTimeout(timeoutId);
  }, [router]);

  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-3xl border border-red-100 bg-gradient-to-br from-red-50 via-white to-orange-50 p-8 text-center shadow-lg">
        <div className="mx-auto mb-5 h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-[6px] border-red-500 border-b-white bg-white" />
        </div>
        <h1 className="text-xl font-extrabold text-gray-900">ログインを確認中</h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">
          このままアプリへ戻ります。
        </p>
        <a
          href="#"
          onClick={(event) => {
            event.preventDefault();
            const deepLink = new URL("pokedamagecalc://auth/callback");
            deepLink.search = window.location.search;
            deepLink.hash = window.location.hash;
            window.location.href = deepLink.toString();
          }}
          className="mt-5 inline-flex rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600"
        >
          アプリに戻る
        </a>
      </div>
    </main>
  );
}
