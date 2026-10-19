// ===================== STRÖMMANDE TERRÄNG OCH BEBYGGELSE =====================
// Världen delas i rutor om 9 × 9 km som målas och byggs medan man flyger, i tre detaljnivåer.
const CH = 9000;
const LODS = [
  { P: 512, seg: 64, E: 256, range: 11000 },
  { P: 128, seg: 16, E: 32, range: 42000 },
  { P: 32, seg: 4, E: 8, range: 96000 }
];
const TER = { chunks: new Map(), job: null, jobKey: '', desired: new Map(), frame: 0, lastCam: new THREE.Vector3(1e9, 0, 0) };
const TMATS = new Set();
const COL = {
  deep: [26, 52, 66], mid: [36, 74, 88], shallow: [64, 112, 118], surf: [96, 140, 140], reed: [122, 126, 70],
  granite: [158, 128, 116], granite2: [132, 112, 104], lichen: [146, 142, 130],
  forest: [38, 58, 36], forest2: [52, 72, 42], spruce: [28, 44, 32], young: [70, 88, 48], birch: [126, 112, 52], aspen: [150, 104, 46], shrub: [86, 86, 54],
  grass: [118, 126, 70], grass2: [100, 116, 60], mown: [96, 122, 58], wet: [104, 102, 66], wet2: [88, 82, 56],
  town: [118, 116, 112], roofD: [78, 78, 82], roofR: [122, 72, 60], roofL: [164, 160, 150], garden: [94, 112, 62],
  ind: [122, 122, 120], ind2: [148, 146, 140], sand: [192, 180, 146], lake: [30, 50, 56],
  runway: [118, 121, 124], strip: [120, 140, 76]
};
// åkrarna i oktober: stubb, plöjt, höstsådd och vall
const FIELD = [[170, 154, 108], [150, 136, 96], [118, 98, 74], [100, 84, 64], [92, 120, 58], [110, 132, 66], [124, 136, 74], [184, 166, 118],
  [136, 122, 90], [104, 112, 62], [160, 146, 104], [128, 104, 78], [96, 116, 60], [176, 162, 116], [114, 126, 70], [142, 128, 92]];
// vägar: bredd i meter och färg per klass (1 motorväg … 8 cykelväg)
const ROADW = [0, 22, 13, 10, 8, 6, 4.5, 3.5, 2.6, 23];
const ROADC = ['', '#5e5f62', '#646567', '#68696b', '#6c6c6c', '#706e6a', '#7a766e', '#978a72', '#857470', '#6f7174'];
const ROOFC = ['#555659', '#4f5054', '#7b4a3e', '#5a5b5e', '#7d3b2f', '#a9b4b0', '#77797c', '#8a8b8d', '#9a9c9e', '#5d5f63'];
const keyOf = (ci, cj) => ci + ',' + cj;
const cvA = document.createElement('canvas'), cvE = document.createElement('canvas');

// ---------- byggnader i en ruta (avkodas en gång per ruta) ----------
const BU = 9000 / 65535;
// avkodar högst max byggnader per anrop; returnerar listan när allt är klart
function tileBuildings(ci, cj, max = Infinity) {
  const t = tileState(ci, cj);
  if (!t.ready) return null;
  if (!t.bld) return [];
  if (t.blds) return t.blds;
  const b = t.bld, dv = new DataView(b.buffer, b.byteOffset, b.length);
  if (!t.pp) t.pp = { o: 4, i: 0, n: dv.getUint32(0, true), out: [] };
  const st = t.pp, X0 = ci * RCH, Z0 = cj * RCH, out = st.out;
  let o = st.o, cnt = 0;
  for (; st.i < st.n && cnt < max; st.i++, cnt++) {
    const typ = dv.getUint8(o);
    if (typ === 0) {
      const x = X0 + dv.getUint16(o + 1, true) * BU, z = Z0 + dv.getUint16(o + 3, true) * BU, w = dv.getUint16(o + 5, true) / 10, l = dv.getUint16(o + 7, true) / 10;
      const a = dv.getUint8(o + 9) / 255 * Math.PI, h = dv.getUint8(o + 10) / 2, k = dv.getUint8(o + 11); o += 12;
      out.push({ x, z, w, l, a, h, k, p: null });
    } else {
      const m = dv.getUint8(o + 1), h = dv.getUint8(o + 2) / 2, k = dv.getUint8(o + 3);
      let x = X0 + dv.getUint16(o + 4, true) * BU, z = Z0 + dv.getUint16(o + 6, true) * BU; o += 8;
      const p = [x, z]; let sx = x, sz = z;
      for (let j = 1; j < m; j++) { x += dv.getInt16(o, true) / 4; z += dv.getInt16(o + 2, true) / 4; o += 4; p.push(x, z); sx += x; sz += z; }
      out.push({ x: sx / m, z: sz / m, w: 0, l: 0, a: 0, h, k, p });
    }
  }
  st.o = o;
  if (st.i < st.n) return null;
  t.blds = out; t.pp = null;
  return out;
}

