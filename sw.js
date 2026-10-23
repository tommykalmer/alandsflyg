// Ålandsflyg service worker: sparar spelet lokalt så att det startar snabbt och fungerar offline.
// Höj versionen när filerna ändras så att gamla cachar rensas.
const CACHE = 'alandsflyg-v8';
const CORE = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/data.js', 'js/world.js', 'js/physics.js', 'js/scene.js', 'js/terrain.js', 'js/daynight.js', 'js/weather.js',
  'js/route.js', 'js/cockpit.js', 'js/missions.js', 'js/map.js', 'js/hud.js', 'js/app.js', 'js/portal.js',
  'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  // kartdata (vägar och byggnader i rutor sparas när man flyger över dem)
  'data/lc_core.bin', 'data/h_core.bin', 'data/lc_reg.bin', 'data/h_reg.bin', 'data/roads_core.bin', 'data/roads_reg.bin', 'data/pois.json', 'data/t/index.json',
  'vendor/three.min.js'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// visa det sparade direkt och hämta en färsk version i bakgrunden till nästa start
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    return res || (req.mode === 'navigate' ? c.match('index.html') : Response.error());
  }));
});
