// ===================== VÄRLD: Ålands hav-regionen (land/vatten, höjder, marktyp, flygplatser) =====================
// Ingen DOM här. initWorld() anropas med två masker: Åland i hög upplösning och hela regionen i 50 m.
const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------- brus ----------
function hash2(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
function fbm(x, y, oct) {
  let s = 0, amp = 1, f = 1, norm = 0;
  for (let o = 0; o < oct; o++) { s += amp * vnoise(x * f + o * 17.3, y * f - o * 9.1); norm += amp; amp *= 0.5; f *= 2.03; }
  return s / norm;
}

// ---------- geografi ----------
// Lokal plan projektion kring 60,2°N 20,0°E. x = öster, z = söder (Three.js: -z är norr).
const GEO = { LAT0: 60.2, LON0: 20.0, KX: 111320 * Math.cos(60.2 * DEG), KZ: 110574 };
function geo(lat, lon) { return [(lon - GEO.LON0) * GEO.KX, -(lat - GEO.LAT0) * GEO.KZ]; }
function ungeo(x, z) { return [GEO.LAT0 - z / GEO.KZ, GEO.LON0 + x / GEO.KX]; }
function fmtLatLon(x, z) {
  const [la, lo] = ungeo(x, z);
  const f = (v, p, n) => { const d = Math.floor(Math.abs(v)), m = (Math.abs(v) - d) * 60; return `${v >= 0 ? p : n} ${d}°${m.toFixed(1).padStart(4, '0')}′`; };
  return f(la, 'N', 'S') + '  ' + f(lo, 'E', 'W');
}

// Åland i hög upplösning (72 × 72 km) och hela regionen (Stockholm – Åbo)
const T_SIZE = 72000, T_HALF = T_SIZE / 2;
const REG = { x0: -135000, x1: 140000, z0: -62000, z1: 105000 };
const W = { coreN: 2048, core: null, regNX: 2750, regNZ: 1670, reg: null, ready: false };

// ---------- platser ----------
const PLACES = [
  { n: 'Mariehamn', lat: 60.097, lon: 19.934, big: true }, { n: 'Jomala', lat: 60.153, lon: 19.951 },
  { n: 'Godby', lat: 60.236, lon: 19.983 }, { n: 'Kastelholm', lat: 60.229, lon: 20.083 },
  { n: 'Bomarsund', lat: 60.212, lon: 20.24 }, { n: 'Saltvik', lat: 60.282, lon: 20.06 },
  { n: 'Geta', lat: 60.375, lon: 19.84 }, { n: 'Eckerö', lat: 60.222, lon: 19.56 },
  { n: 'Hammarland', lat: 60.218, lon: 19.74 }, { n: 'Lemland', lat: 60.07, lon: 20.1 },
  { n: 'Vårdö', lat: 60.245, lon: 20.37 }, { n: 'Degerby', lat: 60.032, lon: 20.385 },
  { n: 'Lumparn', lat: 60.16, lon: 20.125, water: true }, { n: 'Orrdalsklint', lat: 60.316, lon: 20.135 },
  { n: 'Kumlinge', lat: 60.26, lon: 20.78 }, { n: 'Brändö', lat: 60.41, lon: 21.05 }, { n: 'Kökar', lat: 59.92, lon: 20.91 },
  { n: 'Sottunga', lat: 60.13, lon: 20.67 }, { n: 'Iniö', lat: 60.4, lon: 21.4 }, { n: 'Houtskari', lat: 60.22, lon: 21.37 },
  { n: 'Korppoo', lat: 60.16, lon: 21.56 }, { n: 'Nauvo', lat: 60.19, lon: 21.91 }, { n: 'Parainen', lat: 60.3, lon: 22.3, big: true },
  { n: 'Turku', lat: 60.452, lon: 22.267, big: true }, { n: 'Naantali', lat: 60.467, lon: 22.025 }, { n: 'Raisio', lat: 60.486, lon: 22.17 },
  { n: 'Stockholm', lat: 59.33, lon: 18.065, big: true }, { n: 'Norrtälje', lat: 59.758, lon: 18.705, big: true },
  { n: 'Märsta', lat: 59.62, lon: 17.855 }, { n: 'Upplands Väsby', lat: 59.52, lon: 17.91 }, { n: 'Täby', lat: 59.444, lon: 18.07 },
  { n: 'Åkersberga', lat: 59.48, lon: 18.3 }, { n: 'Vallentuna', lat: 59.534, lon: 18.078 }, { n: 'Kapellskär', lat: 59.72, lon: 19.06 },
  { n: 'Grisslehamn', lat: 60.1, lon: 18.82 }, { n: 'Hallstavik', lat: 60.05, lon: 18.6 }, { n: 'Östhammar', lat: 60.258, lon: 18.37 },
  { n: 'Öregrund', lat: 60.34, lon: 18.44 }, { n: 'Väddö', lat: 59.98, lon: 18.85 }, { n: 'Sea of Åland', lat: 60.0, lon: 19.35, water: true },
  { n: 'Archipelago Sea', lat: 60.05, lon: 21.4, water: true }, { n: 'Lake Mälaren', lat: 59.37, lon: 17.75, water: true }
];
const MHAMN = geo(60.098, 19.935);
// tätorter: radie i meter, täthet (0–1) och gatunätets vridning
const TOWNS = [
  { n: 'Mariehamn', lat: 60.0985, lon: 19.938, r: 1550, dense: 0.55, ang: 12 },
  { n: 'Stockholm', lat: 59.335, lon: 18.04, r: 7800, dense: 1.0, ang: 0 },
  { n: 'Solna', lat: 59.37, lon: 17.99, r: 2600, dense: 0.8, ang: 20 },
  { n: 'Nacka', lat: 59.31, lon: 18.17, r: 2600, dense: 0.6, ang: 35 },
  { n: 'Sollentuna', lat: 59.43, lon: 17.95, r: 2600, dense: 0.55, ang: 8 },
  { n: 'Täby', lat: 59.444, lon: 18.07, r: 2600, dense: 0.55, ang: 15 },
  { n: 'Lidingö', lat: 59.365, lon: 18.15, r: 1800, dense: 0.45, ang: 25 },
  { n: 'Upplands Väsby', lat: 59.52, lon: 17.91, r: 1900, dense: 0.5, ang: 5 },
  { n: 'Märsta', lat: 59.622, lon: 17.855, r: 1500, dense: 0.45, ang: 18 },
  { n: 'Vallentuna', lat: 59.534, lon: 18.078, r: 1300, dense: 0.4, ang: 30 },
  { n: 'Åkersberga', lat: 59.48, lon: 18.3, r: 1700, dense: 0.4, ang: 22 },
  { n: 'Norrtälje', lat: 59.758, lon: 18.705, r: 1700, dense: 0.5, ang: 10 },
  { n: 'Hallstavik', lat: 60.05, lon: 18.6, r: 900, dense: 0.35, ang: 40 },
  { n: 'Östhammar', lat: 60.258, lon: 18.37, r: 900, dense: 0.35, ang: 15 },
  { n: 'Öregrund', lat: 60.34, lon: 18.44, r: 650, dense: 0.35, ang: 0 },
  { n: 'Turku', lat: 60.452, lon: 22.265, r: 4800, dense: 0.9, ang: 28 },
  { n: 'Raisio', lat: 60.486, lon: 22.17, r: 1800, dense: 0.5, ang: 10 },
  { n: 'Naantali', lat: 60.467, lon: 22.025, r: 1300, dense: 0.4, ang: 0 },
  { n: 'Kaarina', lat: 60.41, lon: 22.37, r: 2200, dense: 0.5, ang: 15 },
  { n: 'Parainen', lat: 60.302, lon: 22.3, r: 1200, dense: 0.4, ang: 30 }
].map(t => Object.assign(t, { p: geo(t.lat, t.lon), a: t.ang * DEG, block: t.dense > 0.8 ? 110 : 90 }));
const TOWN_STREET = 12;
// huvudvägar på Åland (ungefärliga sträckningar) – målas i terrängen och på kartan
const ROADS = [
  [[60.098, 19.94], [60.125, 19.945], [60.153, 19.951], [60.2, 19.97], [60.236, 19.983]],
  [[60.236, 19.983], [60.232, 20.03], [60.229, 20.083], [60.222, 20.16], [60.212, 20.24]],
  [[60.1, 19.93], [60.14, 19.89], [60.17, 19.86], [60.2, 19.8], [60.218, 19.74], [60.222, 19.65], [60.222, 19.56]],
  [[60.236, 19.983], [60.26, 20.03], [60.282, 20.06]],
  [[60.236, 19.983], [60.275, 19.94], [60.31, 19.9], [60.345, 19.86], [60.375, 19.84]],
  [[60.098, 19.945], [60.085, 20.0], [60.075, 20.06], [60.07, 20.1]],
  // E18 Kapellskär – Norrtälje – Stockholm, väg 76 och E4 mot Arlanda
  [[59.72, 19.06], [59.74, 18.85], [59.758, 18.705], [59.62, 18.5], [59.5, 18.25], [59.42, 18.1], [59.34, 18.05]],
  [[59.758, 18.705], [59.9, 18.62], [60.05, 18.6], [60.1, 18.82]],
  [[59.34, 18.05], [59.43, 17.95], [59.52, 17.91], [59.6, 17.88], [59.65, 17.9]],
  // Åbo – Reso – Nådendal, Åbo – Pargas
  [[60.452, 22.265], [60.486, 22.17], [60.467, 22.025]], [[60.452, 22.265], [60.41, 22.37]], [[60.452, 22.265], [60.35, 22.3], [60.302, 22.3]]
].map(r => r.map(([la, lo]) => geo(la, lo)));
// tätortsgrad i punkten (från marktäcket); andra värdet finns kvar för äldre anrop
function townAt(x, z) { return [urbanAt(x, z), null]; }

// ---------- flygplatser (banändar från OurAirports) ----------
const FT = 0.3048;
function zoneFromEnds(o) {
  const [x1, z1] = geo(o.a[0], o.a[1]), [x2, z2] = geo(o.b[0], o.b[1]);
  const len = Math.hypot(x2 - x1, z2 - z1);
  return Object.assign({ x: (x1 + x2) / 2, z: (z1 + z2) / 2, len, hdg: (Math.atan2(x2 - x1, -(z2 - z1)) / DEG + 360) % 360 }, o);
}
function zoneFromCenter(o) { const [x, z] = geo(o.c[0], o.c[1]); return Object.assign({ x, z }, o); }
const AIRPORTS = [
  { icao: 'EFMA', iata: 'MHQ', name: 'Mariehamn', big: true, elev: 5, terminal: { side: 1, along: 60, across: 285 } },
  { icao: 'ESSA', iata: 'ARN', name: 'Stockholm-Arlanda', big: true, elev: 38, terminal: { side: 1, along: 0, across: 420 } },
  { icao: 'ESSB', iata: 'BMA', name: 'Stockholm-Bromma', big: true, elev: 14, terminal: { side: -1, along: 0, across: 230 } },
  { icao: 'EFTU', iata: 'TKU', name: 'Turku', big: true, elev: 45, terminal: { side: -1, along: 100, across: 260 } },
  { icao: 'SALT', iata: '', name: 'Saltvik airstrip', elev: 10 },
  { icao: 'EFKG', iata: '', name: 'Kumlinge', elev: 3 },
  { icao: 'ESSN', iata: '', name: 'Norrtälje', elev: 12 },
  { icao: 'ESKA', iata: '', name: 'Lunda', elev: 16 },
  { icao: 'EFGE', iata: '', name: 'Genböle', elev: 14 },
  { icao: 'LIND', iata: '', name: 'Lindholmen', elev: 23 },
  { icao: 'GIMO', iata: '', name: 'Gimo', elev: 14 },
  { icao: 'ACS', iata: '', name: 'Mariehamn Hospital', heli: true, elev: 8 },
  { icao: 'TYKS', iata: '', name: 'Turku University Hospital', heli: true, elev: 30 },
  { icao: 'KS', iata: '', name: 'Karolinska Solna', heli: true, elev: 20 }
];
const APT = Object.fromEntries(AIRPORTS.map(a => [a.icao, a]));
const ZONES = [
  // ordningen spelar roll: uppdragen använder ZONES[0] (Mariehamn) och ZONES[1] (Saltvik)
  zoneFromEnds({ id: 'efma', apt: 'EFMA', name: 'Mariehamn (EFMA)', short: 'EFMA', a: [60.114333, 19.891333], b: [60.130, 19.905], wid: 45, pad: 240, margin: 450, elev: 5, kind: 'asphalt', ends: ['03', '21'] }),
  zoneFromCenter({ id: 'strip', apt: 'SALT', name: 'Saltvik airstrip', short: 'Saltvik', c: [60.279, 20.088], hdg: 72, len: 620, wid: 26, pad: 230, margin: 300, elev: 10, kind: 'grass', ends: ['07', '25'] }),
  zoneFromEnds({ id: 'essa01l', apt: 'ESSA', name: 'Arlanda (ESSA)', short: 'ESSA', a: [59.637299, 17.9132], b: [59.666401, 17.9238], wid: 45, pad: 200, margin: 500, elev: 38, kind: 'asphalt', ends: ['01L', '19R'] }),
  zoneFromEnds({ id: 'essa01r', apt: 'ESSA', name: 'Arlanda (ESSA)', short: 'ESSA', a: [59.6264, 17.9507], b: [59.648499, 17.9587], wid: 45, pad: 200, margin: 500, elev: 38, kind: 'asphalt', ends: ['01R', '19L'] }),
  zoneFromEnds({ id: 'essa08', apt: 'ESSA', name: 'Arlanda (ESSA)', short: 'ESSA', a: [59.658401, 17.9361], b: [59.663898, 17.9792], wid: 45, pad: 200, margin: 500, elev: 38, kind: 'asphalt', ends: ['08', '26'] }),
  zoneFromEnds({ id: 'essb', apt: 'ESSB', name: 'Bromma (ESSB)', short: 'ESSB', a: [59.3587, 17.9296], b: [59.3501, 17.9537], wid: 45, pad: 220, margin: 450, elev: 14, kind: 'asphalt', ends: ['12', '30'] }),
  zoneFromEnds({ id: 'eftu', apt: 'EFTU', name: 'Turku (EFTU)', short: 'EFTU', a: [60.5131, 22.2401], b: [60.5151, 22.2855], wid: 60, pad: 230, margin: 500, elev: 45, kind: 'asphalt', ends: ['08', '26'] }),
  zoneFromEnds({ id: 'eska', apt: 'ESKA', name: 'Lunda (ESKA)', short: 'ESKA', a: [60.127434, 18.091719], b: [60.132315, 18.103836], wid: 25, pad: 150, margin: 350, elev: 16, kind: 'asphalt', ends: ['05', '23'] }),
  zoneFromCenter({ id: 'efkg', apt: 'EFKG', name: 'Kumlinge (EFKG)', short: 'EFKG', c: [60.2469, 20.8047], hdg: 156, len: 600, wid: 18, pad: 150, margin: 300, elev: 3, kind: 'asphalt', ends: ['15', '33'] }),
  zoneFromCenter({ id: 'essn', apt: 'ESSN', name: 'Norrtälje (ESSN)', short: 'ESSN', c: [59.732592, 18.695215], hdg: 76, len: 800, wid: 18, pad: 150, margin: 300, elev: 12, kind: 'asphalt', ends: ['07', '25'] }),
  zoneFromCenter({ id: 'efge', apt: 'EFGE', name: 'Genböle', short: 'EFGE', c: [60.0869, 22.5219], hdg: 76, len: 630, wid: 14, pad: 150, margin: 300, elev: 14, kind: 'grass', ends: ['07', '25'] }),
  zoneFromCenter({ id: 'lind', apt: 'LIND', name: 'Lindholmen', short: 'Lindholmen', c: [59.58588, 18.161], hdg: 66, len: 1100, wid: 30, pad: 150, margin: 300, elev: 23, kind: 'grass', ends: ['06', '24'] }),
  zoneFromCenter({ id: 'gimo', apt: 'GIMO', name: 'Gimo airstrip', short: 'Gimo', c: [60.177022, 18.194143], hdg: 16, len: 600, wid: 15, pad: 150, margin: 300, elev: 14, kind: 'grass', ends: ['01', '19'] }),
  // sjukhusens helikopterplattor (ungefärliga lägen)
  zoneFromCenter({ id: 'acs', apt: 'ACS', name: 'Mariehamn Hospital', short: 'HOSPITAL', c: [60.1045, 19.9418], hdg: 0, len: 26, wid: 26, pad: 35, margin: 70, elev: 8, kind: 'helipad', ends: ['H', 'H'] }),
  zoneFromCenter({ id: 'tyks', apt: 'TYKS', name: 'Turku University Hospital', short: 'TYKS', c: [60.4495, 22.2935], hdg: 0, len: 26, wid: 26, pad: 35, margin: 70, elev: 30, kind: 'helipad', ends: ['H', 'H'] }),
  zoneFromCenter({ id: 'ks', apt: 'KS', name: 'Karolinska Solna', short: 'KAROLINSKA', c: [59.3505, 18.0315], hdg: 0, len: 26, wid: 26, pad: 35, margin: 70, elev: 20, kind: 'helipad', ends: ['H', 'H'] }),
  // olycksplatser för ambulanshelikoptern (flyttas till närmaste lämpliga mark vid start)
  zoneFromCenter({ id: 'sc_geta', name: 'Getabergen', short: 'SCENE', c: [60.372, 19.845], hdg: 0, len: 30, wid: 30, pad: 25, margin: 60, elev: 20, kind: 'scene', ends: ['', ''] }),
  zoneFromCenter({ id: 'sc_vardo', name: 'Vårdö', short: 'SCENE', c: [60.243, 20.365], hdg: 0, len: 30, wid: 30, pad: 25, margin: 60, elev: 10, kind: 'scene', ends: ['', ''] }),
  zoneFromCenter({ id: 'sc_foglo', name: 'Föglö', short: 'SCENE', c: [60.03, 20.43], hdg: 0, len: 30, wid: 30, pad: 25, margin: 60, elev: 10, kind: 'scene', ends: ['', ''] }),
  zoneFromCenter({ id: 'sc_kokar', name: 'Kökar', short: 'SCENE', c: [59.921, 20.912], hdg: 0, len: 30, wid: 30, pad: 25, margin: 60, elev: 8, kind: 'scene', ends: ['', ''] })
];
for (const zn of ZONES) {
  zn.big = zn.kind === 'asphalt' && zn.len > 1500;
  zn.reach = zn.len / 2 + zn.pad + zn.margin + zn.wid;
  zn.small = zn.kind === 'helipad' || zn.kind === 'scene'; // planar inte terrängen, följer den
}
for (const a of AIRPORTS) {
  a.zones = ZONES.filter(z => z.apt === a.icao);
  if (!a.zones.length) a.zones = [ZONES[0]];
  const zs = a.zones; a.x = zs.reduce((s, z) => s + z.x, 0) / zs.length; a.z = zs.reduce((s, z) => s + z.z, 0) / zs.length;
  a.main = zs.reduce((m, z) => (z.len > m.len ? z : m), zs[0]);
  a.label = a.iata || a.icao;
}
function zoneLocal(zn, x, z) {
  const s = Math.sin(zn.hdg * DEG), c = Math.cos(zn.hdg * DEG), dx = x - zn.x, dz = z - zn.z;
  return [dx * s - dz * c, dx * c + dz * s];
}
function zoneWorld(zn, along, across) {
  const s = Math.sin(zn.hdg * DEG), c = Math.cos(zn.hdg * DEG);
  return [zn.x + along * s + across * c, zn.z - along * c + across * s];
}
function zoneBlend(x, z, skipSmall) {
  let best = 0, elev = 0;
  for (const zn of ZONES) {
    if (skipSmall && zn.small) continue;
    if (Math.abs(x - zn.x) > zn.reach || Math.abs(z - zn.z) > zn.reach) continue;
    const [a, c] = zoneLocal(zn, x, z);
    const dx = Math.max(Math.abs(a) - (zn.len / 2 + zn.pad), 0), dz = Math.max(Math.abs(c) - (zn.wid / 2 + zn.pad), 0);
    const b = 1 - smooth(0, zn.margin, Math.hypot(dx, dz));
    if (b > best) { best = b; elev = zn.elev; }
  }
  for (const ap of AIRPORTS) {
    if (!ap.flat) continue;
    const d = Math.hypot(x - ap.x, z - ap.z);
    if (d > ap.flat + 700) continue;
    const b = 1 - smooth(ap.flat, ap.flat + 700, d);
    if (b > best) { best = b; elev = ap.elev; }
  }
  return [best, elev];
}
function inRunway(x, z, extra = 0) {
  for (const zn of ZONES) {
    if (Math.abs(x - zn.x) > zn.reach || Math.abs(z - zn.z) > zn.reach) continue;
    const [a, c] = zoneLocal(zn, x, z);
    if (Math.abs(a) <= zn.len / 2 + extra && Math.abs(c) <= zn.wid / 2 + extra) return zn;
  }
  return null;
}

// ---------- avståndsfält ----------
function chamfer(land, NX, NZ, cell) {
  const INF = 1e9, b = Math.SQRT2;
  const pass = inside => {
    const d = new Float32Array(NX * NZ);
    for (let k = 0; k < NX * NZ; k++) d[k] = (land[k] === 1) === inside ? INF : 0;
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i; let v = d[k]; if (v === 0) continue;
      if (i > 0) v = Math.min(v, d[k - 1] + 1);
      if (j > 0) { v = Math.min(v, d[k - NX] + 1); if (i > 0) v = Math.min(v, d[k - NX - 1] + b); if (i < NX - 1) v = Math.min(v, d[k - NX + 1] + b); }
      d[k] = v;
    }
    for (let j = NZ - 1; j >= 0; j--) for (let i = NX - 1; i >= 0; i--) {
      const k = j * NX + i; let v = d[k]; if (v === 0) continue;
      if (i < NX - 1) v = Math.min(v, d[k + 1] + 1);
      if (j < NZ - 1) { v = Math.min(v, d[k + NX] + 1); if (i < NX - 1) v = Math.min(v, d[k + NX + 1] + b); if (i > 0) v = Math.min(v, d[k + NX - 1] + b); }
      d[k] = v;
    }
    return d;
  };
  const dl = pass(true), dw = pass(false), out = new Int16Array(NX * NZ);
  for (let k = 0; k < NX * NZ; k++) out[k] = land[k] ? Math.min(dl[k] * cell, 30000) : -Math.min(dw[k] * cell, 30000);
  return out;
}
function downsample(mask, MX, MZ) {
  const NX = MX >> 1, NZ = MZ >> 1, land = new Uint8Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const k = 2 * j * MX + 2 * i;
    land[j * NX + i] = (mask[k] + mask[k + 1] + mask[k + MX] + mask[k + MX + 1]) >= 2 ? 1 : 0;
  }
  return land;
}
function sampleGrid(D, NX, NZ, fx, fz) {
  fx = clamp(fx, 0, NX - 1.001); fz = clamp(fz, 0, NZ - 1.001);
  const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, k = iz * NX + ix;
  return lerp(lerp(D[k], D[k + 1], tx), lerp(D[k + NX], D[k + NX + 1], tx), tz);
}
// signerat avstånd till kusten i meter (+ på land, − i vattnet)
function coastDist(x, z) {
  const ax = Math.abs(x), az = Math.abs(z);
  const wc = ax < T_HALF && az < T_HALF ? clamp((T_HALF - ax) / 2500, 0, 1) * clamp((T_HALF - az) / 2500, 0, 1) : 0;
  let dc = 0, dr = 0;
  if (wc > 0) { const N = W.coreN; dc = sampleGrid(W.core, N, N, (x + T_HALF) / T_SIZE * N - 0.5, (z + T_HALF) / T_SIZE * N - 0.5); }
  if (wc < 1) dr = sampleGrid(W.reg, W.regNX, W.regNZ, (x - REG.x0) / 100 - 0.5, (z - REG.z0) / 100 - 0.5);
  return wc >= 1 ? dc : wc <= 0 ? dr : lerp(dr, dc, wc);
}
// kustlinje med finare detaljer: avståndsfältet plus brus nära kusten
function landSDF(x, z) {
  const d = coastDist(x, z);
  if (d > 150 || d < -150) return d;
  const inCore = Math.abs(x) < T_HALF && Math.abs(z) < T_HALF;
  // kustlinjen kommer från OpenStreetMap; bruset ger bara lite liv åt kanterna mellan rutnätspunkterna
  const amp = inCore ? 6 : 12;
  let s = d + (vnoise(x / 70, z / 70) * 0.6 + vnoise(x / 23 + 5, z / 23 - 3) * 0.4) * amp;
  // banorna ligger alltid på land
  for (const zn of ZONES) {
    if (Math.abs(x - zn.x) > zn.reach || Math.abs(z - zn.z) > zn.reach) continue;
    const [a, c] = zoneLocal(zn, x, z);
    const ex = Math.max(Math.abs(a) - zn.len / 2 - 120, 0), ez = Math.max(Math.abs(c) - zn.wid / 2 - 90, 0);
    s = Math.max(s, 60 - Math.hypot(ex, ez));
  }
  return s;
}
function isLand(x, z) { return landSDF(x, z) > 0; }

