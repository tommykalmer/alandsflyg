// ===================== STRÖMMANDE TERRÄNG OCH BEBYGGELSE =====================
// Världen delas i rutor om 9 × 9 km som målas och byggs medan man flyger, i tre detaljnivåer.
const CH = 9000;
const LODS = [
  { P: 512, seg: 64, E: 128, range: 11000 },
  { P: 128, seg: 16, E: 32, range: 42000 },
  { P: 32, seg: 4, E: 8, range: 96000 }
];
const TER = { chunks: new Map(), job: null, jobKey: '', desired: new Map(), frame: 0, lastCam: new THREE.Vector3(1e9, 0, 0) };
const TMATS = new Set();
const COL = {
  deep: [26, 52, 66], mid: [36, 74, 88], shallow: [64, 112, 118], surf: [96, 140, 140], reed: [122, 126, 70],
  granite: [160, 128, 116], granite2: [132, 112, 104], forest: [40, 62, 35], forest2: [56, 78, 40],
  field: [154, 148, 85], field2: [110, 133, 64], field3: [179, 160, 102], grass: [88, 113, 47],
  town: [96, 104, 84], town2: [126, 120, 112], street: [92, 92, 94], road: [128, 120, 106],
  runway: [150, 153, 156], strip: [134, 156, 84]
};
const keyOf = (ci, cj) => ci + ',' + cj;

// ---------- vägar: rastreras per ruta med canvas ----------
const roadCv = document.createElement('canvas');
function roadMask(x0, z0, P) {
  const segs = [];
  for (const r of ROADS) for (let i = 0; i < r.length - 1; i++) {
    const [ax, az] = r[i], [bx, bz] = r[i + 1];
    if (Math.max(ax, bx) < x0 - 50 || Math.min(ax, bx) > x0 + CH + 50 || Math.max(az, bz) < z0 - 50 || Math.min(az, bz) > z0 + CH + 50) continue;
    segs.push([ax, az, bx, bz]);
  }
  if (!segs.length) return null;
  roadCv.width = roadCv.height = P;
  const g = roadCv.getContext('2d', { willReadFrequently: true }), k = P / CH;
  g.clearRect(0, 0, P, P); g.strokeStyle = '#fff'; g.lineWidth = Math.max(1, 9 * k); g.lineCap = 'round';
  g.beginPath(); for (const [ax, az, bx, bz] of segs) { g.moveTo((ax - x0) * k, (az - z0) * k); g.lineTo((bx - x0) * k, (bz - z0) * k); } g.stroke();
  return g.getImageData(0, 0, P, P).data;
}

