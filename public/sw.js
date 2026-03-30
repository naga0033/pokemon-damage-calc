// サービスワーカー: キャッシュ戦略（Network First + Cache Fallback）
// ※ /_next/ は絶対にキャッシュしない（チャンクと HTML の組み合わせがずれると
//   Webpack が TypeError: Cannot read properties of undefined (reading 'call') を出す）
const CACHE_NAME = "pokemon-dmg-calc-v3";

// インストール時にシェルをキャッシュ
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(["/manifest.json", "/icon-192.png", "/icon-512.png"])
    )
  );
  self.skipWaiting();
});

// 古いキャッシュを削除
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network First: ネットワーク優先、失敗時にキャッシュ
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  // API・Next.js ビルド成果物はキャッシュしない（respondWith なし＝ブラウザの通常取得）
  if (url.pathname.includes("/api/") || url.pathname.startsWith("/_next/") || event.request.mode === "navigate") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 成功したらキャッシュを更新
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