// ---------- verkliga kartdata ----------
// Marktäcke: ESA WorldCover 10 m (CC BY 4.0) förfinat med OpenStreetMap; höjder: Copernicus DEM GLO-30;
// vägar, byggnader, fyrar: © OpenStreetMap contributors (ODbL). Byggs av coast/build_map.py.
// Klasser (låga 4 bitar): 0 hav, 1 skog, 2 buskmark, 3 gräs/äng, 4 åker, 5 tät bebyggelse, 6 berg/häll,
// 7 sjö, 8 våtmark, 9 villaområde, 10 industri/asfalt, 11 sand. Höga 4 bitar: ton (åkerskifte, hällskog).
const MAPD = {
  lcC: null, lcCN: 3600, lcR: null, lcRX: 5500, lcRZ: 3340, lcRC: 50,
  hC: null, hCN: 1024, hR: null, hRX: 2750, hRZ: 1670, hRC: 100,
  roads: [], rgrid: new Map(), pois: null, tiles: {}, tile: new Map(), urb: null, urbX: 0, urbZ: 0, base: 'data/', fetch: null
};
const RCH = 9000; // rutnätet för vägar och byggnader (samma som terrängrutorna)
async function mapBytes(name) {
  if (MAPD.fetch) return MAPD.fetch(name);
  let buf;
  if (typeof MAP_EMBED !== 'undefined' && MAP_EMBED[name]) {
    const bin = atob(MAP_EMBED[name]); buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  } else {
    const r = await fetch(MAPD.base + name);
    if (!r.ok) throw new Error(name + ' ' + r.status);
    buf = new Uint8Array(await r.arrayBuffer());
  }
  if (!name.endsWith('.bin')) return buf;
  if (typeof DecompressionStream === 'undefined') throw new Error('this browser is too old for the map data – please update it');
  const ds = new DecompressionStream('gzip');
  return new Uint8Array(await new Response(new Blob([buf]).stream().pipeThrough(ds)).arrayBuffer());
}
function decodeH(b, NX, NZ, q) {
  const i8 = new Int8Array(b.buffer, b.byteOffset, b.length), a = new Int32Array(NX * NZ), out = new Float32Array(NX * NZ);
  for (let j = 0, k = 0; j < NZ; j++) for (let i = 0; i < NX; i++, k++) {
    const p = i > 0 && j > 0 ? a[k - 1] + a[k - NX] - a[k - NX - 1] : i > 0 ? a[k - 1] : j > 0 ? a[k - NX] : 0;
    a[k] = p + i8[k]; out[k] = a[k] * q;
  }
  return out;
}
function decodeRoads(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.length), n = dv.getUint32(0, true), out = [];
  let o = 4;
  for (let r = 0; r < n; r++) {
    const c = dv.getUint8(o), m = dv.getUint16(o + 1, true); let x = dv.getInt32(o + 3, true), z = dv.getInt32(o + 7, true); o += 11;
    const pts = new Float32Array(m * 2); pts[0] = x; pts[1] = z;
    let x0 = x, x1 = x, z0 = z, z1 = z;
    for (let k = 1; k < m; k++) { x += dv.getInt16(o, true); z += dv.getInt16(o + 2, true); o += 4; pts[k * 2] = x; pts[k * 2 + 1] = z; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    out.push({ c: c & 15, br: c >> 4 & 1, pts, bb: [x0, z0, x1, z1] });
  }
  return { list: out, end: o };
}
function indexRoads(list, into) {
  for (const r of list) {
    const [x0, z0, x1, z1] = r.bb;
    for (let ci = Math.floor((x0 - 40) / RCH); ci <= Math.floor((x1 + 40) / RCH); ci++)
      for (let cj = Math.floor((z0 - 40) / RCH); cj <= Math.floor((z1 + 40) / RCH); cj++) {
        const k = ci + ',' + cj; let L = into.get(k); if (!L) into.set(k, L = []); L.push(r);
      }
  }
}
const MAP_FILES = ['lc_core.bin', 'h_core.bin', 'lc_reg.bin', 'h_reg.bin', 'roads_core.bin', 'roads_reg.bin', 'pois.json', 't/index.json'];
async function loadMapData(progress) {
  let done = 0;
  const got = await Promise.all(MAP_FILES.map(n => mapBytes(n).then(b => { done++; if (progress) progress(done / MAP_FILES.length); return b; })));
  applyMapData(got);
}
function applyMapData(got) {
  const [lcC, hC, lcR, hR, rC, rR, pois, idx] = got;
  MAPD.lcC = lcC; MAPD.lcR = lcR;
  MAPD.hC = decodeH(hC, MAPD.hCN, MAPD.hCN, 0.25);
  MAPD.hR = decodeH(hR, MAPD.hRX, MAPD.hRZ, 0.5);
  const td = new TextDecoder();
  MAPD.pois = JSON.parse(td.decode(pois)); MAPD.tiles = JSON.parse(td.decode(idx));
  MAPD.roads = decodeRoads(rC).list.concat(decodeRoads(rR).list);
  indexRoads(MAPD.roads, MAPD.rgrid);
  buildUrban();
}
// ---------- rutor med småvägar och byggnader som hämtas medan man flyger ----------
function tileState(ci, cj) {
  const k = ci + ',' + cj;
  if (!MAPD.tiles[k]) return { ready: true, roads: [], bld: null };
  let t = MAPD.tile.get(k);
  if (!t) {
    t = { ready: false, roads: [], bld: null, used: 0 };
    MAPD.tile.set(k, t);
    mapBytes('t/' + ci + '_' + cj + '.bin').then(b => {
      const r = decodeRoads(b); t.roads = r.list; t.bld = b.subarray(r.end); t.ready = true;
      if (MAPD.onTile) MAPD.onTile(ci, cj);
    }).catch(() => { t.ready = true; });
  }
  t.used = performance.now();
  if (MAPD.tile.size > 60) {
    // glöm de rutor som inte använts på längst tid
    const old = [...MAPD.tile.entries()].filter(e => e[1].ready).sort((a, b) => a[1].used - b[1].used);
    for (let i = 0; i < old.length - 50; i++) MAPD.tile.delete(old[i][0]);
  }
  return t;
}
function roadsNear(ci, cj, minor) {
  const a = MAPD.rgrid.get(ci + ',' + cj) || [];
  if (!minor) return a;
  const t = tileState(ci, cj);
  return t.roads.length ? a.concat(t.roads) : a;
}
// marktäcke i en punkt (byte med klass och ton)
function lcAt(x, z) {
  if (!MAPD.lcC) return 1;
  if (x > -T_HALF && x < T_HALF && z > -T_HALF && z < T_HALF) {
    const N = MAPD.lcCN, i = ((x + T_HALF) / T_SIZE * N) | 0, j = ((z + T_HALF) / T_SIZE * N) | 0;
    return MAPD.lcC[j * N + i];
  }
  const i = Math.floor((x - REG.x0) / MAPD.lcRC), j = Math.floor((z - REG.z0) / MAPD.lcRC);
  if (i < 0 || j < 0 || i >= MAPD.lcRX || j >= MAPD.lcRZ) return 0;
  return MAPD.lcR[j * MAPD.lcRX + i];
}
// tätortsgrad 0–1 (rutnät om 150 m över hela regionen, utjämnat)
function buildUrban() {
  const C = 3, NX = Math.floor(MAPD.lcRX / C), NZ = Math.floor(MAPD.lcRZ / C), u = new Float32Array(NX * NZ);
  const wgt = [0, 0, 0, 0, 0, 1, 0, 0, 0, 0.55, 0.7, 0];
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    let s = 0;
    for (let b = 0; b < C; b++) for (let a = 0; a < C; a++) s += wgt[MAPD.lcR[(j * C + b) * MAPD.lcRX + i * C + a] & 15] || 0;
    u[j * NX + i] = s / (C * C);
  }
  const v = new Float32Array(NX * NZ);
  for (let j = 1; j < NZ - 1; j++) for (let i = 1; i < NX - 1; i++) {
    let s = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) s += u[(j + b) * NX + i + a];
    v[j * NX + i] = Math.min(1, s / 9 * 2.2);
  }
  MAPD.urb = v; MAPD.urbX = NX; MAPD.urbZ = NZ;
}
function urbanAt(x, z) {
  if (!MAPD.urb) return 0;
  return sampleGrid(MAPD.urb, MAPD.urbX, MAPD.urbZ, (x - REG.x0) / 150 - 0.5, (z - REG.z0) / 150 - 0.5);
}
// höjd över havet enligt höjdmodellen (Åland 70 m, regionen 100 m)
function demH(x, z) {
  if (!MAPD.hC) return 2;
  const ax = Math.abs(x), az = Math.abs(z);
  const wc = ax < T_HALF && az < T_HALF ? clamp((T_HALF - ax) / 2500, 0, 1) * clamp((T_HALF - az) / 2500, 0, 1) : 0;
  let hc = 0, hr = 0;
  if (wc > 0) { const N = MAPD.hCN; hc = sampleGrid(MAPD.hC, N, N, (x + T_HALF) / T_SIZE * N - 0.5, (z + T_HALF) / T_SIZE * N - 0.5); }
  if (wc < 1) hr = sampleGrid(MAPD.hR, MAPD.hRX, MAPD.hRZ, (x - REG.x0) / MAPD.hRC - 0.5, (z - REG.z0) / MAPD.hRC - 0.5);
  return wc >= 1 ? hc : wc <= 0 ? hr : lerp(hr, hc, wc);
}
function landHeight(x, z, dIn) {
  const d = dIn != null ? dIn : coastDist(x, z);
  if (d <= 0) return 0;
  // närmast stranden går marken mjukt ner till vattenytan
  return Math.max(0.6, demH(x, z) * smooth(0, 60, d) + 0.6);
}
// höjd i en punkt inklusive utplaning vid flygfält (används för terrängnätets hörn)
function heightAt(x, z) {
  const d = coastDist(x, z);
  let h = d > 0 ? landHeight(x, z, d) : 0;
  const [b, elev] = zoneBlend(x, z, true);
  if (b > 0) h = lerp(h, elev, b);
  return h;
}
// fysik och närmaste terrängnät delar samma gitter (140,625 m)
const LATT = 9000 / 64;
const HCACHE = new Map();
function hv(i, j) {
  const key = i * 131071 + j;
  let h = HCACHE.get(key);
  if (h === undefined) {
    h = heightAt(i * LATT, j * LATT);
    if (HCACHE.size > 250000) HCACHE.clear();
    HCACHE.set(key, h);
  }
  return h;
}
function latticeH(x, z) {
  const fx = x / LATT, fz = z / LATT, ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
  const a = hv(ix, iz), b = hv(ix + 1, iz), c = hv(ix, iz + 1), d = hv(ix + 1, iz + 1);
  return tx + tz <= 1 ? a + (b - a) * tx + (c - a) * tz : d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
}

