// ===================== HUD =====================
const hud = document.getElementById('hud'), hx = hud.getContext('2d');
let HW = 0, HH = 0, HDPR = 1, TOPBAR_W = 260, HUDMIN = false;
const HUDSTATE = { stallWarn: false };
const HL = { clipW: 200 };
const C_HUD = '#a6ffbe', C_SH = 'rgba(0,22,12,.62)', C_WARN = '#ff5a4e', C_AMBER = '#ffc24a', C_GOAL = '#7fd3ff';
const FONT = (px, w = 600) => `${w} ${px}px "Barlow Condensed","Arial Narrow",sans-serif`;
function hudResize() {
  HW = innerWidth; HH = innerHeight; HDPR = Math.min(window.devicePixelRatio || 1, 2);
  hud.width = HW * HDPR; hud.height = HH * HDPR;
  const tb = document.querySelector('.topbar'); if (tb) { const r = tb.getBoundingClientRect(); if (r.width) TOPBAR_W = r.width; }
}
function strokeFill(fn, color = C_HUD, lw = 1.6) {
  hx.beginPath(); fn(); hx.strokeStyle = C_SH; hx.lineWidth = lw + 2.6; hx.stroke();
  hx.strokeStyle = color; hx.lineWidth = lw; hx.stroke();
}
function htext(s, x, y, px, align = 'center', color = C_HUD, w = 600) {
  hx.font = FONT(px, w); hx.textAlign = align; hx.textBaseline = 'middle';
  hx.lineWidth = 3.2; hx.strokeStyle = C_SH; hx.strokeText(s, x, y);
  hx.fillStyle = color; hx.fillText(s, x, y);
}
const kt = ms => ms * 1.94384, ft = m => m * 3.28084;
const fmtKm = m => (m / 1000).toFixed(m < 10000 ? 1 : 0);
const bearingTo = (S, x, z) => (Math.atan2(x - S.pos.x, -(z - S.pos.z)) / DEG + 360) % 360;

