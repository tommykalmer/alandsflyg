// ===================== RUTTER, AUTOPILOT OCH SNABBSPOLNING =====================
const ROUTE = { on: false, from: null, to: null, depZone: null, zone: null, end: 0, rh: 0, cruise: 0, wp: [], idx: 0, dist: 0 };
const AP = { on: false, lat: 'HDG', hdg: 0, alt: 0, spd: 0, at: 0.5, msg: '', msgT: 0 };
const WARPS = [1, 2, 4, 8, 16];
let WARP = 1;

// välj den bana på flygplatsen som har mest motvind
function bestZone(ap, wind) {
  let best = ap.main, bs = -2;
  for (const z of ap.zones) {
    if (z.len < ap.main.len * 0.6) continue;
    const s = Math.abs(Math.cos((wind.dir - z.hdg) * DEG)) + z.len / 1e5;
    if (s > bs) { bs = s; best = z; }
  }
  return best;
}
function runwayEnds(zn, end) {
  const sgn = end === 0 ? 1 : -1;
  return { thr: zoneWorld(zn, sgn * -zn.len / 2, 0), far: zoneWorld(zn, sgn * zn.len / 2, 0), rh: (zn.hdg + (end ? 180 : 0)) % 360, sgn };
}
function routeDist(a, b) { return Math.hypot(b.x - a.x, b.z - a.z); }
function planRoute(fromIcao, toIcao, acId, wind) {
  const from = APT[fromIcao], to = APT[toIcao], A = AIRCRAFT[acId], big = isBig(A), jet = A.cls === 'jet';
  const dz = bestZone(from, wind), az = bestZone(to, wind);
  const dEnd = activeEnd(dz, wind), aEnd = activeEnd(az, wind);
  const dep = runwayEnds(dz, dEnd), arr = runwayEnds(az, aEnd);
  const D = big ? 16000 : 5500, Di = big ? 12000 : 4000;
  const back = (dist) => { const h = arr.rh * DEG; return [arr.thr[0] - Math.sin(h) * dist, arr.thr[1] + Math.cos(h) * dist]; };
  const out = (dist) => { const h = dep.rh * DEG; return [dep.far[0] + Math.sin(h) * dist, dep.far[1] - Math.cos(h) * dist]; };
  const faf = back(D), ifx = back(D + Di), clb = out(big ? 6000 : 2000);
  const total = Math.hypot(clb[0] - dep.thr[0], clb[1] - dep.thr[1]) + Math.hypot(ifx[0] - clb[0], ifx[1] - clb[1]) + Di + D;
  const cruise = big ? (total < 90000 ? 6000 : total < 170000 ? (jet ? 10000 : 9000) : (jet ? 14000 : 12000)) * FT : (total < 40000 ? 1500 : 2500) * FT;
  Object.assign(ROUTE, {
    on: true, from, to, depZone: dz, depEnd: dEnd, zone: az, end: aEnd, rh: arr.rh, thr: arr.thr, cruise, dist: total,
    fafD: D, wp: [{ p: clb, n: 'DEPARTURE' }, { p: ifx, n: 'IF' }, { p: faf, n: 'FAF', faf: true }, { p: arr.thr, n: to.label + ' ' + az.ends[aEnd] }], idx: 0
  });
  return ROUTE;
}
function clearRoute() { ROUTE.on = false; }
function routePoints() {
  if (!ROUTE.on) return [];
  const d = runwayEnds(ROUTE.depZone, ROUTE.depEnd);
  return [d.thr, ...ROUTE.wp.map(w => w.p)];
}
function routeRemaining(S) {
  if (!ROUTE.on) return 0;
  let d = 0, px = S.pos.x, pz = S.pos.z;
  for (let i = ROUTE.idx; i < ROUTE.wp.length; i++) { const [x, z] = ROUTE.wp[i].p; d += Math.hypot(x - px, z - pz); px = x; pz = z; }
  return d;
}
function routeGoal() {
  if (!ROUTE.on) return null;
  const w = ROUTE.wp[Math.min(ROUTE.idx, ROUTE.wp.length - 1)];
  return { x: w.p[0], z: w.p[1], name: w.n };
}
function fafAlt() { return ROUTE.zone.elev + ROUTE.fafD * Math.tan(3 * DEG) + 120 * FT; }