function initWorld(coreMask, regMask) {
  // Åland: 4096² → 2048² (35 m), regionen: 5500 × 3340 → 2750 × 1670 (100 m)
  W.core = chamfer(downsample(coreMask, 4096, 4096), 2048, 2048, T_SIZE / 2048);
  W.reg = chamfer(downsample(regMask, 5500, 3340), W.regNX, W.regNZ, 100);
  W.ready = true;
  // banornas höjd från höjdmodellen (medianen längs banan); flygplatser med flera banor får en gemensam nivå
  for (const zn of ZONES) {
    if (zn.small) continue;
    const hs = [];
    for (let k = -4; k <= 4; k++) { const [x, z] = zoneWorld(zn, k / 8 * zn.len, 0); hs.push(landHeight(x, z)); }
    hs.sort((a, b) => a - b); zn.elev = Math.max(1, Math.round(hs[4] * 2) / 2);
  }
  for (const ap of AIRPORTS) {
    if (ap.zones[0].small) continue;
    if (ap.flat) { const e = Math.round(ap.zones.reduce((s, z) => s + z.elev, 0) / ap.zones.length * 2) / 2; for (const z of ap.zones) z.elev = e; }
    ap.elev = ap.main.elev;
  }
  // olycksplatser: närmaste öppna mark (inte tätort, inte nära vatten), höjd från terrängen
  for (const zn of ZONES) {
    if (zn.kind === 'scene') {
      let best = null;
      for (const need of [70, 40, 20]) for (let r = 0; r < 3000 && !best; r += 60) for (let k = 0; k < 16 && !best; k++) {
        const a = k / 16 * Math.PI * 2, x = zn.x + Math.cos(a) * r, z = zn.z + Math.sin(a) * r;
        if (coastDist(x, z) > need && townAt(x, z)[0] < 0.1 && !waterAt(x, z) && [3, 4, 2].includes(lcAt(x, z) & 15)) best = [x, z];
      }
      if (best) { zn.x = best[0]; zn.z = best[1]; }
    }
    if (zn.small) {
      if (zn.kind === 'scene') zn.elev = Math.max(latticeH(zn.x, zn.z), 0.3);
      else { let m = 0; for (const [dx, dz] of [[0, 0], [-15, -15], [15, -15], [-15, 15], [15, 15]]) m = Math.max(m, latticeH(zn.x + dx, zn.z + dz)); zn.elev = Math.round((m + 0.25) * 10) / 10; }
      if (APT[zn.apt]) { APT[zn.apt].elev = zn.elev; APT[zn.apt].x = zn.x; APT[zn.apt].z = zn.z; } }
  }
  computeStarts();
}