// ---------- ett jobb som bygger en ruta, fördelat över flera bildrutor ----------
function* chunkJob(ci, cj, lod) {
  const L = LODS[lod], P = L.P, x0 = ci * CH, z0 = cj * CH, pm = CH / P;
  // grovt rutnät: höjder, typ och tätort per cell
  const G = P / 8, gs = CH / G, G1 = G + 1;
  const H = new Float32Array(G1 * G1);
  for (let j = 0; j < G1; j++) for (let i = 0; i < G1; i++)
    H[j * G1 + i] = lod === 0 ? hv(ci * 64 + i, cj * 64 + j) : heightAt(x0 + i * gs, z0 + j * gs);
  yield;
  const T = new Uint8Array(G * G), TW = new Array(G * G), SH = new Float32Array(G * G);
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const wx = x0 + (i + 0.5) * gs, wz = z0 + (j + 0.5) * gs, k = j * G + i;
    let t = terrainType(wx, wz);
    if (t === 0) t = 2;
    T[k] = t;
    if (t === 5) TW[k] = townAt(wx, wz)[1];
    const h00 = H[j * G1 + i], h10 = H[j * G1 + i + 1], h01 = H[(j + 1) * G1 + i];
    const gx = (h10 - h00) / gs * 3.2, gz = (h01 - h00) / gs * 3.2;
    SH[k] = clamp(((gx * 0.55) + 0.7 + (-gz * 0.45)) / Math.hypot(gx, 1, gz) / 0.7, 0.55, 1.3);
  }
  yield;
  const rm = lod < 2 ? roadMask(x0, z0, P) : null;
  // banorna målas in i marktexturen så att de syns på håll (även där banans egen yta är för liten för att synas)
  const RWS = ZONES.filter(z => !z.small && z.x + z.reach > x0 && z.x - z.reach < x0 + CH && z.z + z.reach > z0 && z.z - z.reach < z0 + CH);
  const data = new Uint8Array(P * P * 4);
  const put = (i, c, k) => { data[i] = c[0] * k; data[i + 1] = c[1] * k; data[i + 2] = c[2] * k; };
  for (let y = 0; y < P; y++) {
    const wz = z0 + (y + 0.5) * pm, cy = Math.min(G - 1, (y / 8) | 0);
    for (let x = 0; x < P; x++) {
      const wx = x0 + (x + 0.5) * pm, i = (y * P + x) * 4;
      const d = landSDF(wx, wz);
      const sp = hash2((wx / 3) | 0, (wz / 3) | 0);
      if (d <= 0) {
        const dd = -d;
        if (dd < 28 && vnoise(wx / 45, wz / 45) > 0.3 && vnoise(wx / 300 + 9, wz / 300) > 0) { put(i, COL.reed, 0.85 + sp * 0.3); data[i + 3] = 255; continue; }
        const t = smooth(0, 900, dd);
        let c = t < 0.5 ? [lerp(COL.shallow[0], COL.mid[0], t * 2), lerp(COL.shallow[1], COL.mid[1], t * 2), lerp(COL.shallow[2], COL.mid[2], t * 2)]
          : [lerp(COL.mid[0], COL.deep[0], t * 2 - 1), lerp(COL.mid[1], COL.deep[1], t * 2 - 1), lerp(COL.mid[2], COL.deep[2], t * 2 - 1)];
        if (dd < 9) c = COL.surf;
        put(i, c, 1 + vnoise(wx / 3000, wz / 3000) * 0.05); data[i + 3] = 200; continue;
      }
      const cx = Math.min(G - 1, (x / 8) | 0), k = cy * G + cx, ty = T[k];
      const n = vnoise(wx / 230, wz / 230) * 0.5 + vnoise(wx / 61, wz / 61) * 0.5;
      let c, kk = (0.9 + n * 0.1) * SH[k];
      if (d < 14 + vnoise(wx / 40, wz / 40) * 8 && ty !== 4 && ty !== 5) { c = sp > 0.5 ? COL.granite : COL.granite2; kk *= 0.85 + sp * 0.3; }
      else if (ty === 3) {
        const f = vnoise(wx / 520 + 9, wz / 520 - 3); c = f > 0.25 ? COL.field3 : f > -0.2 ? COL.field : COL.field2;
        const dir = hash2((wx / 300) | 0, (wz / 300) | 0) > 0.5;
        kk *= (((dir ? wx : wz) / 6) | 0) & 1 ? 1.05 : 0.95;
      } else if (ty === 4) c = COL.grass;
      else if (ty === 5) {
        const tw = TW[k];
        if (tw && isTownStreet(wx, wz, tw)) { c = COL.street; kk = 1; }
        else { c = n > 0.15 ? COL.town2 : COL.town; kk *= 0.9 + sp * 0.2; }
      } else if (ty === 1) c = n > 0 ? COL.granite : COL.granite2;
      else { c = n > 0 ? COL.forest2 : COL.forest; kk *= 0.82 + sp * 0.3; }
      if (rm && rm[i + 3] > 100) { c = COL.road; kk = 1; }
      for (const z of RWS) {
        const [a, cc] = zoneLocal(z, wx, wz), hw = z.wid / 2 + pm * 0.5;
        if (Math.abs(a) <= z.len / 2 + pm * 0.3 && Math.abs(cc) <= hw) {
          const cov = Math.min(1, z.wid / pm), rc = z.kind === 'asphalt' ? COL.runway : COL.strip;
          c = [lerp(c[0] * kk, rc[0], cov), lerp(c[1] * kk, rc[1], cov), lerp(c[2] * kk, rc[2], cov)]; kk = 1;
          break;
        }
      }
      put(i, c, kk); data[i + 3] = 255;
    }
    if ((y & 31) === 31) yield;
  }
  // nattsken: städer, flygplatsplattor och enstaka gårdar
  const E = L.E, em = new Uint8Array(E * E * 4), es = CH / E;
  for (let y = 0; y < E; y++) for (let x = 0; x < E; x++) {
    const wx = x0 + (x + 0.5) * es, wz = z0 + (y + 0.5) * es, i = (y * E + x) * 4;
    let r = 0, g = 0, b = 0;
    const [tf] = townAt(wx, wz);
    if (tf > 0.3 && landSDF(wx, wz) > 0) { const v = (0.25 + 0.3 * tf) * (0.8 + vnoise(wx / 400, wz / 400) * 0.3); r += 255 * v; g += 170 * v; b += 74 * v; }
    for (const ap of AIRPORTS) {
      if (!ap.big || !ap.term) continue;
      const dd = Math.hypot(wx - ap.term[0], wz - ap.term[1]);
      if (dd < 420) { const v = (1 - dd / 420) * 0.9; r += 255 * v; g += 240 * v; b += 208 * v; }
    }
    if (lod === 0 && tf < 0.2 && hash2((wx / 70) | 0, (wz / 70) | 0) > 0.985) { const t = terrainType(wx, wz); if (t === 3 || t === 2) { r += 200; g += 150; b += 70; } }
    em[i] = Math.min(255, r); em[i + 1] = Math.min(255, g); em[i + 2] = Math.min(255, b); em[i + 3] = 255;
  }
  yield;
  // geometri: samma triangulering som fysikens höjdfunktion, med kjolar som döljer skarvar
  const S = L.seg, S1 = S + 1, sp2 = CH / S;
  const hAt = (i, j) => lod === 0 ? hv(ci * 64 + i, cj * 64 + j) : heightAt(x0 + i * sp2, z0 + j * sp2);
  const hs = new Float32Array((S + 3) * (S + 3));
  for (let j = -1; j <= S + 1; j++) for (let i = -1; i <= S + 1; i++) hs[(j + 1) * (S + 3) + i + 1] = hAt(i, j);
  const HH = (i, j) => hs[(j + 1) * (S + 3) + i + 1];
  const nv = S1 * S1 + 4 * S1;
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  for (let j = 0; j <= S; j++) for (let i = 0; i <= S; i++) {
    const k = j * S1 + i, h = HH(i, j);
    pos[k * 3] = i * sp2; pos[k * 3 + 1] = h; pos[k * 3 + 2] = j * sp2;
    const nx = HH(i - 1, j) - HH(i + 1, j), nz = HH(i, j - 1) - HH(i, j + 1), ny = 2 * sp2, l = Math.hypot(nx, ny, nz);
    nor[k * 3] = nx / l; nor[k * 3 + 1] = ny / l; nor[k * 3 + 2] = nz / l;
    uv[k * 2] = i / S; uv[k * 2 + 1] = j / S;
  }
  const idx = [];
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const a = j * S1 + i, b = a + 1, c = a + S1, d = c + 1;
    idx.push(a, c, b, c, d, b);
  }
  // kjolar längs kanterna
  const edges = [[], [], [], []];
  for (let t = 0; t <= S; t++) { edges[0].push(t); edges[1].push(S * S1 + t); edges[2].push(t * S1); edges[3].push(t * S1 + S); }
  let vk = S1 * S1;
  for (let e = 0; e < 4; e++) {
    const base = vk;
    for (const k of edges[e]) {
      pos[vk * 3] = pos[k * 3]; pos[vk * 3 + 1] = pos[k * 3 + 1] - 35; pos[vk * 3 + 2] = pos[k * 3 + 2];
      nor[vk * 3] = nor[k * 3]; nor[vk * 3 + 1] = nor[k * 3 + 1]; nor[vk * 3 + 2] = nor[k * 3 + 2];
      uv[vk * 2] = uv[k * 2]; uv[vk * 2 + 1] = uv[k * 2 + 1]; vk++;
    }
    for (let t = 0; t < S; t++) { const a = edges[e][t], b = edges[e][t + 1], c = base + t, d = base + t + 1; idx.push(a, b, c, b, d, c, a, c, b, b, c, d); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return { data, P, em, E, geo };
}
function finishChunk(ci, cj, lod, res) {
  const tex = new THREE.DataTexture(res.data, res.P, res.P, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
  tex.anisotropy = maxAniso; tex.needsUpdate = true;
  const etex = new THREE.DataTexture(res.em, res.E, res.E, THREE.RGBAFormat);
  etex.magFilter = THREE.LinearFilter; etex.minFilter = THREE.LinearFilter; etex.needsUpdate = true;
  const mat = terrainMaterial(tex); mat.emissive.setHex(0xffffff); mat.emissiveMap = etex; mat.emissiveIntensity = 1.6 * NIGHTU.value;
  TMATS.add(mat);
  const mesh = new THREE.Mesh(res.geo, mat);
  mesh.position.set(ci * CH, 0, cj * CH);
  mesh.receiveShadow = true;
  scene.add(mesh);
  const key = keyOf(ci, cj), old = TER.chunks.get(key);
  if (old) disposeChunk(old);
  TER.chunks.set(key, { ci, cj, lod, mesh });
}
function disposeChunk(c) {
  scene.remove(c.mesh); c.mesh.geometry.dispose();
  const m = c.mesh.material; TMATS.delete(m); m.map.dispose(); m.emissiveMap.dispose(); m.dispose();
}
function chunkDist(ci, cj, cam) {
  const dx = Math.max(ci * CH - cam.x, 0, cam.x - (ci + 1) * CH), dz = Math.max(cj * CH - cam.z, 0, cam.z - (cj + 1) * CH);
  return Math.hypot(dx, dz);
}
function computeDesired(cam) {
  const D = new Map(), R = LODS[2].range, c0 = Math.floor((cam.x - R) / CH), c1 = Math.floor((cam.x + R) / CH);
  const r0 = Math.floor((cam.z - R) / CH), r1 = Math.floor((cam.z + R) / CH);
  const high = cam.y > 3500;
  for (let cj = r0; cj <= r1; cj++) for (let ci = c0; ci <= c1; ci++) {
    const d = chunkDist(ci, cj, cam);
    let lod = d < LODS[0].range && !high ? 0 : d < LODS[1].range ? 1 : d < LODS[2].range ? 2 : -1;
    if (lod >= 0) D.set(keyOf(ci, cj), { ci, cj, lod, d });
  }
  TER.desired = D;
  for (const [k, c] of TER.chunks) if (!D.has(k)) { disposeChunk(c); TER.chunks.delete(k); }
}
function nextJob(cam) {
  let best = null, bs = Infinity;
  for (const [k, w] of TER.desired) {
    const have = TER.chunks.get(k);
    if (have && have.lod === w.lod) continue;
    // saknade rutor först, sedan förbättringar nära kameran
    const score = (have ? 1e6 : 0) + w.d + w.lod * 2000;
    if (score < bs) { bs = score; best = w; }
  }
  return best;
}
// kör terrängjobb inom en tidsbudget (ms)
function updateTerrain(cam, budget) {
  TER.frame++;
  if (TER.frame % 12 === 0 || cam.distanceToSquared(TER.lastCam) > 4e6) { computeDesired(cam); TER.lastCam.copy(cam); }
  const t0 = performance.now();
  while (performance.now() - t0 < budget) {
    if (!TER.job) {
      const w = nextJob(cam); if (!w) return true;
      TER.job = { w, gen: chunkJob(w.ci, w.cj, w.lod) }; TER.jobKey = keyOf(w.ci, w.cj);
    }
    const r = TER.job.gen.next();
    if (r.done) {
      const w = TER.job.w; TER.job = null;
      const still = TER.desired.get(keyOf(w.ci, w.cj));
      if (still && still.lod === w.lod) finishChunk(w.ci, w.cj, w.lod, r.value);
    } else if (TER.job && !TER.desired.has(TER.jobKey)) TER.job = null;
  }
  return false;
}
// laddar allt nära en position innan flygningen börjar
function terrainPending(cam, radius) {
  let n = 0, tot = 0;
  for (const [k, w] of TER.desired) { if (w.d > radius) continue; tot++; const h = TER.chunks.get(k); if (!h || h.lod !== w.lod) n++; }
  return [n, tot];
}
async function ensureTerrain(cam, progress) {
  computeDesired(cam);
  for (;;) {
    updateTerrain(cam, 40);
    const [n, tot] = terrainPending(cam, 30000);
    if (progress) progress(1 - n / Math.max(tot, 1));
    if (n === 0) break;
    await new Promise(r => setTimeout(r, 0));
  }
}

// ---------- bebyggelse som följer kameran ----------
const BLD = { cell: 600, rad: 6, key: '', cache: new Map(), blocks: null, broofs: null, walls: null, roofs: null };
function buildBuildingStreams() {
  const wallGeo = new THREE.BoxGeometry(1, 1, 1); wallGeo.translate(0, 0.5, 0);
  const roofGeo = new THREE.ConeGeometry(0.75, 0.5, 4); roofGeo.rotateY(Math.PI / 4); roofGeo.translate(0, 1.25, 0);
  const mk = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3); m.count = 0; m.frustumCulled = false; scene.add(m); return m; };
  BLD.blocks = mk(wallGeo, windowMaterial(), 9000);
  BLD.broofs = mk(wallGeo, new THREE.MeshLambertMaterial({ color: 0x4a4d50 }), 9000);
  BLD.walls = mk(wallGeo, windowMaterial(), 8000);
  BLD.roofs = mk(roofGeo, new THREE.MeshLambertMaterial({ color: 0x2e2f30 }), 8000);
}
const FLAT_COLS = [0xe8e2d4, 0xd9cdb0, 0xc9cfd3, 0xb9805e, 0xe2d7bd, 0xa9b2b8, 0xf1ece2, 0xc8a27a];
const HOUSE_COLS = [0xe9e4d8, 0xd9c48a, 0x8b2b1e, 0xc7cdd1, 0xb98d5e, 0xf2efe6];
function bldCell(ci, cj) {
  const key = ci + ',' + cj;
  let c = BLD.cache.get(key);
  if (c) return c;
  const C = BLD.cell, x0 = ci * C, z0 = cj * C, R = rng((ci * 92821) ^ (cj * 68917) ^ 7);
  const blocks = [], houses = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  // tätorter: tomter längs gatunätet
  for (const t of TOWNS) {
    if (Math.hypot(x0 + C / 2 - t.p[0], z0 + C / 2 - t.p[1]) > t.r * 1.4 + C) continue;
    const B = t.block, ca = Math.cos(t.a), sa = Math.sin(t.a);
    const us = [], vs = [];
    for (const [x, z] of [[x0, z0], [x0 + C, z0], [x0, z0 + C], [x0 + C, z0 + C]]) { const [u, v] = townUV(t, x, z); us.push(u); vs.push(v); }
    const lot = B / 2, off = [TOWN_STREET + (lot - TOWN_STREET) / 2, lot + TOWN_STREET / 2 + (lot - TOWN_STREET) / 2];
    q.setFromAxisAngle(up, -t.a);
    for (let bu = Math.floor(Math.min(...us) / B) * B; bu < Math.max(...us); bu += B) for (let bv = Math.floor(Math.min(...vs) / B) * B; bv < Math.max(...vs); bv += B)
      for (const ou of off) for (const ov of off) {
        const u = bu + ou, v = bv + ov, x = u * ca - v * sa, z = u * sa + v * ca;
        if (x < x0 || x >= x0 + C || z < z0 || z >= z0 + C) continue;
        const [tf, tt] = townAt(x, z);
        if (tt !== t || tf < 0.5 || landSDF(x, z) < 25 || inRunway(x, z, 150)) continue;
        if (R() < 0.12) continue;
        const h0 = terrainH(x, z), dense = t.dense * tf;
        if (dense > 0.4 && R() < dense + 0.15) {
          const fw = lot * (0.62 + R() * 0.18), fl = lot * (0.62 + R() * 0.18), ht = 6 + dense * dense * 26 * (0.6 + R() * 0.8);
          blocks.push(m.compose(p.set(x, h0 - 0.5, z), q, s.set(fw, ht, fl)).clone(), m.compose(p.set(x, h0 - 0.5 + ht, z), q, s.set(fw + 0.6, 0.8, fl + 0.6)).clone(), FLAT_COLS[Math.floor(R() * FLAT_COLS.length)]);
        } else {
          const w = 9 + R() * 5, l = w * (1.2 + R() * 0.5), qq = new THREE.Quaternion().setFromAxisAngle(up, -t.a + (R() < 0.5 ? 0 : Math.PI / 2));
          houses.push(m.compose(p.set(x + (R() - 0.5) * 8, h0 - 0.3, z + (R() - 0.5) * 8), qq, s.set(w, 4.5, l)).clone(), m.compose(p.set(x, h0 - 0.3, z), qq, s.set(Math.max(w, l) * 1.15, 4.5, Math.max(w, l) * 1.15)).clone(), HOUSE_COLS[Math.floor(R() * HOUSE_COLS.length)]);
        }
      }
  }
  // landsbygd: gårdar med 1–3 byggnader
  for (let k = 0; k < 6; k++) {
    const x = x0 + R() * C, z = z0 + R() * C, t = terrainType(x, z);
    if (!(t === 3 || (t === 2 && coastDist(x, z) < 160 && R() < 0.5))) continue;
    if (R() < 0.45 || inRunway(x, z, 200)) continue;
    const n = 1 + Math.floor(R() * 3), fin = x > 20000;
    for (let j = 0; j < n; j++) {
      const hx = x + (R() - 0.5) * 40, hz = z + (R() - 0.5) * 40, w = 6 + R() * 5, l = w * (1.3 + R() * 0.6), h0 = terrainH(hx, hz);
      if (h0 < 0.5) continue;
      q.setFromAxisAngle(up, R() * 6);
      const col = R() < (fin ? 0.5 : 0.85) ? 0x8b2b1e : (fin && R() < 0.5 ? 0xd9c48a : 0xe9e4d8);
      houses.push(m.compose(p.set(hx, h0 - 0.3, hz), q, s.set(w, 4.5, l)).clone(), m.compose(p.set(hx, h0 - 0.3, hz), q, s.set(Math.max(w, l) * 1.15, 4.5, Math.max(w, l) * 1.15)).clone(), col);
    }
  }
  c = { blocks, houses };
  if (BLD.cache.size > 1500) BLD.cache.clear();
  BLD.cache.set(key, c);
  return c;
}
const _bc = new THREE.Color();
function updateBuildings(pos) {
  if (!BLD.blocks) return;
  const ci = Math.floor(pos.x / BLD.cell), cj = Math.floor(pos.z / BLD.cell);
  const key = ci + ',' + cj + (pos.y > 4000 ? 'h' : '');
  if (key === BLD.key) return;
  BLD.key = key;
  let nb = 0, nh = 0;
  if (pos.y <= 4000) {
    const cells = [];
    for (let a = -BLD.rad; a <= BLD.rad; a++) for (let b = -BLD.rad; b <= BLD.rad; b++) cells.push([a * a + b * b, a, b]);
    cells.sort((u, v) => u[0] - v[0]);
    for (const [, a, b] of cells) {
      const c = bldCell(ci + a, cj + b);
      for (let k = 0; k < c.blocks.length && nb < 9000; k += 3) { BLD.blocks.setMatrixAt(nb, c.blocks[k]); BLD.broofs.setMatrixAt(nb, c.blocks[k + 1]); BLD.blocks.setColorAt(nb, _bc.setHex(c.blocks[k + 2])); nb++; }
      for (let k = 0; k < c.houses.length && nh < 8000; k += 3) { BLD.walls.setMatrixAt(nh, c.houses[k]); BLD.roofs.setMatrixAt(nh, c.houses[k + 1]); BLD.walls.setColorAt(nh, _bc.setHex(c.houses[k + 2])); nh++; }
    }
  }
  BLD.blocks.count = BLD.broofs.count = nb; BLD.walls.count = BLD.roofs.count = nh;
  for (const mm of [BLD.blocks, BLD.broofs, BLD.walls, BLD.roofs]) { mm.instanceMatrix.needsUpdate = true; mm.instanceColor.needsUpdate = true; }
}