function drawHUD(S, show, paused) {
  hx.setTransform(HDPR, 0, 0, HDPR, 0, 0);
  hx.clearRect(0, 0, HW, HH);
  if (!show || !S) return;
  if (typeof showFps !== 'undefined' && showFps) htext(Math.round(PERF.fps) + ' FPS' + (PERF.prK < 1 ? ' · ' + Math.round(PERF.prK * 100) + '%' : ''), HW - 12, HH - 10, 11, 'right', PERF.fps < 40 ? C_AMBER : C_HUD);
  const A = S.ac, W = HW, H = HH;
  const small = Math.min(W, H) < 500, portrait = H > W;
  const cx = W / 2, cy = H * 0.46;
  const ppd = Math.min(H, W) * (small ? 0.021 : 0.019);
  // i cockpitvyn visar instrumenten fart, höjd och attityd: rita dem osynligt
  hx.globalAlpha = HUDMIN ? 0 : 1;
  // ---- attityd ----
  const miniR = (typeof MINI !== 'undefined' && MINI.on && !portrait) ? MINI.size + 16 : 0;
  const axL = Math.min(cx + Math.min(W * 0.33, 290), W - 112 - miniR);
  const clipW = Math.max(70, Math.min(W * 0.22, 210, axL - cx - 48)), clipH = H * 0.3;
  HL.clipW = clipW;
  hx.save();
  hx.beginPath(); hx.rect(cx - clipW, cy - clipH, clipW * 2, clipH * 2); hx.clip();
  hx.translate(cx, cy); hx.rotate(-S.bank);
  const pd = S.pitch / DEG;
  for (let d = -90; d <= 90; d += 5) {
    const y = (pd - d) * ppd;
    if (Math.abs(y) > clipH * 1.5) continue;
    if (d === 0) { strokeFill(() => { hx.moveTo(-clipW * 2, y); hx.lineTo(-28, y); hx.moveTo(28, y); hx.lineTo(clipW * 2, y); }); continue; }
    const wMax = Math.max(24, Math.min(52, clipW - 58)), w = d % 10 === 0 ? wMax : wMax * 0.58, gap = 26;
    hx.setLineDash(d < 0 ? [6, 5] : []);
    strokeFill(() => {
      hx.moveTo(-gap - w, y); hx.lineTo(-gap, y); hx.lineTo(-gap, y + (d > 0 ? 6 : -6));
      hx.moveTo(gap + w, y); hx.lineTo(gap, y); hx.lineTo(gap, y + (d > 0 ? 6 : -6));
    }, C_HUD, 1.3);
    hx.setLineDash([]);
    if (d % 10 === 0) { htext(Math.abs(d), -gap - w - 14, y, 13); htext(Math.abs(d), gap + w + 14, y, 13); }
  }
  hx.restore();
  const br = clipH * 0.95;
  strokeFill(() => {
    for (const a of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
      const r = a * DEG, l = a % 30 === 0 ? 12 : 7;
      hx.moveTo(cx + Math.sin(r) * br, cy - Math.cos(r) * br); hx.lineTo(cx + Math.sin(r) * (br + l), cy - Math.cos(r) * (br + l));
    }
  }, C_HUD, 1.3);
  const bk = -S.bank;
  strokeFill(() => {
    const tx = cx + Math.sin(bk) * (br - 2), ty = cy - Math.cos(bk) * (br - 2);
    hx.moveTo(tx, ty); hx.lineTo(tx + Math.sin(bk - 2.7) * 11, ty - Math.cos(bk - 2.7) * 11);
    hx.lineTo(tx + Math.sin(bk + 2.7) * 11, ty - Math.cos(bk + 2.7) * 11); hx.closePath();
  }, Math.abs(S.bank) > 45 * DEG ? C_AMBER : C_HUD);
  strokeFill(() => { hx.moveTo(cx - 44, cy); hx.lineTo(cx - 16, cy); hx.lineTo(cx - 8, cy + 8); hx.lineTo(cx, cy); hx.lineTo(cx + 8, cy + 8); hx.lineTo(cx + 16, cy); hx.lineTo(cx + 44, cy); }, C_HUD, 2.2);
  if (S.V > 8 && (typeof camMode === 'undefined' || camMode !== 'chase')) {
    const mx = clamp(cx + (S.beta / DEG) * ppd, cx - clipW, cx + clipW), my = clamp(cy + (S.alpha / DEG) * ppd, cy - clipH, cy + clipH);
    strokeFill(() => { hx.arc(mx, my, 7, 0, Math.PI * 2); hx.moveTo(mx - 7, my); hx.lineTo(mx - 19, my); hx.moveTo(mx + 7, my); hx.lineTo(mx + 19, my); hx.moveTo(mx, my - 7); hx.lineTo(mx, my - 14); });
  }
  // ---- fart ----
  const tapeH = H * (small ? 0.26 : 0.28);
  const sx = Math.max(cx - Math.min(W * 0.33, 290), portrait ? 118 : 108);
  const ias = kt(S.ias), pxk = A.cls === 'jet' ? 2.2 : A.cls === 'tp' ? 2.6 : 3.4;
  const fl = A.flaps[Math.round(S.flapPos)];
  const clmax = A.heli ? 1 : A.CL0 + fl.cl + A.CLa * (A.aStall - S.flapPos * 0.6 * DEG);
  const vs = A.heli ? -99 : kt(Math.sqrt((2 * A.mass * 9.81) / (1.225 * A.S * clmax)));
  hx.save(); hx.beginPath(); hx.rect(sx - 60, cy - tapeH, 90, tapeH * 2); hx.clip();
  strokeFill(() => {
    hx.moveTo(sx, cy - tapeH); hx.lineTo(sx, cy + tapeH);
    for (let v = Math.floor((ias - tapeH / pxk) / 10) * 10; v <= ias + tapeH / pxk; v += 10) {
      if (v < 0) continue; const y = cy - (v - ias) * pxk; hx.moveTo(sx, y); hx.lineTo(sx - (v % 20 === 0 ? 10 : 6), y);
    }
  }, C_HUD, 1.3);
  for (let v = Math.floor((ias - tapeH / pxk) / 20) * 20; v <= ias + tapeH / pxk; v += 20) { if (v < 0) continue; htext(v, sx - 30, cy - (v - ias) * pxk, 14, 'center'); }
  const yVs = cy - (vs - ias) * pxk;
  hx.fillStyle = C_WARN; hx.fillRect(sx + 2, yVs, 5, cy + tapeH - yVs);
  hx.fillStyle = C_AMBER; hx.fillRect(sx + 2, cy - (vs * 1.2 - ias) * pxk, 5, (vs * 0.2) * pxk);
  const vmax = kt(S.flap > 0 ? Math.min(fl.vfe, A.vne) : A.vne), yMax = cy - (vmax - ias) * pxk;
  for (let y = yMax; y > cy - tapeH - 10; y -= 10) { hx.fillStyle = C_WARN; hx.fillRect(sx + 2, y - 5, 5, 5); }
  hx.restore();
  strokeFill(() => { hx.rect(sx - 54, cy - 15, 50, 30); }, C_HUD, 1.6);
  hx.fillStyle = 'rgba(0,18,10,.55)'; hx.fillRect(sx - 53, cy - 14, 48, 28);
  htext(Math.round(ias), sx - 29, cy + 1, 21, 'center', S.stall ? C_WARN : C_HUD, 700);
  htext('KT', sx - 29, cy - tapeH - 12, 12);
  htext('GS ' + Math.round(kt(S.gs)), sx - 29, cy + tapeH + 14, 13);
  htext('G ' + S.g.toFixed(1), sx - 29, cy + tapeH + 30, 13, 'center', S.g > 3.5 || S.g < -0.5 ? C_AMBER : C_HUD);
  // ---- höjd ----
  const ax = axL;
  const alt = ft(S.pos.y), pxf = 0.22;
  hx.save(); hx.beginPath(); hx.rect(ax - 30, cy - tapeH, 100, tapeH * 2); hx.clip();
  strokeFill(() => {
    hx.moveTo(ax, cy - tapeH); hx.lineTo(ax, cy + tapeH);
    for (let v = Math.floor((alt - tapeH / pxf) / 100) * 100; v <= alt + tapeH / pxf; v += 100) {
      const y = cy - (v - alt) * pxf; hx.moveTo(ax, y); hx.lineTo(ax + (v % 500 === 0 ? 10 : 6), y);
    }
  }, C_HUD, 1.3);
  for (let v = Math.floor((alt - tapeH / pxf) / 500) * 500; v <= alt + tapeH / pxf; v += 500) htext(v, ax + 34, cy - (v - alt) * pxf, 14, 'center');
  const gAlt = ft(Math.max(terrainH(S.pos.x, S.pos.z), 0)), yG = cy - (gAlt - alt) * pxf;
  if (yG < cy + tapeH) { hx.fillStyle = 'rgba(255,194,74,.35)'; hx.fillRect(ax - 1, yG, 8, cy + tapeH - yG); }
  hx.restore();
  strokeFill(() => { hx.rect(ax + 4, cy - 15, 62, 30); }, C_HUD, 1.6);
  hx.fillStyle = 'rgba(0,18,10,.55)'; hx.fillRect(ax + 5, cy - 14, 60, 28);
  htext(Math.round(alt / 10) * 10, ax + 35, cy + 1, 20, 'center', C_HUD, 700);
  htext('FT', ax + 35, cy - tapeH - 12, 12);
  const fpm = S.vs * 196.85;
  htext((fpm >= 0 ? '+' : '−') + Math.abs(Math.round(fpm / 10) * 10), ax + 35, cy + tapeH + 14, 13, 'center', fpm < -1500 && S.agl < 300 ? C_AMBER : C_HUD);
  const vsBar = clamp(fpm / 2000, -1, 1) * tapeH * 0.6;
  strokeFill(() => { hx.moveTo(ax + 74, cy); hx.lineTo(ax + 74, cy - vsBar); }, C_HUD, 3);
  if (ft(S.agl) < 2500 && !S.onGround) htext('RA ' + Math.max(0, Math.round(ft(S.agl) / 10) * 10), ax - 8, cy + 32, 14, 'right', ft(S.agl) < 200 ? C_AMBER : C_HUD);
  // ---- vind (under farttejpen) ----
  {
    const w = S.windNow, wk = kt(Math.hypot(w.x, w.z));
    const from = (Math.atan2(-w.x, w.z) / DEG + 360) % 360;
    htext(wk > 0.5 ? `WIND ${String(Math.round(from / 10) * 10 % 360).padStart(3, '0')}/${Math.round(wk)}` : 'WIND CALM', sx - 29, cy + tapeH + 46, 13, 'center');
  }
  hx.globalAlpha = 1;
  // ---- kurs ----
  const hy = portrait ? 74 : 26 + (small ? 4 : 10), pxd = 3.6;
  let hw = Math.min(W * 0.34, 360);
  const maxRight = W - TOPBAR_W - 26;
  let hcx = cx;
  if (!portrait && hcx + hw / 2 > maxRight) { hcx = Math.max(maxRight - hw / 2, 100 + hw / 2); if (hcx + hw / 2 > maxRight) { hw = Math.max(160, (maxRight - 100)); hcx = 100 + hw / 2; } }
  hx.save(); hx.beginPath(); hx.rect(hcx - hw / 2, hy - 20, hw, 46); hx.clip();
  strokeFill(() => {
    hx.moveTo(hcx - hw / 2, hy + 8); hx.lineTo(hcx + hw / 2, hy + 8);
    for (let d = Math.floor(S.hdg - hw / 2 / pxd); d <= S.hdg + hw / 2 / pxd; d++) {
      if (d % 5) continue; const x = hcx + (d - S.hdg) * pxd; hx.moveTo(x, hy + 8); hx.lineTo(x, hy + 8 - (d % 10 === 0 ? 8 : 4));
    }
  }, C_HUD, 1.2);
  for (let d = Math.ceil((S.hdg - hw / 2 / pxd) / 10) * 10; d <= S.hdg + hw / 2 / pxd; d += 10) {
    const dd = ((d % 360) + 360) % 360, lbl = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[dd] ?? String(dd / 10).padStart(2, '0');
    if (dd % 30 === 0) htext(lbl, hcx + (d - S.hdg) * pxd, hy - 8, 13, 'center', C_HUD, lbl.length === 1 ? 700 : 600);
  }
  let near = null, nd = Infinity;
  for (const z of ZONES) { if (z.kind === 'scene' || (z.kind === 'helipad' && !A.heli)) continue; const d = Math.hypot(z.x - S.pos.x, z.z - S.pos.z); if (d < nd) { nd = d; near = z; } }
  const marker = (brg, col) => {
    const rel = ((brg - S.hdg + 540) % 360) - 180, bx = hcx + clamp(rel * pxd, -hw / 2 + 6, hw / 2 - 6);
    strokeFill(() => { hx.moveTo(bx, hy + 10); hx.lineTo(bx - 6, hy + 20); hx.lineTo(bx + 6, hy + 20); hx.closePath(); }, col, 1.6);
  };
  const brg = bearingTo(S, near.x, near.z);
  marker(brg, C_AMBER);
  const goal = (typeof routeGoal === 'function' && ROUTE.on ? routeGoal() : null) || (typeof missionGoal === 'function' ? missionGoal() : null);
  let gbrg = 0, gd = 0;
  if (goal) { gbrg = bearingTo(S, goal.x, goal.z); gd = Math.hypot(goal.x - S.pos.x, goal.z - S.pos.z); marker(gbrg, C_GOAL); }
  hx.restore();
  strokeFill(() => { hx.rect(hcx - 24, hy + 12, 48, 22); }, C_HUD, 1.4);
  hx.fillStyle = 'rgba(0,18,10,.55)'; hx.fillRect(hcx - 23, hy + 13, 46, 20);
  htext(String(Math.round(S.hdg) % 360).padStart(3, '0'), hcx, hy + 23.5, 16, 'center', C_HUD, 700);
  if (goal) htext(`${goal.name}  ${fmtKm(gd)} km  ${String(Math.round(gbrg)).padStart(3, '0')}°`, hcx, hy + 48, 13, 'center', C_GOAL);
  else htext(`${near.short}  ${fmtKm(nd)} km  ${String(Math.round(brg)).padStart(3, '0')}°`, hcx, hy + 48, 13, 'center', C_AMBER);
  // ---- uppdragsrad ----
  if (typeof MS !== 'undefined' && MS.state === 'run' && !MS.def.tutorial) {
    const obj = missionObjective();
    htext(obj + (MS.def.score === 'time' ? '  ·  ' + fmtTime(MS.t) : ''), cx, H - (W < 600 ? 136 : 90) - GUIDE_LINES * 20, 15, 'center', C_GOAL, 700);
  }
  // ---- rutt och autopilot ----
  if (ROUTE.on) {
    const rem = routeRemaining(S), eta = rem / Math.max(S.gs, 25) / 60;
    htext(`${ROUTE.from.label} → ${ROUTE.to.label} · ${fmtKm(rem)} km to go · ${eta < 1 ? '<1' : Math.round(eta)} min`, hcx, hy + 66, 13, 'center', '#ff9ae6', 700);
  }
  if (AP.on) htext(AP.app ? `AUTOLAND · ${{ APP: 'GLIDESLOPE', FLARE: 'FLARE', ROLL: 'ROLLOUT' }[AP.lat] || AP.lat} · ${Math.round(AP.spdT || AP.spd)} KT` : `AP ${AP.lat} · ${Math.round(ft(AP.lat === 'NAV' && AP.altT != null ? AP.altT : AP.alt) / 100) * 100} FT · ${Math.round(AP.spdT || AP.spd)} KT${WARP > 1 ? ' · TIME WARP ×' + WARP : ''}`, hcx, hy + (ROUTE.on ? 84 : 66), 13, 'center', C_GOAL, 700);
  if (AP.msg && performance.now() < AP.msgT) htext(AP.msg, cx, cy - clipH * 0.58 - 26, 16, 'center', C_GOAL, 700);
  hx.globalAlpha = HUDMIN ? 0 : 1;
  // ---- status ----
  const lines = [];

  if (A.heli && S.vsCmd != null && !AP.on) lines.push([(S.posHold ? 'ASSIST · HOVER HOLD' : Math.abs(S.vsCmd) < 0.05 ? 'ASSIST · HOLD HEIGHT' : `ASSIST · ${S.vsCmd > 0 ? 'CLIMB' : 'DESCEND'} ${Math.abs(Math.round(S.vsCmd * 196.85 / 50) * 50)} FT/MIN`) + (S.vfT != null && !S.posHold ? ` · SPEED ${Math.round(S.vfT * 1.944)} KT` : '') + (S.hspd > 0.5 ? ` · TRIM ${Math.round(S.hspd * 1.944)} KT` : ''), C_GOAL]);
  lines.push([A.heli ? `COLLECTIVE ${Math.round((S.coll != null ? S.coll : S.thr) * 100)}%  TQ ${Math.round(S.tq || 0)}%` : A.prop ? `THROTTLE ${Math.round(S.thr * 100)}%` : `N1 ${Math.round(20 + S.n1 * 80)}%  (${Math.round(S.thr * 100)}%)`, A.heli && (S.tq || 0) > 100 ? C_WARN : C_HUD]);
  if (!A.heli) lines.push([`FLAPS ${A.flaps[S.flap].n}${Math.abs(S.flapPos - S.flap) > 0.02 ? ' …' : ''}`, C_HUD]);
  if (A.retract) lines.push([S.gearPos > 0.98 ? 'GEAR DOWN' : S.gearPos < 0.02 ? 'GEAR UP' : 'GEAR IN TRANSIT', S.gearPos > 0.98 ? C_HUD : C_AMBER]);
  if (A.heli && !S.assist && Math.abs(S.htrim || 0) > 0.2) lines.push([`TRIM ${S.htrim < 0 ? 'NOSE DN' : 'NOSE UP'} ${Math.abs(S.htrim).toFixed(0)}°`, C_HUD]);
  if (!A.fbw && !A.heli) lines.push([`TRIM ${S.trim <= 0 ? '▲' : '▼'} ${Math.abs(Math.round(S.trim / DEG * 2) / 2).toFixed(1)}`, C_HUD]);
  if (S.brake && S.onGround) lines.push(['BRAKES', C_AMBER]);
  if (S.spoilers) lines.push([S.onGround ? 'SPOILERS' : 'SPEED BRAKE', C_AMBER]);
  if (S.landAssist) lines.push(['LANDING ASSIST', C_GOAL]);
  if (typeof CABIN !== 'undefined' && CABIN.belts && !A.heli) lines.push(['SEAT BELTS ON', C_AMBER]);
  if (A.fbw) lines.push([S.onGround || S.airTime < 2.5 ? 'GROUND MODE' : 'NORMAL LAW', C_HUD]);
  hx.font = FONT(14); const gapS = 18;
  const tw = lines.reduce((a, [s]) => a + hx.measureText(s).width, 0) + gapS * (lines.length - 1);
  let lx = cx - tw / 2; const ly = H - (W < 600 ? 112 : 66);
  for (const [s, c] of lines) { const w = hx.measureText(s).width; htext(s, lx, ly, 14, 'left', c); lx += w + gapS; }
  hx.globalAlpha = 1;
  if (HUDMIN && typeof drawCockpitOverlay === 'function') drawCockpitOverlay(hx, W, H);
  // ---- varningar ----
  const warns = [];
  const stallWarn = !A.heli && !S.onGround && S.V > 10 && S.alpha > S.aSt - 2 * DEG;
  HUDSTATE.stallWarn = stallWarn;
  if (stallWarn) warns.push(['STALL', C_WARN, true]);
  if (S.alphaFloor) warns.push(['A.FLOOR · TOGA', C_AMBER, false]);
  if (S.ias > A.vne) warns.push(['OVERSPEED', C_WARN, true]);
  else if (S.flap > 0 && S.ias > fl.vfe + 2) warns.push(['FLAPS – TOO FAST', C_AMBER, false]);
  const nearRwy = nd < 4500;
  if (A.heli && (S.tq || 0) > 105) warns.push(['TORQUE LIMIT', C_WARN, true]);
  if (A.heli && (S.vrs || 0) > 0.35) warns.push(['VORTEX RING – PUSH FORWARD', C_WARN, true]);
  else if (A.heli && !S.onGround && S.vs < -6 && S.agl < 60) warns.push(['SINK RATE – PULL COLLECTIVE', C_WARN, true]);
  if (!A.heli && !S.onGround && S.vs < -4 && S.agl < 400 && S.agl / -S.vs < 8 && !(nearRwy && S.flap > 0) && !(A.floats && !isLand(S.pos.x, S.pos.z))) warns.push(['TERRAIN – PULL UP', C_WARN, true]);
  if (A.retract && !S.gearDown && !S.onGround && S.agl < 230 && S.vs < 0) warns.push(['GEAR NOT DOWN', C_WARN, true]);
  if (paused) warns.push(['PAUSED', C_HUD, false]);
  const blink = Math.floor(performance.now() / 300) % 2 === 0;
  warns.forEach(([s, c, b], i) => { if (!b || blink) htext(s, cx, cy + clipH * 0.55 + i * 24, 20, 'center', c, 700); });
}

