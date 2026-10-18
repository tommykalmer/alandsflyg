// ===================== COCKPIT: 3D-interiör med fungerande instrument =====================
// Interiören ritas i en egen scen i flygplanets koordinater (ögat i origo) efter världen,
// med eget djup. Det ger skarp närbild utan att världens djupprecision försämras.
const CK = { scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(62, 1, 0.03, 60), group: null, kind: '', cv: null, g: null, tex: null, t: 0, parts: {} };
const ckHemi = new THREE.HemisphereLight(0xdfe8f0, 0x40464c, 0.75), ckSun = new THREE.DirectionalLight(0xffffff, 0.6);
CK.scene.add(ckHemi, ckSun, ckSun.target);
// blicken riktas ner mot nosen så att banan syns ovanför instrumenten (som en pilot som tittar över glareshielden)
const CK_LOOK = { a320: -8 * DEG, beaver: -8 * DEG, heli: -13 * DEG }, CK_DROP = { a320: 0.15, beaver: 0.11, heli: 0.08 }, CK_FOV = 74, CK_SC = 2;
const CK_SIZES = [{ n: 'INSTR', k: 0.24 }, { n: 'INSTR+', k: 0.34 }, { n: 'INSTR –', k: 0 }];
let CK_SIZE = 0; try { CK_SIZE = +(localStorage.getItem('alandsflyg.ck') || 0) % 3; } catch (e) {}

function ckMat(c, sh) { return new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide }); }
function ckBox(g, w, h, d, x, y, z, mat, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m;
}
// skärm/instrument som visar en del av instrumentkanvasen
function ckScreen(g, w, h, u0, v0, u1, v1, x, y, z, rx) {
  const geo = new THREE.PlaneGeometry(w, h), uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0);
  const m = new THREE.Mesh(geo, CK.screenMat); m.position.set(x, y, z); m.rotation.x = rx; g.add(m); return m;
}
// stolpe mellan två punkter
function ckPost(g, a, b, r, mat) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
  const m = new THREE.Mesh(new THREE.BoxGeometry(r, d.length(), r), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(m); return m;
}