// höjd för fysiken: havet ger −1 (havsytan är y = 0); sjöar ger sjöns yta och waterAt() säger att det är vatten
function terrainH(x, z) {
  if (!isLand(x, z)) return -1;
  const zn = inRunway(x, z, 60);
  if (zn && !zn.small) return zn.elev;
  // helikopterplattan är en upphöjd platta; olycksplatsen följer terrängen
  if (zn && zn.kind === 'helipad' && inRunway(x, z, 0) === zn) return zn.elev;
  return Math.max(latticeH(x, z), 0.3);
}
function isLake(x, z) { return (lcAt(x, z) & 15) === 7 && !inRunway(x, z, 80); }
function waterAt(x, z) { return !isLand(x, z) || isLake(x, z); }
// marktyp: 0 vatten, 1 klippa, 2 skog, 3 åker/äng, 4 flygfält, 5 tätort
const LC2T = [0, 2, 2, 3, 3, 5, 1, 0, 3, 5, 5, 1, 3, 3, 3, 3];
function terrainType(x, z, sdf) {
  const d = sdf != null ? sdf : landSDF(x, z);
  if (d <= 0) return 0;
  const [zb] = zoneBlend(x, z);
  if (zb > 0.55) return 4;
  return LC2T[lcAt(x, z) & 15];
}