// ===================== LANDNINGSGUIDE =====================
let GUIDE_LINES = 0;
const C_ILS = '#ff7ad9';
// banmarkering: banans kontur ritas i HUD:en så att den går att hitta på håll (som en syntetisk vy)
const _rv = new THREE.Vector3();
function projScr(x, y, z) {
  _rv.set(x, y, z).project(camera);
  if (_rv.z > 1 || _rv.z < -1) return null;
  return [(_rv.x + 1) / 2 * HW, (1 - _rv.y) / 2 * HH];
}
function drawRunwayBoxes(S, ap) {
  const A = S.ac;
  hx.save(); hx.lineJoin = 'round';
  for (const zn of ZONES) {
    const pad = zn.kind === 'helipad' || zn.kind === 'scene';
    if (A.heli ? !pad : pad) continue;
    if (!A.heli && isBig(A) && !zn.big) continue;
    const d = Math.hypot(zn.x - S.pos.x, zn.z - S.pos.z);
    const maxD = A.heli ? 5000 : isBig(A) ? 25000 : 14000;
    if (d > maxD || d < (A.heli ? 60 : zn.len * 0.6)) continue;
    const hl = zn.len / 2, hw = zn.wid / 2, y = zn.elev + 0.3, pts = [];
    for (const [a, c] of [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]]) { const [x, z] = zoneWorld(zn, a, c); const p = projScr(x, y, z); if (!p) { pts.length = 0; break; } pts.push(p); }
    if (pts.length < 4) continue;
    const xs0 = pts.map(p => p[0]), ys0 = pts.map(p => p[1]);
    if (Math.max(...xs0) < 0 || Math.min(...xs0) > HW || Math.max(...ys0) < 0 || Math.min(...ys0) > HH) continue;
    const main = ap && ap.zn === zn;
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
    // konturen tonas bort när banan själv syns tydligt, så att den inte döljer banljusen
    const fade = pad ? 1 : clamp((140 - Math.max(bw, bh * 2)) / 90, 0, 1);
    if (fade > 0.02) {
      hx.globalAlpha = fade * (main ? 0.9 : 0.55);
      strokeFill(() => { hx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < 4; i++) hx.lineTo(pts[i][0], pts[i][1]); hx.closePath(); }, main ? C_ILS : C_HUD, 1.4);
    }
    // på håll är banan bara några pixlar: rama in den med hörn och namn så att den går att hitta
    if (bw < 40 || bh < 18) {
      const mx = (Math.max(...xs) + Math.min(...xs)) / 2, my = (Math.max(...ys) + Math.min(...ys)) / 2;
      const rx = Math.max(bw / 2 + 8, 18), ry = Math.max(bh / 2 + 6, 11), k = 7;
      hx.globalAlpha = main ? 1 : 0.75;
      strokeFill(() => {
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { hx.moveTo(mx + sx * rx, my + sy * (ry - k)); hx.lineTo(mx + sx * rx, my + sy * ry); hx.lineTo(mx + sx * (rx - k), my + sy * ry); }
      }, main ? C_ILS : C_HUD, 1.8);
      const lbl = pad ? '' : (main ? 'RWY ' + ap.name : (APT[zn.apt] ? APT[zn.apt].label : zn.short));
      if (lbl) htext(lbl, mx, my + ry + 10, 12, 'center', main ? C_ILS : C_HUD, 700);
    }
    if (pad) { const c = projScr(zn.x, y, zn.z); if (c) htext(zn.kind === 'scene' ? '✚' : 'H', c[0], c[1] - 14, 13, 'center', zn.kind === 'scene' ? '#7fb2ff' : C_HUD, 700); }
  }
  hx.restore();
}
// ---- inflygningsguide: grindar längs glidbanan, flygbanemarkering och en ring att följa ----
// Allt projiceras genom den riktiga kameran, så det stämmer i yttre vy, cockpit och HUD.
const GUIDE = { key: '', passed: [], last: Infinity, flash: null, ias: null, acc: 0, t: 0 };
function guideReset() { GUIDE.key = ''; GUIDE.passed = []; GUIDE.last = Infinity; GUIDE.flash = null; }
const C_OK = '#7dff9a';
function drawFPV(x, y, col, lw = 2) {
  strokeFill(() => { hx.moveTo(x + 8, y); hx.arc(x, y, 8, 0, Math.PI * 2); hx.moveTo(x - 8, y); hx.lineTo(x - 22, y); hx.moveTo(x + 8, y); hx.lineTo(x + 22, y); hx.moveTo(x, y - 8); hx.lineTo(x, y - 16); }, col, lw);
}
function speedTape(W, H, cx, cy, A) {
  const small = Math.min(W, H) < 500, portrait = H > W, tapeH = H * (small ? 0.26 : 0.28);
  return { sx: Math.max(cx - Math.min(W * 0.33, 290), portrait ? 118 : 108), pxk: A.cls === 'jet' ? 2.2 : A.cls === 'tp' ? 2.6 : 3.4, tapeH };
}
function drawGuide(S, on, toast) {
  GUIDE_LINES = 0;
  const A = S.ac, W = HW, H = HH, cx = W / 2, cy = H * 0.46, clipH = H * 0.3;
  hx.setTransform(HDPR, 0, 0, HDPR, 0, 0);
  if (toast) drawLandingReport(toast, W, H);
  if (!on) return;
  if (A.heli) { drawRunwayBoxes(S, null); return; }
  const ias = kt(S.ias), ap = approachInfo(S), big = isBig(A);
  if (!S.onGround) drawRunwayBoxes(S, ap);
  // fartens trend (kt/s), utjämnad
  const now = performance.now();
  if (GUIDE.ias != null && now > GUIDE.t) GUIDE.acc = lerp(GUIDE.acc, (ias - GUIDE.ias) / ((now - GUIDE.t) / 1000), 0.08);
  GUIDE.ias = ias; GUIDE.t = now;
  // ---- målfart på farttejpen: rosa markering som flyttar sig jämnt nedåt mot landningsfarten ----
  const showSpd = (ap && ap.dist > -100) || ATHR.on;
  const vT = showSpd ? speedTarget(S, ap) : null, T = speedTape(W, H, cx, cy, A);
  if (vT != null && !S.onGround && !HUDMIN) {
    const y = cy - (vT - ias) * T.pxk;
    if (Math.abs(y - cy) < T.tapeH) {
      strokeFill(() => { hx.moveTo(T.sx + 3, y); hx.lineTo(T.sx + 15, y - 7); hx.lineTo(T.sx + 15, y + 7); hx.closePath(); }, C_ILS, 2.4);
      htext(Math.round(vT), T.sx + 19, y, 13, 'left', C_ILS, 700);
    } else htext((y < cy ? '▲ ' : '▼ ') + Math.round(vT), T.sx + 8, y < cy ? cy - T.tapeH + 8 : cy + T.tapeH - 8, 13, 'left', C_ILS, 700);
    // trendpil: var farten är om 10 sekunder
    const yt = clamp(cy - GUIDE.acc * 10 * T.pxk, cy - T.tapeH, cy + T.tapeH);
    if (Math.abs(yt - cy) > 4) strokeFill(() => { hx.moveTo(T.sx - 2, cy); hx.lineTo(T.sx - 2, yt); hx.moveTo(T.sx - 6, yt + (yt < cy ? 5 : -5)); hx.lineTo(T.sx - 2, yt); hx.lineTo(T.sx + 2, yt + (yt < cy ? 5 : -5)); }, C_OK, 2);
  }
  if (!ap) { if (ATHR.on) htext('A/THR · ' + Math.round(vT) + ' KT', cx, H - (W < 600 ? 136 : 90), 14, 'center', C_GOAL, 700); return; }
  const base = HUDMIN ? (CK.ovTop ? CK.ovTop - 14 : (H > W ? 190 : 150)) : H - (W < 600 ? 136 : 90);
  const flareH = ((typeof FLAREK !== 'undefined' && FLAREK[A.cls]) ? FLAREK[A.cls][2] : A.flareFt) * 1.3;
  const aglFt = ft(Math.max(S.agl, 0));
  // ---- flygbanemarkering och ringen att följa ----
  let onRing = false, ringXY = null, fpvXY = null;
  if (!S.onGround && S.V > 15) {
    const L = 1500, v = S.vel, vl = Math.max(S.V, 1);
    fpvXY = projScr(S.pos.x + v.x / vl * L, S.pos.y + v.y / vl * L, S.pos.z + v.z / vl * L);
    const [qx, qy, qz] = cuePoint(S, ap);
    ringXY = projScr(qx, qy, qz);
    if (fpvXY && ringXY) onRing = Math.hypot(fpvXY[0] - ringXY[0], fpvXY[1] - ringXY[1]) < 16;
  }
  // ---- läget mot glidbanan i klartext ----
  const gy = glidePoint(A, ap, Math.max(ap.dist, 0))[1], dev = ft(S.pos.y - gy);
  let advice = null, acol = C_HUD;
  const want = ap.dist < (APPRS[A.cls] || APPRS.ga).stab + 1500 ? A.landFlap : Math.min(flapFor(A, apprSpeed(A, Math.max(ap.dist, 0))), A.landFlap);
  const nextOk = S.flap < A.flaps.length - 1 && ias < A.flaps[S.flap + 1].vfe * 1.944 - 3;
  if (S.onGround) { if (S.gs > 3 && !AP.on) { advice = S.thr > 0.1 ? 'THROTTLE IDLE AND BRAKE' : 'BRAKE GENTLY'; } }
  else if (AP.on) advice = null;
  else if (aglFt < flareH && S.vs < 0 && ap.dist < 1500) { advice = 'FLARE – EASE BACK' + (S.thr > 0.12 && !ATHR.on ? ', THROTTLE IDLE' : ''); acol = C_AMBER; }
  else if (A.retract && !S.gearDown && gearDue(A, ap.dist, S.flap)) { advice = 'GEAR DOWN NOW'; acol = C_WARN; }
  else if (S.flap < want && nextOk) { advice = 'FLAPS ' + A.flaps[S.flap + 1].n + ' NOW'; acol = C_AMBER; }
  else if (S.flap < want) { advice = 'SLOW DOWN FOR FLAPS ' + A.flaps[S.flap + 1].n; acol = C_AMBER; }
  else if (vT != null && ias > vT + 8 && !ATHR.on) { advice = 'TOO FAST – THROTTLE DOWN TO THE PINK MARK' + (A.spoilers && ias > vT + 25 ? ', SPEED BRAKE' : ''); acol = C_AMBER; }
  else if (vT != null && ias < vT - 6 && !ATHR.on) { advice = 'TOO SLOW – THROTTLE UP TO THE PINK MARK'; acol = C_WARN; }
  else if (dev > 120) { advice = 'HIGH – NOSE DOWN TO THE RING'; acol = C_AMBER; }
  else if (dev < -120) { advice = 'LOW – MORE POWER, NOSE UP TO THE RING'; acol = C_AMBER; }
  else advice = onRing ? 'STABLE – KEEP THE MARKER IN THE RING' : 'PUT THE GREEN MARKER IN THE RING';
  if (!S.onGround && !AP.on) {
    if (ringXY) strokeFill(() => { hx.moveTo(ringXY[0] + 18, ringXY[1]); hx.arc(ringXY[0], ringXY[1], 18, 0, Math.PI * 2); }, onRing ? C_OK : C_ILS, 3.2);
    if (fpvXY) drawFPV(fpvXY[0], fpvXY[1], onRing ? C_OK : C_HUD, 2.2);
  }
  const devTxt = S.onGround ? '' : Math.abs(dev) < 50 ? 'ON GLIDEPATH' : `${Math.round(Math.abs(dev) / 10) * 10} FT ${dev > 0 ? 'HIGH' : 'LOW'}`;
  const top = `RWY ${ap.name} · ${fmtKm(Math.max(ap.dist, 0))} km` + (devTxt ? ' · ' + devTxt : '') + (HUDMIN && vT != null && !S.onGround ? ` · FLY ${Math.round(vT)} KT (NOW ${Math.round(ias)})` : '');
  htext(top, cx, base - 20, 14, 'center', Math.abs(dev) > 120 && !S.onGround ? C_AMBER : C_ILS, 700);
  if (AP.on && AP.app) advice = { APP: 'AUTOLAND · ' + (A.retract && !S.gearDown ? 'CONFIGURING' : 'ON THE GLIDEPATH'), FLARE: 'AUTOLAND · FLARE', ROLL: 'AUTOLAND · BRAKING' }[AP.lat] || advice;
  if (advice) htext(advice, cx, base, 17, 'center', AP.on ? C_GOAL : acol, 700);
  GUIDE_LINES = 2;
}
// ---- landningsrapport: betyg med stjärnor ----
function drawLandingReport(r, W, H) {
  const now = performance.now();
  if (now > r.until) return;
  const a = clamp((r.until - now) / 600, 0, 1) * clamp((now - r.t0) / 250, 0, 1);
  const bw = Math.min(W - 40, 380), bh = 32 + 26 + r.lines.length * 19 + 14, bx = (W - bw) / 2, by = H * 0.13;
  hx.save(); hx.globalAlpha = a;
  hx.fillStyle = 'rgba(6,14,12,.74)'; hx.beginPath(); hx.roundRect ? hx.roundRect(bx, by, bw, bh, 12) : hx.rect(bx, by, bw, bh); hx.fill();
  hx.strokeStyle = r.col; hx.lineWidth = 2; hx.stroke();
  htext(r.txt, W / 2, by + 22, 22, 'center', r.col, 700);
  let st = ''; for (let i = 0; i < 3; i++) st += i < r.stars ? '★' : '☆';
  htext(st + (r.best ? '  NEW BEST' : ''), W / 2, by + 48, 20, 'center', '#ffd75a', 700);
  r.lines.forEach((l, i) => htext(l[0], W / 2, by + 72 + i * 19, 14, 'center', l[1] ? C_OK : C_AMBER, 600));
  hx.restore();
}