function buildCockpit(acId) {
  if (CK.group) { CK.scene.remove(CK.group); CK.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  const big = acId === 'a320' || acId === 'f50', G = new THREE.Group();
  CK.kind = big ? 'a320' : acId === 'heli' ? 'heli' : 'beaver'; CK.parts = {};
  CK.cv = document.createElement('canvas');
  CK.cv.width = (big ? 1024 : 768) * CK_SC; CK.cv.height = (big ? 256 : 512) * CK_SC;
  CK.g = CK.cv.getContext('2d');
  CK.tex = new THREE.CanvasTexture(CK.cv); CK.tex.anisotropy = 4;
  CK.screenMat = new THREE.MeshBasicMaterial({ map: CK.tex });
  if (big) {
    const panel = ckMat(0x55626c), dark = ckMat(0x262b30), frame = ckMat(0x3b444b), lever = ckMat(0x1c1f22), seat = ckMat(0x2c3a4a);
    // instrumentpanel (lutad bakåt) och glareshield
    const tilt = -0.28, py = -0.37, pz = -0.72;
    ckBox(G, 2.6, 0.42, 0.06, 0.55, py, pz - 0.02, panel, tilt);
    ckBox(G, 2.7, 0.08, 0.32, 0.55, -0.15, pz - 0.06, dark);
    ckBox(G, 0.9, 0.05, 0.06, 0.55, -0.12, pz + 0.07, ckMat(0x8a949b)); // FCU
    // skärmar: PFD, ND (kapten), E/WD i mitten, PFD (styrman)
    const sw = 0.24, sy = py + 0.02, sz = pz + 0.016;
    ckScreen(G, sw, sw, 0, 0, 0.25, 1, -0.16, sy, sz, tilt);
    ckScreen(G, sw, sw, 0.25, 0, 0.5, 1, 0.11, sy, sz, tilt);
    ckScreen(G, sw, sw, 0.5, 0, 0.75, 1, 0.55, sy, sz, tilt);
    ckScreen(G, sw, sw, 0.25, 0, 0.5, 1, 0.99, sy, sz, tilt);
    ckScreen(G, sw, sw, 0, 0, 0.25, 1, 1.26, sy, sz, tilt);
    // vindrutans ramar
    ckPost(G, [0.55, -0.12, -0.92], [0.55, 0.42, -0.62], 0.035, frame);
    ckPost(G, [-0.62, -0.12, -0.72], [-0.7, 0.4, -0.45], 0.05, frame);
    ckPost(G, [1.72, -0.12, -0.72], [1.8, 0.4, -0.45], 0.05, frame);
    ckPost(G, [-0.7, 0.42, -0.45], [1.8, 0.42, -0.45], 0.05, frame);
    ckPost(G, [-0.72, -0.1, -0.1], [-0.76, 0.38, 0.05], 0.07, frame);
    ckPost(G, [1.82, -0.1, -0.1], [1.86, 0.38, 0.05], 0.07, frame);
    // takpanel
    ckBox(G, 1.1, 0.04, 0.9, 0.55, 0.46, -0.05, panel, 0.12);
    for (let i = 0; i < 18; i++) ckBox(G, 0.05, 0.012, 0.03, 0.2 + (i % 9) * 0.085, 0.435, -0.35 + Math.floor(i / 9) * 0.2, ckMat(i % 4 ? 0x9aa3a8 : 0xd9a441), 0.12);
    // sidokonsol med sidospak, mittkonsol med gasreglage
    ckBox(G, 0.22, 0.25, 0.8, -0.62, -0.62, -0.15, dark);
    CK.parts.stick = new THREE.Group(); CK.parts.stick.position.set(-0.62, -0.49, -0.3); G.add(CK.parts.stick);
    ckBox(CK.parts.stick, 0.035, 0.13, 0.035, 0, 0.065, 0, lever);
    ckBox(G, 0.36, 0.3, 0.75, 0.55, -0.66, -0.25, panel);
    CK.parts.levers = [];
    for (const dx of [-0.05, 0.05]) {
      const l = new THREE.Group(); l.position.set(0.55 + dx, -0.5, -0.32); G.add(l);
      ckBox(l, 0.03, 0.14, 0.03, 0, 0.07, 0, lever); ckBox(l, 0.05, 0.03, 0.04, 0, 0.14, 0, ckMat(0xbfc6cb)); CK.parts.levers.push(l);
    }
    ckBox(G, 0.06, 0.08, 0.05, 0.43, -0.48, -0.15, ckMat(0x9aa3a8)); // klaffspak
    ckBox(G, 0.5, 0.9, 0.08, -0.25, -0.75, 0.35, seat);
  } else {
    const panel = ckMat(0x2a2c2e), frame = ckMat(CK.kind === 'heli' ? 0xc9a200 : 0x8b2b1e), dark = ckMat(0x191a1c), metal = ckMat(0x9aa0a4);
    const tilt = -0.12, py = -0.33, pz = -0.6;
    ckBox(G, 1.25, 0.34, 0.05, 0.3, py, pz - 0.02, panel, tilt);
    ckBox(G, 1.3, 0.06, 0.22, 0.3, py + 0.19, pz - 0.05, dark);
    // sex runda instrument i två rader (kanvasen har 3 × 2 rutor)
    const gw = 0.15, gx = [-0.1, 0.065, 0.23], gy = [py + 0.082, py - 0.082];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) ckScreen(G, gw, gw, c / 3, 1 - (r + 1) / 2, (c + 1) / 3, 1 - r / 2, gx[c], gy[r], pz + 0.012, tilt);

    // vindrutans ramar och dörrstolpar
    ckPost(G, [0.3, -0.13, -0.72], [0.3, 0.3, -0.42], 0.025, frame);
    ckPost(G, [-0.33, -0.13, -0.68], [-0.36, 0.3, -0.4], 0.04, frame);
    ckPost(G, [0.93, -0.13, -0.68], [0.96, 0.3, -0.4], 0.04, frame);
    ckPost(G, [-0.36, 0.32, -0.4], [0.96, 0.32, -0.4], 0.04, frame);
    ckPost(G, [-0.38, -0.2, 0.05], [-0.4, 0.32, 0.1], 0.06, frame);
    ckPost(G, [0.98, -0.2, 0.05], [1.0, 0.32, 0.1], 0.06, frame);
    ckBox(G, 1.4, 0.03, 0.6, 0.3, 0.34, -0.1, ckMat(0xd8d2c4)); // innertak
    // ratt som rör sig med spaken
    if (CK.kind === 'heli') {
      // cyklisk spak mellan knäna och kollektiv till vänster
      CK.parts.stick = new THREE.Group(); CK.parts.stick.position.set(0.0, -0.62, -0.28); G.add(CK.parts.stick);
      ckBox(CK.parts.stick, 0.025, 0.3, 0.025, 0, 0.15, 0, dark); ckBox(CK.parts.stick, 0.04, 0.08, 0.04, 0, 0.32, 0, ckMat(0x1c1c1c));
      CK.parts.collective = new THREE.Group(); CK.parts.collective.position.set(-0.3, -0.55, -0.05); G.add(CK.parts.collective);
      ckBox(CK.parts.collective, 0.03, 0.03, 0.4, 0, 0, -0.2, metal); ckBox(CK.parts.collective, 0.045, 0.045, 0.1, 0, 0, -0.42, ckMat(0x1c1c1c));
    } else {
      CK.parts.yoke = new THREE.Group(); CK.parts.yoke.position.set(0.0, -0.3, -0.52); G.add(CK.parts.yoke);
      ckBox(CK.parts.yoke, 0.03, 0.03, 0.2, 0, 0, 0.08, metal);
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 20), dark); wheel.position.z = 0.18; CK.parts.yoke.add(wheel);
      ckBox(CK.parts.yoke, 0.18, 0.02, 0.02, 0, 0, 0.18, dark);
      CK.parts.throttle = new THREE.Group(); CK.parts.throttle.position.set(0.3, -0.42, -0.5); G.add(CK.parts.throttle);
      ckBox(CK.parts.throttle, 0.02, 0.12, 0.02, 0, 0.06, 0, metal); ckBox(CK.parts.throttle, 0.04, 0.03, 0.03, 0, 0.12, 0, ckMat(0x1c1c1c));
    }
    ckBox(G, 0.45, 0.8, 0.06, 0, -0.72, 0.3, ckMat(0x5a4632));
  }
  CK.group = G; CK.scene.add(G);
}

