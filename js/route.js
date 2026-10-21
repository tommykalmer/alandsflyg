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

// ---------- inflygning: gemensamt underlag för guiden, autogasen och autolandningen ----------
// Glidbanan är 3° mot sättningspunkten (A.tdz meter efter tröskeln). dist = meter kvar till sättningspunkten
// längs banans riktning, c = meter höger om centrumlinjen (sett i landningsriktningen).
function approachGeom(S, zn, end) {
  const A = S.ac, sg = end === 0 ? 1 : -1, [a0, c0] = zoneLocal(zn, S.pos.x, S.pos.z), a = a0 * sg;
  const dist = (-zn.len / 2 + A.tdz) - a;
  return { zn, end, sg, dist, c: c0 * sg, rh: (zn.hdg + (end ? 180 : 0)) % 360, name: zn.ends[end], fromThr: a + zn.len / 2 };
}
function approachInfo(S) {
  const A = S.ac; if (A.floats || A.heli) return null;
  if (AP.on && AP.app && (AP.lat === 'APP' || AP.lat === 'FLARE' || AP.lat === 'ROLL')) return approachGeom(S, AP.app.zn, AP.app.end);
  let best = null;
  if (S.onGround && S.touches === 0 && S.gs < 45) return null;
  for (const zn of ZONES) {
    if (zn.kind === 'helipad' || zn.kind === 'scene') continue;
    if (isBig(A) && !zn.big) continue;
    if (ROUTE.on && zn !== ROUTE.zone) continue;
    for (let end = 0; end < 2; end++) {
      const g = approachGeom(S, zn, end);
      if (g.dist < -(zn.len - A.tdz) - 50 || g.dist > (isBig(A) ? 22000 : 9000)) continue;
      if (Math.abs(((S.hdg - g.rh + 540) % 360) - 180) > 60) continue;
      if (g.dist > 300 && Math.abs(Math.atan2(g.c, g.dist)) > 35 * DEG) continue;
      if (ROUTE.on && end !== ROUTE.end) continue;
      if (!best || Math.abs(g.dist) < Math.abs(best.dist)) best = g;
    }
  }
  return best;
}
// punkt på den ideala glidbanan d meter före sättningspunkten: [x, y, z] (y = tyngdpunktens höjd)
function glidePoint(A, ap, d) {
  const [x, z] = zoneWorld(ap.zn, ap.sg * (-ap.zn.len / 2 + A.tdz - d), 0);
  return [x, ap.zn.elev + A.gearH + Math.max(d, 0) * Math.tan(3 * DEG), z];
}
// ringen att följa: en punkt på glidbanan en bit framför planet. Nära marken ligger den längre bort på banan,
// så att den som följer ringen planar ut mjukt av sig själv.
function cuePoint(S, ap) {
  const A = S.ac, big = isBig(A), fH = ((FLAREK[A.cls] || FLAREK.ga)[2]) * FT;
  let Lc = clamp(S.gs * 10, big ? 300 : 180, big ? 1300 : 700);
  if (ap.dist < 1500) Lc *= 1 + clamp(1 - S.agl / (fH * 2.5), 0, 1) * 1.2;
  return glidePoint(A, ap, ap.dist - Lc);
}
// referensfart vid sättning och farten man bör ha längs inflygningen (minskar jämnt mot banan)
function vref(A) { return A.vapp[A.landFlap] + (isBig(A) ? 5 : 3); }
const APPRS = { jet: { stab: 5500, slope: 6, vmax: 250 }, tp: { stab: 4500, slope: 7, vmax: 200 }, ga: { stab: 1500, slope: 14, vmax: 110 } };
// i byig vind läggs några knop till (som piloter gör): en fjärdedel av vinden plus en del av byarna
function windAdd(A, w) { return w ? clamp(w.kt * (0.25 + (w.gust || 0) * 0.6), 0, A.cls === 'ga' ? 10 : 15) : 0; }
function apprSpeed(A, dist, w) {
  const k = APPRS[A.cls] || APPRS.ga;
  return Math.min(k.vmax, vref(A) + windAdd(A, w) + Math.max(0, dist - k.stab) / 1000 * k.slope);
}
// lämplig klaff för en fart: minsta klaffen vars inflygningsfart ryms under farten
function flapFor(A, v) {
  for (let f = 0; f < A.flaps.length; f++) if (A.vapp[f] <= v + 3) return f;
  return A.flaps.length - 1;
}
// ställs ut när? landställ vid stabiliseringen eller när näst sista klaffen går ut
function gearDue(A, dist, flap) { return A.retract && (dist < (APPRS[A.cls] || APPRS.ga).stab + 4500 || flap >= A.landFlap - 1); }
// autogas: gemensam regulator för autopiloten och A/THR
const ATHR = { on: false, at: 0.5, last: null, spd: 0 };
function autothrottle(S, spdT, dt, st) {
  const big = isBig(S.ac), ias = S.ias * 1.944, se = spdT - ias;
  const acc = st.last != null ? (ias - st.last) / Math.max(dt, 1e-3) : 0;
  st.last = ias;
  st.at = clamp(st.at + se * (big ? 0.004 : 0.006) * dt, 0, 1);
  return clamp(st.at + se * (big ? 0.012 : 0.02) - acc * (big ? 0.06 : 0.04), 0, 1);
}
function athrOn(S) {
  if (!S || S.ac.heli || S.onGround) { apMsg(S && S.onGround ? 'A/THR CAN BE ENGAGED IN THE AIR' : ''); return; }
  ATHR.on = true; ATHR.at = S.thr; ATHR.last = null; ATHR.spd = S.ias * 1.944;
  apMsg('AUTOTHRUST ON · IT FLIES THE PINK SPEED'); if (typeof chime === 'function') chime('ding');
}
function athrOff(why) { if (!ATHR.on) return; ATHR.on = false; apMsg(why || 'AUTOTHRUST OFF'); if (typeof chime === 'function') chime('dingdong'); }
// målfarten just nu: inflygningsschemat nära en bana, annars farten när A/THR kopplades in
function speedTarget(S, ap) {
  if (ap && ap.dist > -200) return apprSpeed(S.ac, Math.max(ap.dist, 0), S.wind);
  return ATHR.spd || S.ias * 1.944;
}

