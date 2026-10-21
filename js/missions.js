// ===================== UPPDRAG (missions) =====================
function ringsFrom(list) {
  // varje ring vänds mot nästa punkt
  const pts = list.map(([la, lo, agl]) => { const [x, z] = geo(la, lo); return { x, z, y: Math.max(terrainH(x, z), 0) + agl }; });
  pts.forEach((p, i) => {
    const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, pts.length - 1)];
    const dx = b.x - a.x, dz = b.z - a.z; p.hdg = (Math.atan2(dx, -dz) / DEG + 360) % 360;
  });
  return pts;
}
// ---- guidad första flygning: steg för steg med ett villkor per steg ----
const angDiff = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
const TUT = [
  { hi: 'thr', t: () => 'Push the throttle lever on the left all the way up. Keep the stick centred – the plane keeps itself straight on the runway.', ok: S => S.thr > 0.9 },
  { hi: 'stick', t: () => 'The speed builds up. At about 55 kt, drag the stick gently down (towards you) to lift the nose and fly.', ok: S => !S.onGround && S.agl > 6 },
  { hi: null, t: () => 'You\'re flying! Keep climbing gently to 800 ft (right-hand tape). Keep the nose about 10° up on the ladder.', ok: S => S.agl * 3.281 > 760 },
  { hi: 'thr', t: () => 'Level off: ease the nose down to the horizon line and pull the throttle back to about 65%.', ok: (S, M) => S.agl * 3.281 > 600 && Math.abs(S.vs * 196.85) < 300 && S.thr < 0.8, hold: 2.5 },
  { hi: 'stick', enter: (S, M) => { M.h0 = Math.round(S.hdg); M.h1 = (M.h0 + 270) % 360; }, t: (S, M) => `Turn left: move the stick left to bank about 20°, then centre it to hold the bank. Roll out when the heading (top tape) reads ${String(M.h1).padStart(3, '0')}.`, ok: (S, M) => angDiff(S.hdg, M.h1) < 12 },
  { hi: 'stick', t: (S, M) => `Nice. Now turn right back to heading ${String(M.h0).padStart(3, '0')}, and level the wings when you get there.`, ok: (S, M) => angDiff(S.hdg, M.h0) < 12 && Math.abs(S.bank) < 10 * DEG },
  { hi: 'bFlapDn', enter: () => { if (typeof missionReposition === 'function') missionReposition('app'); }, t: () => 'Now let\'s land. You\'re on final approach to Mariehamn. Tap FLAP + so the flaps show 30° – they let you fly slowly.', ok: S => S.flap === 2 },
  { hi: 'bATHR', t: () => 'Fly through the pink gates: steer the green marker into the pink ring and keep it there. Tap A/THR and the throttle keeps the pink speed for you.', ok: S => S.airTime > 2 && S.agl * 3.281 < 60 },
  { hi: null, t: () => 'Over the runway: ease the stick back a little to flare, let the throttle go to idle and let the plane settle onto its wheels.', ok: S => S.onGround },
  { hi: 'bBrake', t: () => 'You\'re down! Hold BRAKE gently to stop. Don\'t brake too hard or the plane tips onto its nose.', ok: S => S.onGround && S.gs < 1.5 }
];
const MISSIONS = [
  {
    id: 'tutorial', title: 'First flight', ac: 'beaver', sub: 'Tutorial · take off, turn and land · 5 min',
    brief: 'A guided first flight in the bush plane: take off from Mariehamn, climb, level off, turn, and then land with the help of the landing guide. Each step tells you exactly what to do.',
    wind: { dir: 210, kt: 4, gust: 0.1 }, score: 'time', start: () => 'efma', tutorial: true
  },
  {
    id: 'tour', title: 'Kastelholm sightseeing', ac: 'beaver', sub: 'Bush plane · 6 rings',
    brief: 'Fly through all the rings in order as fast as you can. They lead over Jomala, Kastelholm, Bomarsund and Orrdalsklint.',
    wind: { dir: 230, kt: 8, gust: 0.3 }, score: 'time',
    start: () => { const [x, z] = geo(60.112, 19.95); return { type: 'air', x, z, y: 280, hdg: 20, V: 50 }; },
    rings: () => ringsFrom([[60.15, 19.965, 230], [60.205, 20.03, 200], [60.229, 20.083, 160], [60.212, 20.232, 170], [60.27, 20.2, 220], [60.316, 20.135, 140]])
  },
  {
    id: 'post', title: 'Mail run to Degerby', ac: 'float', sub: 'Seaplane · Lumparn → Föglö',
    brief: 'Take the mail from Lumparn to Degerby on Föglö. Land on the water inside the yellow ring and come to a full stop.',
    wind: { dir: 200, kt: 10, gust: 0.35 }, score: 'time', start: () => 'water',
    target: () => ({ x: ALAND_DATA.degerby[0], z: ALAND_DATA.degerby[1], r: 220, name: 'Degerby' })
  },
  {
    id: 'strip', title: 'Short field at Saltvik', ac: 'beaver', sub: 'Bush plane · Mariehamn → Saltvik',
    brief: 'Take off from Mariehamn and fly north to the grass strip at Saltvik. Land and stop on the strip.',
    wind: { dir: 250, kt: 12, gust: 0.45 }, score: 'time', start: () => 'efma',
    field: 1
  },
  {
    id: 'xwind', title: 'Crosswind at EFMA', ac: 'a320', sub: 'A320 · landing in a gusty crosswind',
    brief: 'Land on runway 21 at Mariehamn with a 16-knot gusty crosswind. Put it down in the touchdown zone, softly and close to the centreline.',
    wind: { dir: 290, kt: 16, gust: 0.55 }, score: 'points', start: () => 'app', wx: 'overcast',
    field: 0, landing: true
  },
  {
    id: 'medGeta', title: 'Medevac: Getabergen', ac: 'heli', sub: 'Air ambulance · hospital → Geta → hospital',
    brief: 'A hiker is hurt near Getabergen in the north-west. Lift off from the hospital pad in Mariehamn, land by the blue lights, wait while the crew loads the patient and fly back to the hospital pad.',
    wind: { dir: 240, kt: 9, gust: 0.35 }, score: 'time', start: () => 'pad', medevac: 'sc_geta'
  },
  {
    id: 'medVardo', title: 'Medevac: Vårdö', ac: 'heli', sub: 'Air ambulance · across Lumparn to Vårdö',
    brief: 'Someone has been injured on Vårdö in the north-east. Fly out over the archipelago, land at the scene and bring the patient back to Mariehamn hospital.',
    wind: { dir: 200, kt: 14, gust: 0.5 }, score: 'time', start: () => 'pad', medevac: 'sc_vardo'
  },
  {
    id: 'medKokar', title: 'Medevac: Kökar', ac: 'heli', sub: 'Air ambulance · far out to Kökar and back',
    brief: 'An emergency call from Kökar, the outermost island group about 50 km south-east of Mariehamn. Climb out, engage the autopilot (AP) and time-warp across the sea. It slows down and hands over near the scene. Land by the blue lights, load the patient and bring them back to the hospital pad. Engage AP again for the flight home.',
    wind: { dir: 230, kt: 12, gust: 0.4 }, score: 'time', start: () => 'pad', medevac: 'sc_kokar', wx: 'scattered'
  },
  {
    id: 'medFoglo', title: 'Night medevac: Föglö', ac: 'heli', sub: 'Air ambulance · at night',
    brief: 'A night call to Föglö in the south-east. The scene is marked with blue flashing lights. Land carefully in the dark and fly the patient back to the lit hospital pad.',
    wind: { dir: 260, kt: 8, gust: 0.3 }, score: 'time', start: () => 'pad', medevac: 'sc_foglo', tod: 'night', wx: 'rain'
  }
];
const MS = { def: null, idx: 0, t: 0, state: 'idle', result: null, rings: null, target: null, marks: [], lastSide: null, landing: null, med: null };

