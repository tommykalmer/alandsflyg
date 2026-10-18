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
  if (S.V > 8) {
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
  if (AP.on) htext(`AP ${AP.lat}${AP.lat !== 'APP' ? ' · ' + Math.round(ft(AP.lat === 'NAV' && AP.altT != null ? AP.altT : AP.alt) / 100) * 100 + ' FT' : ' · GLIDESLOPE'} · ${Math.round(AP.spdT || AP.spd)} KT${WARP > 1 ? ' · TIME WARP ×' + WARP : ''}`, hcx, hy + (ROUTE.on ? 84 : 66), 13, 'center', C_GOAL, 700);
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
function approachInfo(S) {
  const A = S.ac; if (A.floats || A.heli) return null;
  let best = null;
  if (S.onGround && S.touches === 0 && S.gs < 45) return null;
  for (const zn of ZONES) {
    if (zn.kind === 'helipad' || zn.kind === 'scene') continue;
    if (isBig(A) && !zn.big) continue;
    if (ROUTE.on && zn !== ROUTE.zone) continue;
    const [a0, c0] = zoneLocal(zn, S.pos.x, S.pos.z);
    for (let end = 0; end < 2; end++) {
      const sg = end === 0 ? 1 : -1, a = a0 * sg, c = c0 * sg;
      const dist = (-zn.len / 2 + A.tdz) - a;
      if (dist < -(zn.len - A.tdz) - 50 || dist > (isBig(A) ? 20000 : 9000)) continue;
      const rh = (zn.hdg + (end ? 180 : 0)) % 360;
      if (Math.abs(((S.hdg - rh + 540) % 360) - 180) > 60) continue;
      if (dist > 300 && Math.abs(Math.atan2(c, dist)) > 35 * DEG) continue;
      if (!best || Math.abs(dist) < Math.abs(best.dist)) best = { zn, end, dist, c, rh, name: zn.ends[end] };
    }
  }
  return best;
}
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
function drawGuide(S, on, toast) {
  GUIDE_LINES = 0;
  const A = S.ac, W = HW, H = HH, cx = W / 2, cy = H * 0.46, clipW = HL.clipW, clipH = H * 0.3;
  hx.setTransform(HDPR, 0, 0, HDPR, 0, 0);
  // landningsbetyg
  if (toast && performance.now() < toast.until) {
    htext(toast.txt, cx, cy - clipH * 0.58, 24, 'center', toast.col, 700);
    htext(toast.sub, cx, cy - clipH * 0.58 + 22, 14, 'center', toast.col);
  }
  if (!on) return;
  if (A.heli) { drawRunwayBoxes(S, null); return; }
  const ias = kt(S.ias), vapp = A.vapp[S.flap];
  const ap = approachInfo(S);
  if (!S.onGround) drawRunwayBoxes(S, ap);
  // fartmarkering för inflygning på farttejpen
  if (ap || S.flap > 0) {
    const small = Math.min(W, H) < 500, portrait = H > W, tapeH = H * (small ? 0.26 : 0.28);
    const sx = Math.max(cx - Math.min(W * 0.33, 290), portrait ? 118 : 108), pxk = A.cls === 'jet' ? 2.2 : A.cls === 'tp' ? 2.6 : 3.4;
    const y = cy - (vapp - ias) * pxk;
    if (Math.abs(y - cy) < tapeH) strokeFill(() => { hx.moveTo(sx + 9, y); hx.lineTo(sx + 19, y - 6); hx.lineTo(sx + 19, y + 6); hx.closePath(); }, C_ILS, 2);
    else htext((y < cy ? '▲ ' : '▼ ') + vapp, sx + 22, y < cy ? cy - tapeH + 8 : cy + tapeH - 8, 12, 'left', C_ILS);
  }
  if (!ap) return;
  const aglFt = ft(Math.max(S.agl, 0));
  const hRel = S.pos.y - A.gearH - ap.zn.elev;
  const gsOk = ap.dist > 150 && !S.onGround;
  const dots = gsOk ? clamp((Math.atan2(hRel, ap.dist) / DEG - 3) / 0.35, -2.5, 2.5) : 0;
  const loc = clamp((Math.atan2(ap.c, ap.dist + ap.zn.len - A.tdz) / DEG) / 1.25, -2.5, 2.5);
  // glidbana (höger om horisonten) och kurslinje (under)
  if (!S.onGround) {
    const top = HUDMIN && CK.ovTop ? CK.ovTop : 0, gc = HUDMIN ? Math.min(cy, top - 46) : cy;
    const gx = HUDMIN ? cx + Math.min(clipW, 150) : cx + clipW + 16;
    if (gsOk) {
      strokeFill(() => { for (const k of [-2, -1, 1, 2]) { hx.moveTo(gx + 3.5, gc + k * 14); hx.arc(gx, gc + k * 14, 3.5, 0, Math.PI * 2); } hx.moveTo(gx - 8, gc); hx.lineTo(gx + 8, gc); }, C_HUD, 1.2);
      const dy = gc + dots * 14;
      strokeFill(() => { hx.moveTo(gx, dy - 7); hx.lineTo(gx + 6, dy); hx.lineTo(gx, dy + 7); hx.lineTo(gx - 6, dy); hx.closePath(); }, C_ILS, 2.2);
    }
    const ly = HUDMIN && top ? top - 14 : cy + clipH - 12;
    strokeFill(() => { for (const k of [-2, -1, 1, 2]) { hx.moveTo(cx + k * 18 + 3.5, ly); hx.arc(cx + k * 18, ly, 3.5, 0, Math.PI * 2); } hx.moveTo(cx, ly - 8); hx.lineTo(cx, ly + 8); }, C_HUD, 1.2);
    const lx = cx - loc * 18;
    strokeFill(() => { hx.moveTo(lx - 7, ly); hx.lineTo(lx, ly - 6); hx.lineTo(lx + 7, ly); hx.lineTo(lx, ly + 6); hx.closePath(); }, C_ILS, 2.2);
  }
  // ---- styrcirkel (flight director): för in flygbanemarkeringen i den rosa ringen så följer du glidbanan till sättningen ----
  let fdOk = false, fdLine = null, fdCol = C_ILS, fdRing = null;
  const base = HUDMIN ? (H > W ? 190 : 150) : H - (W < 600 ? 136 : 90);
  if (!S.onGround && S.V > 8) {
    const small = Math.min(W, H) < 500, ppd = Math.min(H, W) * (small ? 0.021 : 0.019);
    const mx = cx + clamp((S.beta / DEG) * ppd, -clipW, clipW), my = cy + clamp((S.alpha / DEG) * ppd, -clipH, clipH);
    const gsAltM = ap.zn.elev + A.gearH + Math.max(ap.dist, 0) * Math.tan(3 * DEG);
    const altErr = gsAltM - S.pos.y; // + = för lågt
    const flareH = A.flareFt * 2.5;
    let gDes = -3 + clamp(altErr * 0.05, -3, 2.5);
    if (aglFt < flareH) gDes = Math.max(gDes, -3 * clamp(aglFt / flareH, 0.12, 1));
    const gAct = Math.asin(clamp(S.vel.y / Math.max(S.V, 1), -1, 1)) / DEG;
    const track = (Math.atan2(S.vel.x, -S.vel.z) / DEG + 360) % 360;
    const trDes = ap.rh - clamp(Math.atan2(ap.c, Math.max(ap.dist * 0.35 + 250, 300)) / DEG * 1.6, -30, 30);
    const bankDes = clamp((((trDes - track) % 360) + 540) % 360 - 180, -10, 10) * 2;
    const fx = mx + clamp((bankDes - S.bank / DEG) * ppd * 0.5, -clipW * 0.6, clipW * 0.6);
    const fy = Math.min(my - clamp((gDes - gAct) * ppd * 1.5, -clipH * 0.5, clipH * 0.45), base - 32);
    fdOk = Math.hypot(fx - mx, fy - my) < 11;
    hx.globalAlpha = 1;
    if (HUDMIN) strokeFill(() => { hx.arc(mx, my, 7, 0, Math.PI * 2); hx.moveTo(mx - 7, my); hx.lineTo(mx - 19, my); hx.moveTo(mx + 7, my); hx.lineTo(mx + 19, my); hx.moveTo(mx, my - 7); hx.lineTo(mx, my - 14); }, C_HUD, 1.6);
    fdRing = [fx, fy];
    // höjd och sjunkfart i klartext
    const ftErr = Math.round(ft(altErr) / 10) * 10, tgtFpm = Math.round(S.gs * Math.tan(3 * DEG) * 196.85 / 50) * 50, nowFpm = Math.round(-S.vs * 196.85 / 50) * 50;
    const hTxt = Math.abs(ftErr) < 40 ? 'ON GLIDEPATH' : `${Math.abs(ftErr)} FT TOO ${ftErr < 0 ? 'HIGH' : 'LOW'}`;
    fdLine = `${hTxt} · SINK ${tgtFpm} FT/MIN (NOW ${nowFpm})`;
    fdCol = Math.abs(ftErr) > 150 || Math.abs(nowFpm - tgtFpm) > 400 ? C_AMBER : C_HUD;
  }
  // råd
  let adv = null, col = C_HUD;
  if (S.onGround) {
    if (S.gs > 3) { adv = S.thr > 0.1 ? 'THROTTLE IDLE AND BRAKE' : (A.floats ? 'LET IT COAST TO A STOP' : 'BRAKE GENTLY'); col = C_HUD; }
  } else if (aglFt < A.flareFt && S.vs < 0) { adv = 'FLARE – EASE BACK' + (S.thr > 0.12 ? ', THROTTLE IDLE' : ''); col = C_AMBER; }
  else if (A.retract && !S.gearDown && ap.dist < 9000) { adv = 'GEAR DOWN' + (ias > A.vapp[A.landFlap] + 20 ? ' (IT SLOWS YOU TOO)' : ''); col = C_WARN; }
  else {
    // inbromsning: hur långt behövs för att komma ner till inflygningsfarten?
    const vLand = A.vapp[A.landFlap], va = S.ias, vt = vLand * 0.5144;
    // uppmätt inbromsning på tomgång med klaff (planflykt/flack sjunkning), med marginal
    const dec = A.cls === 'jet' ? 0.85 : A.cls === 'tp' ? 0.95 : 1.1, margin = A.cls === 'jet' ? 3000 : A.cls === 'tp' ? 2400 : 700;
    const need = Math.max(0, (va * va - vt * vt) / (2 * dec)) + margin;
    const nextOk = S.flap < A.flaps.length - 1 && ias < A.flaps[S.flap + 1].vfe * 1.944 - 3;
    if (ias > vLand + 12 && ap.dist < need) {
      adv = 'SLOW DOWN NOW – IDLE' + (nextOk ? ', FLAPS ' + A.flaps[S.flap + 1].n : '') + (A.spoilers && !S.speedbrake && ias > vLand + 25 ? ', SPEED BRAKE' : ''); col = C_AMBER;
    } else if (S.flap < A.landFlap && nextOk && ap.dist < need + 2500) { adv = 'FLAPS ' + A.flaps[S.flap + 1].n + ' NOW'; col = C_AMBER; }
    else if (S.flap < A.landFlap && ap.dist < (isBig(A) ? 6000 : 2500)) { adv = 'SET FLAPS ' + A.flaps[A.landFlap].n + (nextOk ? '' : ' – SLOW DOWN FIRST'); col = C_AMBER; }
    else if (S.speedbrake && ias < vLand + 8) { adv = 'RETRACT SPEED BRAKE'; col = C_AMBER; }
  }
  if (adv) { /* inbromsningsråd har företräde */ }
  else if (gsOk && dots > 1.2) { adv = 'TOO HIGH – LESS POWER, NOSE DOWN TO THE RING'; col = C_AMBER; }
  else if (!adv && gsOk && dots < -1.2) { adv = 'TOO LOW – MORE POWER, NOSE UP TO THE RING'; col = C_AMBER; }
  else if (!adv && ias > vapp + 10) { adv = 'TOO FAST – REDUCE POWER'; col = C_AMBER; }
  else if (!adv && ias < vapp - 6) { adv = 'TOO SLOW – MORE POWER'; col = C_WARN; }
  else if (!adv && Math.abs(loc) > 1) { adv = 'STEER ' + (loc > 0 ? 'LEFT' : 'RIGHT') + ' TO THE RUNWAY'; col = C_AMBER; }
  else if (!adv) adv = fdOk ? 'ON GLIDESLOPE – GOOD' : 'STEER THE MARKER INTO THE PINK RING';
  htext(`RWY ${ap.name} · ${fmtKm(Math.max(ap.dist, 0))} km · LAND ${A.vapp[A.landFlap]} KT WITH FLAPS ${A.flaps[A.landFlap].n}`, cx, base - 18, 13, 'center', C_ILS);
  if (adv) htext(adv, cx, base, 16, 'center', col, 700);
  if (fdLine && !AP.on) htext(fdLine, cx, cy - clipH * 0.72, 13, 'center', fdCol, 700);
  if (fdRing && !AP.on) { const [fx, fy] = fdRing; strokeFill(() => { hx.arc(fx, fy, 15, 0, Math.PI * 2); hx.moveTo(fx + 3, fy); hx.arc(fx, fy, 3, 0, Math.PI * 2); }, fdOk ? C_HUD : C_ILS, 3); }
  GUIDE_LINES = 2;
}