// ---------- autopilot ----------
function apMsg(t) { AP.msg = t; AP.msgT = performance.now() + 4000; }
function apOn(S) {
  if (S.onGround) { apMsg('AUTOPILOT CAN BE ENGAGED AFTER TAKEOFF'); return; }
  AP.on = true; AP.lastIas = null; AP.hdg = S.hdg; AP.alt = S.pos.y; AP.spd = S.ias * 1.944; AP.at = S.thr;
  AP.lat = ROUTE.on && ROUTE.idx < ROUTE.wp.length - 1 ? 'NAV' : 'HDG';
  if (S.ac.heli) {
    // helikoptern: flyger mot uppdragsmålet om det finns, minst 500 fot över marken, marschfart 120 kt
    const goal = typeof missionGoal === 'function' ? missionGoal() : null;
    AP.lat = goal ? 'NAV' : 'HDG'; AP.spd = goal ? 120 : Math.max(S.gs * 1.944, 60);
    AP.alt = Math.max(S.pos.y, Math.max(terrainH(S.pos.x, S.pos.z), 0) + 500 * FT); AP.eI = 0; AP.dist = Infinity;
  }
  if (ROUTE.on) AP.alt = Math.max(S.pos.y, ROUTE.cruise);
  apMsg('AUTOPILOT ON · ' + AP.lat);
  if (typeof chime === 'function') chime('ding');
}
function apOff(why) {
  if (!AP.on) return;
  AP.on = false; WARP = 1; apMsg(why || 'AUTOPILOT OFF');
  if (typeof sim !== 'undefined' && sim) sim.apVs = null;
  if (typeof chime === 'function') chime('dingdong');
}
const wrap180 = a => ((a % 360) + 540) % 360 - 180;
// helikopterns autopilot: kurs/NAV, höjd via kollektivet (stigfart), fart via nosvinkeln
function apHeli(S, dt) {
  const goal = typeof missionGoal === 'function' ? missionGoal() : null;
  const h = S.hdg * DEG, fx = Math.sin(h), fz = -Math.cos(h);
  const vf = (S.vel.x * fx + S.vel.z * fz) * 1.944;
  AP.dist = Infinity;
  let hdgT = AP.hdg, spdT = AP.spd, dist = Infinity;
  if (AP.lat === 'NAV' && goal) {
    const dx = goal.x - S.pos.x, dz = goal.z - S.pos.z; dist = Math.hypot(dx, dz);
    hdgT = (Math.atan2(dx, -dz) / DEG + 360) % 360;
    // bromsa in mot målet och lämna över för landning
    spdT = Math.min(AP.spd, Math.max(25, (dist - 300) / 1852 * 70));
    AP.dist = dist;
    if (dist < 450) { apOff('AUTOPILOT OFF – HOVER AND LAND'); S.apVs = null; return; }
  } else if (AP.lat === 'NAV') AP.lat = 'HDG';
  AP.spdT = spdT;
  // sidled: önskad lutning → spaken (i framfart ger spaken 14–50° lutning)
  const err = wrap180(hdgT - S.hdg), fwd = smooth(8, 24, Math.hypot(S.vel.x, S.vel.z));
  const bankT = clamp(err * 1.4, -25, 25);
  S.inp.r = clamp(bankT / (14 + 36 * fwd), -1, 1);
  S.inp.rud = 0;
  // höjd: följ marken med minst 500 fot, och sjunk mot 300 fot nära målet
  const gnd = Math.max(terrainH(S.pos.x, S.pos.z), 0);
  let altT = Math.max(AP.alt, gnd + 500 * FT);
  if (dist < 2500) altT = Math.min(altT, gnd + (150 + Math.max(dist - 450, 0) * 0.15) * FT);
  AP.altT = altT;
  S.apVs = clamp((altT - S.pos.y) * 0.08, -4, 5);
  // fart: nosvinkel med PI
  const se = spdT - vf;
  AP.eI = clamp((AP.eI || 0) - se * dt * 0.004, -0.4, 0.4);
  S.inp.e = clamp(-se * 0.025 + AP.eI, -0.9, 0.6);
}
function apUpdate(S, dt) {
  if (!AP.on) return;
  if (S.ac.heli) return apHeli(S, dt);
  const A = S.ac, big = isBig(A), jet = A.cls === 'jet', ias = S.ias * 1.944;
  // ----- sidled -----
  let hdgT = AP.hdg;
  if (AP.lat === 'NAV' && ROUTE.on) {
    const w = ROUTE.wp[ROUTE.idx], dx = w.p[0] - S.pos.x, dz = w.p[1] - S.pos.z, d = Math.hypot(dx, dz);
    hdgT = (Math.atan2(dx, -dz) / DEG + 360) % 360;
    if (d < (big ? 2600 : 900)) {
      if (w.faf) { AP.lat = 'APP'; apMsg('APPROACH · TRACKING LOCALISER AND GLIDESLOPE'); WARP = 1; }
      else ROUTE.idx++;
    }
  }
  if (AP.lat === 'APP' && ROUTE.on) {
    const zn = ROUTE.zone, [a, c] = zoneLocal(zn, S.pos.x, S.pos.z), sg = ROUTE.end === 0 ? 1 : -1;
    const xt = c * sg; // + = höger om centrumlinjen sett i landningsriktningen
    hdgT = (ROUTE.rh - clamp(xt / (big ? 25 : 15), -30, 30) + 360) % 360;
    ROUTE.idx = ROUTE.wp.length - 1;
  }
  const err = wrap180(hdgT - S.hdg), bankMax = (big ? 25 : 22) * DEG;
  const bankT = clamp(err * DEG * 2.2, -bankMax, bankMax);
  if (A.fbw) S.inp.r = clamp((bankT - S.bank) * 2.4, -0.7, 0.7);
  else S.inp.r = clamp((bankT - S.bank) * 2.0 + S.w.z * 0.9, -0.8, 0.8);
  S.inp.rud = S.inp.r * 0.22;
  // ----- höjd -----
  let vsT;
  if (AP.lat === 'APP' && ROUTE.on) {
    const [x, z] = ROUTE.thr, dist = Math.hypot(x - S.pos.x, z - S.pos.z);
    const gsAlt = ROUTE.zone.elev + A.gearH + Math.max(dist - (big ? 300 : 150), 0) * Math.tan(3 * DEG);
    vsT = -S.gs * Math.tan(3 * DEG) + clamp((gsAlt - S.pos.y) * 0.12, -3, 3);
    if (S.pos.y > gsAlt + 30) vsT = Math.min(vsT, 0); // fånga glidbanan uppifrån utan att stiga
  } else {
    let altT = AP.alt;
    // nedstigningsprofil: 2,6° ner mot en planflygning före IF där farten minskas
    if (ROUTE.on && AP.lat === 'NAV') altT = Math.min(ROUTE.cruise, fafAlt() + Math.max(routeRemaining(S) - ROUTE.fafD - (big ? 14000 : 3000), 0) * Math.tan(2.6 * DEG));
    AP.altT = altT;
    const vmax = jet ? 9 : big ? 7 : 4;
    vsT = clamp((altT - S.pos.y) * 0.06, -vmax, vmax);
    AP.vsRaw = vsT;
  }
  // för snabbt i sjunkning: flacka ut så att farten minskar
  if (vsT < 0 && AP.spdT && ias > AP.spdT + 4) vsT = Math.min(0, vsT + (ias - AP.spdT - 4) * 0.35);
  if (A.fbw) S.inp.e = clamp((vsT - S.vs) * 0.07, -0.6, 0.6);
  else {
    S.inp.e = clamp((vsT - S.vs) * 0.12 - S.w.x * 1.2, -0.7, 0.7);
    S.trim = clamp(S.trim + S.inp.e * 0.04 * dt, -0.15, 0.15);
  }
  // ----- fart (autogas) -----
  let spdT;
  if (AP.lat === 'APP') spdT = A.vapp[S.flap] + (big ? 5 : 3);
  else if (ROUTE.on && AP.lat === 'NAV') {
    const rem = routeRemaining(S);
    spdT = jet ? (rem < ROUTE.fafD + 25000 ? 210 : S.pos.y < 3000 * 0.3048 * 3.3 ? 250 : 280) : big ? (rem < ROUTE.fafD + 20000 ? 170 : 220) : (rem < ROUTE.fafD + 6000 ? 85 : 105);
    spdT = Math.min(spdT, A.flaps[S.flap].vfe * 1.944 - 5);
  } else spdT = AP.spd;
  AP.spdT = spdT;
  const se = spdT - ias, acc = AP.lastIas != null ? (ias - AP.lastIas) / dt : 0;
  AP.lastIas = ias;
  AP.at = clamp(AP.at + se * (big ? 0.004 : 0.006) * dt, 0, 1);
  S.thr = clamp(AP.at + se * (big ? 0.012 : 0.02) - acc * (big ? 0.06 : 0.04), 0, 1);
  // ----- frånkoppling nära marken -----
  if (AP.lat === 'APP' && S.agl < (big ? 60 : 40)) apOff('AUTOPILOT OFF – LAND MANUALLY');
}
// får man snabbspola just nu?
function warpAllowed(S) {
  if (S.ac.heli) return AP.on && !S.onGround && S.agl > 90 && !(AP.dist < 2500);
  if (!AP.on || S.onGround || S.agl < 300 || AP.lat === 'APP') return false;
  if (ROUTE.on && routeRemaining(S) < ROUTE.fafD + (isBig(S.ac) ? 12000 : 4000)) return false;
  return true;
}
// startpunkt för "hoppa till inflygningen"
function jumpStart(acId) {
  const A = AIRCRAFT[acId], big = isBig(A), jet = A.cls === 'jet', h = ROUTE.rh * DEG, D = ROUTE.fafD + (big ? 6000 : 2500);
  const x = ROUTE.thr[0] - Math.sin(h) * D, z = ROUTE.thr[1] + Math.cos(h) * D;
  const y = ROUTE.zone.elev + ROUTE.fafD * Math.tan(3 * DEG) + AIRCRAFT[acId].gearH;
  return { type: 'air', x, z, y, hdg: ROUTE.rh, V: jet ? 82 : big ? 74 : 40, gamma: 0, flap: jet ? 2 : 1 };
}
