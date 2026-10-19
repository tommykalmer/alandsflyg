// ===================== TID PÅ DYGNET: sol, måne, himmel, ljus och nattbelysning =====================
// Solens läge räknas fram för Åland i mitten av oktober (sommartid, UTC+3).
const TIMES = [
  { id: 'dawn', n: 'Dawn 08:10', h: 8.17 },
  { id: 'morning', n: 'Morning 09:30', h: 9.5 },
  { id: 'day', n: 'Midday 13:00', h: 13 },
  { id: 'golden', n: 'Sunset 17:50', h: 17.83 },
  { id: 'dusk', n: 'Dusk 18:50', h: 18.83 },
  { id: 'night', n: 'Night 23:00', h: 23 }
];
const TOD = { hour: 13, night: 0, sunEl: 20, light: 1 };
const LDIR = new THREE.Vector3().copy(SUN); // riktning till ljuskällan (sol eller måne)
const MOON = new THREE.Vector3();
{ const az = 150 * DEG, el = 28 * DEG; MOON.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)); }

// ---------- himmel med solglöd, stjärnor och måne ----------
const SKYU = {
  hor: { value: HORIZON }, zen: { value: ZENITH }, sun: { value: SUN }, moon: { value: MOON },
  sunCol: { value: new THREE.Color(1, 0.92, 0.75) }, glow: { value: 0.2 }, disc: { value: 1 }, stars: { value: 0 }, moonA: { value: 0 }
};
sky.material = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, uniforms: SKYU,
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform vec3 hor; uniform vec3 zen; uniform vec3 sun; uniform vec3 moon; uniform vec3 sunCol;
uniform float glow; uniform float disc; uniform float stars; uniform float moonA;
varying vec3 vD;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
  vec3 d = normalize(vD); float h = d.y;
  vec3 c = mix(hor, zen, pow(clamp(h, 0.0, 1.0), 0.5));
  if (h < 0.0) c = mix(hor, hor * 0.35, clamp(-h * 6.0, 0.0, 1.0));
  // glöd kring solen, även när den har gått ner
  vec2 dh = normalize(d.xz + 1e-5), sh = normalize(sun.xz + 1e-5);
  float az = max(dot(dh, sh), 0.0);
  float band = exp(-max(h, 0.0) * 7.0) * pow(az, 3.0);
  c += sunCol * band * glow;
  float s = max(dot(d, sun), 0.0);
  c += sunCol * (pow(s, 1400.0) * 3.0 + pow(s, 14.0) * 0.25) * disc;
  // stjärnor
  if (stars > 0.01 && h > 0.0) {
    vec3 p = d * 380.0, i = floor(p), f = fract(p) - 0.5;
    float r = hash(i);
    float st = step(0.9975, r) * smoothstep(0.32, 0.0, length(f)) * (0.4 + 0.6 * fract(r * 913.7));
    c += vec3(0.9, 0.93, 1.0) * st * stars * smoothstep(0.0, 0.15, h);
  }
  // måne
  float m = dot(d, moon);
  c += vec3(0.92, 0.93, 0.88) * smoothstep(0.99993, 0.99996, m) * moonA + vec3(0.25, 0.3, 0.4) * pow(max(m, 0.0), 60.0) * 0.25 * moonA;
  gl_FragColor = vec4(c, 1.0);
}`
});

// ---------- nattljus: punkter som lyser i mörkret ----------
const LIGHTU = { uNight: { value: 0 }, uTime: { value: 0 }, uPx: { value: 300 }, uFog: { value: 0.000026 } };
function lightMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: LIGHTU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 color; attribute float size; attribute vec3 fl;
uniform float uNight; uniform float uTime; uniform float uPx; uniform float uFog;
varying vec3 vC; varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float d = max(-mv.z, 0.5);
  float px = size * uPx / d;
  float a = max(uNight, fl.z);
  if (fl.x > 0.0) { float ph = fract(uTime * fl.x + fl.y); a *= step(ph, 0.08) + step(0.16, ph) * step(ph, 0.2) * step(1.5, fl.x); }
  // flygfältens ljus (som även lyser i dagsljus) hålls synliga långt bort
  float lo = fl.z > 0.2 ? 0.75 : 0.22;
  a *= clamp(px / 1.8, lo, 1.0) * exp(-d * uFog * (fl.z > 0.2 ? 0.2 : 0.35));
  vA = a; vC = color;
  gl_PointSize = clamp(px * 3.0, fl.z > 0.2 ? 3.4 : 2.2, 90.0);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `varying vec3 vC; varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float core = smoothstep(0.38, 0.0, r), halo = exp(-r * r * 5.0);
  gl_FragColor = vec4(vC * (core * 1.3 + halo * 0.55) * vA, 1.0);
}`
  });
}
// samlar ljuspunkter: pos, färg, storlek (m), blink [Hz, fas, dagsljus]
function LightSet() { this.p = []; this.c = []; this.s = []; this.f = []; }
LightSet.prototype.add = function (x, y, z, col, size, hz = 0, ph = 0, day = 0) {
  const c = new THREE.Color(col);
  this.p.push(x, y, z); this.c.push(c.r, c.g, c.b); this.s.push(size); this.f.push(hz, ph, day);
};
LightSet.prototype.build = function () {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
  g.setAttribute('size', new THREE.Float32BufferAttribute(this.s, 1));
  g.setAttribute('fl', new THREE.Float32BufferAttribute(this.f, 3));
  const pts = new THREE.Points(g, lightMaterial());
  pts.frustumCulled = false; pts.renderOrder = 5;
  return pts;
};

// ---------- bygg all nattbelysning ----------
let NIGHT_PTS = null;
const LAMP_SODIUM = 0xffaa4a, LAMP_LED = 0xfff1d6, WARM = 0xffd38a;
function buildNight() {
  const L = new LightSet(), R = rng(77);
  // gatubelysning längs de riktiga vägarna i och nära tätorterna (småvägar i regionen lyser via marktexturen)
  for (const r of MAPD.roads) {
    if (r.c > 6) continue;
    const q = r.pts, core = Math.abs(q[0]) < T_HALF && Math.abs(q[1]) < T_HALF;
    const step = core ? (r.c <= 3 ? 40 : 34) : 70;
    let carry = R() * step;
    for (let j = 2; j < q.length; j += 2) {
      const ax = q[j - 2], az = q[j - 1], bx = q[j], bz = q[j + 1], len = Math.hypot(bx - ax, bz - az);
      for (let d = carry; d < len; d += step) {
        const x = ax + (bx - ax) * d / len, z = az + (bz - az) * d / len, u = urbanAt(x, z);
        if (u < (core ? 0.12 : 0.25) && !(r.c <= 2 && u > 0.04)) continue;
        if (!isLand(x, z)) continue;
        L.add(x, terrainH(x, z) + (r.c <= 2 ? 10 : 7), z, r.c <= 2 || R() < 0.35 ? LAMP_LED : LAMP_SODIUM, r.c <= 2 ? 2.6 : 2.0);
      }
      carry = ((carry - len) % step + step) % step;
    }
  }
  // flygfälten
  for (const zn of ZONES) {
    if (zn.kind === 'scene') {
      // olycksplatsen: blinkande blått på ambulansen, syns även i dagsljus
      for (const [a, c, ph] of [[-1.2, -0.7, 0], [-1.2, 0.7, 0.5], [1.6, 0, 0.25]]) { const [x, z] = zoneWorld(zn, a + 6, c + 9); L.add(x, terrainH(x, z) + 3.9, z, 0x2a5bff, 2.2, 1.6, ph, 1); }
      for (const ph of [0, 0.5]) { const [x, z] = zoneWorld(zn, -8 + ph * 2, -10); L.add(x, terrainH(x, z) + 2.6, z, 0x2a5bff, 1.8, 1.3, ph + 0.1, 1); }
      continue;
    }
    if (zn.kind === 'helipad') {
      // landningsplatta: grön ring och vit strålkastare
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; L.add(zn.x + Math.cos(a) * 15, zn.elev + 0.4, zn.z + Math.sin(a) * 15, 0x3dff7a, 1.0, 0, 0, 0.1); }
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + 0.2; L.add(zn.x + Math.cos(a) * 6, zn.elev + 0.3, zn.z + Math.sin(a) * 6, 0xfff3d0, 0.8); }
      L.add(zn.x + 22, zn.elev + 7, zn.z - 22, 0xfff0d0, 4);
      continue;
    }
    // banljus är tända dygnet runt (svagare i dagsljus) så att banan syns på håll
    const big = zn.kind === 'asphalt', y = zn.elev + 0.5, edge = big ? 60 : 50, dayK = big ? 0.45 : 0.3;
    for (let a = -zn.len / 2; a <= zn.len / 2 + 0.1; a += edge) for (const sgn of [-1, 1]) {
      const [x, z] = zoneWorld(zn, a, sgn * (zn.wid / 2 + 1.5));
      L.add(x, y, z, big ? 0xfff6e0 : 0xfff0c8, big ? 1.8 : 1.3, 0, 0, dayK);
    }
    for (const end of [-1, 1]) for (let c = -zn.wid / 2; c <= zn.wid / 2 + 0.1; c += zn.wid / (big ? 10 : 5)) {
      const [x, z] = zoneWorld(zn, end * (zn.len / 2 + 3), c);
      L.add(x, y, z, 0x3dff7a, big ? 1.8 : 1.4, 0, 0, dayK);
    }
    if (big && zn.len >= 1000) {
      // mittlinjeljus var 30:e meter; de sista 300 m mot vardera banände lyser röda och vita om vartannat
      for (let a = -zn.len / 2 + 15; a <= zn.len / 2 - 15; a += 30) {
        const [x, z] = zoneWorld(zn, a, 0), fromEnd = zn.len / 2 - Math.abs(a);
        const red = fromEnd < 300 && Math.round(a / 30) % 2 === 0;
        L.add(x, zn.elev + 0.3, z, red ? 0xff3a2a : 0xf4f8ff, 1.3, 0, 0, 0.4);
      }
      // sättningszonens ljus: vita rader de första 600 m från vardera tröskeln
      if (zn.big) for (const end of [-1, 1]) for (let d = 60; d <= 600; d += 60) for (const c of [-12, -9, -6, 6, 9, 12]) {
        const [x, z] = zoneWorld(zn, end * (zn.len / 2 - d), c);
        L.add(x, zn.elev + 0.3, z, 0xfff6e8, 0.9, 0, 0, 0.25);
      }
    }
    if (!zn.big) continue;
    // inflygningsljus med blinkande "kanin" i båda riktningar
    for (const end of [-1, 1]) {
      for (let k = 1; k <= 20; k++) {
        const a = end * (zn.len / 2 + k * 30);
        for (const c of [-2, 0, 2]) { const [x, z] = zoneWorld(zn, a, c); L.add(x, Math.max(terrainH(x, z), 0) + 1.5, z, 0xfff3d8, 1.6, 0, 0, 0.35); }
        const [x, z] = zoneWorld(zn, a, 0); L.add(x, Math.max(terrainH(x, z), 0) + 2, z, 0xffffff, 3.2, 2, -k * 0.022, 0.6);
      }
      for (let c = -15; c <= 15; c += 3) { const [x, z] = zoneWorld(zn, end * (zn.len / 2 + 300), c); L.add(x, Math.max(terrainH(x, z), 0) + 1.5, z, 0xfff3d8, 1.6, 0, 0, 0.35); }
    }
  }
  for (const ap of AIRPORTS) {
    for (const [x, z] of ap.lights || []) L.add(x, ap.main.elev + 0.5, z, 0x4a7bff, 1.1);
    for (const [x, z] of ap.floods || []) L.add(x, ap.main.elev + 16, z, 0xfff0d0, 4.5);
  }
  // vindkraftverk: röda hinderljus som blinkar i takt
  for (const t of TURBINES) { const p = t.pos; L.add(p.x, p.y + 83, p.z, 0xff2a1a, 2.2, 0.5, 0, 0.6); }
  // fyrar på sina riktiga platser (OpenStreetMap)
  {
    const R2 = rng(9);
    const towerM = new THREE.MeshLambertMaterial({ color: 0xf2efe6 }), topM = new THREE.MeshLambertMaterial({ color: 0xb3261e });
    const tg = new THREE.CylinderGeometry(1.6, 2.2, 14, 8), cg = new THREE.CylinderGeometry(1.7, 1.7, 3, 8);
    for (const [x, z] of (MAPD.pois && MAPD.pois.lighthouse) || []) {
      const h = Math.max(terrainH(x, z), 0.5);
      const tw = new THREE.Mesh(tg, towerM); tw.position.set(x, h + 7, z); scene.add(tw);
      const top = new THREE.Mesh(cg, topM); top.position.set(x, h + 15.5, z); scene.add(top);
      L.add(x, h + 16, z, 0xffffff, 5, 0.2 + R2() * 0.15, R2(), 0);
    }
  }
  // hamnen och slottet
  for (const sp of SHIP_LIGHTS) L.add(sp[0], sp[1], sp[2], sp[3], sp[4]);
  {
    const [x, z] = geo(60.2295, 20.0838), h = terrainH(x, z);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; L.add(x + Math.cos(a) * 40, h + 2, z + Math.sin(a) * 40, 0xffe0a8, 3); }
  }
  NIGHT_PTS = L.build(); scene.add(NIGHT_PTS);
}

// ---------- flygplanets lampor ----------
const LANDLIGHT = new THREE.SpotLight(0xfff4e0, 0, 1400, 0.32, 0.55, 1);
LANDLIGHT.castShadow = false;
function addAircraftLights(model, A) {
  const L = new LightSet(), big = A.id === 'a320', heli = !!A.heli, tp = A.cls === 'tp';
  const tip = big ? [16.9, 0.1, 5.0] : tp ? [14.6, 1.35, 0.6] : heli ? [1.35, 0.72, 7.6] : [7.32, 1.0, -0.6], tail = big ? [0, 0.7, 23.2] : tp ? [0, 0.9, 16.4] : heli ? [0, 1.75, 9.4] : [0, 0.45, 6.1];
  const bcn = big ? [[0, 2.05, 0], [0, -2.05, 0]] : tp ? [[0, 1.35, 3], [0, -1.35, 0]] : heli ? [[0, 1.62, 1.6], [0, -0.85, 0.4]] : [[0, 1.42, 0.6]];
  L.add(-tip[0], tip[1], tip[2], 0xff2a20, (big || tp) ? 0.9 : 0.5, 0, 0, 0.15);
  L.add(tip[0], tip[1], tip[2], 0x30ff60, (big || tp) ? 0.9 : 0.5, 0, 0, 0.15);
  L.add(tail[0], tail[1], tail[2], 0xffffff, (big || tp) ? 0.8 : 0.45, 0, 0, 0.1);
  for (const b of bcn) L.add(b[0], b[1], b[2], 0xff3020, (big || tp) ? 1.2 : 0.7, 1, 0.5, 0.5);
  for (const s of [-1, 1]) L.add(s * (tip[0] - 0.2), tip[1], tip[2] + ((big || tp) ? 0.4 : 0.2), 0xffffff, (big || tp) ? 2.2 : 1.3, 1.6, 0, 0.6);
  const pts = L.build(); pts.userData.lights = true;
  model.group.add(pts);
  const lp = (big || tp) ? [0, -1.8, -12] : tp ? [0, -1.3, -8.6] : heli ? [0, -0.95, -2.0] : [-2.6, 0.85, -1.3];
  LANDLIGHT.position.set(...lp);
  if (heli) LANDLIGHT.target.position.set(lp[0], lp[1] - 120, lp[2] - 220); else LANDLIGHT.target.position.set(lp[0], lp[1] - 60, lp[2] - 420);
  model.group.add(LANDLIGHT, LANDLIGHT.target);
  // själva strålkastaren som en lysande punkt
  const LL = new LightSet(); LL.add(lp[0], lp[1] - 0.1, lp[2] - 0.3, 0xfff4e0, (big || tp) ? 1.6 : 0.8, 0, 0, 0);
  const lpts = LL.build(); lpts.material.uniforms = { uNight: { value: 0 }, uTime: LIGHTU.uTime, uPx: LIGHTU.uPx, uFog: LIGHTU.uFog };
  model.group.add(lpts); model.landPts = lpts;
}
function updateAircraftLights(S, model) {
  const on = TOD.night > 0.15 && (S.onGround || S.agl < 900 || (S.ac.retract ? S.gearDown : S.flap > 0) || (S.ac.heli && S.agl < 1500));
  LANDLIGHT.intensity = on ? 2.6 * TOD.night : 0;
  if (model.landPts) model.landPts.material.uniforms.uNight.value = on ? 1 : 0;
}

// ---------- byt tid ----------
const _c = new THREE.Color();
const mixHex = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), clamp(t, 0, 1));
function sunPosition(hour) {
  const lat = 60.2 * DEG, dec = -8.6 * DEG, H = (hour - 13.45) * 15 * DEG;
  const el = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H));
  const azS = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat)); // från syd mot väst
  const az = Math.PI + azS;
  return { el, az };
}
function setTimeOfDay(hour) {
  TOD.hour = hour;
  const { el, az } = sunPosition(hour), e = el / DEG;
  SUN.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  TOD.sunEl = e;
  const dayF = smooth(-3, 14, e), twi = smooth(-13, -1, e), golden = (1 - smooth(1, 14, e)) * smooth(-7, 1, e);
  const night = 1 - smooth(-9, -1, e);
  TOD.night = night; TOD.light = dayF;
  // himmel
  ZENITH.copy(mixHex(0x03060f, 0x1a2f5c, twi)).lerp(new THREE.Color(0x3a6fa3), dayF);
  HORIZON.copy(mixHex(0x0b1322, 0x4b5878, twi)).lerp(new THREE.Color(0xc4d3dc), dayF).lerp(new THREE.Color(0xe0a27a), golden * 0.55);
  SKYU.sunCol.value.copy(mixHex(0xff7a3a, 0xffe9c4, smooth(0, 16, e)));
  SKYU.glow.value = (0.25 * dayF + golden * 0.9 + (1 - dayF) * twi * 0.6) * smooth(-14, -3, e);
  SKYU.disc.value = smooth(-1.5, 0.5, e);
  SKYU.stars.value = smooth(0.35, 0.95, night);
  SKYU.moonA.value = smooth(0.2, 0.9, night);
  scene.background.copy(HORIZON);
  scene.fog.color.copy(HORIZON);
  // ljus
  const hemi = scene.children.find(o => o.isHemisphereLight);
  hemi.color.copy(mixHex(0x1b2640, 0xc3d6e8, dayF * 0.9 + twi * 0.1));
  hemi.groundColor.copy(mixHex(0x0b0f12, 0x4d5a3c, dayF));
  hemi.intensity = 0.16 + 0.46 * dayF + 0.14 * twi * (1 - dayF);
  if (e > -2) {
    LDIR.copy(SUN); if (LDIR.y < 0.05) LDIR.y = 0.05; LDIR.normalize();
    sunLight.color.copy(mixHex(0xff9a5a, 0xfff0d8, smooth(1, 18, e)));
    sunLight.intensity = 0.95 * smooth(-2, 6, e);
  } else {
    LDIR.copy(MOON); sunLight.color.setHex(0x8ea7d6); sunLight.intensity = 0.22 * night;
  }
  terrainUniforms.uSun.value = LDIR;
  terrainUniforms.uGlit.value = e > -2 ? 2.5 * smooth(-2, 4, e) : 0.3 * night;
  // moln
  for (const m of CLOUD_MATS) m.color.copy(mixHex(0x161b26, 0xffffff, clamp(dayF * 0.9 + twi * 0.45, 0, 1))).lerp(new THREE.Color(0xffa98a), golden * 0.7);
  // nattbelysning
  NIGHTU.value = smooth(0.25, 0.85, night + (1 - dayF) * 0.4);
  LIGHTU.uNight.value = smooth(0.15, 0.7, night + (1 - dayF) * 0.5);
  if (NIGHT_PTS) NIGHT_PTS.visible = LIGHTU.uNight.value > 0.02;
  for (const m of TMATS) m.emissiveIntensity = 1.6 * NIGHTU.value;
  scene.fog.density = FOG_BASE * (1 - 0.3 * night);
  LIGHTU.uFog.value = scene.fog.density;
  // diset lyser upp mot solen, varmast när solen står lågt
  HAZE.sun.x = SUN.x; HAZE.sun.y = SUN.y; HAZE.sun.z = SUN.z;
  const sc = SKYU.sunCol.value; HAZE.col.x = sc.r; HAZE.col.y = sc.g; HAZE.col.z = sc.b;
  HAZE.p.y = (0.35 * dayF + golden * 0.9 + twi * (1 - dayF) * 0.5) * smooth(-10, -2, e);
  // grundläge som vädret blandar från varje bildruta
  TOD.base = { zen: ZENITH.clone(), hor: HORIZON.clone(), sunI: sunLight.intensity, hemiI: hemi.intensity, disc: SKYU.disc.value, glow: SKYU.glow.value, glit: terrainUniforms.uGlit.value, haze: HAZE.p.y };
  drawEnv();
}
function lightsResize() {
  LIGHTU.uPx.value = renderer.domElement.height / (2 * Math.tan(camera.fov * DEG / 2));
}