// ---------- vägar som band i 3D ----------
// Vägarna ligger som tunna band på marken (inte bara i texturen) så att de syns skarpt både nära och på håll.
// Vertexshadern breddar bandet till minst en dryg bildpunkt på avstånd.
const ROADS3D = { maxC: 9, mat: null };
const ROADRGB = [[0, 0, 0], [0.32, 0.33, 0.34], [0.34, 0.35, 0.36], [0.36, 0.37, 0.38], [0.37, 0.38, 0.39], [0.39, 0.39, 0.4], [0.43, 0.42, 0.41],
  [0.56, 0.5, 0.4], [0.47, 0.42, 0.4], [0.41, 0.42, 0.43]];
function roadMaterial() {
  if (ROADS3D.mat) return ROADS3D.mat;
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uPx = LIGHTU.uPx;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 rdat;\nuniform float uPx;')
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
  float rdc = length((modelViewMatrix * vec4(position, 1.0)).xyz);
  float rhw = max(abs(rdat.z), rdc / uPx * 0.8);
  transformed.xz += rdat.xy * sign(rdat.z) * rhw;
  transformed.y += 0.3 + rdc * 0.0006;`);
  };
  return ROADS3D.mat = m;
}
function* roadRibbons(ci, cj, out) {
  const x0 = ci * CH, z0 = cj * CH, pos = [], dat = [], col = [], idx = [];
  const rl = roadsNear(ci, cj, true);
  let n = 0;
  const hAt = (x, z, br) => { let y = Math.max(latticeH(x, z), 0); if (br && y < 3) y = 3; return y; };
  for (const r of rl) {
    if (r.c > ROADS3D.maxC || r.bb[2] < x0 || r.bb[0] > x0 + CH || r.bb[3] < z0 || r.bb[1] > z0 + CH) continue;
    if (++n % 400 === 0) yield;
    const q = r.pts, hw = ROADW[r.c] / 2, cc = ROADRGB[r.c];
    // punkter längs vägen var 20:e meter
    const P = [];
    for (let j = 0; j + 3 < q.length + 1 && j + 2 < q.length; j += 2) {
      const ax = q[j], az = q[j + 1], bx = q[j + 2], bz = q[j + 3], L = Math.hypot(bx - ax, bz - az), k = Math.max(1, Math.ceil(L / 20));
      for (let t = j === 0 ? 0 : 1; t <= k; t++) P.push(ax + (bx - ax) * t / k, az + (bz - az) * t / k);
    }
    // bara delar vars mittpunkt ligger i den här rutan (vägar som korsar rutgränser delas)
    let run = -1;
    const np = P.length / 2;
    for (let k = 0; k < np; k++) {
      const x = P[k * 2], z = P[k * 2 + 1];
      const nx2 = k + 1 < np ? P[k * 2 + 2] : x, nz2 = k + 1 < np ? P[k * 2 + 3] : z;
      const mx = (x + nx2) / 2, mz = (z + nz2) / 2, inside = k + 1 < np && mx >= x0 && mx < x0 + CH && mz >= z0 && mz < z0 + CH;
      const prevIn = run >= 0;
      if (!inside && !prevIn) continue;
      const px = k > 0 ? P[k * 2 - 2] : x, pz = k > 0 ? P[k * 2 - 1] : z;
      let dx = nx2 - px, dz = nz2 - pz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const y = hAt(x, z, r.br), v = pos.length / 3;
      for (const sd of [-1, 1]) { pos.push(x - x0, y, z - z0); dat.push(-dz, dx, sd * hw); col.push(cc[0], cc[1], cc[2]); }
      if (prevIn) idx.push(run, run + 1, v, run + 1, v + 1, v);
      run = inside ? v : -1;
    }
  }
  if (!pos.length) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute('rdat', new THREE.Float32BufferAttribute(dat, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(CH / 2, 20, CH / 2), CH * 0.75);
  out.roads = g;
}

// ---------- ett jobb som bygger en ruta, fördelat över flera bildrutor ----------
function* chunkJob(ci, cj, lod) {
  const L = LODS[lod], P = L.P, x0 = ci * CH, z0 = cj * CH, pm = CH / P;
  // skuggning från höjdmodellen (fyra pixlar per punkt nära, åtta längre bort)
  const SG = lod === 0 ? P / 4 : P / 8, ss = CH / SG, S1g = SG + 1;
  const HS = new Float32Array((SG + 3) * (SG + 3)), SH = new Float32Array(S1g * S1g);
  for (let j = -1; j <= SG + 1; j++) for (let i = -1; i <= SG + 1; i++) {
    const x = x0 + i * ss, z = z0 + j * ss;
    HS[(j + 1) * (SG + 3) + i + 1] = coastDist(x, z) > 0 ? demH(x, z) : 0;
  }
  const LX = -0.5, LY = 0.62, LZ = -0.6; // kartografiskt ljus från nordväst
  for (let j = 0; j <= SG; j++) for (let i = 0; i <= SG; i++) {
    const k = (j + 1) * (SG + 3) + i + 1;
    const gx = (HS[k + 1] - HS[k - 1]) / (2 * ss) * 2.2, gz = (HS[k + SG + 3] - HS[k - SG - 3]) / (2 * ss) * 2.2;
    const l = Math.hypot(gx, 1, gz), d = (-gx * LX + LY - gz * LZ) / l / LY;
    SH[j * S1g + i] = clamp(1 + (d - 1) * 0.55, 0.72, 1.18);
  }
  yield;
  // småvägar och byggnader kommer från rutfilen; vänta på den nära kameran
  if (lod === 0) { const t = tileState(ci, cj); while (!t.ready) yield 'wait'; while (!tileBuildings(ci, cj, 2000)) yield; }
  const inCore = x0 + CH > -T_HALF && x0 < T_HALF && z0 + CH > -T_HALF && z0 < T_HALF;
  const jit = inCore ? 11 : 26;
  const RWS = ZONES.filter(z => !z.small && z.x + z.reach > x0 && z.x - z.reach < x0 + CH && z.z + z.reach > z0 && z.z - z.reach < z0 + CH);
  const data = new Uint8ClampedArray(P * P * 4), wat = new Uint8Array(P * P);
  const put = (i, c, k) => { data[i] = c[0] * k; data[i + 1] = c[1] * k; data[i + 2] = c[2] * k; data[i + 3] = 255; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  for (let y = 0; y < P; y++) {
    const wz = z0 + (y + 0.5) * pm, fy = (y + 0.5) / P * SG, sy = Math.min(SG - 1, fy | 0), ty = fy - sy;
    for (let x = 0; x < P; x++) {
      const wx = x0 + (x + 0.5) * pm, i = (y * P + x) * 4;
      const d = landSDF(wx, wz);
      const sp = hash2((wx / 3) | 0, (wz / 3) | 0);
      if (d <= 0) {
        const dd = -d;
        wat[y * P + x] = 1;
        if (dd < 28 && vnoise(wx / 45, wz / 45) > 0.3 && vnoise(wx / 300 + 9, wz / 300) > 0) { put(i, COL.reed, 0.85 + sp * 0.3); wat[y * P + x] = 0; continue; }
        const t = smooth(0, 900, dd);
        let c = t < 0.5 ? mix(COL.shallow, COL.mid, t * 2) : mix(COL.mid, COL.deep, t * 2 - 1);
        if (dd < 9) c = COL.surf;
        put(i, c, 1 + vnoise(wx / 3000, wz / 3000) * 0.05); continue;
      }
      const fx = (x + 0.5) / P * SG, sx = Math.min(SG - 1, fx | 0), tx = fx - sx, sk = sy * S1g + sx;
      const sh = lerp(lerp(SH[sk], SH[sk + 1], tx), lerp(SH[sk + S1g], SH[sk + S1g + 1], tx), ty);
      const jx = vnoise(wx / 41, wz / 41) * jit, jz = vnoise(wx / 41 + 71, wz / 41 - 13) * jit;
      const b = lcAt(wx + jx, wz + jz), cl = b & 15, tone = b >> 4;
      const n = vnoise(wx / 230, wz / 230) * 0.5 + vnoise(wx / 61, wz / 61) * 0.5;
      let c, kk = (0.92 + n * 0.08) * sh;
      if (d < 7 + vnoise(wx / 40, wz / 40) * 6 && cl !== 5 && cl !== 10 && cl !== 9) { c = sp > 0.5 ? COL.granite : COL.granite2; kk *= 0.85 + sp * 0.3; }
      else switch (cl) {
        case 1: {
          // bestånd: gran mörk, tall olivgrön, ungskog ljusare; löv gulnar i oktober
          const st = vnoise(wx / 190 + 11, wz / 190 - 4), bv = vnoise(wx / 70 + 3, wz / 70 - 8);
          c = st > 0.3 ? COL.spruce : st < -0.35 ? COL.young : n > 0 ? COL.forest2 : COL.forest;
          if (bv > 0.4) c = mix(c, bv > 0.62 ? COL.aspen : COL.birch, Math.min(1, (bv - 0.4) * 2.4) * 0.7);
          if (tone & 1) c = mix(c, COL.lichen, 0.32);
          kk *= 0.78 + sp * 0.36; break;
        }
        case 2: c = mix(COL.shrub, COL.forest2, sp * 0.5); kk *= 0.88 + sp * 0.2; break;
        case 3: c = mix(COL.grass, COL.grass2, (tone & 7) / 8); kk *= 0.96 + sp * 0.08; break;
        case 4: {
          c = FIELD[tone];
          // skiftesgränser: diken och renar mellan åkrarna
          const bx = lcAt(wx + jx + pm, wz + jz), bz = lcAt(wx + jx, wz + jz + pm);
          if (bx !== b || bz !== b) kk *= (bx & 15) === 4 && (bz & 15) === 4 ? 0.86 : 0.92;
          if (pm < 12) kk *= (((((tone & 1) ? wx : wz) / 5) | 0) & 1) ? 1.035 : 0.965;
          kk *= 0.97 + sp * 0.06; break;
        }
        case 5: { const h = hash2((wx / 9) | 0, (wz / 9) | 0); c = h < 0.3 ? COL.roofD : h < 0.42 ? COL.roofR : h < 0.55 ? COL.roofL : COL.town; kk *= 0.92 + sp * 0.12; break; }
        case 6: c = n > 0.1 ? COL.granite : vnoise(wx / 25, wz / 25) > 0.2 ? COL.lichen : COL.granite2; kk *= 0.86 + sp * 0.26; break;
        case 7: c = COL.lake; wat[y * P + x] = 1; kk = 1 + n * 0.04; break;
        case 8: c = vnoise(wx / 35, wz / 35) > 0 ? COL.wet : COL.wet2; kk *= 0.9 + sp * 0.16; break;
        case 9: c = vnoise(wx / 28 - 4, wz / 28 + 6) > 0.15 ? COL.forest2 : COL.garden; kk *= 0.88 + sp * 0.22; break;
        case 10: c = n > 0 ? COL.ind : COL.ind2; kk *= 0.95 + sp * 0.08; break;
        case 11: c = COL.sand; kk *= 0.95 + sp * 0.08; break;
        default: c = COL.grass;
      }
      // gräset kring banorna är klippt
      if (RWS.length && cl !== 10 && cl !== 7) for (const zn of RWS) {
        const [al, ac] = zoneLocal(zn, wx, wz);
        if (Math.abs(al) < zn.len / 2 + 60 && Math.abs(ac) < zn.wid / 2 + 75) { c = COL.mown; kk = (0.95 + sp * 0.06) * ((((al / 12) | 0) & 1) ? 1.03 : 0.97); break; }
      }
      put(i, c, kk);
    }
    if ((y & 15) === 15) yield;
  }
  // vägar, byggnader och banor ritas med canvas ovanpå marken
  cvA.width = cvA.height = P;
  const g = cvA.getContext('2d', { willReadFrequently: true });
  g.putImageData(new ImageData(data, P, P), 0, 0);
  const k = 1 / pm, tx = p => (p - x0) * k, tz = p => (p - z0) * k;
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (lod < 2) {
    const rl = roadsNear(ci, cj, lod === 0);
    // breda vägar sist så att de hamnar överst
    for (let c = 9; c >= 1; c--) {
      const w = ROADW[c] * k;
      if (w < (lod === 0 ? 0.12 : 0.25)) continue;
      g.strokeStyle = ROADC[c]; g.globalAlpha = Math.min(1, 0.35 + w); g.lineWidth = Math.max(w, 0.7);
      g.beginPath();
      for (const r of rl) {
        if (r.c !== c || r.bb[2] < x0 - 30 || r.bb[0] > x0 + CH + 30 || r.bb[3] < z0 - 30 || r.bb[1] > z0 + CH + 30) continue;
        const q = r.pts; g.moveTo(tx(q[0]), tz(q[1]));
        for (let j = 2; j < q.length; j += 2) g.lineTo(tx(q[j]), tz(q[j + 1]));
      }
      g.stroke();
      // tvinga fram ritningen nu (annars samlas allt arbete i getImageData längre ned)
      if (lod === 0) { g.getImageData(0, 0, 1, 1); yield; }
    }
    g.globalAlpha = 1;
  }
  yield;
  if (lod === 0) {
    const bl = tileBuildings(ci, cj);
    let nn = 0;
    if (bl) for (const B of bl) {
      if (++nn % 2500 === 0) { g.getImageData(0, 0, 1, 1); yield; }
      g.fillStyle = ROOFC[B.k] || ROOFC[0];
      g.beginPath();
      if (B.p) { g.moveTo(tx(B.p[0]), tz(B.p[1])); for (let j = 2; j < B.p.length; j += 2) g.lineTo(tx(B.p[j]), tz(B.p[j + 1])); }
      else {
        const ca = Math.cos(B.a), sa = Math.sin(B.a), hw = B.w / 2, hl = B.l / 2;
        for (const [u, v] of [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]]) g.lineTo(tx(B.x + u * ca - v * sa), tz(B.z + u * sa + v * ca));
      }
      g.fill();
    }
  }
  // banorna målas in i marktexturen så att de syns på håll
  for (const zn of RWS) {
    g.save(); g.translate(tx(zn.x), tz(zn.z)); g.rotate(zn.hdg * DEG);
    const ww = Math.max(zn.wid * k, 1.2), ll = zn.len * k;
    g.fillStyle = zn.kind === 'asphalt' ? `rgb(${COL.runway})` : `rgb(${COL.strip})`;
    g.fillRect(-ww / 2, -ll / 2, ww, ll); g.restore();
  }
  g.getImageData(0, 0, 1, 1);
  yield;
  const out = g.getImageData(0, 0, P, P).data;
  // vatten som inte täckts av vägar eller broar får alfa 200 (vattenshadern)
  for (let j = 0, q = 0; j < P * P; j++, q += 4) {
    if (wat[j] && Math.abs(out[q] - data[q]) + Math.abs(out[q + 1] - data[q + 1]) + Math.abs(out[q + 2] - data[q + 2]) < 10) out[q + 3] = 200;
  }
  yield;
  // nattsken: tätorter, upplysta gator, flygplatser och enstaka gårdar
  const E = L.E, es = CH / E;
  cvE.width = cvE.height = E;
  const ge = cvE.getContext('2d', { willReadFrequently: true });
  const em = new Uint8ClampedArray(E * E * 4), urbE = new Float32Array(E * E);
  for (let y = 0; y < E; y++) { if ((y & 63) === 63) yield; for (let x = 0; x < E; x++) {
    const wx = x0 + (x + 0.5) * es, wz = z0 + (y + 0.5) * es, i = (y * E + x) * 4;
    let r = 0, gg = 0, bb = 0;
    const u = urbanAt(wx, wz); urbE[y * E + x] = u;
    if (u > 0.08 && landSDF(wx, wz) > 0) { const cl = lcAt(wx, wz) & 15, v = (0.05 + 0.2 * u) * (cl === 5 || cl === 10 ? 1.2 : cl === 9 ? 0.8 : 0.45) * (0.8 + vnoise(wx / 400, wz / 400) * 0.3); r += 255 * v; gg += 170 * v; bb += 74 * v; }
    for (const ap of AIRPORTS) {
      if (!ap.big || !ap.term) continue;
      const dd = Math.hypot(wx - ap.term[0], wz - ap.term[1]);
      if (dd < 420) { const v = (1 - dd / 420) * 0.9; r += 255 * v; gg += 240 * v; bb += 208 * v; }
    }
    if (lod === 0 && u < 0.1 && hash2((wx / 70) | 0, (wz / 70) | 0) > 0.988) { const cl = lcAt(wx, wz) & 15; if (cl === 4 || cl === 3 || cl === 1) { r += 200; gg += 150; bb += 70; } }
    em[i] = r; em[i + 1] = gg; em[i + 2] = bb; em[i + 3] = 255;
  } }
  ge.putImageData(new ImageData(em, E, E), 0, 0);
  if (lod === 0) {
    // gatubelysning: vägar i och nära tätorter lyser orange
    const ke = 1 / es, rl = roadsNear(ci, cj, lod === 0);
    ge.globalCompositeOperation = 'lighter'; ge.lineCap = 'round';
    for (const r of rl) {
      if (r.c > 6 || r.bb[2] < x0 || r.bb[0] > x0 + CH || r.bb[3] < z0 || r.bb[1] > z0 + CH) continue;
      const q = r.pts, mx = q[(q.length >> 2) * 2], mz = q[(q.length >> 2) * 2 + 1];
      const u = Math.max(urbanAt(mx, mz), urbanAt(q[0], q[1]));
      if ((u < 0.1 && r.c > 2) || (lod > 0 && r.c > 2)) continue;
      const a = Math.min(0.7, (u < 0.1 ? 0.12 : 0.18 + u * 0.45)) * (r.c <= 2 ? 0.8 : 0.8);
      ge.strokeStyle = `rgba(255,${r.c <= 2 ? 200 : 160},${r.c <= 2 ? 140 : 70},${a.toFixed(2)})`;
      ge.lineWidth = r.c <= 2 ? 0.9 : 0.7;
      ge.beginPath(); ge.moveTo((q[0] - x0) * ke, (q[1] - z0) * ke);
      for (let j = 2; j < q.length; j += 2) ge.lineTo((q[j] - x0) * ke, (q[j + 1] - z0) * ke);
      ge.stroke();
    }
    ge.globalCompositeOperation = 'source-over';
  }
  const emo = ge.getImageData(0, 0, E, E).data;
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
  const res = { data: new Uint8Array(out.buffer), P, em: new Uint8Array(emo.buffer), E, geo, roads: null };
  if (lod === 0) yield* roadRibbons(ci, cj, res);
  return res;
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
  if (res.roads) { const rm = new THREE.Mesh(res.roads, roadMaterial()); rm.receiveShadow = true; rm.renderOrder = 1; mesh.add(rm); mesh.userData.roads = rm; }
  scene.add(mesh);
  const key = keyOf(ci, cj), old = TER.chunks.get(key);
  if (old) disposeChunk(old);
  TER.chunks.set(key, { ci, cj, lod, mesh });
}
function disposeChunk(c) {
  scene.remove(c.mesh); c.mesh.geometry.dispose();
  if (c.mesh.userData.roads) c.mesh.userData.roads.geometry.dispose();
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
    if (r.value === 'wait') break;
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

// ---------- byggnader runt kameran (OpenStreetMaps fotavtryck) ----------
// Enkla hus blir instansade lådor med sadeltak, flerkantiga byggnader extruderas per cell om 600 m.
const BLD = { cell: 600, rad: 6, key: '', cache: new Map(), blocks: null, broofs: null, walls: null, roofs: null, meshes: new Map(), mat: null, cap: 24000, hcap: 30000, pending: false };
function buildBuildingStreams() {
  const wallGeo = new THREE.BoxGeometry(1, 1, 1); wallGeo.translate(0, 0.5, 0);
  // sadeltak: prisma längs husets längd
  const roofGeo = new THREE.BufferGeometry();
  {
    const v = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0, 1, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, 0, 1, 0.5];
    const f = [0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4];
    const pos = []; for (const i of f) pos.push(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]);
    roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); roofGeo.computeVertexNormals();
  }
  const mk = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3); m.count = 0; m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; };
  BLD.blocks = mk(wallGeo, windowMaterial(), BLD.cap);
  BLD.broofs = mk(wallGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), BLD.cap);
  BLD.walls = mk(wallGeo, windowMaterial(), BLD.hcap);
  BLD.roofs = mk(roofGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), BLD.hcap);
  BLD.mat = windowMaterial(); BLD.mat.vertexColors = true;
  MAPD.onTile = () => { BLD.key = ''; };
}
const FLAT_COLS = [0xe8e2d4, 0xd9cdb0, 0xc9cfd3, 0xb9805e, 0xe2d7bd, 0xa9b4b0, 0xf1ece2, 0xc8a27a, 0x9aa3a8];
const HOUSE_COLS = [0x8b2b1e, 0x8b2b1e, 0x9a3324, 0xe9e4d8, 0xf2efe6, 0xd9c48a, 0xc7cdd1, 0xb98d5e, 0x6f7f86];
const ROOF_COLS = [0x3a3b3e, 0x2e2f30, 0x5b3a2e, 0x7a3b2c, 0x45484c, 0x3d4a3f];
const PITCH = new Set([1, 3, 4, 9]);
function bldCell(ci, cj) {
  const key = ci + ',' + cj;
  let c = BLD.cache.get(key);
  if (c) return c;
  const C = BLD.cell, x0 = ci * C, z0 = cj * C;
  const tci = Math.floor(x0 / RCH), tcj = Math.floor(z0 / RCH), list = tileBuildings(tci, tcj);
  if (!list) return null;
  const blocks = [], houses = [], polys = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (const B of list) {
    if (B.x < x0 || B.x >= x0 + C || B.z < z0 || B.z >= z0 + C) continue;
    if (inRunway(B.x, B.z, 40)) continue;
    const hh = hash2(Math.round(B.x * 7), Math.round(B.z * 3));
    if (B.p) { polys.push(B); continue; }
    const h0 = terrainH(B.x, B.z); if (h0 < 0) continue;
    q.setFromAxisAngle(up, -B.a);
    const big = Math.max(B.w, B.l);
    if (PITCH.has(B.k) && big < 45 && B.h < 14) {
      // ögat ser takfoten längs husets långsida
      const along = B.w >= B.l, wall = Math.max(2.4, B.h * 0.62), roofH = Math.max(1.2, B.h - wall);
      const qq = along ? q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(up, Math.PI / 2)) : q;
      const ww = along ? B.l : B.w, ll = along ? B.w : B.l;
      const col = B.k === 4 ? (hh < 0.75 ? 0x8b2b1e : 0x9a8f80) : B.k === 3 ? (hh < 0.5 ? 0x8b2b1e : 0x7d6a55) : HOUSE_COLS[Math.floor(hh * HOUSE_COLS.length)];
      houses.push(m.compose(p.set(B.x, h0 - 0.4, B.z), qq, s.set(ww, wall + 0.4, ll)).clone(),
        m.compose(p.set(B.x, h0 + wall, B.z), qq, s.set(ww + 0.8, roofH, ll + 0.6)).clone(), col, ROOF_COLS[Math.floor(hash2(Math.round(B.x), 7) * ROOF_COLS.length)]);
    } else {
      const col = B.k === 8 ? (hh < 0.5 ? 0xb9bcbf : 0x8f9599) : B.k === 9 ? 0xf2efe6 : FLAT_COLS[Math.floor(hh * FLAT_COLS.length)];
      blocks.push(m.compose(p.set(B.x, h0 - 0.5, B.z), q, s.set(B.w, B.h + 0.5, B.l)).clone(),
        m.compose(p.set(B.x, h0 + B.h, B.z), q, s.set(B.w + 0.3, 0.5, B.l + 0.3)).clone(), col);
    }
  }
  c = { blocks, houses, polys, mesh: null };
  if (BLD.cache.size > 600) { for (const [k, v] of BLD.cache) { if (v.mesh && v.mesh.parent) continue; if (v.mesh) v.mesh.geometry.dispose(); BLD.cache.delete(k); if (BLD.cache.size < 450) break; } }
  BLD.cache.set(key, c);
  return c;
}
// flerkantiga byggnader i en cell: väggar och platt tak i ett enda nät
function polyMesh(c) {
  if (c.mesh || !c.polys.length) return c.mesh;
  const pos = [], col = [], nor = [], cc = new THREE.Color();
  for (const B of c.polys) {
    const p = B.p, n = p.length / 2;
    let h0 = Infinity; for (let j = 0; j < n; j++) h0 = Math.min(h0, terrainH(p[j * 2], p[j * 2 + 1]));
    if (h0 < 0) h0 = 0.3;
    const y0 = h0 - 0.6, y1 = h0 + B.h, hh = hash2(Math.round(B.x * 7), Math.round(B.z * 3));
    cc.setHex(B.k === 8 ? 0xaeb3b6 : B.k === 9 ? 0xf2efe6 : FLAT_COLS[Math.floor(hh * FLAT_COLS.length)]);
    // ringens riktning avgör vilken sida som är utsidan
    let ar = 0; for (let j = 0; j < n; j++) { const k2 = (j + 1) % n; ar += p[j * 2] * p[k2 * 2 + 1] - p[k2 * 2] * p[j * 2 + 1]; }
    const sg = ar > 0 ? 1 : -1;
    for (let j = 0; j < n; j++) {
      const k2 = (j + 1) % n, ax = p[j * 2], az = p[j * 2 + 1], bx = p[k2 * 2], bz = p[k2 * 2 + 1];
      let nx = (bz - az) * sg, nz = -(bx - ax) * sg; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      const quad = sg > 0 ? [[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y0, az], [bx, y1, bz], [ax, y1, az]] : [[ax, y0, az], [bx, y1, bz], [bx, y0, bz], [ax, y0, az], [ax, y1, az], [bx, y1, bz]];
      for (const v of quad) { pos.push(v[0], v[1], v[2]); nor.push(-nx, 0, -nz); col.push(cc.r, cc.g, cc.b); }
    }
    const contour = []; for (let j = 0; j < n; j++) contour.push(new THREE.Vector2(p[j * 2], p[j * 2 + 1]));
    let tris; try { tris = THREE.ShapeUtils.triangulateShape(contour, []); } catch (e) { tris = []; }
    const rc = 0.36 + hh * 0.12;
    for (const t of tris) for (const ix of [t[0], t[2], t[1]]) { pos.push(p[ix * 2], y1, p[ix * 2 + 1]); nor.push(0, 1, 0); col.push(rc, rc, rc * 1.02); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  c.mesh = new THREE.Mesh(g, BLD.mat); c.mesh.castShadow = true; c.mesh.receiveShadow = true;
  return c.mesh;
}
const _bc = new THREE.Color();
function updateBuildings(pos) {
  if (!BLD.blocks) return;
  const ci = Math.floor(pos.x / BLD.cell), cj = Math.floor(pos.z / BLD.cell);
  const key = ci + ',' + cj + (pos.y > 4000 ? 'h' : '');
  if (key === BLD.key) return;
  BLD.key = key;
  let nb = 0, nh = 0, missing = false;
  const want = new Set();
  if (pos.y <= 4000) {
    const cells = [];
    for (let a = -BLD.rad; a <= BLD.rad; a++) for (let b = -BLD.rad; b <= BLD.rad; b++) if (a * a + b * b <= BLD.rad * BLD.rad + 1) cells.push([a * a + b * b, a, b]);
    cells.sort((u, v) => u[0] - v[0]);
    const t0 = performance.now();
    for (const [r2, a, b] of cells) {
      // nya celler byggs några i taget så att flygningen inte hackar
      if (!BLD.cache.has((ci + a) + ',' + (cj + b)) && performance.now() - t0 > 5) { missing = true; continue; }
      const c = bldCell(ci + a, cj + b);
      if (!c) { missing = true; continue; }
      for (let k = 0; k < c.blocks.length && nb < BLD.cap; k += 3) { BLD.blocks.setMatrixAt(nb, c.blocks[k]); BLD.broofs.setMatrixAt(nb, c.blocks[k + 1]); BLD.blocks.setColorAt(nb, _bc.setHex(c.blocks[k + 2])); BLD.broofs.setColorAt(nb, _bc.setHex(0x55585c)); nb++; }
      for (let k = 0; k < c.houses.length && nh < BLD.hcap; k += 4) { BLD.walls.setMatrixAt(nh, c.houses[k]); BLD.roofs.setMatrixAt(nh, c.houses[k + 1]); BLD.walls.setColorAt(nh, _bc.setHex(c.houses[k + 2])); BLD.roofs.setColorAt(nh, _bc.setHex(c.houses[k + 3])); nh++; }
      if (r2 <= 16 && c.polys.length) {
        if (!c.mesh && performance.now() - t0 > 5) { missing = true; continue; }
        const mm = polyMesh(c); if (mm) { want.add(mm); if (!mm.parent) scene.add(mm); }
      }
    }
  }
  for (const c of BLD.cache.values()) if (c.mesh && c.mesh.parent && !want.has(c.mesh)) scene.remove(c.mesh);
  BLD.blocks.count = BLD.broofs.count = nb; BLD.walls.count = BLD.roofs.count = nh;
  for (const mm of [BLD.blocks, BLD.broofs, BLD.walls, BLD.roofs]) { mm.instanceMatrix.needsUpdate = true; mm.instanceColor.needsUpdate = true; }
  if (missing) BLD.key = ''; // försök igen när rutfilen har kommit
}