function missionBest(id) { try { return JSON.parse(localStorage.getItem('alandsflyg.best.' + id) || 'null'); } catch (e) { return null; } }
function missionSaveBest(id, r) {
  const b = missionBest(id);
  const better = !b || (r.time != null ? r.time < b.time : r.points > b.points);
  if (better) try { localStorage.setItem('alandsflyg.best.' + id, JSON.stringify(r)); } catch (e) {}
  return better;
}
function fmtTime(s) { const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + r.toFixed(1).padStart(4, '0'); }

function missionStart(def) {
  clearMarkers();
  Object.assign(MS, { def, idx: 0, t: 0, state: def ? 'run' : 'idle', result: null, rings: null, target: null, marks: [], lastSide: null, landing: null, med: null, entered: false, hold: 0 });
  if (!def) return;
  if (def.rings) {
    MS.rings = def.rings();
    MS.marks = MS.rings.map((r, i) => addRing(r.x, r.y, r.z, r.hdg, i === 0));
  }
  if (def.target) {
    MS.target = def.target();
    MS.marks.push(addBeacon(MS.target.x, 0, MS.target.z, MS.target.r));
  }
  if (def.medevac) {
    const sc = ZONES.find(z => z.id === def.medevac), pad = ZONES.find(z => z.id === 'acs');
    MS.med = { phase: 'out', scene: sc, pad, load: 0, out: 0 };
    MS.target = { x: sc.x, z: sc.z, r: 40, name: sc.name };
    MS.marks.push(addBeacon(sc.x, sc.elev, sc.z, 40));
  }
  if (def.field != null) {
    const zn = ZONES[def.field];
    MS.target = { x: zn.x, z: zn.z, r: zn.len / 2, name: zn.name };
    if (!def.landing) MS.marks.push(addBeacon(zn.x, zn.elev, zn.z, zn.len / 2 + 30));
  }
}
// returnerar mål för HUD: { x, z, name }
function missionGoal() {
  if (MS.state !== 'run') return null;
  if (MS.rings) { const r = MS.rings[MS.idx]; return { x: r.x, z: r.z, y: r.y, name: 'Ring ' + (MS.idx + 1) + '/' + MS.rings.length }; }
  if (MS.target) return { x: MS.target.x, z: MS.target.z, name: MS.target.name };
  return null;
}
function missionObjective() {
  const d = MS.def; if (!d) return '';
  if (MS.state !== 'run' || d.tutorial) return '';
  if (MS.rings) return 'Fly through ring ' + (MS.idx + 1) + ' of ' + MS.rings.length;
  if (MS.med) {
    const M = MS.med;
    if (M.phase === 'out') return 'Fly to the scene at ' + M.scene.name + ' and land by the blue lights';
    if (M.phase === 'load') return M.load > 0 ? 'Loading the patient… ' + Math.ceil(10 - M.load) + ' s' : 'Land within 40 m of the scene';
    return 'Patient on board: fly back and land on the hospital pad';
  }
  if (d.id === 'post') return 'Land on the water at Degerby and stop';
  if (d.id === 'strip') return 'Land on the Saltvik grass strip and stop';
  if (d.id === 'xwind') return MS.landing ? 'Brake and stop on the runway' : 'Land on runway 21';
  return '';
}
function missionFinish(ok, text, extra) {
  MS.state = ok ? 'done' : 'failed';
  MS.result = Object.assign({ ok, text }, extra || {});
  if (ok) MS.result.best = missionSaveBest(MS.def.id, extra.save);
}
function tutorialShow(S) {
  const el = typeof document !== 'undefined' && document.getElementById('tut');
  if (!el) return;
  const on = MS.def && MS.def.tutorial && MS.state === 'run' && MS.idx < TUT.length;
  el.hidden = !on;
  for (const id of ['thr', 'stickBase', 'bFlapDn', 'bBrake']) { const e = document.getElementById(id); if (e) e.classList.remove('pulse'); }
  if (!on) return;
  const st = TUT[MS.idx];
  const txt = st.t(S, MS);
  if (el.dataset.t !== txt) { el.dataset.t = txt; document.getElementById('tutStep').textContent = `STEP ${MS.idx + 1} / ${TUT.length}`; document.getElementById('tutText').textContent = txt; }
  const hid = st.hi === 'stick' ? 'stickBase' : st.hi;
  if (hid) { const e = document.getElementById(hid); if (e) e.classList.add('pulse'); }
}
function missionUpdate(S, dt) {
  if (MS.state !== 'run' || S.crashed) return;
  MS.t += dt;
  const d = MS.def;
  if (d.tutorial) {
    if (MS.idx >= TUT.length) return;
    const st = TUT[MS.idx];
    if (!MS.entered) { MS.entered = true; MS.hold = 0; if (st.enter) st.enter(S, MS); return; }
    if (st.ok(S, MS)) MS.hold += dt; else MS.hold = 0;
    if (MS.hold >= (st.hold || 0.4)) {
      MS.idx++; MS.entered = false;
      if (typeof chime === 'function') chime('ding');
      if (MS.idx >= TUT.length) {
        try { localStorage.setItem('alandsflyg.tutDone', '1'); } catch (e) {}
        missionFinish(true, 'First flight complete – well flown!', { save: { time: MS.t }, time: MS.t,
          lines: ['Next: try Free flight, a route between airports, or the missions', 'Tip: the landing guide and Easy difficulty are on by default'] });
      }
    }
    return;
  }
  if (MS.rings) {
    const r = MS.rings[MS.idx];
    const nx = Math.sin(r.hdg * DEG), nz = -Math.cos(r.hdg * DEG);
    const dx = S.pos.x - r.x, dy = S.pos.y - r.y, dz = S.pos.z - r.z;
    const side = dx * nx + dz * nz;
    if (MS.lastSide != null && MS.lastSide < 0 && side >= 0) {
      const lat = Math.hypot(dx - side * nx, dz - side * nz, dy);
      if (lat < 44) {
        MS.marks[MS.idx].material.color.setHex(0x6fd08c); MS.marks[MS.idx].material.opacity = 0.35;
        MS.idx++;
        if (MS.idx >= MS.rings.length) { missionFinish(true, 'All rings in ' + fmtTime(MS.t), { save: { time: MS.t }, time: MS.t }); return; }
        const nm = MS.marks[MS.idx]; nm.material.color.setHex(0xf4c430); nm.material.opacity = 0.95;
        MS.lastSide = null; return;
      }
    }
    MS.lastSide = side;
    return;
  }
  if (MS.med) {
    const M = MS.med;
    if (M.phase === 'out' || M.phase === 'load') {
      const dist = Math.hypot(S.pos.x - M.scene.x, S.pos.z - M.scene.z);
      if (dist < 40 && S.onGround && S.gs < 1 && (S.coll != null ? S.coll : S.thr) < 0.62) {
        if (M.phase === 'out') { M.phase = 'load'; M.load = 0; M.out = MS.t; if (typeof chime === 'function') chime('ding'); }
        M.load += dt;
        if (M.load >= 10) {
          M.phase = 'back'; if (typeof chime === 'function') chime('dingdong');
          clearMarkers(); MS.marks = [addBeacon(M.pad.x, M.pad.elev, M.pad.z, 22)];
          MS.target = { x: M.pad.x, z: M.pad.z, r: 15, name: M.pad.name };
        }
      } else if (M.phase === 'load') M.load = 0;
      return;
    }
    const dist = Math.hypot(S.pos.x - M.pad.x, S.pos.z - M.pad.z);
    if (S.onGround && dist < 15 && S.gs < 0.5 && (S.coll != null ? S.coll : S.thr) < 0.62) {
      missionFinish(true, 'Patient delivered in ' + fmtTime(MS.t), { save: { time: MS.t }, time: MS.t,
        lines: ['Scene reached after ' + fmtTime(M.out), Math.round(dist) + ' m from the pad centre'] });
    }
    return;
  }
  if (d.id === 'post') {
    const dist = Math.hypot(S.pos.x - MS.target.x, S.pos.z - MS.target.z);
    if (S.onGround && !isLand(S.pos.x, S.pos.z) && dist < MS.target.r && S.gs < 1.5 && MS.t > 10) missionFinish(true, 'Mail delivered in ' + fmtTime(MS.t), { save: { time: MS.t }, time: MS.t });
    return;
  }
  if (d.id === 'strip') {
    const zn = ZONES[1], [a, c] = zoneLocal(zn, S.pos.x, S.pos.z);
    const on = Math.abs(a) < zn.len / 2 + 10 && Math.abs(c) < zn.wid / 2 + 6;
    if (S.onGround && on && S.gs < 1.0 && MS.t > 20) missionFinish(true, 'Landed at Saltvik in ' + fmtTime(MS.t), { save: { time: MS.t }, time: MS.t });
    return;
  }
  if (d.landing) {
    const zn = ZONES[0];
    if (!MS.landing && S.touch && S.touch.t > 1) {
      const [a, c] = zoneLocal(zn, S.touch.x, S.touch.z);
      const end = activeEnd(zn, S.wind), fromThr = end === 0 ? a + zn.len / 2 : zn.len / 2 - a;
      if (Math.abs(c) > zn.wid / 2 || fromThr < 0) { missionFinish(false, 'The aircraft touched down off the runway.'); return; }
      MS.landing = { fpm: -S.touch.vs * 196.85, fromThr, off: Math.abs(c) };
    }
    if (MS.landing && S.onGround && S.gs < 3) {
      const L = MS.landing;
      const pRate = clamp(100 - Math.max(0, L.fpm - 120) / 5, 0, 100);
      const pZone = L.fromThr >= 150 && L.fromThr <= 750 ? 100 : clamp(100 - Math.min(Math.abs(L.fromThr - 150), Math.abs(L.fromThr - 750)) / 4, 0, 100);
      const pCl = clamp(100 - L.off * 6, 0, 100);
      const points = Math.round(pRate * 0.45 + pZone * 0.3 + pCl * 0.25);
      const grade = points >= 90 ? 'A' : points >= 75 ? 'B' : points >= 55 ? 'C' : 'D';
      missionFinish(true, `Grade ${grade} · ${points} points`, {
        save: { points }, points,
        lines: [`Touchdown ${Math.round(L.fpm)} ft/min`, `${Math.round(L.fromThr)} m past the threshold`, `${L.off.toFixed(1)} m from the centreline`]
      });
    }
  }
}
