/**
 * AI NEWS Service Worker
 *
 * 方針:
 *  - シェル（HTML/CSS/JS）: stale-while-revalidate でオフライン閲覧を可能に
 *  - データ (news.json / audio/*.mp3): network-first（最新優先）、失敗時はキャッシュ
 *  - 外部画像: cache-first（長期キャッシュで再訪時の UI を高速化）
 *
 * バージョンを上げると旧キャッシュを全削除して再取得する。
 */
const CACHE_VERSION = 'ai-news-v1';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const DATA_CACHE = `${CACHE_VERSION}-data`;
const IMG_CACHE = `${CACHE_VERSION}-img`;

const SHELL_ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  '../../assets/app-styles.css',
  '../../assets/onboarding.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(SHELL_ASSETS).catch(() => {
        // シェル取得失敗は致命ではないので握りつぶす（次回再試行）
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => !n.startsWith(CACHE_VERSION))
          .map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // データ: network-first (news.json / audio/*.mp3 / archives/*.json)
  if (
    url.pathname.endsWith('/news.json') ||
    url.pathname.includes('/data/archives/') ||
    url.pathname.includes('/data/audio/')
  ) {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(DATA_CACHE).then((c) => c.put(request, copy));
          }
          return resp;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 外部画像（OGP）: cache-first
  if (request.destination === 'image' && url.origin !== location.origin) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request)
          .then((resp) => {
            if (resp.ok) {
              const copy = resp.clone();
              caches.open(IMG_CACHE).then((c) => c.put(request, copy));
            }
            return resp;
          })
          .catch(() => new Response('', { status: 504 }))
      )
    );
    return;
  }

  // シェル: stale-while-revalidate
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((resp) => {
            if (resp.ok) {
              const copy = resp.clone();
              caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
            }
            return resp;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
