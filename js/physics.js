const AIRCRAFT = {
  beaver: {
    id: 'beaver', cls: 'ga', title: 'Bush plane', sub: 'DHC-2 Beaver type · wheels', model: 'beaver', floats: false,
    mass: 2200, S: 23.2, span: 14.6, AR: 9.2, e: 0.75, CL0: 0.25, CLa: 5.0, aStall: 15 * DEG, CD0: 0.042, CYb: 0.6,
    flaps: [{ n: 'UP', cl: 0, cd: 0, vfe: 99 }, { n: '15°', cl: 0.35, cd: 0.024, vfe: 54 }, { n: '30°', cl: 0.7, cd: 0.075, vfe: 46 }],
    prop: true, power: 336000, eta: 0.8, Tstatic: 8500,
    Vref: 50, pitchAuth: 3.2, pitchStab: 6, pitchDamp: 3.8, aTrim: 0.05,
    rollAuth: 2.0, rollDamp: 2.6, rollBeta: 0.6, rollLevel: 0.22, yawAuth: 1.5, yawStab: 3.0, yawDamp: 1.8, advYaw: 0.15,
    gyr: [2.0, 2.6, 2.2], steerMax: 30 * DEG, muBrake: 0.5, vsLimit: 4.6, vne: 72, fbw: false, retract: false, spoilers: false,
    gear: [{ p: [-1.3, -2.17, -1.1], brake: true }, { p: [1.3, -2.17, -1.1], brake: true }, { p: [0, -0.87, 5.6], steer: -1 }],
    struct: [
      { p: [0, -1.3, -3.75], n: 'Propeller strike' }, { p: [0, 1.3, -3.75], n: 'Propeller strike' },
      { p: [0, -0.7, -3.4], n: 'The nose hit the ground' }, { p: [-7.3, 0.95, -0.6], n: 'Left wingtip strike' }, { p: [7.3, 0.95, -0.6], n: 'Right wingtip strike' },
      { p: [0, 2.1, 5.6], n: 'The aircraft flipped over' }, { p: [0, 0.8, -1.2], n: 'The aircraft flipped over' }
    ],
    chase: [0, 4.2, 16], cockpit: [-0.3, 0.8, -1.25], shadow: 16, vapp: [85, 72, 63], landFlap: 2, flareFt: 12, tdz: 120,
    starts: [{ id: 'strip', n: 'Saltvik airstrip' }, { id: 'efma', n: 'Mariehamn runway' }, { id: 'app', n: 'Mariehamn approach' }]
  },
  a320: {
    id: 'a320', cls: 'jet', title: 'Airliner', sub: 'A320 type · fly-by-wire', model: 'a320', floats: false,
    mass: 62000, S: 122.6, span: 34.1, AR: 9.4, e: 0.8, CL0: 0.2, CLa: 5.6, aStall: 14 * DEG, CD0: 0.021, CYb: 0.5,
    flaps: [{ n: 'UP', cl: 0, cd: 0, vfe: 999 }, { n: '1', cl: 0.25, cd: 0.009, vfe: 118 }, { n: '2', cl: 0.5, cd: 0.022, vfe: 103 }, { n: '3', cl: 0.7, cd: 0.04, vfe: 95 }, { n: 'FULL', cl: 0.95, cd: 0.075, vfe: 91 }],
    prop: false, Tstatic: 230000, spool: 2.6,
    Vref: 120, pitchAuth: 1.3, pitchStab: 3.2, pitchDamp: 2.2, aTrim: 0.04,
    rollAuth: 0.7, rollDamp: 1.6, rollBeta: 0.35, yawAuth: 0.5, yawStab: 1.8, yawDamp: 1.4, advYaw: 0.03,
    gyr: [9, 11, 7.5], steerMax: 40 * DEG, muBrake: 0.45, vsLimit: 3.6, vne: 180, fbw: true, retract: true, spoilers: true,
    gear: [{ p: [0, -3.95, -11.5], steer: 1 }, { p: [-3.8, -3.95, 1.5], brake: true }, { p: [3.8, -3.95, 1.5], brake: true }],
    struct: [
      { p: [0, -1.4, -18.3], n: 'The nose hit the ground' }, { p: [0, -0.55, 21.5], n: 'Tailstrike' },
      { p: [-16.8, 0.2, 5.0], n: 'Left wingtip strike' }, { p: [16.8, 0.2, 5.0], n: 'Right wingtip strike' },
      { p: [-5.7, -3.35, -4.5], n: 'Left engine struck the ground' }, { p: [5.7, -3.35, -4.5], n: 'Right engine struck the ground' },
      { p: [0, -2.05, 0], n: 'Belly landing' }, { p: [0, -2.05, -9], n: 'Belly landing' }, { p: [0, -1.9, 9], n: 'Belly landing' }, { p: [0, 2.0, 0], n: 'The aircraft flipped over' }
    ],
    chase: [0, 13, 58], cockpit: [-0.55, 0.95, -16.2], shadow: 50, vapp: [210, 180, 160, 145, 135], landFlap: 4, flareFt: 30, tdz: 300, callouts: true, toFlap: 1, app: { V: 70, flap: 4, D: 7000 },
    starts: [{ id: 'efma', n: 'Mariehamn runway' }, { id: 'app', n: 'Mariehamn approach' }]
  },
  // regionalt turbopropflyg (Fokker 50-typ): högvingat, två sexbladiga propellrar, klassiska roder
  f50: {
    id: 'f50', cls: 'tp', title: 'Turboprop', sub: 'Fokker 50 type · twin turboprop', model: 'f50', floats: false,
    mass: 18500, S: 70, span: 29, AR: 12, e: 0.8, CL0: 0.25, CLa: 5.4, aStall: 15 * DEG, CD0: 0.028, CYb: 0.5,
    flaps: [{ n: 'UP', cl: 0, cd: 0, vfe: 999 }, { n: '10', cl: 0.3, cd: 0.014, vfe: 93 }, { n: '25', cl: 0.62, cd: 0.04, vfe: 78 }, { n: '35', cl: 0.85, cd: 0.075, vfe: 70 }],
    prop: true, twin: true, power: 3700000, eta: 0.85, Tstatic: 80000,
    Vref: 70, pitchAuth: 1.8, pitchStab: 4.2, pitchDamp: 2.8, aTrim: 0.05,
    rollAuth: 1.1, rollDamp: 2.0, rollBeta: 0.4, rollLevel: 0.12, yawAuth: 0.8, yawStab: 2.4, yawDamp: 1.6, advYaw: 0.06,
    gyr: [6.5, 8, 6.5], steerMax: 45 * DEG, muBrake: 0.45, vsLimit: 3.8, vne: 120, fbw: false, retract: true, spoilers: false,
    gear: [{ p: [0, -2.75, -8.8], steer: 1 }, { p: [-3.6, -2.75, 0.9], brake: true }, { p: [3.6, -2.75, 0.9], brake: true }],
    struct: [
      { p: [0, -1.1, -11.6], n: 'The nose hit the ground' }, { p: [0, -0.3, 13.5], n: 'Tailstrike' },
      { p: [-14.5, 1.3, 0.4], n: 'Left wingtip strike' }, { p: [14.5, 1.3, 0.4], n: 'Right wingtip strike' },
      { p: [-3.6, -1.25, -4.1], n: 'Left propeller struck the ground' }, { p: [3.6, -1.25, -4.1], n: 'Right propeller struck the ground' },
      { p: [0, -1.4, 0], n: 'Belly landing' }, { p: [0, -1.3, -7], n: 'Belly landing' }, { p: [0, -1.2, 7], n: 'Belly landing' }, { p: [0, 2.6, 0], n: 'The aircraft flipped over' }
    ],
    chase: [0, 9, 42], cockpit: [-0.5, 0.78, -9.7], shadow: 38, vapp: [150, 130, 118, 110], landFlap: 3, flareFt: 20, tdz: 250, callouts: true, toFlap: 1, app: { V: 62, flap: 3, D: 6000 },
    starts: [{ id: 'efma', n: 'Mariehamn runway' }, { id: 'app', n: 'Mariehamn approach' }]
  }
};
// större trafikflyg (jet och turboprop) använder stora flygplatser, längre inflygningar och callouts
function isBig(A) { return A.cls === 'jet' || A.cls === 'tp'; }
AIRCRAFT.float = Object.assign({}, AIRCRAFT.beaver, {
  id: 'float', cls: 'ga', title: 'Seaplane', sub: 'DHC-2 Beaver type · floats', floats: true, mass: 2350, CD0: 0.052, Tstatic: 8800,
  gear: [{ p: [-1.35, -2.42, -2.6] }, { p: [1.35, -2.42, -2.6] }, { p: [-1.35, -2.42, 2.6], steer: -1 }, { p: [1.35, -2.42, 2.6], steer: -1 }],
  struct: [
    { p: [0, 1.3, -3.75], n: 'Propeller hit the water' }, { p: [0, -1.25, -3.75], n: 'Propeller hit the water' },
    { p: [-7.3, 0.95, -0.6], n: 'Left wingtip strike' }, { p: [7.3, 0.95, -0.6], n: 'Right wingtip strike' },
    { p: [0, 2.1, 5.6], n: 'The aircraft flipped over' }, { p: [0, 0.8, -1.2], n: 'The aircraft flipped over' }
  ],
  starts: [{ id: 'water', n: 'On the water' }, { id: 'air', n: 'In the air' }]
});
// ambulanshelikopter (H145-typ): kollektiv på gasreglaget, cyklisk på spaken med attitydhållning (SAS)
AIRCRAFT.heli = {
  id: 'heli', cls: 'heli', heli: true, title: 'Air ambulance', sub: 'H145 type helicopter', model: 'heli', floats: false,
  mass: 3300, S: 1, span: 11, AR: 1, e: 1, CL0: 0, CLa: 1, aStall: 1, CD0: 0, CYb: 0,
  flaps: [{ n: '—', cl: 0, cd: 0, vfe: 99 }], prop: false, Tstatic: 0, Vref: 40, Tmax: 3300 * 9.81 * 1.55,
  gyr: [1.9, 2.4, 1.6], steerMax: 0, muBrake: 0, vsLimit: 3.3, vne: 82, fbw: false, retract: false, spoilers: false,
  gear: [{ p: [-1.1, -1.55, -1.6] }, { p: [1.1, -1.55, -1.6] }, { p: [-1.1, -1.55, 1.5] }, { p: [1.1, -1.55, 1.5] }],
  struct: [
    { p: [0, 1.0, 9.6], n: 'Tail rotor strike' }, { p: [0, 0.4, 8.0], n: 'Tail boom struck the ground' },
    { p: [-5.5, 1.85, 0], n: 'Main rotor struck the ground' }, { p: [5.5, 1.85, 0], n: 'Main rotor struck the ground' },
    { p: [0, 1.85, -5.5], n: 'Main rotor struck the ground' }, { p: [0, 1.85, 5.5], n: 'Main rotor struck the ground' },
    { p: [0, 2.0, 0], n: 'The helicopter rolled over' }, { p: [0, -0.4, -2.9], n: 'The nose hit the ground' }
  ],
  chase: [0, 5, 20], cockpit: [-0.4, 0.75, -1.75], shadow: 16, vapp: [60], landFlap: 0, flareFt: 0, tdz: 0,
  starts: [{ id: 'pad', n: 'Mariehamn Hospital helipad' }, { id: 'efma', n: 'Mariehamn airport' }, { id: 'hover', n: 'Hover over Mariehamn' }]
};
for (const k in AIRCRAFT) {
  const A = AIRCRAFT[k];
  A.qref = 0.5 * 1.225 * A.Vref * A.Vref;
  A.I = A.gyr.map(r => A.mass * r * r);
  A.k = A.mass * 9.81 / (A.gear.length * 0.12);
  A.c = 2 * 0.65 * Math.sqrt(A.k * A.mass / A.gear.length);
  A.gearH = -Math.min(...A.gear.map(g => g.p[1]));
}