// ---------- startplatser ----------
const STARTS = {};
function longestWater(x, z) {
  let best = 0, bestLen = 0;
  for (let hd = 0; hd < 360; hd += 10) {
    const s = Math.sin(hd * DEG), c = Math.cos(hd * DEG); let len = 0;
    while (len < 3000 && !isLand(x + s * len, z - c * len) && !isLand(x + s * len + c * 40, z - c * len + s * 40) && !isLand(x + s * len - c * 40, z - c * len - s * 40)) len += 40;
    if (len > bestLen) { bestLen = len; best = hd; }
  }
  return best;
}
function computeStarts() {
  const [lx, lz] = geo(60.158, 20.115);
  STARTS.water = { x: lx, z: lz, hdg: longestWater(lx, lz) };
}
if (typeof module !== 'undefined' && module.exports) Object.assign(module.exports, { MAPD, MAP_FILES, applyMapData, loadMapData, lcAt, demH, urbanAt, waterAt, isLake, roadsNear, tileState, decodeRoads, RCH, ROADS, TOWNS, townAt, MHAMN, DEG, clamp, lerp, smooth, fbm, vnoise, hash2, GEO, geo, ungeo, fmtLatLon, T_SIZE, T_HALF, REG, W, PLACES, AIRPORTS, APT, ZONES, zoneLocal, zoneWorld, zoneBlend, inRunway, isLand, landSDF, coastDist, landHeight, heightAt, hv, LATT, latticeH, initWorld, terrainH, terrainType, STARTS });