// ---------- instrumentritning ----------
function ckArc(g, cx, cy, r, a0, a1, col, w) { g.beginPath(); g.arc(cx, cy, r, a0, a1); g.strokeStyle = col; g.lineWidth = w; g.stroke(); }
function ckText(g, s, x, y, px, col = '#fff', al = 'center', w = 600) { g.font = `${w} ${px}px "Barlow Condensed","Arial Narrow",sans-serif`; g.fillStyle = col; g.textAlign = al; g.textBaseline = 'middle'; g.fillText(s, x, y); }
function drawPFD(g, S, x0) {
  const W = 256, cx = x0 + 128, cy = 118, A = S.ac;
  g.save(); g.beginPath(); g.rect(x0, 0, W, 256); g.clip();
  g.fillStyle = '#05070a'; g.fillRect(x0, 0, W, 256);
  // attityd
  g.save(); g.beginPath(); g.rect(cx - 62, cy - 70, 124, 140); g.clip();
  g.translate(cx, cy); g.rotate(-S.bank);
  const pp = 3.4, py = S.pitch / DEG * pp;
  g.fillStyle = '#2f73c9'; g.fillRect(-200, -400 + py, 400, 400);
  g.fillStyle = '#8a5a2b'; g.fillRect(-200, py, 400, 400);
  g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(-200, py); g.lineTo(200, py); g.stroke();
  g.lineWidth = 1.5;
  for (let d = -30; d <= 30; d += 5) { if (!d) continue; const y = py - d * pp, w = d % 10 ? 10 : 22; g.beginPath(); g.moveTo(-w, y); g.lineTo(w, y); g.stroke(); if (!(d % 10)) ckText(g, Math.abs(d), -w - 10, y, 11); }
  g.restore();
  g.strokeStyle = '#ffd400'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 44, cy); g.lineTo(cx - 16, cy); g.moveTo(cx + 16, cy); g.lineTo(cx + 44, cy); g.stroke();
  g.fillStyle = '#ffd400'; g.fillRect(cx - 3, cy - 3, 6, 6);
  // fart
  const ias = S.ias * 1.944, ax = x0 + 24;
  g.fillStyle = '#3a4048'; g.fillRect(x0 + 4, cy - 80, 40, 160);
  g.save(); g.beginPath(); g.rect(x0 + 4, cy - 80, 40, 160); g.clip();
  for (let v = Math.floor((ias - 40) / 10) * 10; v < ias + 40; v += 10) { if (v < 0) continue; const y = cy - (v - ias) * 2; g.fillStyle = '#fff'; g.fillRect(x0 + 36, y, 8, 1.5); if (!(v % 20)) ckText(g, v, ax - 2, y, 13); }
  const vls = A.vapp[S.flap] - 10; g.fillStyle = '#e8463a'; const yv = cy - (vls * 0.85 - ias) * 2; g.fillRect(x0 + 40, yv, 4, 200);
  g.restore();
  g.fillStyle = '#000'; g.fillRect(x0 + 2, cy - 11, 44, 22); g.strokeStyle = '#ffd400'; g.lineWidth = 1.5; g.strokeRect(x0 + 2, cy - 11, 44, 22);
  ckText(g, Math.round(ias), ax, cy + 1, 17, '#3dff6a', 'center', 700);
  // höjd
  const alt = S.pos.y * 3.281, bx = x0 + W - 46;
  g.fillStyle = '#3a4048'; g.fillRect(bx, cy - 80, 42, 160);
  g.save(); g.beginPath(); g.rect(bx, cy - 80, 42, 160); g.clip();
  for (let v = Math.floor((alt - 400) / 100) * 100; v < alt + 400; v += 100) { const y = cy - (v - alt) * 0.2; g.fillStyle = '#fff'; g.fillRect(bx, y, 6, 1.5); if (!(v % 500)) ckText(g, v, bx + 24, y, 12); }
  g.restore();
  g.fillStyle = '#000'; g.fillRect(bx - 2, cy - 11, 46, 22); g.strokeRect(bx - 2, cy - 11, 46, 22);
  ckText(g, Math.round(alt / 10) * 10, bx + 21, cy + 1, 15, '#3dff6a', 'center', 700);
  // vertikalfart
  const vs = clamp(S.vs * 196.85 / 2000, -1, 1) * 60;
  g.strokeStyle = '#3dff6a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x0 + W - 3, cy); g.lineTo(x0 + W - 3, cy - vs); g.stroke();
  // kurs
  g.fillStyle = '#3a4048'; g.fillRect(cx - 62, 212, 124, 30);
  g.save(); g.beginPath(); g.rect(cx - 62, 212, 124, 30); g.clip();
  for (let d = Math.floor((S.hdg - 20) / 5) * 5; d < S.hdg + 20; d += 5) { const x = cx + (d - S.hdg) * 3; g.fillStyle = '#fff'; g.fillRect(x, 212, 1.5, d % 10 ? 5 : 9); if (!(d % 10)) ckText(g, String(((d % 360) + 360) % 360 / 10).padStart(2, '0'), x, 230, 12); }
  g.restore();
  g.fillStyle = '#ffd400'; g.fillRect(cx - 1, 208, 2, 14);
  // FMA-rad
  ckText(g, AP.on ? (AP.lat === 'APP' ? 'LOC  G/S' : AP.lat === 'NAV' ? 'NAV  ALT' : 'HDG  ALT') : '', cx, 14, 13, '#3dff6a');
  ckText(g, AP.on ? 'AP1  A/THR' : '', cx, 32, 12, '#fff');
  g.restore();
}
function drawND(g, S, x0) {
  const cx = x0 + 128, cy = 190, R = 150;
  g.save(); g.beginPath(); g.rect(x0, 0, 256, 256); g.clip();
  g.fillStyle = '#05070a'; g.fillRect(x0, 0, 256, 256);
  const range = 20000, k = R / range, h = S.hdg * DEG;
  // rutt
  if (ROUTE.on) {
    const pts = routePoints();
    g.strokeStyle = '#ff4fd8'; g.lineWidth = 2; g.beginPath();
    pts.forEach(([x, z], i) => {
      const dx = x - S.pos.x, dz = z - S.pos.z;
      const rx = dx * Math.cos(h) + dz * Math.sin(h), ry = -dx * Math.sin(h) + dz * Math.cos(h);
      i ? g.lineTo(cx + rx * k, cy + ry * k) : g.moveTo(cx + rx * k, cy + ry * k);
    });
    g.stroke();
  }
  // flygplatser
  for (const ap of AIRPORTS) {
    const dx = ap.x - S.pos.x, dz = ap.z - S.pos.z, rx = dx * Math.cos(h) + dz * Math.sin(h), ry = -dx * Math.sin(h) + dz * Math.cos(h);
    if (Math.hypot(rx, ry) > range * 1.1) continue;
    g.strokeStyle = '#d65dff'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx + rx * k, cy + ry * k, 4, 0, Math.PI * 2); g.stroke();
    ckText(g, ap.icao, cx + rx * k + 6, cy + ry * k - 6, 11, '#d65dff', 'left');
  }
  // kompassbåge
  ckArc(g, cx, cy, R, Math.PI * 1.15, Math.PI * 1.85, '#fff', 1.5);
  for (let d = 0; d < 360; d += 10) {
    const a = (d - S.hdg) * DEG - Math.PI / 2; if (Math.abs(((d - S.hdg + 540) % 360) - 180) > 55) continue;
    const x1 = cx + Math.cos(a) * R, y1 = cy + Math.sin(a) * R, l = d % 30 ? 6 : 10;
    g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(cx + Math.cos(a) * (R - l), cy + Math.sin(a) * (R - l)); g.stroke();
    if (!(d % 30)) ckText(g, String(d / 10), cx + Math.cos(a) * (R - 20), cy + Math.sin(a) * (R - 20), 12);
  }
  g.fillStyle = '#ffd400'; g.beginPath(); g.moveTo(cx, cy - 10); g.lineTo(cx - 8, cy + 8); g.lineTo(cx + 8, cy + 8); g.closePath(); g.fill();
  ckText(g, 'GS ' + Math.round(S.gs * 1.944) + '  TAS ' + Math.round(S.V * 1.944), x0 + 6, 12, 12, '#fff', 'left');
  const w = S.windNow, wk = Math.round(Math.hypot(w.x, w.z) * 1.944), wd = Math.round((Math.atan2(-w.x, w.z) / DEG + 360) % 360);
  ckText(g, String(wd).padStart(3, '0') + '/' + wk, x0 + 6, 28, 12, '#fff', 'left');
  const goal = ROUTE.on ? routeGoal() : null;
  if (goal) { ckText(g, goal.name, x0 + 250, 12, 12, '#ff4fd8', 'right'); ckText(g, (Math.hypot(goal.x - S.pos.x, goal.z - S.pos.z) / 1852).toFixed(1) + ' NM', x0 + 250, 28, 12, '#3dff6a', 'right'); }
  ckText(g, '10', cx + R * 0.5 + 8, cy - 4, 10, '#7fa0b0');
  g.restore();
}
function drawEWD(g, S, x0) {
  g.save(); g.beginPath(); g.rect(x0, 0, 256, 256); g.clip();
  g.fillStyle = '#05070a'; g.fillRect(x0, 0, 256, 256);
  for (let e = 0; e < 2; e++) {
    const cx = x0 + 70 + e * 116, cy = 70, r = 40, n1 = S.ac.prop ? 4 + S.thr * 96 : 20 + S.n1 * 80;
    ckArc(g, cx, cy, r, Math.PI * 0.8, Math.PI * 2.2, '#fff', 2);
    const a = Math.PI * 0.8 + (n1 / 110) * Math.PI * 1.4;
    g.strokeStyle = '#3dff6a'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke();
    ckText(g, n1.toFixed(1), cx + 8, cy + 26, 16, '#3dff6a', 'center', 700);
  }
  ckText(g, S.ac.prop ? 'TQ %' : 'N1 %', x0 + 128, 70, 12, '#7fd3ff');
  const A = S.ac;
  ckText(g, 'FLAP ' + A.flaps[S.flap].n, x0 + 128, 140, 15, '#fff');
  g.fillStyle = '#3a4048'; g.fillRect(x0 + 70, 154, 116, 8); g.fillStyle = '#3dff6a'; g.fillRect(x0 + 70, 154, 116 * S.flapPos / (A.flaps.length - 1), 8);
  if (A.retract) for (let i = 0; i < 3; i++) {
    const x = x0 + 88 + i * 40, y = 196, dn = S.gearPos > 0.98, up = S.gearPos < 0.02;
    g.fillStyle = dn ? '#1e7a35' : up ? '#2a2f34' : '#9a2a20'; g.fillRect(x - 15, y - 12, 30, 24);
    ckText(g, dn ? 'DN' : up ? 'UP' : '▲▼', x, y, 12, '#fff');
  }
  if (S.speedbrake) ckText(g, 'SPEED BRK', x0 + 128, 236, 13, '#3dff6a');
  g.restore();
}
function drawDial(g, cx, cy, r, label) {
  g.fillStyle = '#0d0e10'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#555'; g.lineWidth = 6; g.stroke();
  ckText(g, label, cx, cy + r * 0.45, 14, '#ccc');
}
function dialTicks(g, cx, cy, r, a0, a1, n, major, labels) {
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * i / n, l = i % major ? 8 : 15;
    g.strokeStyle = '#eee'; g.lineWidth = i % major ? 1.5 : 3;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4)); g.lineTo(cx + Math.cos(a) * (r - 4 - l), cy + Math.sin(a) * (r - 4 - l)); g.stroke();
    if (labels && !(i % major)) ckText(g, labels(i), cx + Math.cos(a) * (r - 32), cy + Math.sin(a) * (r - 32), 18, '#eee');
  }
}
function needle(g, cx, cy, a, len, col = '#fff', w = 5) {
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx - Math.cos(a) * 14, cy - Math.sin(a) * 14); g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); g.stroke();
  g.fillStyle = '#222'; g.beginPath(); g.arc(cx, cy, 8, 0, Math.PI * 2); g.fill();
}
function drawBeaverPanel(g, S) {
  g.fillStyle = '#2a2c2e'; g.fillRect(0, 0, 768, 512);
  const r = 116, C = [[128, 128], [384, 128], [640, 128], [128, 384], [384, 384], [640, 384]];
  // fartmätare 0–200 kt
  { const [cx, cy] = C[0]; drawDial(g, cx, cy, r, 'KNOTS'); const a0 = -Math.PI * 0.5, sc = Math.PI * 1.8 / 200;
    ckArc(g, cx, cy, r - 10, a0 + 45 * sc, a0 + 110 * sc, '#2fa84f', 6); ckArc(g, cx, cy, r - 16, a0 + 40 * sc, a0 + 90 * sc, '#eee', 4); ckArc(g, cx, cy, r - 10, a0 + 140 * sc, a0 + 144 * sc, '#e33', 6);
    dialTicks(g, cx, cy, r, a0, a0 + Math.PI * 1.8, 20, 4, i => i * 10); needle(g, cx, cy, a0 + Math.min(S.ias * 1.944, 200) * sc, r - 22); }
  // konstgjord horisont
  { const [cx, cy] = C[1]; g.save(); g.beginPath(); g.arc(cx, cy, r - 6, 0, Math.PI * 2); g.clip();
    g.translate(cx, cy); g.rotate(-S.bank); const py = S.pitch / DEG * 3.2;
    g.fillStyle = '#2f73c9'; g.fillRect(-200, -400 + py, 400, 400); g.fillStyle = '#5a3a1e'; g.fillRect(-200, py, 400, 400);
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(-200, py); g.lineTo(200, py); g.stroke();
    g.lineWidth = 2; for (const d of [-20, -10, 10, 20]) { g.beginPath(); g.moveTo(-20, py - d * 3.2); g.lineTo(20, py - d * 3.2); g.stroke(); }
    g.restore(); g.strokeStyle = '#555'; g.lineWidth = 8; g.beginPath(); g.arc(cx, cy, r - 2, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#ffb000'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx - 60, cy); g.lineTo(cx - 18, cy); g.lineTo(cx, cy + 12); g.lineTo(cx + 18, cy); g.lineTo(cx + 60, cy); g.stroke(); }
  // höjdmätare
  { const [cx, cy] = C[2]; drawDial(g, cx, cy, r, 'ALT'); const alt = S.pos.y * 3.281;
    dialTicks(g, cx, cy, r, -Math.PI / 2, Math.PI * 1.5, 50, 5, i => i < 50 ? i / 5 : '');
    needle(g, cx, cy, -Math.PI / 2 + (alt % 10000) / 10000 * Math.PI * 2, r - 55, '#fff', 8);
    needle(g, cx, cy, -Math.PI / 2 + (alt % 1000) / 1000 * Math.PI * 2, r - 20); }
  // varvräknare (helikoptern: vridmoment)
  if (S.ac.heli) { const [cx, cy] = C[3]; drawDial(g, cx, cy, r, 'TORQUE %'); const a0 = Math.PI * 0.75, sc = Math.PI * 1.5 / 120;
    ckArc(g, cx, cy, r - 10, a0 + 0 * sc, a0 + 92 * sc, '#2fa84f', 6); ckArc(g, cx, cy, r - 10, a0 + 92 * sc, a0 + 100 * sc, '#e6b800', 6); ckArc(g, cx, cy, r - 10, a0 + 100 * sc, a0 + 102 * sc, '#e33', 6);
    dialTicks(g, cx, cy, r, a0, a0 + Math.PI * 1.5, 12, 2, i => i * 10); needle(g, cx, cy, a0 + clamp(S.tq || 0, 0, 120) * sc, r - 22); }
  else { const [cx, cy] = C[3]; drawDial(g, cx, cy, r, 'RPM ×100'); const a0 = Math.PI * 0.75, sc = Math.PI * 1.5 / 30;
    ckArc(g, cx, cy, r - 10, a0 + 18 * sc, a0 + 23 * sc, '#2fa84f', 6); dialTicks(g, cx, cy, r, a0, a0 + Math.PI * 1.5, 30, 5, i => i);
    needle(g, cx, cy, a0 + (8 + S.thr * 15) * sc, r - 22); }
  // kursgyro
  { const [cx, cy] = C[4]; drawDial(g, cx, cy, r, ''); g.save(); g.translate(cx, cy); g.rotate(-S.hdg * DEG);
    for (let d = 0; d < 360; d += 5) { const a = d * DEG - Math.PI / 2, l = d % 30 ? 8 : 16; g.strokeStyle = '#eee'; g.lineWidth = 2; g.beginPath(); g.moveTo(Math.cos(a) * (r - 6), Math.sin(a) * (r - 6)); g.lineTo(Math.cos(a) * (r - 6 - l), Math.sin(a) * (r - 6 - l)); g.stroke();
      if (!(d % 30)) { g.save(); g.rotate(d * DEG); ckText(g, ({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' })[d] || d / 10, 0, -r + 36, 20, '#eee'); g.restore(); } }
    g.restore(); g.strokeStyle = '#ffb000'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, cy - 40); g.lineTo(cx, cy + 40); g.moveTo(cx - 26, cy); g.lineTo(cx + 26, cy); g.stroke(); }
  // variometer
  { const [cx, cy] = C[5]; drawDial(g, cx, cy, r, 'FT/MIN ×100'); const vs = clamp(S.vs * 196.85 / 100, -20, 20);
    dialTicks(g, cx, cy, r, Math.PI * 0.2, Math.PI * 1.8, 8, 2, i => Math.abs(i * 5 - 20));
    needle(g, cx, cy, Math.PI - vs / 20 * Math.PI * 0.8, r - 22); }
}
function updateCockpit(S, dt) {
  if (!CK.group) return;
  CK.t += dt;
  if (CK.t > 1 / 15) {
    CK.t = 0;
    const g = CK.g;
    g.setTransform(CK_SC, 0, 0, CK_SC, 0, 0);
    if (CK.kind === 'a320') { drawPFD(g, S, 0); drawND(g, S, 256); drawEWD(g, S, 512); g.drawImage(CK.cv, 0, 0, 256 * CK_SC, 256 * CK_SC, 768, 0, 256, 256); }
    else drawBeaverPanel(g, S);
    CK.tex.needsUpdate = true;
  }
  // rörliga reglage
  const p = CK.parts;
  if (p.stick) p.stick.rotation.set(S.inp.e * 0.3, 0, -S.inp.r * 0.3);
  if (p.levers) for (const l of p.levers) l.rotation.x = -0.5 + S.thr * 0.9;
  if (p.yoke) { p.yoke.position.z = -0.52 + S.inp.e * 0.06; p.yoke.rotation.z = -S.inp.r * 0.6; }
  if (p.throttle) p.throttle.rotation.x = -0.4 + S.thr * 0.8;
  if (p.collective) p.collective.rotation.x = -0.15 + S.thr * 0.45;
  // ljus i flygplanets koordinater
  const qi = S.q.clone().invert();
  ckSun.position.copy(LDIR).applyQuaternion(qi).multiplyScalar(10); ckSun.target.position.set(0, 0, 0);
  ckSun.intensity = sunLight.intensity * 0.8;
  ckHemi.intensity = 0.25 + 0.55 * TOD.light;
  CK.screenMat.color.setScalar(0.75 + 0.25 * TOD.light);
}
function renderCockpit(S) {
  const look = CK_LOOK[CK.kind];
  CK.group.position.set(0, -CK_DROP[CK.kind], 0);
  CK.cam.aspect = camera.aspect; CK.cam.fov = camera.fov; CK.cam.updateProjectionMatrix();
  CK.cam.position.set(0, 0, 0); CK.cam.rotation.set(look, 0, 0);
  renderer.autoClear = false; renderer.clearDepth();
  renderer.render(CK.scene, CK.cam);
  renderer.autoClear = true;
}

// skarpa instrument i skärmens nederkant (ritas på HUD-lagret i cockpitvyn)
function drawCockpitOverlay(g, W, H) {
  if (!CK.cv) return;
  const portrait = H > W, bar = W < 600 ? 112 : 64;
  const cells = CK.kind === 'a320'
    ? [[0, 0], [1, 0], [2, 0]]                 // PFD, ND, motorer (rutor om 256 i kanvasen)
    : CK.kind === 'heli' ? [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1]] // + vridmoment
    : [[0, 0], [1, 0], [2, 0], [2, 1]];        // fart, horisont, höjd, variometer (rutor om 256)
  const src = 256 * CK_SC, n = cells.length;
  const side = portrait ? 12 : 92, maxW = W - side * 2 - (portrait ? 0 : 150);
  const kk = CK_SIZES[CK_SIZE].k;
  if (!kk) { CK.ovTop = H - bar; return CK.ovTop; }
  const sz = Math.floor(Math.min(H * (portrait ? Math.min(kk, 0.2) : kk), (maxW - (n - 1) * 6) / n, 220));
  const tw = n * sz + (n - 1) * 6, x0 = portrait ? (W - tw) / 2 : Math.max(side, (W - 150 - tw) / 2 + 10), y0 = H - bar - sz - 6;
  g.fillStyle = 'rgba(20,24,28,.82)';
  g.beginPath(); if (g.roundRect) g.roundRect(x0 - 6, y0 - 6, tw + 12, sz + 12, 8); else g.rect(x0 - 6, y0 - 6, tw + 12, sz + 12); g.fill();
  cells.forEach(([cx, cy], i) => {
    const x = x0 + i * (sz + 6);
    g.save(); g.beginPath();
    if (CK.kind === 'a320') g.rect(x, y0, sz, sz); else g.arc(x + sz / 2, y0 + sz / 2, sz / 2, 0, Math.PI * 2);
    g.clip(); g.drawImage(CK.cv, cx * src, cy * src, src, src, x, y0, sz, sz); g.restore();
  });
  CK.ovTop = y0 - 6;
  return y0 - 6;
}