function clCurve(a, cl0, cla, as) {
  const sgn = a < 0 ? -1 : 1, aa = Math.abs(a);
  const lin = cl0 + cla * a;
  if (aa <= as) return lin;
  const peak = cl0 + cla * as * sgn;
  const flat = 1.1 * Math.sin(2 * a);
  return lerp(peak, flat, smooth(as, as + 0.09, aa));
}
function flapInterp(A, pos) {
  const i = Math.floor(pos), t = pos - i, f0 = A.flaps[i], f1 = A.flaps[Math.min(i + 1, A.flaps.length - 1)];
  return { cl: lerp(f0.cl, f1.cl, t), cd: lerp(f0.cd, f1.cd, t) };
}

const _q = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _vb = new THREE.Vector3(), _F = new THREE.Vector3(), _Fw = new THREE.Vector3(), _Tw = new THREE.Vector3(), _Tw2 = new THREE.Vector3();
const _r = new THREE.Vector3(), _P = new THREE.Vector3(), _wW = new THREE.Vector3(), _vP = new THREE.Vector3(), _f = new THREE.Vector3(), _t = new THREE.Vector3(), _ax = new THREE.Vector3();
const _e = new THREE.Euler();

function attitude(S) {
  const F = _t.set(0, 0, -1).applyQuaternion(S.q);
  S.pitch = Math.asin(clamp(F.y, -1, 1));
  S.hdg = (Math.atan2(F.x, -F.z) / DEG + 360) % 360;
  const Rx = new THREE.Vector3(1, 0, 0).applyQuaternion(S.q), U = new THREE.Vector3(0, 1, 0).applyQuaternion(S.q);
  S.bank = Math.atan2(-Rx.y, U.y);
}
function setAttitude(q, hdg, pitch, bank) { return q.setFromEuler(_e.set(pitch, -hdg * DEG, -bank, 'YXZ')); }

