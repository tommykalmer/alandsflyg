// ===================== KARTPLOTTER (sjökortsstil) =====================
const MAP = { open: false, base: null, cv: null, g: null, zoom: 2.2, cx: 0, cz: 0, follow: true, track: [], trackT: 0, ptrs: new Map(), pinch: null, W: 0, H: 0, dpr: 1 };
const MAPC = { town: [214, 190, 160], land: [240, 228, 178], coast: [120, 104, 70], shallow: [196, 226, 240], deep: [168, 208, 230], text: '#2b3a44', grid: 'rgba(43,58,68,.22)' };

function paintMapArea(x0, z0, w, h, PX, PZ) {
  const cv = document.createElement('canvas'); cv.width = PX; cv.height = PZ;
  const g = cv.getContext('2d'), id = g.createImageData(PX, PZ), d = id.data, sx = w / PX, sz = h / PZ;
  const lnd = new Uint8Array(PX * PZ), dist = new Float32Array(PX * PZ);
  for (let y = 0; y < PZ; y++) for (let x = 0; x < PX; x++) { const v = coastDist(x0 + (x + 0.5) * sx, z0 + (y + 0.5) * sz); dist[y * PX + x] = v; lnd[y * PX + x] = v > 0 ? 1 : 0; }
  const L = (x, y) => (x < 0 || y < 0 || x >= PX || y >= PZ) ? 0 : lnd[y * PX + x];
  for (let y = 0; y < PZ; y++) for (let x = 0; x < PX; x++) {
    const i = (y * PX + x) * 4; let c;
    if (L(x, y)) {
      const wx = x0 + (x + 0.5) * sx, wz = z0 + (y + 0.5) * sz;
      if ((lcAt(wx, wz) & 15) === 7) c = MAPC.shallow;
      else if (!L(x + 1, y) || !L(x - 1, y) || !L(x, y + 1) || !L(x, y - 1)) c = MAPC.coast;
      else { const u = urbanAt(wx, wz); c = u > 0.3 ? MAPC.land.map((v, j) => lerp(v, MAPC.town[j], Math.min(1, (u - 0.3) * 2.5))) : MAPC.land; }
    }
    else { const t = smooth(0, 700, -dist[y * PX + x]); c = MAPC.shallow.map((v, j) => lerp(v, MAPC.deep[j], t)); }
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  // vägar (OpenStreetMap): större vägar röda, mindre grå
  const X = x => (x - x0) / sx, Z = z => (z - z0) / sz, detail = sx < 100;
  g.lineJoin = g.lineCap = 'round';
  for (const [maxC, minC, col, lw] of [[5, 5, 'rgba(120,100,80,.45)', 0.6], [4, 3, 'rgba(176,72,48,.6)', 0.9], [2, 1, 'rgba(176,72,48,.85)', 1.4]]) {
    if (!detail && minC > 3) continue;
    g.strokeStyle = col; g.lineWidth = lw * (detail ? 1 : 0.8);
    g.beginPath();
    for (const r of MAPD.roads) {
      if (r.c < minC || r.c > maxC || r.bb[2] < x0 || r.bb[0] > x0 + w || r.bb[3] < z0 || r.bb[1] > z0 + h) continue;
      const q = r.pts; g.moveTo(X(q[0]), Z(q[1])); for (let j = 2; j < q.length; j += 2) g.lineTo(X(q[j]), Z(q[j + 1]));
    }
    g.stroke();
  }
  return cv;
}
function buildMapBase() {
  MAP.base = paintMapArea(REG.x0, REG.z0, REG.x1 - REG.x0, REG.z1 - REG.z0, 2048, Math.round(2048 * (REG.z1 - REG.z0) / (REG.x1 - REG.x0)));
  MAP.core = paintMapArea(-T_HALF, -T_HALF, T_SIZE, T_SIZE, 1024, 1024);
}
function drawBase(g, sx, sy, s, zoomed) {
  g.drawImage(MAP.base, sx(REG.x0), sy(REG.z0), (REG.x1 - REG.x0) * s, (REG.z1 - REG.z0) * s);
  if (zoomed) g.drawImage(MAP.core, sx(-T_HALF), sy(-T_HALF), T_SIZE * s, T_SIZE * s);
}
function drawRoute(g, sx, sy, S) {
  if (typeof ROUTE === 'undefined' || !ROUTE.on) return;
  const pts = routePoints();
  g.strokeStyle = '#c2189b'; g.lineWidth = 2.4; g.setLineDash([]);
  g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(sx(x), sy(z)) : g.moveTo(sx(x), sy(z)))); g.stroke();
  g.fillStyle = '#c2189b';
  pts.forEach(([x, z], i) => { if (i > 0 && i < pts.length - 1) { g.beginPath(); g.arc(sx(x), sy(z), 3.5, 0, Math.PI * 2); g.fill(); } });
}
function mapInit() {
  MAP.cv = document.getElementById('mapCanvas');
  MAP.g = MAP.cv.getContext('2d');
  const cv = MAP.cv;
  cv.addEventListener('pointerdown', e => {
    e.preventDefault(); cv.setPointerCapture(e.pointerId);
    MAP.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (MAP.ptrs.size === 2) { const [a, b] = [...MAP.ptrs.values()]; MAP.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: MAP.zoom }; }
  });
  cv.addEventListener('pointermove', e => {
    const p = MAP.ptrs.get(e.pointerId); if (!p) return;
    const nx = e.clientX, ny = e.clientY;
    if (MAP.ptrs.size === 1) {
      const s = mapScale(); MAP.cx -= (nx - p.x) / s; MAP.cz -= (ny - p.y) / s; MAP.follow = false; syncMapButtons();
    }
    p.x = nx; p.y = ny;
    if (MAP.ptrs.size === 2 && MAP.pinch) { const [a, b] = [...MAP.ptrs.values()]; MAP.zoom = clamp(MAP.pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / MAP.pinch.d, MAPZ[0], MAPZ[1]); }
  });
  const up = e => { MAP.ptrs.delete(e.pointerId); if (MAP.ptrs.size < 2) MAP.pinch = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); MAP.zoom = clamp(MAP.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), MAPZ[0], MAPZ[1]); }, { passive: false });
  const on = (id, f) => document.getElementById(id).addEventListener('click', f);
  on('mapIn', () => { MAP.zoom = clamp(MAP.zoom * 1.4, MAPZ[0], MAPZ[1]); });
  on('mapOut', () => { MAP.zoom = clamp(MAP.zoom / 1.4, MAPZ[0], MAPZ[1]); });
  on('mapCenter', () => { MAP.follow = true; syncMapButtons(); });
  on('mapClose', () => mapToggle(false));
}
function syncMapButtons() { document.getElementById('mapCenter').classList.toggle('on', MAP.follow); }
function mapToggle(v) {
  MAP.open = v == null ? !MAP.open : v;
  document.getElementById('mapPanel').hidden = !MAP.open;
  document.getElementById('bMap').classList.toggle('on', MAP.open);
  if (MAP.open) { mapResize(); MAP.follow = true; syncMapButtons(); }
}
function mapResize() {
  const r = MAP.cv.getBoundingClientRect(); MAP.dpr = Math.min(window.devicePixelRatio || 1, 2);
  MAP.W = r.width; MAP.H = r.height; MAP.cv.width = r.width * MAP.dpr; MAP.cv.height = r.height * MAP.dpr;
}
// pixel per meter
function mapScale() { return (Math.min(MAP.W, MAP.H) / T_SIZE) * MAP.zoom; }
const MAPZ = [0.18, 16];
function mapTrack(S, dt) {
  MAP.trackT += dt;
  if (MAP.trackT > 1.5) { MAP.trackT = 0; MAP.track.push([S.pos.x, S.pos.z]); if (MAP.track.length > 2400) MAP.track.shift(); }
}
function drawMap(S) {
  if (!MAP.open || !MAP.base) return;
  const g = MAP.g, Wd = MAP.W, Ht = MAP.H, s = mapScale();
  if (MAP.follow) { MAP.cx = S.pos.x; MAP.cz = S.pos.z; }
  const sx = x => Wd / 2 + (x - MAP.cx) * s, sy = z => Ht / 2 + (z - MAP.cz) * s;
  g.setTransform(MAP.dpr, 0, 0, MAP.dpr, 0, 0);
  g.fillStyle = `rgb(${MAPC.deep})`; g.fillRect(0, 0, Wd, Ht);
  g.imageSmoothingEnabled = MAP.zoom < 3;
  drawBase(g, sx, sy, s, MAP.zoom > 0.9);
  // gradnät: 5′ latitud, 10′ longitud
  g.strokeStyle = MAPC.grid; g.lineWidth = 1; g.font = '600 11px "Barlow Condensed","Arial Narrow",sans-serif'; g.fillStyle = MAPC.text;
  const stepLat = MAP.zoom > 5 ? 1 / 60 : MAP.zoom > 0.8 ? 5 / 60 : 15 / 60, stepLon = MAP.zoom > 5 ? 2 / 60 : MAP.zoom > 0.8 ? 10 / 60 : 30 / 60;
  for (let la = 59.2; la <= 60.85; la += stepLat) {
    const y = sy(-(la - GEO.LAT0) * GEO.KZ); if (y < 0 || y > Ht) continue;
    g.beginPath(); g.moveTo(0, y); g.lineTo(Wd, y); g.stroke();
    const mm = Math.round((la % 1) * 60); g.textAlign = 'left'; g.fillText(`${Math.floor(la)}°${String(mm % 60).padStart(2, '0')}′`, 4, y - 3);
  }
  for (let lo = 17.5; lo <= 22.7; lo += stepLon) {
    const x = sx((lo - GEO.LON0) * GEO.KX); if (x < 0 || x > Wd) continue;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, Ht); g.stroke();
    const mm = Math.round((lo % 1) * 60); g.textAlign = 'center'; g.fillText(`${Math.floor(lo)}°${String(mm % 60).padStart(2, '0')}′`, x, Ht - 6);
  }
  // ortnamn
  for (const p of PLACES) {
    const [x, z] = geo(p.lat, p.lon), X = sx(x), Y = sy(z);
    if (X < -60 || Y < -20 || X > Wd + 60 || Y > Ht + 20) continue;
    if (MAP.zoom < 0.9 && !p.big && !p.water) continue;
    g.font = `${p.water ? 'italic 600' : p.big ? '700' : '600'} ${p.big ? 15 : 12.5}px "Barlow Condensed","Arial Narrow",sans-serif`;
    g.textAlign = 'center'; g.fillStyle = p.water ? '#3c6f8f' : MAPC.text;
    if (!p.water) { g.beginPath(); g.arc(X, Y, 2.2, 0, Math.PI * 2); g.fill(); }
    g.fillText(p.n, X, Y - 6);
  }
  // flygfält
  for (const zn of ZONES) {
    if (zn.kind === 'scene') continue;
    const [ax, az] = zoneWorld(zn, -zn.len / 2, 0), [bx, bz] = zoneWorld(zn, zn.len / 2, 0);
    g.strokeStyle = '#7a1f5c'; g.lineWidth = Math.max(3, zn.wid * s); g.lineCap = 'butt';
    g.beginPath(); g.moveTo(sx(ax), sy(az)); g.lineTo(sx(bx), sy(bz)); g.stroke();
  }
  for (const ap of AIRPORTS) {
    if (MAP.zoom < (ap.heli ? 1.8 : 0.9) && !ap.big) continue;
    const r = Math.max(9, ap.main.len * 0.6 * s);
    g.strokeStyle = '#7a1f5c'; g.lineWidth = 1.5; g.beginPath(); g.arc(sx(ap.x), sy(ap.z), r, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#7a1f5c'; g.font = '700 12.5px "Barlow Condensed","Arial Narrow",sans-serif'; g.textAlign = 'left';
    g.fillText((ap.iata ? ap.iata + ' ' : '') + (ap.big ? ap.name : ap.name) + (MAP.zoom > 3 && !ap.heli ? ' ' + ap.main.ends.join('/') : ''), sx(ap.x) + r + 3, sy(ap.z) + 4);
  }
  drawRoute(g, sx, sy, S);
  // uppdrag
  if (MS.state === 'run') {
    g.strokeStyle = '#c98a00'; g.fillStyle = '#c98a00'; g.lineWidth = 2;
    if (MS.rings) MS.rings.forEach((r, i) => {
      g.globalAlpha = i < MS.idx ? 0.3 : 1;
      g.beginPath(); g.arc(sx(r.x), sy(r.z), i === MS.idx ? 8 : 6, 0, Math.PI * 2); g.stroke();
      g.font = '700 12px "Barlow Condensed",sans-serif'; g.textAlign = 'center'; g.fillText(String(i + 1), sx(r.x), sy(r.z) - 11);
    });
    g.globalAlpha = 1;
    if (MS.target && !MS.rings) { g.beginPath(); g.arc(sx(MS.target.x), sy(MS.target.z), Math.max(8, MS.target.r * s), 0, Math.PI * 2); g.stroke(); }
    const goal = missionGoal();
    if (goal) { g.setLineDash([6, 5]); g.beginPath(); g.moveTo(sx(S.pos.x), sy(S.pos.z)); g.lineTo(sx(goal.x), sy(goal.z)); g.stroke(); g.setLineDash([]); }
  }
  // spår
  if (MAP.track.length > 1) {
    g.strokeStyle = 'rgba(160,30,30,.75)'; g.lineWidth = 2; g.beginPath();
    MAP.track.forEach(([x, z], i) => (i ? g.lineTo(sx(x), sy(z)) : g.moveTo(sx(x), sy(z))));
    g.lineTo(sx(S.pos.x), sy(S.pos.z)); g.stroke();
  }
  // flygplanet
  {
    const X = sx(S.pos.x), Y = sy(S.pos.z), h = S.hdg * DEG;
    // färdvektor: var planet är om 60 sekunder
    g.strokeStyle = '#b3261e'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(X, Y); g.lineTo(X + S.vel.x * 60 * s, Y + S.vel.z * 60 * s); g.stroke();
    g.save(); g.translate(X, Y); g.rotate(h);
    g.fillStyle = '#b3261e'; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -11); g.lineTo(2, -3); g.lineTo(10, 2); g.lineTo(10, 4); g.lineTo(2, 2); g.lineTo(1.5, 8); g.lineTo(4, 10); g.lineTo(-4, 10); g.lineTo(-1.5, 8); g.lineTo(-2, 2); g.lineTo(-10, 4); g.lineTo(-10, 2); g.lineTo(-2, -3); g.closePath();
    g.stroke(); g.fill(); g.restore();
  }
  // skala: km och nautiska mil
  const km = [0.5, 1, 2, 5, 10, 20].find(v => v * 1000 * s > 70) || 20;
  const nm = [0.25, 0.5, 1, 2, 5, 10].find(v => v * 1852 * s > 70) || 10;
  g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(8, 8, Math.max(km * 1000, nm * 1852) * s + 52, 40);
  g.strokeStyle = MAPC.text; g.fillStyle = MAPC.text; g.lineWidth = 2; g.font = '600 12px "Barlow Condensed",sans-serif'; g.textAlign = 'left';
  g.beginPath(); g.moveTo(14, 20); g.lineTo(14 + km * 1000 * s, 20); g.stroke(); g.fillText(km + ' km', 18 + km * 1000 * s, 24);
  g.beginPath(); g.moveTo(14, 38); g.lineTo(14 + nm * 1852 * s, 38); g.stroke(); g.fillText(nm + ' NM', 18 + nm * 1852 * s, 42);
  // nordpil
  g.save(); g.translate(Wd - 26, 64); g.fillStyle = MAPC.text;
  g.beginPath(); g.moveTo(0, -16); g.lineTo(7, 8); g.lineTo(0, 3); g.lineTo(-7, 8); g.closePath(); g.fill();
  g.font = '700 13px "Barlow Condensed",sans-serif'; g.textAlign = 'center'; g.fillText('N', 0, -20); g.restore();
  // info
  const info = document.getElementById('mapInfo');
  const txt = `${fmtLatLon(S.pos.x, S.pos.z)} · HDG ${String(Math.round(S.hdg) % 360).padStart(3, '0')}° · GS ${Math.round(S.gs * 1.944)} kt · ${Math.round(S.pos.y * 3.281)} ft`;
  if (info.textContent !== txt) info.textContent = txt;
}

