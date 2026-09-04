/* 热量手账 Service Worker：离线优先，网络优先更新 */
const CACHE = 'reliang-v43';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './js/store.js',
  './js/data.js',
  './js/ai.js',
  './js/llm.js',
  './js/app.js',
  './js/pages1.js',
  './js/pages2.js',
  './js/edit.js',
  './js/pages3.js',
  './js/pages4.js',
  './js/pages5.js',
  './js/crop.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // 页面导航（打开 App）：优先缓存秒开，后台静默刷新到最新版
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cached = (await caches.match(req, { ignoreSearch: true })) || (await caches.match('./index.html'));
      const refresh = fetch(req).then((res) => {
        if (res && res.ok) caches.open(CACHE).then((c) => c.put('./index.html', res.clone()));
        return res;
      }).catch(() => cached);
      return cached || refresh;
    })());
    return;
  }
  // 静态资源：stale-while-revalidate（忽略查询串匹配预缓存，秒开 + 后台拉新）
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const refresh = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || refresh;
    })
  );
});