function crash(S, why) { if (!S.crashed) S.crashed = why; }

// vind: från-riktning i grader, styrka i knop, byighet 0–1
function setWind(S, dir, kt, gust) {
  S.wind = { dir, kt, gust };
  S.windPh = [Math.random() * 9, Math.random() * 9, Math.random() * 9, Math.random() * 9, Math.random() * 9, Math.random() * 9];
}
function updateWind(S, agl) {
  const w = S.wind, ms = w.kt * 0.5144, t = S.time;
  const prof = 0.55 + 0.45 * smooth(0, 350, agl);
  const sx = -Math.sin(w.dir * DEG) * ms * prof, sz = Math.cos(w.dir * DEG) * ms * prof;
  const P = S.windPh, gk = w.gust * ms * prof * (1 + 0.3 * (1 - smooth(20, 250, agl))) + (ms > 4 ? 0.25 : 0) + (S.wxTurb || 0);
  const gx = (Math.sin(t * 0.63 + P[0]) * 0.55 + Math.sin(t * 1.71 + P[1]) * 0.3 + Math.sin(t * 4.1 + P[2]) * 0.15) * gk;
  const gz = (Math.sin(t * 0.57 + P[3]) * 0.55 + Math.sin(t * 1.93 + P[4]) * 0.3 + Math.sin(t * 3.7 + P[0]) * 0.15) * gk;
  const gy = (Math.sin(t * 0.9 + P[5]) * 0.6 + Math.sin(t * 2.6 + P[2]) * 0.4) * gk * 0.35 * smooth(2, 40, agl);
  S.windNow.set(sx + gx, gy, sz + gz);
}
// välj banände med motvind
function activeEnd(zn, wind) {
  const head = Math.cos((wind.dir - zn.hdg) * DEG);
  return head >= -0.05 ? 0 : 1; // 0 = landa mot zn.hdg, 1 = motsatt
}
function createState(acId, start, wind) {
  const A = AIRCRAFT[acId];
  const S = {
    ac: A, pos: new THREE.Vector3(), vel: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(), windNow: new THREE.Vector3(),
    thr: 0, n1: 0, speedbrake: false, flap: 0, flapPos: 0, gearDown: true, gearPos: 1, brake: 0, trim: 0, crashed: null,
    onGround: true, airTime: 0, gammaHold: 0, bankHold: 0, fbwInit: false, alphaFloor: false, stallSide: 1, wasStall: false,
    inp: { e: 0, r: 0, rud: 0 }, V: 0, ias: 0, gs: 0, alpha: 0, beta: 0, agl: 0, g: 1, pitch: 0, hdg: 0, bank: 0, vs: 0, T: 0, time: 0,
    touch: null, touches: 0
  };
  wind = wind || { dir: 220, kt: 0, gust: 0 };
  setWind(S, wind.dir, wind.kt, wind.gust);
  A.gear.forEach(g => (g.c = true));
  const groundPlace = (x, z, hdg, elev) => {
    let pitch = 0;
    if (A.gear.length === 3) {
      const mains = A.gear.filter(g => !g.steer), o = A.gear.find(g => g.steer);
      pitch = Math.atan((o.p[1] - mains[0].p[1]) / (o.p[2] - mains[0].p[2]));
    }
    setAttitude(S.q, hdg, pitch, 0);
    let low = Infinity;
    for (const g of A.gear) low = Math.min(low, _t.fromArray(g.p).applyQuaternion(S.q).y);
    S.pos.set(x, elev - low - 0.02, z);
  };
  const airStart = (x, z, y, hdg, V, gamma, flap) => {
    if (A.heli) {
      setAttitude(S.q, hdg, 0, 0); S.pos.set(x, y, z);
      S.vel.set(Math.sin(hdg * DEG) * V, 0, -Math.cos(hdg * DEG) * V);
      S.thr = S.n1 = 0.65; S.onGround = false; S.airTime = 30; A.gear.forEach(g => (g.c = false)); S.hdgHold = hdg; return;
    }
    S.flap = S.flapPos = flap;
    const rho = 1.225 * Math.exp(-y / 8500), qb = 0.5 * rho * V * V;
    const fl = flapInterp(A, S.flapPos);
    const CL = A.mass * 9.81 / (qb * A.S);
    const alpha = (CL - A.CL0 - fl.cl) / A.CLa;
    setAttitude(S.q, hdg, alpha + gamma, 0);
    S.pos.set(x, y, z);
    S.vel.set(Math.sin(hdg * DEG) * Math.cos(gamma) * V, Math.sin(gamma) * V, -Math.cos(hdg * DEG) * Math.cos(gamma) * V);
    // lägg till vinden så att planet startar med rätt fart genom luften
    S.vel.x += -Math.sin(S.wind.dir * DEG) * S.wind.kt * 0.5144; S.vel.z += Math.cos(S.wind.dir * DEG) * S.wind.kt * 0.5144;
    const CD = A.CD0 + fl.cd + (A.retract ? 0.025 : 0) + CL * CL / (Math.PI * A.e * A.AR);
    const Treq = qb * A.S * CD + A.mass * 9.81 * Math.sin(gamma);
    const Tav = A.prop ? Math.min(A.Tstatic, A.eta * A.power / V) : A.Tstatic * (1 - 0.0011 * V);
    S.thr = clamp(A.prop ? Treq / Tav : (Treq / Tav - 0.04) / 0.96, 0, 1);
    S.n1 = S.thr;
    S.onGround = false; S.airTime = 30; S.gammaHold = gamma; S.fbwInit = true;
    A.gear.forEach(g => (g.c = false));
    if (!A.fbw) S.trim = clamp(alpha - A.aTrim + fl.cl / A.CLa * 0.6, -0.15, 0.15);
  };
  const runwayStart = (Z, from) => {
    const end = activeEnd(Z, S.wind), sgn = end === 0 ? 1 : -1;
    const [x, z] = zoneWorld(Z, sgn * (-Z.len / 2 + from), 0);
    groundPlace(x, z, (Z.hdg + (end ? 180 : 0)) % 360, Z.elev);
  };
  const appStart = (zn, D) => {
    const end = activeEnd(zn, S.wind), sgn = end === 0 ? 1 : -1, hdg = (zn.hdg + (end ? 180 : 0)) % 360;
    const [x, z] = zoneWorld(zn, sgn * (-zn.len / 2 + 300 - D), 0);
    airStart(x, z, zn.elev + D * Math.tan(3 * DEG) + A.gearH, hdg, A.app ? A.app.V : 36, -3 * DEG, A.app ? A.app.flap : 1);
  };
  const zn = ZONES[0];
  if (typeof start === 'object') {
    if (start.type === 'air') airStart(start.x, start.z, start.y, start.hdg, start.V, start.gamma || 0, start.flap || 0);
    else if (start.type === 'pad') { const Z = ZONES.find(z => z.id === start.zone); groundPlace(Z.x, Z.z, start.hdg || 0, Z.elev); }
    else if (start.type === 'rwy') { const Z = ZONES.find(z => z.id === start.zone); runwayStart(Z, Z.len > 1500 ? 45 : 20); if (A.toFlap) S.flap = S.flapPos = A.toFlap; }
    else if (start.type === 'app') appStart(ZONES.find(z => z.id === start.zone), start.dist || (A.app ? A.app.D : 3500));
    else groundPlace(start.x, start.z, start.hdg, start.type === 'water' ? 0 : terrainH(start.x, start.z));
  } else if (start === 'pad') { const Z = ZONES.find(z => z.id === 'acs'); groundPlace(Z.x, Z.z, 30, Z.elev); }
  else if (start === 'hover') { const Z = ZONES.find(z => z.id === 'acs'); airStart(Z.x - 400, Z.z + 600, Z.elev + 120, 30, 0, 0, 0); }
  else if (start === 'strip') { runwayStart(ZONES[1], 20); }
  else if (start === 'efma') { if (A.heli) { const [x, z] = zoneWorld(zn, 80, 205); groundPlace(x, z, zn.hdg, zn.elev); } else runwayStart(zn, 45); if (A.toFlap) S.flap = S.flapPos = A.toFlap; }
  else if (start === 'water') { groundPlace(STARTS.water.x, STARTS.water.z, STARTS.water.hdg, 0); }
  else if (start === 'app') appStart(zn, A.app ? A.app.D : 3500);
  else airStart(STARTS.water.x, STARTS.water.z, 450, STARTS.water.hdg, 50, 0, 0);
  S.hdgHold = S.hdgHold != null ? S.hdgHold : null;
  attitude(S);
  if (A.heli && S.hdgHold == null) S.hdgHold = S.hdg;
  return S;
}