// ---------- minikarta ----------
const MINI = { on: false, cv: null, g: null, size: 150, dpr: 1 };
function miniInit() {
  MINI.cv = document.getElementById('mini'); MINI.g = MINI.cv.getContext('2d');
  MINI.cv.addEventListener('pointerdown', e => { e.preventDefault(); mapToggle(true); });
}
function miniResize() {
  const r = MINI.cv.getBoundingClientRect(); MINI.dpr = Math.min(window.devicePixelRatio || 1, 2);
  MINI.size = r.width || 150; MINI.cv.width = MINI.size * MINI.dpr; MINI.cv.height = MINI.size * MINI.dpr;
}
function miniToggle(v) {
  MINI.on = v == null ? !MINI.on : v;
  document.getElementById('mini').hidden = !MINI.on;
  try { localStorage.setItem('alandsflyg.mini', MINI.on ? '1' : '0'); } catch (e) {}
  if (MINI.on) miniResize();
}
function drawMini(S) {
  if (!MINI.on || !MAP.base || MAP.open) return;
  const g = MINI.g, D = MINI.size, s = D / 14000;
  const sx = x => D / 2 + (x - S.pos.x) * s, sy = z => D / 2 + (z - S.pos.z) * s;
  g.setTransform(MINI.dpr, 0, 0, MINI.dpr, 0, 0);
  g.fillStyle = `rgb(${MAPC.deep})`; g.fillRect(0, 0, D, D);
  g.imageSmoothingEnabled = true;
  drawBase(g, sx, sy, s, true);
  drawRoute(g, sx, sy, S);
  for (const zn of ZONES) {
    if (zn.kind === 'scene') continue;
    const [ax, az] = zoneWorld(zn, -zn.len / 2, 0), [bx, bz] = zoneWorld(zn, zn.len / 2, 0);
    g.strokeStyle = '#7a1f5c'; g.lineWidth = 3; g.beginPath(); g.moveTo(sx(ax), sy(az)); g.lineTo(sx(bx), sy(bz)); g.stroke();
  }
  g.font = '600 10.5px "Barlow Condensed","Arial Narrow",sans-serif'; g.textAlign = 'center'; g.fillStyle = MAPC.text;
  for (const p of PLACES) {
    const [x, z] = geo(p.lat, p.lon), X = sx(x), Y = sy(z);
    if (X < 10 || Y < 10 || X > D - 10 || Y > D - 10) continue;
    g.fillStyle = p.water ? '#3c6f8f' : MAPC.text; g.fillText(p.n, X, Y - 3);
  }
  if (MAP.track.length > 1) {
    g.strokeStyle = 'rgba(160,30,30,.7)'; g.lineWidth = 1.5; g.beginPath();
    MAP.track.slice(-200).forEach(([x, z], i) => (i ? g.lineTo(sx(x), sy(z)) : g.moveTo(sx(x), sy(z)))); g.lineTo(D / 2, D / 2); g.stroke();
  }
  const goal = typeof missionGoal === 'function' ? missionGoal() : null;
  if (goal) {
    g.strokeStyle = '#c98a00'; g.lineWidth = 1.6; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(D / 2, D / 2); g.lineTo(sx(goal.x), sy(goal.z)); g.stroke(); g.setLineDash([]);
    g.beginPath(); g.arc(clamp(sx(goal.x), 6, D - 6), clamp(sy(goal.z), 6, D - 6), 5, 0, Math.PI * 2); g.stroke();
  }
  g.save(); g.translate(D / 2, D / 2); g.rotate(S.hdg * DEG);
  g.fillStyle = '#b3261e'; g.strokeStyle = '#fff'; g.lineWidth = 1.3;
  g.beginPath(); g.moveTo(0, -9); g.lineTo(2, -2); g.lineTo(8, 2); g.lineTo(8, 3.5); g.lineTo(1.5, 2); g.lineTo(1, 6); g.lineTo(3, 8); g.lineTo(-3, 8); g.lineTo(-1, 6); g.lineTo(-1.5, 2); g.lineTo(-8, 3.5); g.lineTo(-8, 2); g.lineTo(-2, -2); g.closePath();
  g.stroke(); g.fill(); g.restore();
  g.fillStyle = MAPC.text; g.font = '700 11px "Barlow Condensed",sans-serif'; g.fillText('N', D / 2, 12);
}
