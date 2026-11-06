/**
 * FudFarmer POS service worker.
 *
 * Strategy:
 *  - Navigations: network-first, falling back to the cached shell so a cold
 *    start with no network still boots the till.
 *  - Static assets: stale-while-revalidate (instant, refreshed in background).
 *
 * Sale data is NOT cached here ??? it lives in IndexedDB (see lib/db.ts).
 */

const VERSION = 'ffpos-v2';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const SHELL_URL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll([SHELL_URL, '/manifest.webmanifest'])).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

// Client-side navigation does not fetch an HTML document. Cache the generic
// receipt page shell explicitly; transaction data stays in location-scoped IDB.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_HISTORY_ROUTE') return;
  const url = new URL(event.data.path, self.location.origin);
  if (url.origin !== self.location.origin || !/^\/history(?:\/[^/?#]+)?$/.test(url.pathname)) return;
  event.waitUntil(fetch(url.pathname, { cache: 'reload' }).then(async response => {
    if (!response.ok) throw new Error('Page unavailable');
    const html = await response.clone().text();
    const assets = [...html.matchAll(/\b(?:src|href)=["']([^"']+)/g)].map(match => new URL(match[1].replace(/&amp;/g, '&'), url));
    const assetCache = await caches.open(ASSETS);
    await Promise.all(assets.filter(asset => asset.origin === url.origin && asset.pathname.startsWith('/_next/static/')).map(async asset => {
      const result = await fetch(asset.href);
      if (!result.ok) throw new Error('Page asset unavailable');
      await assetCache.put(asset.href, result);
    }));
    await (await caches.open(SHELL)).put(url.pathname, response);
    event.ports[0]?.postMessage({ cached: true });
  }).catch(() => event.ports[0]?.postMessage({ cached: false })));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // App shell for navigations
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(async () => {
          const shell = await caches.open(SHELL);
          return (await shell.match(req, { ignoreSearch: true })) || (await shell.match(SHELL_URL)) || new Response('Offline', { status: 503 });
        }),
    );
    return;
  }

  // Static assets: stale-while-revalidate
  // Never cache authenticated API responses or Next's route-data streams here.
  if (!url.pathname.startsWith('/_next/static/') && !/\.(?:svg|png|ico|webmanifest|woff2?)$/.test(url.pathname)) return;
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(ASSETS).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