function step(S, dt) {
  if (S.crashed) return;
  const A = S.ac, m = A.mass, g = 9.81;
  S.time += dt;
  _qi.copy(S.q).invert();
  const tH0 = terrainH(S.pos.x, S.pos.z);
  updateWind(S, S.pos.y - Math.max(tH0, 0));
  const vb = _vb.copy(S.vel).sub(S.windNow).applyQuaternion(_qi);
  const V = vb.length(), u = -vb.z;
  const alpha = V > 0.3 ? Math.atan2(-vb.y, u) : 0;
  const beta = V > 1 ? Math.asin(clamp(vb.x / V, -1, 1)) : 0;
  const rho = 1.225 * Math.exp(-Math.max(S.pos.y, 0) / 8500);
  const qbar = 0.5 * rho * V * V;
  if (A.heli) return stepHeli(S, dt, vb, V, rho, tH0);

  // klaffar och ställ rör sig i realistisk takt
  S.flapPos += clamp(S.flap - S.flapPos, -dt * 0.45, dt * 0.45);
  if (A.retract) S.gearPos = clamp(S.gearPos + (S.gearDown ? 1 : -1) * dt / 8, 0, 1);
  const fl = flapInterp(A, S.flapPos);
  const dfl = S.prevFlCl == null ? 0 : (fl.cl - S.prevFlCl) / dt; S.prevFlCl = fl.cl;

  const agl = S.pos.y - Math.max(tH0, 0) - A.gearH;
  const hRel = Math.max(agl + A.gearH * 0.5, 0.2) / A.span;
  const aSt = A.aStall - S.flapPos * 0.6 * DEG;

  let CL = clCurve(alpha, A.CL0 + fl.cl, A.CLa, aSt);
  let extraCD = 0;
  S.spoilers = false;
  if (A.spoilers && S.onGround && S.thr < 0.06 && V > 15) { CL *= 0.25; extraCD = 0.08; S.spoilers = true; }
  else if (A.spoilers && S.speedbrake && !S.onGround) { CL -= 0.12; extraCD = 0.035; S.spoilers = true; } // luftbroms i flykt
  if (A.prop) extraCD += 0.028 * (1 - S.thr) * (1 - S.thr); // propellern bromsar på tomgång
  let ge = 1;
  if (hRel < 1) { const x = 16 * hRel; ge = (x * x) / (1 + x * x); CL *= 1 + 0.1 * (1 - hRel); }
  const kInd = 1 / (Math.PI * A.e * A.AR);
  const stalled = Math.abs(alpha) > aSt;
  const CD = A.CD0 + fl.cd + (A.retract ? S.gearPos * 0.025 : 0) + kInd * CL * CL * ge + extraCD +
    1.1 * Math.pow(Math.sin(alpha), 2) * smooth(aSt * 0.8, aSt + 0.2, Math.abs(alpha));

  _F.set(0, 0, 0);
  if (V > 0.5) {
    const dx = vb.x / V, dy = vb.y / V, dz = vb.z / V;
    const ll = Math.hypot(dy, dz);
    const L = qbar * A.S * CL, D = qbar * A.S * CD;
    if (ll > 1e-3) { _F.y += (L * -dz) / ll; _F.z += (L * dy) / ll; }
    _F.x -= dx * D; _F.y -= dy * D; _F.z -= dz * D;
    _F.x -= qbar * A.S * A.CYb * beta;
  }
  // dragkraft
  let T;
  if (A.prop) {
    T = S.thr * Math.min(A.Tstatic, (A.eta * A.power * (rho / 1.225)) / Math.max(V, 1));
  } else {
    if (A.fbw && !S.onGround && S.airTime > 5 && alpha > aSt - 1.2 * DEG) { S.alphaFloor = true; }
    if (S.alphaFloor) { S.thr = 1; if (alpha < aSt - 5 * DEG) S.alphaFloor = false; }
    const k = S.thr > S.n1 ? 1 / A.spool : 1 / (A.spool * 0.8);
    S.n1 += (S.thr - S.n1) * (1 - Math.exp(-dt * k));
    T = A.Tstatic * (0.025 + 0.975 * S.n1) * Math.pow(rho / 1.225, 0.8) * (1 - 0.0011 * V);
  }
  S.T = T;
  _F.z -= T;
  const nz = _F.y / (m * g); // lastfaktor (aero)
  _Fw.copy(_F).applyQuaternion(S.q);
  _Fw.y -= m * g;

  // ---- moment (vinkelacceleration i kroppskoordinater) ----
  attitude(S);
  const qr = Math.min(qbar / A.qref, 3);
  const vr = Math.max(V / A.Vref, 0.15);
  let { e, r, rud } = S.inp;
  // lätt läge: landningshjälp nära marken – rätar upp vingarna och flyter ut om du sjunker för fort
  S.landAssist = false;
  const bigA = A.cls === 'jet' || A.cls === 'tp', asH = bigA ? 60 : 25;
  if (S.easy && !S.onGround && S.airTime > 2 && S.agl < asH && S.vel.y < 0) {
    S.landAssist = true;
    const vsDes = -Math.max(0.55, S.agl * (bigA ? 0.18 : 0.3));
    // inte så mycket nos upp att stjärten slår i: hjälpen tonas bort mot ca 9° nosvinkel (bushplanet 14°)
    const pmax = (bigA ? 9 : 14) * DEG, room = clamp((pmax - S.pitch) / (4 * DEG), 0, 1);
    if (S.vel.y < vsDes) e = clamp(e + (vsDes - S.vel.y) * (A.fbw ? 0.35 : 0.22) * room, -1, 1);
    if (S.pitch > pmax) e = Math.min(e, -0.2);
    if (S.agl < 20 && Math.abs(r) < 0.35) r = clamp(r - S.bank * 2.2 + S.w.z * 0.4, -1, 1);
  }
  const wash = A.prop ? S.thr * 0.35 : 0;
  let ax, az;
  const fbwOn = A.fbw && !S.onGround && S.airTime > 2.5;
  if (fbwOn) {
    const gamma = V > 1 ? Math.asin(clamp(S.vel.y / V, -1, 1)) : 0;
    const pilot = Math.abs(e) > 0.04;
    if (pilot || !S.fbwInit) { S.gammaHold = gamma; S.fbwInit = true; }
    const tb = Math.tan(clamp(S.bank, -1.2, 1.2));
    const turnQ = V > 20 ? (g / V) * Math.sin(S.bank) * tb : 0;
    let cmd = (pilot ? e * 0.17 : 0.6 * (S.gammaHold - gamma)) + turnQ - (dfl / A.CLa) * 1.0;
    cmd = Math.min(cmd, ((aSt - 1.5 * DEG) - alpha) * 1.5);
    if (S.pitch > 30 * DEG) cmd = Math.min(cmd, 30 * DEG - S.pitch);
    if (S.pitch < -15 * DEG) cmd = Math.max(cmd, -15 * DEG - S.pitch);
    const auth = clamp(qr * 1.4, 0.2, 1) * 3.5;
    ax = auth * (cmd - S.w.x);
    let pT;
    if (Math.abs(r) > 0.04) { pT = r * 0.26; S.bankHold = S.bank; }
    else {
      if (Math.abs(S.bankHold) > 33 * DEG) S.bankHold -= Math.sign(S.bankHold) * Math.min(Math.abs(S.bankHold) - 33 * DEG, 6 * DEG * dt);
      pT = clamp(1.0 * (S.bankHold - S.bank), -0.15, 0.15);
    }
    if (S.bank > 67 * DEG && pT > 0) pT = 0;
    if (S.bank < -67 * DEG && pT < 0) pT = 0;
    az = clamp(qr * 1.4, 0.2, 1) * 3 * (-pT - S.w.z);
  } else {
    // klaffarna ger nosen-ned-moment: planet flyger med lägre nos i stället för att ballongera
    const aErr = clamp(alpha - (A.aTrim + S.trim - fl.cl / A.CLa * 0.6), -0.6, 0.6);
    ax = A.pitchAuth * e * (qr + wash) - A.pitchStab * qr * aErr - A.pitchDamp * S.w.x * vr - (dfl / A.CLa) * A.pitchDamp * 1.0 * vr;
    az = -A.rollAuth * r * qr + A.rollBeta * beta * qr - A.rollDamp * S.w.z * vr + (A.rollLevel || 0) * clamp(S.bank, -1, 1) * Math.min(qr, 1.5);
    if (A.fbw) S.fbwInit = false;
  }
  // överstegring: vingen tappar
  if (stalled && !S.onGround && V > 8) {
    if (!S.wasStall) { S.stallSide = Math.random() < 0.5 ? -1 : 1; S.wasStall = true; }
    az += 0.7 * S.stallSide * Math.min(qr, 1);
  } else S.wasStall = false;
  let ay = -A.yawAuth * rud * (qr + wash * 0.6) - A.yawStab * beta * qr - A.yawDamp * S.w.y * vr + A.advYaw * r * qr;

  finishStep(S, dt, ax, ay, az, rud, nz, V, alpha, beta, agl, rho, stalled, aSt);
}
function finishStep(S, dt, ax, ay, az, rud, nz, V, alpha, beta, agl, rho, stalled, aSt) {
  const A = S.ac, m = A.mass;
  // ---- markkontakt ----
  _Tw.set(0, 0, 0); _Tw2.set(0, 0, 0);
  let contacts = 0;
  const gsp = Math.hypot(S.vel.x, S.vel.z), steerScale = 1 / (1 + (gsp / 7) * (gsp / 7)); // hjulstyrningen tonas ut med farten
  const gearActive = !A.retract || S.gearPos > 0.98;
  for (const gp of A.gear) {
    if (!gearActive) { gp.c = false; continue; }
    _r.fromArray(gp.p).applyQuaternion(S.q);
    _P.copy(S.pos).add(_r);
    const t = terrainH(_P.x, _P.z), water = t < 0 || (gp.lk = isLake(_P.x, _P.z)), h = t < 0 ? 0 : t;
    const pen = h - _P.y;
    if (pen <= 0) { gp.c = false; continue; }
    if (water && !A.floats) { crash(S, A.heli ? 'Ditched in the water' : 'The wheels touched the water and the aircraft overturned'); return; }
    _wW.copy(S.w).applyQuaternion(S.q);
    _vP.copy(_wW).cross(_r).add(S.vel);
    if (!gp.c && S.airTime > 0.5) { S.touch = { vs: _vP.y, x: _P.x, z: _P.z, t: S.time, water }; S.touches++; }
    if (!gp.c && _vP.y < -A.vsLimit * (S.easy ? 1.8 : 1)) { crash(S, 'Hard landing (' + Math.round(-_vP.y * 196.85) + ' ft/min)'); return; }
    gp.c = true;
    if (pen > (S.easy ? 1.1 : 0.75) && !water) { crash(S, A.heli ? 'The skids collapsed' : 'The landing gear collapsed'); return; }
    contacts++;
    const kk = A.k * (water ? 0.22 : 1), cc = A.c * (water ? 0.9 : 1);
    const N = Math.max(kk * pen - cc * _vP.y, 0);
    const dl = gp.steer ? gp.steer * rud * A.steerMax * steerScale : 0;
    _f.set(Math.sin(dl), 0, -Math.cos(dl)).applyQuaternion(S.q);
    _f.y = 0; _f.normalize();
    const lx = -_f.z, lz = _f.x;
    const vF = _vP.x * _f.x + _vP.z * _f.z, vL = _vP.x * lx + _vP.z * lz;
    let muF, muL;
    if (A.floats) {
      if (water) { const sp = Math.abs(vF); muF = 0.03 + 0.11 * smooth(3, 11, sp) * (1 - smooth(15, 26, sp)); muL = 0.5; }
      else { muF = 0.45; muL = 0.6; }
    } else {
      const rw = inRunway(_P.x, _P.z, 3);
      muF = A.heli ? 0.5 : (!rw ? 0.06 : rw.kind === 'grass' ? 0.04 : 0.018) + (gp.brake ? S.brake * A.muBrake : 0);
      muL = A.heli ? 0.6 : 0.6;
    }
    const Ff = -clamp(vF / 0.4, -1, 1) * N * muF;
    const Fl = -clamp(vL / 0.6, -1, 1) * N * muL;
    const Fx = _f.x * Ff + lx * Fl, Fy = N, Fz = _f.z * Ff + lz * Fl;
    _Fw.x += Fx; _Fw.y += Fy; _Fw.z += Fz;
    const TT = water ? _Tw2 : _Tw;
    TT.x += _r.y * Fz - _r.z * Fy; TT.y += _r.z * Fx - _r.x * Fz; TT.z += _r.x * Fy - _r.y * Fx;
  }
  S.onGround = contacts > 0;
  if (contacts >= 2 && gearActive && !A.heli) {
    // brett ställ och sporrhjul/noshjul som dämpar: håller planet stabilt under rullningen
    az += 5 * S.bank - 3.5 * S.w.z;
    ay += -2.2 * S.w.y;
  }
  _Tw.applyQuaternion(_qi); _Tw2.applyQuaternion(_qi);
  _Tw.x += _Tw2.x * 0.35; _Tw.y += _Tw2.y; _Tw.z += _Tw2.z;
  ax += _Tw.x / A.I[0]; ay += _Tw.y / A.I[1]; az += _Tw.z / A.I[2];

  // ---- integrera ----
  S.vel.addScaledVector(_Fw, dt / m);
  S.pos.addScaledVector(S.vel, dt);
  S.w.x += ax * dt; S.w.y += ay * dt; S.w.z += az * dt;
  if (S.onGround) S.w.multiplyScalar(1 - 0.8 * dt);
  const wl = S.w.length();
  if (wl > 1e-9) { _q.setFromAxisAngle(_ax.copy(S.w).divideScalar(wl), wl * dt); S.q.multiply(_q).normalize(); }
  S.airTime = S.onGround ? 0 : S.airTime + dt;

  for (const sp of A.struct) {
    _r.fromArray(sp.p).applyQuaternion(S.q);
    _P.copy(S.pos).add(_r);
    const t = terrainH(_P.x, _P.z);
    if (_P.y < Math.max(t, 0) - 0.05) { crash(S, sp.n); return; }
  }

  S.V = V; S.gs = Math.hypot(S.vel.x, S.vel.z); S.alpha = alpha; S.beta = beta; S.agl = agl; S.ias = V * Math.sqrt(rho / 1.225);
  S.g = lerp(S.g, nz + (S.onGround ? 0 : 0), 0.05);
  S.vs = S.vel.y; S.stall = stalled && !S.onGround && V > 8; S.aSt = aSt;
}