// ---------- autopilot ----------
// utplaning per flygplanstyp: [förstärkning på sjunkfart, dämpning av nickhastighet, höjd då utplaningen börjar (ft)]
// (framsökt med simulerade landningar i stiltje, motvind och byig sidvind)
const FLAREK = { jet: [0.084, 2.2, 50], tp: [0.14, 1.2, 25], ga: [0.14, 1.2, 20] };
function apMsg(t) { AP.msg = t; AP.msgT = performance.now() + 4000; }
function apOn(S) {
  if (S.onGround) { apMsg('AUTOPILOT CAN BE ENGAGED AFTER TAKEOFF'); return; }
  AP.on = true; AP.lastIas = null; AP.ts = null; AP.xtI = 0; AP.retard = false; AP.hdg = S.hdg; AP.alt = S.pos.y; AP.spd = S.ias * 1.944; AP.at = S.thr;
  AP.lat = ROUTE.on && ROUTE.idx < ROUTE.wp.length - 1 ? 'NAV' : 'HDG';
  if (S.ac.heli) {
    // helikoptern: flyger mot uppdragsmålet om det finns, minst 500 fot över marken, marschfart 120 kt
    const goal = typeof missionGoal === 'function' ? missionGoal() : null;
    AP.lat = goal ? 'NAV' : 'HDG'; AP.spd = goal ? 120 : Math.max(S.gs * 1.944, 60);
    AP.alt = Math.max(S.pos.y, Math.max(terrainH(S.pos.x, S.pos.z), 0) + 500 * FT); AP.eI = 0; AP.dist = Infinity;
  }
  if (ROUTE.on) AP.alt = Math.max(S.pos.y, ROUTE.cruise);
  AP.app = null;
  // nära en bana och på väg mot den: flyg inflygningen och landa automatiskt
  if (!S.ac.heli) {
    const ap = approachInfo(S);
    if (ap && ap.dist > 300 && ap.dist < (isBig(S.ac) ? 22000 : 9000) && (!ROUTE.on || ROUTE.idx >= ROUTE.wp.length - 2)) {
      AP.lat = 'APP'; AP.app = { zn: ap.zn, end: ap.end }; ROUTE.on && (ROUTE.idx = ROUTE.wp.length - 1);
    }
  }
  ATHR.on = false; ATHR.at = S.thr; ATHR.last = null;
  apMsg(AP.lat === 'APP' ? 'AUTOLAND · FOLLOWING THE GLIDEPATH TO THE RUNWAY' : 'AUTOPILOT ON · ' + AP.lat);
  if (typeof chime === 'function') chime('ding');
}
function apOff(why) {
  if (!AP.on) return;
  AP.on = false; WARP = 1; apMsg(why || 'AUTOPILOT OFF');
  if (typeof sim !== 'undefined' && sim) sim.apOn = false;
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
  S.apOn = AP.on;
  if (!AP.on) return;
  if (S.ac.heli) return apHeli(S, dt);
  const A = S.ac, big = isBig(A), jet = A.cls === 'jet', ias = S.ias * 1.944;
  // ----- sidled -----
  let hdgT = AP.hdg;
  if (AP.lat === 'NAV' && ROUTE.on) {
    const w = ROUTE.wp[ROUTE.idx], dx = w.p[0] - S.pos.x, dz = w.p[1] - S.pos.z, d = Math.hypot(dx, dz);
    hdgT = (Math.atan2(dx, -dz) / DEG + 360) % 360;
    if (d < (big ? 2600 : 900)) {
      if (w.faf) { AP.lat = 'APP'; AP.app = { zn: ROUTE.zone, end: ROUTE.end }; apMsg('AUTOLAND · TRACKING LOCALISER AND GLIDESLOPE'); WARP = 1; }
      else ROUTE.idx++;
    }
  }
  const landing = AP.lat === 'APP' || AP.lat === 'FLARE' || AP.lat === 'ROLL';
  if (landing && !AP.app) AP.lat = 'HDG';
  const ap = AP.app ? approachGeom(S, AP.app.zn, AP.app.end) : null;
  if (ap && (AP.lat === 'APP' || AP.lat === 'FLARE')) {
    // styr på färdriktningen (inte nosen) så att sidvinden räknas bort; mjukare nära banan
    const trk = Math.atan2(S.vel.x, -S.vel.z) / DEG;
    const kc = (big ? 22 : 12) * (ap.dist < 3000 ? 1.4 : 1);
    AP.xtI = clamp((AP.xtI || 0) + ap.c * dt * 0.002, -4, 4);
    const trkT = ap.rh - clamp(ap.c / kc + AP.xtI, -30, 30);
    hdgT = (S.hdg + wrap180(trkT - trk) + 360) % 360;
    if (ROUTE.on) ROUTE.idx = ROUTE.wp.length - 1;
  }
  if (AP.lat === 'ROLL') return apRollout(S, ap, dt);  const err = wrap180(hdgT - S.hdg), bankMax = (big ? 25 : 22) * DEG;
  const bankT = clamp(err * DEG * 2.2, -bankMax, bankMax);
  if (A.fbw) S.inp.r = clamp((bankT - S.bank) * 2.4, -0.7, 0.7);
  else S.inp.r = clamp((bankT - S.bank) * 2.0 + S.w.z * 0.9, -0.8, 0.8);
  S.inp.rud = S.inp.r * 0.22;
  // strax före sättningen: nosen rättas upp mot banan med sidrodret och vingarna hålls nästan plana
  if (AP.lat === 'FLARE' && ap) { S.inp.rud = clamp(wrap180(ap.rh - S.hdg) * 0.05, -0.7, 0.7); S.inp.r = clamp(-S.bank * 2.4 - ap.c * 0.002, -0.5, 0.5); }
  // ----- höjd -----
  let vsT;
  const FK = FLAREK[A.cls] || FLAREK.ga, flareH = FK[2] * FT;
  if (AP.lat === 'APP' && S.agl < flareH && ap.dist < 1500) { AP.lat = 'FLARE'; AP.flareVs = Math.min(-0.8, S.vs); apMsg('FLARE'); }
  if (AP.lat === 'APP') {
    const gsAlt = glidePoint(A, ap, ap.dist)[1];
    vsT = -S.gs * Math.tan(3 * DEG) + clamp((gsAlt - S.pos.y) * 0.12, -3, 3);
    if (S.pos.y > gsAlt + 30) vsT = Math.min(vsT, 0); // fånga glidbanan uppifrån utan att stiga
  } else if (AP.lat === 'FLARE') {
    // planar ut: sjunkfarten minskar med höjden och gasen dras av
    vsT = -Math.max(big ? 0.4 : 0.3, -AP.flareVs * clamp(S.agl / flareH, 0, 1) * 0.8);
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
  AP.vsT = vsT;
  if (AP.lat === 'FLARE') {
    // utplaningen: PD på sjunkfarten med dämpning av nickhastigheten, och aldrig uppåt igen (ingen ballong)
    let e = (vsT - S.vs) * FK[0] - S.w.x * FK[1];
    if (S.vs > -0.15) e = Math.min(e, 0);
    S.inp.e = clamp(e, -0.6, 0.9);
  } else if (A.fbw) S.inp.e = clamp((vsT - S.vs) * 0.07, -0.6, 0.6);
  else {
    S.inp.e = clamp((vsT - S.vs) * 0.12 - S.w.x * 1.2, -0.7, 0.7);
    S.trim = clamp(S.trim + S.inp.e * 0.04 * dt, -0.15, 0.15);
  }
  // ----- fart (autogas) -----
  let spdT;
  if (AP.lat === 'APP' || AP.lat === 'FLARE') spdT = apprSpeed(A, Math.max(ap.dist, 0), S.wind);
  else if (ROUTE.on && AP.lat === 'NAV') {
    const rem = routeRemaining(S);
    spdT = jet ? (rem < ROUTE.fafD + 25000 ? 210 : S.pos.y < 3000 * 0.3048 * 3.3 ? 250 : 280) : big ? (rem < ROUTE.fafD + 20000 ? 170 : 220) : (rem < ROUTE.fafD + 6000 ? 85 : 105);
    spdT = Math.min(spdT, A.flaps[S.flap].vfe * 1.944 - 5);
  } else spdT = AP.spd;
  AP.spdT = spdT;
  if (!AP.ts) AP.ts = { at: AP.at, last: null };
  S.thr = autothrottle(S, spdT, dt, AP.ts); AP.at = AP.ts.at;
  if (AP.lat === 'FLARE') { AP.ts.at = 0; S.thr = Math.max(0, S.thr * clamp(S.agl / flareH, 0, 1) - 0.05); if (!AP.retard && A.callouts) { AP.retard = true; } }
  // ----- klaffar och landställ sköts av autopiloten på inflygningen -----
  if ((ap && AP.lat === 'APP') || (AP.lat === 'NAV' && ROUTE.on && routeRemaining(S) < ROUTE.fafD + 30000)) apConfigure(S, ap ? ap.dist : routeRemaining(S));
  // ----- sättning: över till utrullning -----
  if (AP.lat === 'FLARE' && S.onGround) { AP.lat = 'ROLL'; AP.rollT = 0; apMsg('TOUCHDOWN · AUTOBRAKE'); }
}
// klaffar och landställ i takt med farten (meddelar vad den gör så att man lär sig ordningen)
function apConfigure(S, dist) {
  const A = S.ac, ias = S.ias * 1.944, want = dist < (APPRS[A.cls] || APPRS.ga).stab + 1500 ? A.landFlap : Math.min(flapFor(A, apprSpeed(A, Math.max(dist, 0))), A.landFlap);
  if (S.flap < want && ias < A.flaps[S.flap + 1].vfe * 1.944 - 4) { S.flap++; apMsg('AUTOPILOT · FLAPS ' + A.flaps[S.flap].n); }
  if (gearDue(A, dist, S.flap) && !S.gearDown) { S.gearDown = true; apMsg('AUTOPILOT · GEAR DOWN'); if (typeof syncButtons === 'function') syncButtons(); }
}
// utrullning: gasen av, nosen ner, bromsa och styr på centrumlinjen
function apRollout(S, ap, dt) {
  const A = S.ac, big = isBig(A), tail = A.gear.some(g => g.steer === -1);
  AP.rollT = (AP.rollT || 0) + dt;
  S.thr = 0; AP.at = 0;
  if (A.spoilers) S.speedbrake = true;
  if (A.fbw) S.inp.e = AP.rollT < 2 ? 0 : -0.25;
  else S.inp.e = tail ? 0.3 * clamp((AP.rollT - 0.5) / 3, 0, 1) : (AP.rollT < 1.5 ? 0.1 : -0.2);
  S.inp.r = clamp(-S.bank * 2, -0.5, 0.5);
  const hErr = wrap180(ap.rh - S.hdg), gs = S.gs;
  S.inp.rud = clamp(hErr * 0.06 - ap.c * 0.05, -1, 1);
  S.brake = AP.rollT > 1.5 ? (tail ? (gs > 12 ? 0.25 : 0.5) : big ? 0.7 : 0.6) : 0;
  if (gs < 1.5) { S.brake = 1; S.speedbrake = false; apOff('AUTOLAND COMPLETE · YOU HAVE CONTROL'); if (typeof syncButtons === 'function') syncButtons(); }
}
// får man snabbspola just nu?
function warpAllowed(S) {
  if (S.ac.heli) return AP.on && !S.onGround && S.agl > 90 && !(AP.dist < 2500);
  if (!AP.on || S.onGround || S.agl < 300 || AP.lat === 'APP' || AP.lat === 'FLARE' || AP.lat === 'ROLL') return false;
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
