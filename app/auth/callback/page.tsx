"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      router.replace("/");
    }, 1200);

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
      </div>
    </main>
  );
}