// ---------- helikopter ----------
function stepHeli(S, dt, vb, V, rho, tH0) {
  const A = S.ac, m = A.mass, g = 9.81;
  const agl = S.pos.y - Math.max(tH0, 0) - A.gearH;
  attitude(S);
  const vh = Math.hypot(vb.x, vb.z), sink = -S.vel.y;
  // translatorisk lyftkraft: en tydlig "knuff" uppåt när farten passerar 8–18 m/s
  const etl = 1 + 0.2 * smooth(7, 17, vh) - 0.07 * smooth(50, 80, vh);
  const ige = 1 + 0.15 * (1 - smooth(0, 11, agl));                         // markeffekt
  // virvelringstillstånd: snabb sjunkning nästan utan framfart tappar lyftkraft
  // (hovringsstödet håller rotorn ur virvelringen åt dig)
  const vrs = S.assist ? 0 : smooth(4.5, 8, sink) * (1 - smooth(6, 13, vh)) * smooth(4, 12, agl);
  S.vrs = vrs;
  // ---- kollektiv: direkt från spaken, eller via hovringsstödet/autopiloten (spaken = önskad stig/sjunkfart) ----
  let coll = S.thr;
  S.vsCmd = null;
  if (S.apVs != null || S.assist) {
    let vsC;
    if (S.apVs != null) vsC = S.apVs;
    else {
      const L = S.thr;
      // reglaget: mitten håller höjden, upp = stig upp till 2000 ft/min, ner = sjunk upp till 2000 ft/min
      vsC = L > 0.58 ? (L - 0.58) / 0.42 * 10 : L < 0.42 ? (L - 0.42) / 0.42 * 10 : 0;
    }
    // mjuk sättning: sjunket avtar som en utflytning de sista metrarna (ca 120 ft/min vid sättningen)
    if (vsC < 0) vsC = Math.max(vsC, -Math.max(0.6, agl * 0.75));
    S.vsCmd = vsC;
    if (S.onGround && vsC <= 0.05) { coll = 0.3; S.vsI = 0; }
    else {
      const tilt = Math.max(Math.cos(S.pitch) * Math.cos(S.bank), 0.5);
      const ff = 1 / (1.55 * etl * ige * (1 - 0.32 * vrs) * tilt);
      S.vsI = clamp((S.vsI || 0) + (vsC - S.vel.y) * dt * 0.05, -0.15, 0.15);
      coll = clamp(ff + (vsC - S.vel.y) * 0.11 + S.vsI, 0.12, 1);
    }
  }
  S.coll = coll;
  // motor och rotor: kollektivet följs med kort fördröjning
  S.n1 += (coll - S.n1) * (1 - Math.exp(-dt * 4));
  const T = S.n1 * A.Tmax * etl * ige * (1 - 0.32 * vrs) * (rho / 1.225);
  S.T = T; S.tq = S.n1 * 100 / 0.9 * (1 - 0.12 * smooth(7, 17, vh));
  _F.set(0, T, 0);
  // kroppsmotstånd och rotordämpning
  _F.x -= 0.5 * rho * 6 * vb.x * Math.abs(vb.x) + m * 0.05 * vb.x;
  _F.z -= 0.5 * rho * 2.4 * vb.z * Math.abs(vb.z) + m * 0.02 * vb.z;
  _F.y -= 0.5 * rho * 12 * vb.y * Math.abs(vb.y) + m * 0.2 * vb.y;
  const nz = T / (m * g);
  _Fw.copy(_F).applyQuaternion(S.q);
  _Fw.y -= m * g;
  // ---- styrning: attitydkommando (SAS), kvickt men förlåtande ----
  const { e, r } = S.inp;
  const fwd = smooth(8, 24, vh);                 // 0 = hovring, 1 = framfart
  const ground = S.onGround && coll < 0.58;
  const auth = ground ? 0.15 : 1;
  let pitchT = ((S.htrim || 0) + e * 26) * DEG;            // spaken bakåt = nosen upp = bromsa
  let bankT = r * (14 + 36 * fwd) * DEG;
  S.posHold = false; S.vfT = null;
  if (S.assist && S.apVs == null && !(S.onGround && coll < 0.5)) {
    // hovringsstödet: spaken styr farten framåt i stället för nosvinkeln.
    // Släppt spak = helikoptern bromsar själv till marschfarten (TRIM), eller till stillastående hovring.
    const h = S.hdg * DEG, fx = Math.sin(h), fz = -Math.cos(h);
    const vf = S.vel.x * fx + S.vel.z * fz, vr = S.vel.x * -fz + S.vel.z * fx;
    const cruise = S.hspd || 0, vmax = 72;
    const vfT = e < 0 ? cruise + (-e) * (vmax - cruise) : cruise - e * (cruise + 8);
    S.vfT = vfT;
    const I = S.holdI || (S.holdI = [0, 0]);
    // framåtlutning som behövs för att hålla farten (luftmotståndet), plus rättning mot målfarten
    const va = vfT, ff = -Math.atan((0.5 * rho * 2.4 * va * Math.abs(va) + m * 0.02 * va) / (m * g)) / DEG;
    const err = vf - vfT;
    I[0] = clamp(I[0] + err * dt * 0.35, -8, 8);
    pitchT = clamp(ff + err * 1.4 + I[0], -24, 22) * DEG;
    if (Math.abs(r) < 0.06 && vh < 15) {
      // ingen sidodrift vid låg fart, även i sidvind
      I[1] = clamp(I[1] - vr * dt * 0.9, -9, 9);
      bankT += clamp(-vr * 1.6 + I[1], -14, 14) * DEG;
    } else I[1] *= 0.98;
    S.posHold = Math.abs(vfT) < 0.3 && Math.abs(r) < 0.06 && Math.hypot(S.vel.x, S.vel.z) < 2;
  } else if (S.holdI) { S.holdI[0] *= 0.98; S.holdI[1] *= 0.98; }
  const qT = clamp((pitchT - S.pitch) * 3.2, -1.3, 1.3);
  const pT = clamp((bankT - S.bank) * 3.4, -1.5, 1.5);
  let ax = auth * 9 * (qT - S.w.x);
  let az = auth * 9 * (-pT - S.w.z);
  // gir: i hovring svänger spaken åt sidan nosen, i framfart koordinerad sväng
  const pedal = clamp(S.inp.rud, -1, 1); // pedaler (Q/E)
  let yawRate = pedal * 0.8 + r * 0.75 * (1 - fwd) + (vh > 10 ? (g / Math.max(vh, 10)) * Math.tan(S.bank) * fwd : 0);
  if (Math.abs(yawRate) > 0.02 || S.hdgHold == null) S.hdgHold = S.hdg;
  else { const err = ((S.hdgHold - S.hdg + 540) % 360) - 180; yawRate = clamp(err * DEG * 1.2, -0.3, 0.3); }
  // vridmomentet: mer kollektiv vrider nosen lite åt höger tills stjärtrotorn hinner ikapp
  const dq = (S.n1 - (S.n1Prev == null ? S.n1 : S.n1Prev)) / dt; S.n1Prev = S.n1;
  let ay = (ground ? 0.2 : 1) * 7 * (-yawRate - S.w.y) - (ground ? 0 : clamp(dq, -1, 1) * 0.5);
  if (ground) { ax -= S.w.x * 4; az -= S.w.z * 4; }
  finishStep(S, dt, ax, ay, az, 0, nz, V, Math.atan2(-vb.y, Math.max(-vb.z, 0.1)), 0, agl, rho, false, 1);
  S.alpha = 0; S.stall = false;
}
if (typeof module !== 'undefined' && module.exports) Object.assign(module.exports, { AIRCRAFT, createState, step, setWind, activeEnd, attitude });
