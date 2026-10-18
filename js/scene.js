// ===================== SCEN: renderer, himmel, terräng, landskap, flygplansmodeller =====================
const glCanvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const HORIZON = new THREE.Color(0xc4d3dc), ZENITH = new THREE.Color(0x3a6fa3);
scene.fog = new THREE.FogExp2(HORIZON.getHex(), 0.000026);
scene.background = HORIZON.clone();
const camera = new THREE.PerspectiveCamera(62, 1, 1.5, 100000);
let FOG_BASE = 0.000026;
const maxAniso = renderer.capabilities.getMaxAnisotropy();

// oktobersol: lågt i syd-sydväst
const SUN = new THREE.Vector3();
{ const az = 205 * DEG, el = 23 * DEG; SUN.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)); }

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(70000, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: { hor: { value: HORIZON }, zen: { value: ZENITH }, sun: { value: SUN } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 hor; uniform vec3 zen; uniform vec3 sun; varying vec3 vD; void main(){ float h = vD.y; vec3 c = mix(hor, zen, pow(clamp(h,0.0,1.0), 0.5)); if (h < 0.0) c = mix(hor, vec3(0.16,0.26,0.30), clamp(-h*6.0,0.0,1.0)); float s = max(dot(normalize(vD), sun), 0.0); c += vec3(1.0,0.92,0.75) * pow(s, 900.0) * 1.6 + vec3(1.0,0.86,0.62) * pow(s, 10.0) * 0.22; gl_FragColor = vec4(c, 1.0); }'
  })
);
sky.renderOrder = -10;
scene.add(sky);
scene.add(new THREE.HemisphereLight(0xc3d6e8, 0x4d5a3c, 0.62));
const sunLight = new THREE.DirectionalLight(0xfff0d8, 0.95);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.bias = -0.0006;
sunLight.shadow.camera.near = 1; sunLight.shadow.camera.far = 1500;
scene.add(sunLight, sunLight.target);

// delade tillstånd för tid på dygnet
const NIGHTU = { value: 0 };
const CLOUD_MATS = [], SHIP_LIGHTS = [];

function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.anisotropy = maxAniso; return t;
}
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0) / 4294967296); }

// ---------- data: avkoda masken ----------
function loadImage(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }
async function decodeTiles(uris, TW, TH, cols, NX, NZ) {
  const mask = new Uint8Array(NX * NZ);
  const cv = document.createElement('canvas'); cv.width = TW; cv.height = TH;
  const g = cv.getContext('2d', { willReadFrequently: true });
  for (let k = 0; k < uris.length; k++) {
    const im = await loadImage(uris[k]);
    g.clearRect(0, 0, TW, TH); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, TW, TH).data, oy = Math.floor(k / cols) * TH, ox = (k % cols) * TW;
    for (let y = 0; y < TH; y++) { const row = (oy + y) * NX + ox; for (let x = 0; x < TW; x++) mask[row + x] = d[(y * TW + x) * 4] > 127 ? 1 : 0; }
  }
  return mask;
}
async function decodeMask() {
  const R = ALAND_DATA.region;
  const core = await decodeTiles(ALAND_DATA.mask, 2048, 2048, 2, 4096, 4096);
  const reg = await decodeTiles(R.tiles, R.nx / R.tx, R.nz / R.tz, R.tx, R.nx, R.nz);
  return [core, reg];
}

// ---------- terräng: 2×2 delar med målad textur (17,6 m per pixel) ----------
const TC = {
  deep: [26, 52, 66], mid: [36, 74, 88], shallow: [64, 112, 118], surf: [96, 140, 140],
  granite: [160, 128, 116], granite2: [132, 112, 104], forest: [40, 62, 35], forest2: [56, 78, 40],
  field: [154, 148, 85], field2: [110, 133, 64], field3: [179, 160, 102], grass: [88, 113, 47], town: [92, 110, 72], town2: [104, 118, 80]
};
const detailTex = canvasTex(256, 256, (g, W, H) => {
  const id = g.createImageData(W, H), R = rng(5);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = 0.5 + vnoise(x / 9, y / 9) * 0.22 + vnoise(x / 3.1 + 40, y / 3.1) * 0.14 + (R() - 0.5) * 0.12;
    const c = clamp(v * 255, 0, 255), i = (y * W + x) * 4; id.data[i] = id.data[i + 1] = id.data[i + 2] = c; id.data[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
});
detailTex.wrapS = detailTex.wrapT = THREE.RepeatWrapping;
const terrainUniforms = { detailMap: { value: detailTex }, uDetail: { value: 420.0 }, uTime: { value: 0 }, uHor: { value: HORIZON }, uZen: { value: ZENITH }, uSun: { value: SUN }, uGlit: { value: 2.5 } };
// Phong-terräng där vattnet (alfa < 0,9 i texturen) får vågor, himmelsreflex och solglitter
function terrainMaterial(map) {
  const m = new THREE.MeshPhongMaterial({ map, shininess: 90, specular: 0xb4c4d0 });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { detailMap: terrainUniforms.detailMap, uDetail: terrainUniforms.uDetail, uTime: terrainUniforms.uTime, uHor: terrainUniforms.uHor, uZen: terrainUniforms.uZen, uSun: terrainUniforms.uSun, uGlit: terrainUniforms.uGlit });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n  vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWPos; varying vec3 vWN;
uniform sampler2D detailMap; uniform float uDetail; uniform float uTime; uniform float uGlit;
uniform vec3 uHor; uniform vec3 uZen; uniform vec3 uSun;
float isWater = 0.0;
vec3 waveN = vec3(0.0, 1.0, 0.0);
vec2 waveGrad(vec2 p) {
  vec2 g = vec2(0.0);
  float t = uTime;
  vec2 q1 = p * 0.0021 + vec2(t * 0.011, t * 0.006);
  vec2 q2 = p * 0.0067 + vec2(-t * 0.017, t * 0.013);
  vec2 q3 = p * 0.019 + vec2(t * 0.031, -t * 0.024);
  float e = 1.0 / 256.0;
  float a1 = texture2D(detailMap, q1).r, a2 = texture2D(detailMap, q2).r, a3 = texture2D(detailMap, q3).r;
  g += vec2(texture2D(detailMap, q1 + vec2(e, 0.0)).r - a1, texture2D(detailMap, q1 + vec2(0.0, e)).r - a1) * 3.0;
  g += vec2(texture2D(detailMap, q2 + vec2(e, 0.0)).r - a2, texture2D(detailMap, q2 + vec2(0.0, e)).r - a2) * 2.2;
  g += vec2(texture2D(detailMap, q3 + vec2(e, 0.0)).r - a3, texture2D(detailMap, q3 + vec2(0.0, e)).r - a3) * 1.4;
  return g;
}`)
      .replace('#include <map_fragment>', `#ifdef USE_MAP
  vec4 texelColor = texture2D( map, vUv );
  isWater = step( texelColor.a, 0.9 );
  texelColor = mapTexelToLinear( texelColor );
  float det = texture2D( detailMap, vWPos.xz * 0.01167 ).r;
  float det2 = texture2D( detailMap, vWPos.xz * 0.0016 + 0.31 ).r;
  float det3 = texture2D( detailMap, vWPos.xz * 0.0478 ).r;
  float camD = length(cameraPosition - vWPos);
  float nearK = 1.0 - smoothstep(300.0, 1600.0, camD);
  texelColor.rgb *= mix( (0.72 + det * 0.56) * (0.82 + det2 * 0.36) * mix(1.0, 0.8 + det3 * 0.4, nearK), 1.0, isWater );
  // branta partier blir röd granit (rapakivi) som på Ålands klippor
  float slope = 1.0 - clamp(vWN.y, 0.0, 1.0);
  float rock = smoothstep(0.1, 0.24, slope + (det2 - 0.5) * 0.08) * (1.0 - isWater);
  vec3 gran = vec3(0.60, 0.47, 0.43) * (0.75 + det * 0.5);
  texelColor.rgb = mix(texelColor.rgb, gran * gran * 1.15, rock * 0.8);
  diffuseColor.rgb *= texelColor.rgb;
#endif
  if (isWater > 0.5) { float fade = 1.0 - smoothstep(1500.0, 9000.0, length(cameraPosition - vWPos)); vec2 g = waveGrad(vWPos.xz) * (0.35 + 0.65 * fade); waveN = normalize(vec3(-g.x, 1.0, -g.y)); }`)
      .replace('#include <specularmap_fragment>', 'float specularStrength = isWater;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  if (isWater > 0.5) normal = normalize((viewMatrix * vec4(waveN, 0.0)).xyz);')
      .replace('#include <fog_fragment>', `if (isWater > 0.5) {
    vec3 V = normalize(cameraPosition - vWPos);
    vec3 R = reflect(-V, waveN);
    float fr = 0.02 + 0.98 * pow(1.0 - max(dot(V, waveN), 0.0), 5.0);
    vec3 skyc = mix(uHor, uZen, pow(clamp(R.y, 0.0, 1.0), 0.5));
    float glit = pow(max(dot(R, uSun), 0.0), 700.0) * uGlit;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, skyc, clamp(fr * 0.9, 0.0, 0.75)) + vec3(1.0, 0.95, 0.85) * glit;
  }
  #include <fog_fragment>`);
  };
  return m;
}
function buildSea() {
  const t = canvasTex(4, 4, g => { const id = g.createImageData(4, 4); for (let i = 0; i < 16; i++) { id.data[i * 4] = TC.deep[0]; id.data[i * 4 + 1] = TC.deep[1]; id.data[i * 4 + 2] = TC.deep[2]; id.data[i * 4 + 3] = 200; } g.putImageData(id, 0, 0); });
  t.premultiplyAlpha = false;
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(240000, 240000, 48, 48).rotateX(-Math.PI / 2), terrainMaterial(t));
  // havsplanet ritas först utan djup: terrängens vatten ligger alltid ovanpå (ingen z-fighting på avstånd)
  sea.material.depthWrite = false; sea.renderOrder = -5;
  sea.position.y = -0.4; scene.add(sea);
}

// ---------- banor, PAPI, vindstrutar ----------
function helipadTexture(zn) {
  return canvasTex(256, 256, (g, Wd, Ht) => {
    g.fillStyle = '#55595c'; g.fillRect(0, 0, Wd, Ht);
    for (let i = 0; i < 2500; i++) { const c = 70 + Math.random() * 30; g.fillStyle = `rgba(${c},${c},${c},.4)`; g.fillRect(Math.random() * Wd, Math.random() * Ht, 2, 2); }
    g.strokeStyle = '#f2f2ea'; g.lineWidth = 6; g.strokeRect(5, 5, Wd - 10, Ht - 10);
    g.lineWidth = 9; g.beginPath(); g.arc(Wd / 2, Ht / 2, Wd * 0.38, 0, Math.PI * 2); g.stroke();
    // rött kors med vitt H
    g.fillStyle = '#c8102e'; const a = Wd * 0.13, b = Wd * 0.3;
    g.fillRect(Wd / 2 - a, Ht / 2 - b, a * 2, b * 2); g.fillRect(Wd / 2 - b, Ht / 2 - a, b * 2, a * 2);
    g.fillStyle = '#ffffff'; const hw = Wd * 0.035, hh = Wd * 0.11, hx = Wd * 0.07;
    g.fillRect(Wd / 2 - hx - hw, Ht / 2 - hh, hw * 2, hh * 2); g.fillRect(Wd / 2 + hx - hw, Ht / 2 - hh, hw * 2, hh * 2); g.fillRect(Wd / 2 - hx, Ht / 2 - hw * 0.8, hx * 2, hw * 1.6);
  });
}
function runwayTexture(zn) {
  if (zn.kind === 'helipad') return helipadTexture(zn);
  const asphalt = zn.kind === 'asphalt';
  return canvasTex(128, asphalt ? 4096 : 1024, (g, Wd, Ht) => {
    const ay = Ht / zn.len, ax = Wd / zn.wid;
    g.fillStyle = asphalt ? '#4a4d50' : '#6a8a3c'; g.fillRect(0, 0, Wd, Ht);
    for (let i = 0; i < (asphalt ? 9000 : 3000); i++) {
      const c = 40 + Math.random() * 40;
      g.fillStyle = asphalt ? `rgba(${c},${c},${c + 3},.5)` : `rgba(${60 + Math.random() * 50},${90 + Math.random() * 50},30,.35)`;
      g.fillRect(Math.random() * Wd, Math.random() * Ht, 1 + Math.random() * 2, 1 + Math.random() * 3);
    }
    if (!asphalt) {
      for (let y = 0; y < zn.len; y += 25) { g.fillStyle = (y / 25) % 2 ? 'rgba(255,255,200,.07)' : 'rgba(0,30,0,.08)'; g.fillRect(0, y * ay, Wd, 25 * ay); }
      g.fillStyle = '#f2f2ea';
      for (let y = 10; y < zn.len; y += 60) { g.fillRect(2, y * ay, 2.2 * ax, 3 * ay); g.fillRect(Wd - 2 - 2.2 * ax, y * ay, 2.2 * ax, 3 * ay); }
      for (const yy of [6, zn.len - 9]) for (let x = 2; x < zn.wid - 2; x += 4) g.fillRect(x * ax, yy * ay, 2 * ax, 3 * ay);
      return;
    }
    g.fillStyle = '#f0f0ea';
    g.fillRect(1.5 * ax, 0, 0.9 * ax, Ht); g.fillRect(Wd - 2.4 * ax, 0, 0.9 * ax, Ht);
    for (let y = 130; y < zn.len - 130; y += 50) g.fillRect(Wd / 2 - 0.45 * ax, y * ay, 0.9 * ax, 30 * ay);
    const piano = top => { for (let k = 0; k < 6; k++) { const x1 = 3 + k * 3; g.fillRect(x1 * ax, top * ay, 1.8 * ax, 30 * ay); g.fillRect(Wd - (x1 + 1.8) * ax, top * ay, 1.8 * ax, 30 * ay); } };
    piano(6); piano(zn.len - 36);
    for (const y of [300, zn.len - 345]) { g.fillRect(6 * ax, y * ay, 6 * ax, 45 * ay); g.fillRect(Wd - 12 * ax, y * ay, 6 * ax, 45 * ay); }
    for (const y of [150, 450, zn.len - 168, zn.len - 468]) { g.fillRect(8 * ax, y * ay, 3 * ax, 18 * ay); g.fillRect(Wd - 11 * ax, y * ay, 3 * ax, 18 * ay); }
    const num = (txt, yc, flip) => {
      g.save(); g.translate(Wd / 2, yc * ay); g.scale(ax, ay); if (flip) g.rotate(Math.PI);
      g.font = '700 18px "Arial Narrow", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(txt, 0, 0); g.restore();
    };
    num(zn.ends[0], zn.len - 60, false); num(zn.ends[1], 60, true);
  });
}
const PAPI = [], PAPI_TH = [3.5, 3.17, 2.83, 2.5];
const WINDSOCKS = [];
// byggnader med fönster: rutor i fasaden, en del tänds när det blir mörkt
function windowMaterial(color = 0xffffff) {
  const m = new THREE.MeshLambertMaterial({ color });
  m.onBeforeCompile = sh => {
    sh.uniforms.uNight = NIGHTU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBP; varying vec3 vBN;')
      .replace('#include <project_vertex>', `#include <project_vertex>
  vec4 bp = vec4(transformed, 1.0); vec3 bn = objectNormal;
  #ifdef USE_INSTANCING
    bp = instanceMatrix * bp; bn = mat3(instanceMatrix) * bn;
  #endif
  vBP = (modelMatrix * bp).xyz; vBN = normalize(mat3(modelMatrix) * bn);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vBP; varying vec3 vBN; uniform float uNight;\nfloat wh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  if (abs(vBN.y) < 0.4) {
    vec2 hn = normalize(vBN.xz);
    float along = dot(vBP.xz, vec2(-hn.y, hn.x));
    float fx = fract(along / 3.2), fy = fract((vBP.y - 0.6) / 3.1);
    float win = step(0.28, fx) * step(fx, 0.72) * step(0.32, fy) * step(fy, 0.78);
    vec3 cell = vec3(floor(along / 3.2), floor((vBP.y - 0.6) / 3.1), floor(dot(vBP.xz, hn) * 0.2));
    float r = wh(cell);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.2, 0.26), win * 0.85);
    float lit = step(0.62, r) * win * uNight;
    totalEmissiveRadiance += mix(vec3(1.0, 0.72, 0.38), vec3(0.85, 0.9, 1.0), step(0.93, r)) * lit * (0.7 + 0.5 * fract(r * 37.0));
  }`);
  };
  return m;
}
function buildAirfields() {
  const papiGeo = new THREE.SphereGeometry(1.1, 8, 6);
  const apronMat = new THREE.MeshLambertMaterial({ color: 0x4d4f50, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  const bmat = windowMaterial(0xd9d6cf), roof = new THREE.MeshLambertMaterial({ color: 0x5a5f63 }), hang = new THREE.MeshLambertMaterial({ color: 0x9aa3a8 });
  const ambM = new THREE.MeshLambertMaterial({ color: 0xd6e021 }), ambS = new THREE.MeshLambertMaterial({ color: 0x1f5fd0 }), polM = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }), wheelM = new THREE.MeshLambertMaterial({ color: 0x151515 });
  for (const zn of ZONES) {
    if (zn.kind === 'scene') {
      // olycksplats: ambulans och polisbil på marken
      const car = (w, h, l, along, across, mat, ang = 0) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat); const [x, z] = zoneWorld(zn, along, across);
        b.position.set(x, terrainH(x, z) + h / 2 + 0.9, z); b.rotation.y = -zn.hdg * DEG + ang; b.castShadow = true; scene.add(b); return b;
      };
      car(2.4, 2.6, 6.4, 6, 9, ambM); car(2.44, 0.4, 6.42, 6, 9, ambS).position.y += 0.2;
      car(1.8, 0.9, 4.6, -7, -10, polM, 0.4); car(1.6, 0.6, 2.2, -7, -10, ambS, 0.4).position.y += 0.7;
      for (const [al, ac] of [[4, 8], [8, 8], [4, 10], [8, 10]]) car(0.3, 0.7, 0.7, al, ac, wheelM).position.y -= 1.3;
      continue;
    }
    if (zn.kind === 'helipad') {
      // upphöjd betongplatta som når ner i marken även i sluttning
      const side = new THREE.MeshLambertMaterial({ color: 0x8d9093 }), top = new THREE.MeshLambertMaterial({ map: runwayTexture(zn) });
      const m = new THREE.Mesh(new THREE.BoxGeometry(zn.wid, 4, zn.len), [side, side, top, side, side, side]);
      m.position.set(zn.x, zn.elev - 2, zn.z); m.rotation.y = -zn.hdg * DEG; m.receiveShadow = true; scene.add(m);
    } else {
      const g = new THREE.PlaneGeometry(zn.wid, zn.len).rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: runwayTexture(zn), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
      m.position.set(zn.x, zn.elev + 0.05, zn.z); m.rotation.y = -zn.hdg * DEG; m.receiveShadow = true;
      scene.add(m);
    }
    // vindstrut
    const [sx, sz] = zn.kind === 'helipad' ? zoneWorld(zn, 0, -(zn.wid / 2 + 12)) : zoneWorld(zn, zn.len * 0.15, -(zn.wid / 2 + 30));
    const sock = new THREE.Group(); sock.position.set(sx, zn.small ? terrainH(sx, sz) : zn.elev, sz);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6, 6), new THREE.MeshLambertMaterial({ color: 0xdddddd })); pole.position.y = 3; sock.add(pole);
    const cone = new THREE.Group(); cone.position.y = 5.8; sock.add(cone);
    const cg = new THREE.CylinderGeometry(0.45, 0.18, 3.6, 10, 1, true); cg.rotateX(Math.PI / 2); cg.translate(0, 0, 1.8);
    const cm = new THREE.Mesh(cg, new THREE.MeshLambertMaterial({ color: 0xff6a1a, side: THREE.DoubleSide })); cm.castShadow = true; cone.add(cm);
    scene.add(sock); WINDSOCKS.push(cone);
    if (zn.kind !== 'asphalt') continue;
    for (let end = 0; end < 2; end++) {
      const sgn = end === 0 ? 1 : -1, along = sgn * (-zn.len / 2 + Math.min(300, zn.len * 0.2));
      const set = { zn, along, sgn, lights: [] };
      for (let i = 0; i < 4; i++) {
        const mm = new THREE.Mesh(papiGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
        const [x, z] = zoneWorld(zn, along, -sgn * (zn.wid / 2 + 15 + i * 9));
        mm.position.set(x, zn.elev + 1, z); scene.add(mm); set.lights.push(mm);
      }
      PAPI.push(set);
    }
  }
  // flygplatsbyggnader: taxibana, platta, terminal och torn vid de stora fälten, hangar vid de små
  for (const ap of AIRPORTS) {
    const zn = ap.main, e = zn.elev;
    const place = (w, l, along, across, mat = apronMat) => {
      const a = new THREE.Mesh(new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2), mat);
      const [x, z] = zoneWorld(zn, along, across); a.position.set(x, e + 0.03, z); a.rotation.y = -zn.hdg * DEG; a.receiveShadow = true; scene.add(a);
    };
    const box = (w, h, l, along, across, mat) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat); const [x, z] = zoneWorld(zn, along, across);
      b.position.set(x, e + h / 2, z); b.rotation.y = -zn.hdg * DEG; b.castShadow = true; b.receiveShadow = true; scene.add(b);
    };
    ap.lights = []; ap.floods = [];
    if (ap.heli) {
      // sjukhuset bredvid helikopterplattan
      const hb = (w, h, l, along, across, mat) => {
        const [x, z] = zoneWorld(zn, along, across), g0 = Math.min(terrainH(x, z), terrainH(x + w / 2, z + l / 2), terrainH(x - w / 2, z - l / 2)) - 2;
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h + (zn.elev - g0), l), mat); b.position.set(x, (g0 + zn.elev + h) / 2, z); b.rotation.y = -zn.hdg * DEG; b.castShadow = b.receiveShadow = true; scene.add(b);
      };
      hb(34, 16, 60, 0, 52, bmat); hb(20, 8, 24, -38, 40, bmat);
      { const r = new THREE.Mesh(new THREE.BoxGeometry(36, 1, 62), roof), [x, z] = zoneWorld(zn, 0, 52); r.position.set(x, zn.elev + 16.5, z); r.rotation.y = -zn.hdg * DEG; scene.add(r); }
      ap.term = [zn.x, zn.z];
      continue;
    }
    if (!ap.big) {
      const sd = 1, ac = sd * (zn.wid / 2 + 45);
      box(18, 6, 22, zn.len * 0.25, ac, hang); place(40, 40, zn.len * 0.25, ac - sd * 25);
      ap.term = zoneWorld(zn, zn.len * 0.25, ac);
      continue;
    }
    const T = ap.terminal, sd = T.side, tx = sd * (zn.wid / 2 + 100), tl = zn.len * 0.9;
    place(18, tl, 0, tx);
    for (const f of [-0.45, -0.15, 0.2, 0.45]) place(70, 18, f * zn.len, sd * (zn.wid / 2 + 50));
    const apL = Math.min(260 + zn.len * 0.08, 520);
    place(150, apL, T.along, sd * (T.across - 95));
    box(26, 12, apL * 0.7, T.along, sd * T.across, bmat); box(28, 1, apL * 0.7 + 2, T.along, sd * T.across, roof);
    box(44, 15, 50, T.along + apL * 0.55, sd * (T.across + 5), roof);
    box(8, ap.icao === 'ESSA' ? 70 : 24, 8, T.along - apL * 0.45, sd * (T.across + 10), bmat);
    ap.term = zoneWorld(zn, T.along, sd * (T.across - 95));
    for (let a = -tl / 2; a <= tl / 2; a += 50) for (const c of [tx - 9, tx + 9]) ap.lights.push(zoneWorld(zn, a, c));
    for (const da of [-apL * 0.4, 0, apL * 0.4]) for (const dc of [-55, 55]) ap.floods.push(zoneWorld(zn, T.along + da, sd * (T.across - 95) + dc));
  }
}
function updatePAPI(eye) {
  for (const s of PAPI) {
    const [al] = zoneLocal(s.zn, eye.x, eye.z);
    const before = (al - s.along) * s.sgn < 0, d = Math.abs(al - s.along) + 1;
    const ang = Math.atan2(eye.y - s.zn.elev - 1, d) / DEG;
    s.lights.forEach((m, i) => { m.visible = before; m.material.color.setHex(ang > PAPI_TH[i] ? 0xffffff : 0xff2a1a); m.scale.setScalar(clamp(d / 500, 1, 9)); });
  }
}
function updateWindsocks(S) {
  const w = S.windNow, sp = Math.hypot(w.x, w.z);
  const yaw = Math.atan2(w.x, w.z);
  const droop = (1 - clamp(sp / 8, 0, 1)) * 1.2;
  for (const c of WINDSOCKS) { c.rotation.set(0, 0, 0); c.rotation.y = yaw; c.rotateX(droop); }
}

// ---------- landskap: skog, hus, Mariehamn, Kastelholm, vindkraft, moln ----------
const TURBINES = [];
// ---------- tät skog runt kameran (byggs om när kameran flyttar till en ny ruta) ----------
const NEAR = { cell: 350, rad: 4, key: '', cache: new Map(), con: null, dec: null };
function buildNearForest(conGeo, decGeo) {
  NEAR.con = new THREE.InstancedMesh(conGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), 24000);
  NEAR.dec = new THREE.InstancedMesh(decGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), 9000);
  NEAR.con.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(24000 * 3), 3);
  NEAR.dec.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(9000 * 3), 3);
  NEAR.con.count = NEAR.dec.count = 0;
  NEAR.con.frustumCulled = NEAR.dec.frustumCulled = false;
  scene.add(NEAR.con, NEAR.dec);
}
function nearCell(ci, cj) {
  const key = ci + ',' + cj;
  let c = NEAR.cache.get(key);
  if (c) return c;
  const R = rng((ci * 73856093) ^ (cj * 19349663)), C = NEAR.cell, con = [], dec = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const birch = [0xa88f3a, 0xa0702e, 0x7e5e2a, 0x6f7f36, 0x5c7330, 0x4f6a2c, 0xb39a48];
  const col = new THREE.Color();
  for (let k = 0; k < 420; k++) {
    const x = (ci + R()) * C, z = (cj + R()) * C;
    const t = terrainType(x, z);
    if (t !== 2 && !(t === 1 && R() < 0.25)) continue;
    // gläntor och glesare skog där bruset säger så
    if (vnoise(x / 260 + 7, z / 260 - 3) < -0.35 && R() < 0.8) continue;
    const h = terrainH(x, z); if (h < 0.8) continue;
    q.setFromAxisAngle(up, R() * 6);
    if (R() < 0.72) {
      const ht = 9 + R() * 15, wd = ht * (0.17 + R() * 0.06); s.set(wd, ht, wd);
      m.compose(p.set(x, h - 0.4, z), q, s);
      col.setHex(R() < 0.5 ? 0x34552e : 0x41633a).multiplyScalar(0.8 + R() * 0.35);
      con.push(m.clone(), col.clone());
    } else {
      const r = 2.2 + R() * 2.2; s.set(r, r * 1.6, r);
      m.compose(p.set(x, h + r * 1.05, z), q, s);
      col.setHex(birch[Math.floor(R() * birch.length)]).multiplyScalar(0.75 + R() * 0.3);
      dec.push(m.clone(), col.clone());
    }
  }
  c = { con, dec };
  if (NEAR.cache.size > 900) NEAR.cache.clear();
  NEAR.cache.set(key, c);
  return c;
}
function updateNearForest(pos) {
  if (!NEAR.con) return;
  // högt upp syns inte enskilda träd: hoppa över
  const ci = Math.floor(pos.x / NEAR.cell), cj = Math.floor(pos.z / NEAR.cell);
  const key = ci + ',' + cj + (pos.y > 2500 ? 'h' : '');
  if (key === NEAR.key) return;
  NEAR.key = key;
  let nc = 0, nd = 0;
  if (pos.y <= 2500) for (let a = -NEAR.rad; a <= NEAR.rad; a++) for (let b = -NEAR.rad; b <= NEAR.rad; b++) {
    const c = nearCell(ci + a, cj + b);
    for (let k = 0; k < c.con.length && nc < 24000; k += 2) { NEAR.con.setMatrixAt(nc, c.con[k]); NEAR.con.setColorAt(nc, c.con[k + 1]); nc++; }
    for (let k = 0; k < c.dec.length && nd < 9000; k += 2) { NEAR.dec.setMatrixAt(nd, c.dec[k]); NEAR.dec.setColorAt(nd, c.dec[k + 1]); nd++; }
  }
  NEAR.con.count = nc; NEAR.dec.count = nd;
  NEAR.con.instanceMatrix.needsUpdate = NEAR.dec.instanceMatrix.needsUpdate = true;
  if (NEAR.con.instanceColor) NEAR.con.instanceColor.needsUpdate = true;
  if (NEAR.dec.instanceColor) NEAR.dec.instanceColor.needsUpdate = true;
}
function buildScenery() {
  const R = rng(42);
  const conGeo = (() => {
    const a = new THREE.ConeGeometry(1, 0.62, 7, 1, true).toNonIndexed(); a.translate(0, 0.31, 0);
    const b = new THREE.ConeGeometry(0.72, 0.55, 7, 1, true).toNonIndexed(); b.translate(0, 0.72, 0);
    const t = new THREE.CylinderGeometry(0.08, 0.1, 0.12, 4, 1, true).toNonIndexed(); t.translate(0, -0.04, 0);
    const parts = [a, b, t], g = new THREE.BufferGeometry();
    for (const key of ['position', 'normal']) {
      const arr = []; for (const p of parts) arr.push(...p.attributes[key].array);
      g.setAttribute(key, new THREE.Float32BufferAttribute(arr, 3));
    }
    return g;
  })();
  const decGeo = new THREE.IcosahedronGeometry(1, 0);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  buildNearForest(conGeo, decGeo);
  // hamnen: fyrmastade barken och en stor färja i Västerhamn
  const nearestWater = (x, z, minD) => {
    for (let r = 0; r < 900; r += 20) for (let k = 0; k < 24; k++) {
      const a = k / 24 * Math.PI * 2, wx = x + Math.cos(a) * r, wz = z + Math.sin(a) * r;
      if (coastDist(wx, wz) < -minD) return [wx, wz];
    }
    return null;
  };
  const alongCoast = (x, z) => { const gx = coastDist(x + 30, z) - coastDist(x - 30, z), gz = coastDist(x, z + 30) - coastDist(x, z - 30); return Math.atan2(gz, -gx); };
  const lam = (cl) => new THREE.MeshLambertMaterial({ color: cl });
  {
    const [bx, bz] = geo(60.0995, 19.9295), pw = nearestWater(bx, bz, 25);
    if (pw) {
      const g = new THREE.Group(); g.position.set(pw[0], 0, pw[1]); g.rotation.y = alongCoast(pw[0], pw[1]);
      const hull = new THREE.Mesh(new THREE.BoxGeometry(13, 7, 95), lam(0xe9e6df)); hull.position.y = 2.5; g.add(hull);
      const band = new THREE.Mesh(new THREE.BoxGeometry(13.2, 2.2, 95.2), lam(0x2a2d31)); band.position.y = 4.6; g.add(band);
      for (const zz of [-34, -12, 10, 32]) {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 48, 6), lam(0x8a6a44)); mast.position.set(0, 30, zz); g.add(mast);
        for (const yy of [16, 24, 32, 40, 47]) { const yard = new THREE.Mesh(new THREE.BoxGeometry(24 - (yy - 16) * 0.4, 0.4, 0.4), lam(0x5a4430)); yard.position.set(0, yy, zz); g.add(yard); }
      }
      g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
      g.updateMatrixWorld(true);
      const v = new THREE.Vector3();
      for (let zz = -45; zz <= 45; zz += 6) { v.set(0, 52 - Math.abs(zz) * 0.5, zz).applyMatrix4(g.matrixWorld); SHIP_LIGHTS.push([v.x, v.y, v.z, 0xffe6b0, 0.8]); }
      for (let zz = -44; zz <= 44; zz += 8) for (const sx of [-6.7, 6.7]) { v.set(sx, 5.5, zz).applyMatrix4(g.matrixWorld); SHIP_LIGHTS.push([v.x, v.y, v.z, 0xffd38a, 0.9]); }
    }
  }
  {
    const [fx, fz] = geo(60.0935, 19.9205), pw = nearestWater(fx, fz, 60);
    if (pw) {
      const g = new THREE.Group(); g.position.set(pw[0], 0, pw[1]); g.rotation.y = alongCoast(pw[0], pw[1]);
      const hull = new THREE.Mesh(new THREE.BoxGeometry(29, 12, 175), lam(0xf4f4f2)); hull.position.y = 4; g.add(hull);
      const bow = new THREE.Mesh(new THREE.CylinderGeometry(14.5, 14.5, 12, 3, 1, false, 0, Math.PI), lam(0xf4f4f2)); bow.rotation.y = Math.PI / 2; bow.position.set(0, 4, -87.5); bow.scale.set(1, 1, 1.6); g.add(bow);
      const sup = new THREE.Mesh(new THREE.BoxGeometry(27, 16, 120), lam(0xf8f8f6)); sup.position.set(0, 18, 8); g.add(sup);
      const sup2 = new THREE.Mesh(new THREE.BoxGeometry(24, 7, 70), lam(0xf8f8f6)); sup2.position.set(0, 29.5, 0); g.add(sup2);
      for (const yy of [13, 18, 23]) { const w = new THREE.Mesh(new THREE.BoxGeometry(27.3, 1.6, 116), lam(0x1d2a35)); w.position.set(0, yy, 8); g.add(w); }
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(29.3, 2.4, 175.2), lam(0xb3261e)); stripe.position.y = 7; g.add(stripe);
      const fun = new THREE.Mesh(new THREE.BoxGeometry(8, 12, 14), lam(0xb3261e)); fun.position.set(0, 38, 30); g.add(fun);
      g.traverse(o => { if (o.isMesh) { o.castShadow = true; } }); scene.add(g);
      g.updateMatrixWorld(true);
      const v = new THREE.Vector3(), R3 = rng(5);
      for (const yy of [13, 18, 23]) for (let zz = -50; zz <= 66; zz += 3.2) for (const sx of [-13.8, 13.8]) {
        if (R3() < 0.25) continue; v.set(sx, yy, zz).applyMatrix4(g.matrixWorld); SHIP_LIGHTS.push([v.x, v.y, v.z, R3() < 0.8 ? 0xffe2a8 : 0xd8e6ff, 0.55]);
      }
      for (const [xx, yy, zz, cl] of [[0, 34, -40, 0xffffff], [-14.5, 26, 10, 0xff2a20], [14.5, 26, 10, 0x30ff60], [0, 45, 30, 0xffffff]]) { v.set(xx, yy, zz).applyMatrix4(g.matrixWorld); SHIP_LIGHTS.push([v.x, v.y, v.z, cl, 1.3]); }
    }
  }
  // granitblock och hällar längs stränderna
  {
    const NBL = 5000, bg = new THREE.IcosahedronGeometry(1, 0);
    const bl = new THREE.InstancedMesh(bg, new THREE.MeshLambertMaterial({ color: 0xffffff }), NBL);
    let n = 0, tries = 0;
    while (n < NBL && tries < 400000) {
      tries++;
      const x = (R() - 0.5) * T_SIZE * 0.98, z = (R() - 0.5) * T_SIZE * 0.98, d = coastDist(x, z);
      if (d < -14 || d > 26) continue;
      if (inRunway(x, z, 300)) continue;
      const big = R() < 0.25, r = big ? 4 + R() * 6 : 1.2 + R() * 2.4;
      const flat = R() < 0.4;
      q.setFromEuler(new THREE.Euler(R() * 0.4, R() * 6, R() * 0.4));
      s.set(r * (flat ? 2.2 : 1), r * (flat ? 0.35 : 0.7), r * (flat ? 1.6 : 1));
      m.compose(p.set(x, Math.max(terrainH(x, z), 0) - r * 0.25, z), q, s); bl.setMatrixAt(n, m);
      c.setRGB(0.55 + R() * 0.12, 0.36 + R() * 0.08, 0.30 + R() * 0.06); bl.setColorAt(n, c); n++;
    }
    bl.count = n; bl.receiveShadow = true; scene.add(bl);
  }
  // Kastelholms slott
  {
    const [x, z] = geo(60.2295, 20.0838), h = terrainH(x, z), stone = new THREE.MeshLambertMaterial({ color: 0xcfc6b8 }), rf = new THREE.MeshLambertMaterial({ color: 0x5b3a2e });
    const g = new THREE.Group(); g.position.set(x, h, z); g.rotation.y = 0.4;
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(48, 16, 14), stone); b1.position.y = 8; g.add(b1);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(14, 14, 34), stone); b2.position.set(-20, 7, 16); g.add(b2);
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.5, 26, 12), stone); tw.position.set(18, 13, 4); g.add(tw);
    const tr = new THREE.Mesh(new THREE.ConeGeometry(7, 9, 12), rf); tr.position.set(18, 30.5, 4); g.add(tr);
    const r1 = new THREE.Mesh(new THREE.BoxGeometry(50, 3, 15), rf); r1.position.y = 17.5; g.add(r1);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(g);
  }
  // vindkraft (Eckerö och Lemland)
  const tMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
  for (const [la, lo] of [[60.207, 19.585], [60.212, 19.59], [60.217, 19.594], [60.064, 20.155], [60.069, 20.163], [60.059, 20.168]]) {
    const [x, z] = geo(la, lo); if (!isLand(x, z)) continue;
    const h = terrainH(x, z), g = new THREE.Group(); g.position.set(x, h, z);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.4, 80, 10), tMat); tower.position.y = 40; g.add(tower);
    const nac = new THREE.Group(); nac.position.y = 81; g.add(nac);
    const box = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 9), tMat); box.position.z = 2; nac.add(box);
    const rotor = new THREE.Group(); rotor.position.z = -3; nac.add(rotor);
    for (let k = 0; k < 3; k++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(1.6, 42, 0.4), tMat); bl.position.y = 21; const piv = new THREE.Group(); piv.rotation.z = k * 2.094; piv.add(bl); rotor.add(piv); }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(g); TURBINES.push({ nac, rotor, pos: new THREE.Vector3(x, h, z) });
  }
  // moln: varje moln är en klunga av skuggade tussar med plattare, gråare undersida
  const puff = canvasTex(128, 128, (g, Wd, Ht) => {
    for (let i = 0; i < 22; i++) {
      const x = 24 + R() * 80, y = 30 + R() * 60, r = 16 + R() * 26;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,.5)'); gr.addColorStop(0.6, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, Wd, Ht);
    }
    g.globalCompositeOperation = 'source-atop';
    const sh = g.createLinearGradient(0, 30, 0, 110);
    sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(120,132,148,.75)');
    g.fillStyle = sh; g.fillRect(0, 0, Wd, Ht);
  });
  const cmats = [0xffffff, 0xf2f4f7, 0xe6eaef].map(c => new THREE.SpriteMaterial({ map: puff, color: c, transparent: true, depthWrite: false, fog: true }));
  CLOUD_MATS.push(...cmats);
  for (let i = 0; i < 55; i++) {
    const cx = (R() - 0.5) * 90000, cz = (R() - 0.5) * 90000, base = 1250 + R() * 600, size = 500 + R() * 900;
    const n = 4 + Math.floor(R() * 4);
    for (let k = 0; k < n; k++) {
      const sp = new THREE.Sprite(cmats[Math.floor(R() * 3)]), sc = size * (0.55 + R() * 0.6);
      sp.scale.set(sc, sc * 0.62, 1);
      sp.position.set(cx + (R() - 0.5) * size * 1.6, base + R() * size * 0.35, cz + (R() - 0.5) * size * 1.1);
      scene.add(sp);
    }
  }
}
function updateTurbines(S, dt) {
  const w = S.wind, yaw = Math.atan2(-Math.sin(w.dir * DEG), Math.cos(w.dir * DEG));
  for (const t of TURBINES) { t.nac.rotation.y = yaw; t.rotor.rotation.z += dt * clamp(w.kt / 12, 0.15, 1.6); }
}

// ---------- uppdragsmarkörer ----------
const markerGroup = new THREE.Group(); scene.add(markerGroup);
const ringGeo = new THREE.TorusGeometry(40, 2.2, 8, 40);
function clearMarkers() { while (markerGroup.children.length) markerGroup.remove(markerGroup.children[0]); }
function addRing(x, y, z, hdg, active) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: active ? 0xf4c430 : 0x9aa9b4, transparent: true, opacity: active ? 0.95 : 0.4 }));
  m.position.set(x, y, z); m.rotation.y = -hdg * DEG; markerGroup.add(m); return m;
}
function addBeacon(x, y, z, r) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 600, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xf4c430, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  col.position.y = 300; g.add(col);
  const base = new THREE.Mesh(new THREE.RingGeometry(r * 0.92, r, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf4c430, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  base.position.y = 0.4; g.add(base);
  markerGroup.add(g); return g;
}

// ---------- flygplansmodeller ----------
let ENV = null;
function drawEnv() {
  // himmelsreflex (ekvirektangulär) för lack och glas, följer tiden på dygnet
  if (!ENV) { ENV = canvasTex(256, 128, () => {}); ENV.mapping = THREE.EquirectangularReflectionMapping; }
  const cv = ENV.image, g = cv.getContext('2d'), Wd = cv.width, Ht = cv.height;
  const hx = c => '#' + c.getHexString();
  const gr = g.createLinearGradient(0, 0, 0, Ht);
  gr.addColorStop(0, hx(ZENITH)); gr.addColorStop(0.46, hx(HORIZON)); gr.addColorStop(0.5, hx(HORIZON));
  gr.addColorStop(0.53, hx(HORIZON.clone().multiplyScalar(0.45))); gr.addColorStop(1, hx(HORIZON.clone().multiplyScalar(0.18)));
  g.fillStyle = gr; g.fillRect(0, 0, Wd, Ht);
  const az = Math.atan2(SUN.x, -SUN.z), el = Math.asin(clamp(SUN.y, -1, 1));
  if (el > -0.03) {
    const sx = ((az / (2 * Math.PI)) % 1 + 1) % 1 * Wd, sy = Ht * (0.5 - el / Math.PI);
    const sg = g.createRadialGradient(sx, sy, 0, sx, sy, 16); sg.addColorStop(0, 'rgba(255,240,215,1)'); sg.addColorStop(1, 'rgba(255,240,215,0)');
    g.fillStyle = sg; g.fillRect(0, 0, Wd, Ht);
  }
  ENV.needsUpdate = true;
}
function buildEnv() { drawEnv(); }
function phong(cl, sh = 50) {
  const refl = sh >= 100 ? 0.45 : sh >= 80 ? 0.22 : sh >= 60 ? 0.14 : sh >= 30 ? 0.06 : 0;
  return new THREE.MeshPhongMaterial({ color: cl, shininess: sh, specular: 0x4a4a4a, side: THREE.DoubleSide, envMap: refl ? ENV : null, reflectivity: refl, combine: THREE.MixOperation });
}
function mk(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; }
function cylZ(r1, r2, len, seg) { const g = new THREE.CylinderGeometry(r1, r2, len, seg); g.rotateX(-Math.PI / 2); return g; }
function wheel(r, w) { const g = new THREE.CylinderGeometry(r, r, w, 14); g.rotateZ(Math.PI / 2); return g; }
function rod(a, b, r, mat) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
  const m = mk(new THREE.CylinderGeometry(r, r, d.length(), 6), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}
function wingGeo(root, tip, span, sweep, th, side) {
  const tl = span * Math.tan(sweep * DEG), x = side * span, t2 = th * 0.45;
  const P = [[0, th / 2, 0], [0, th / 4, root], [x, t2 / 3, tl + tip], [x, t2 / 2, tl], [0, -th / 2, 0], [0, -th / 4, root], [x, -t2 / 3, tl + tip], [x, -t2 / 2, tl]];
  const F = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 3, 7, 4], [1, 5, 6, 2], [0, 4, 5, 1], [3, 2, 6, 7]];
  const arr = [];
  for (const [a, b, c, d] of F) for (const i of [a, b, c, a, c, d]) arr.push(...P[i]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals();
  return g;
}
function buildBeaver(floats) {
  const G = new THREE.Group();
  const red = phong(0xa3241b, 70), white = phong(0xeeeae0, 60), dark = phong(0x1c1f22, 20), glass = phong(0x22323d, 120), metal = phong(0xb4b8bb, 80), black = phong(0x121314, 10);
  const fus = mk(cylZ(0.64, 0.26, 7.6, 10), red, 0, 0, 1.25); fus.scale.set(0.92, 1.18, 1); fus.userData.body = true; G.add(fus);
  // motorkåpan döljs i cockpitvyn så att banan syns över nosen
  const cowl = mk(cylZ(0.58, 0.66, 1.05, 18), red, 0, 0.02, -3.05); cowl.userData.body = true; G.add(cowl);
  const cowl2 = mk(cylZ(0.5, 0.56, 0.12, 18), black, 0, 0.02, -3.6); cowl2.userData.body = true; G.add(cowl2);
  const sp = new THREE.ConeGeometry(0.17, 0.42, 12); sp.rotateX(-Math.PI / 2); const spm = mk(sp, metal, 0, 0.02, -3.82); spm.userData.body = true; G.add(spm);
  const prop = new THREE.Group(); prop.position.set(0, 0.02, -3.7);
  const blade = mk(new THREE.BoxGeometry(0.16, 2.6, 0.05), dark); blade.userData.body = true; prop.add(blade);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.3, 32), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  prop.add(disc); G.add(prop);
  const gl1 = mk(new THREE.BoxGeometry(1.2, 0.44, 1.9), glass, 0, 0.3, -1.3); gl1.userData.body = true; G.add(gl1);
  const ws = mk(new THREE.BoxGeometry(1.02, 0.5, 0.06), glass, 0, 0.42, -2.35); ws.rotation.x = -0.5; ws.userData.body = true; G.add(ws);
  const strp = mk(new THREE.BoxGeometry(1.2, 0.08, 7.4), white, 0, -0.18, 1.0); strp.userData.body = true; G.add(strp);
  for (const s of [-1, 1]) {
    const w = mk(wingGeo(1.6, 1.6, 7.3, 0, 0.22, s), white, 0, 0.95, -1.4); w.rotation.z = s * 1.5 * DEG; G.add(w);
    G.add(mk(new THREE.BoxGeometry(0.6, 0.24, 1.62), red, s * 7.0, 0.95 + 0.18, -0.6));
    G.add(rod([s * 0.5, -0.55, -0.7], [s * 2.9, 0.9, -0.7], 0.04, metal));
    G.add(mk(wingGeo(1.3, 0.9, 2.6, 10, 0.1, s), white, 0, 0.25, 4.3));
  }
  const fin = mk(wingGeo(1.6, 0.8, 1.75, 32, 0.1, 1), red, 0, 0.3, 3.95); fin.rotation.z = Math.PI / 2; G.add(fin);
  if (!floats) {
    for (const s of [-1, 1]) {
      G.add(mk(wheel(0.42, 0.22), black, s * 1.3, -1.75, -1.1));
      G.add(rod([s * 0.35, -0.6, -1.0], [s * 1.25, -1.72, -1.1], 0.06, dark));
      G.add(rod([s * 0.35, -0.6, -0.2], [s * 1.25, -1.72, -1.1], 0.05, dark));
    }
    G.add(mk(wheel(0.15, 0.1), black, 0, -0.72, 5.6));
    G.add(rod([0, -0.35, 5.3], [0, -0.7, 5.6], 0.04, dark));
  } else {
    for (const s of [-1, 1]) {
      const f = mk(cylZ(0.3, 0.36, 6.4, 10), metal, s * 1.35, -2.06, 0.6); f.scale.set(1, 0.9, 1); G.add(f);
      const bow = new THREE.ConeGeometry(0.3, 1.2, 10); bow.rotateX(-Math.PI / 2); G.add(mk(bow, metal, s * 1.35, -1.98, -3.2));
      G.add(rod([s * 0.4, -0.6, -1.6], [s * 1.35, -1.8, -1.9], 0.05, metal));
      G.add(rod([s * 0.4, -0.6, 0.2], [s * 1.35, -1.8, 0.8], 0.05, metal));
      G.add(rod([s * 0.4, -0.6, -1.6], [s * 1.35, -1.8, 0.8], 0.04, metal));
    }
    G.add(rod([-1.35, -1.8, -1.0], [1.35, -1.8, -1.0], 0.04, metal));
    G.add(rod([-1.35, -1.8, 1.0], [1.35, -1.8, 1.0], 0.04, metal));
  }
  G.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: G, prop, disc, gear: null, cockpitParts: true };
}
function buildA320() {
  const G = new THREE.Group();
  const white = phong(0xf1f3f4, 80), grey = phong(0xa9afb4, 60), navy = phong(0x1d3a6b, 70), glass = phong(0x16202a, 120), black = phong(0x111214, 10), metal = phong(0xc5c9cc, 90);
  G.add(mk(cylZ(2, 2, 30, 28), white));
  const nose = mk(new THREE.SphereGeometry(2, 28, 16), white, 0, -0.12, -15); nose.scale.set(1, 0.97, 2.0); G.add(nose);
  const tail = mk(cylZ(2, 0.42, 8, 28), white, 0, 0.45, 19); tail.rotation.x = -0.11; G.add(tail);
  const belly = mk(cylZ(1.7, 1.7, 14, 20), grey, 0, -0.75, 1); belly.scale.set(1.08, 0.75, 1); G.add(belly);
  const cw = mk(new THREE.BoxGeometry(2.6, 0.55, 1.1), glass, 0, 0.72, -17.55); cw.rotation.x = -0.45; G.add(cw);
  for (const s of [-1, 1]) {
    G.add(mk(new THREE.BoxGeometry(0.06, 0.3, 25), glass, s * 1.97, 0.55, -0.5));
    G.add(mk(new THREE.BoxGeometry(0.06, 0.12, 28), navy, s * 1.99, -0.05, 0));
    const w = mk(wingGeo(6.9, 1.6, 15.3, 27, 0.6, s), white, s * 1.6, -1.15, -3.6); w.rotation.z = s * 5 * DEG; G.add(w);
    const wl = mk(wingGeo(1.3, 0.5, 2.0, 40, 0.12, 1), navy, s * 16.8, 0.2, 7.6); wl.rotation.z = Math.PI / 2; G.add(wl);
    G.add(mk(cylZ(1.02, 0.85, 4.4, 22), white, s * 5.6, -2.3, -5.6));
    const fan = new THREE.Mesh(new THREE.CircleGeometry(0.9, 22), black); fan.position.set(s * 5.6, -2.3, -7.81); fan.rotation.y = Math.PI; G.add(fan);
    G.add(mk(new THREE.BoxGeometry(0.32, 1.0, 3.2), grey, s * 5.6, -1.5, -4.6));
    const hs = mk(wingGeo(3.9, 1.5, 6.0, 30, 0.32, s), white, s * 0.5, 0.75, 17.6); hs.rotation.z = s * 6 * DEG; G.add(hs);
  }
  const fin = mk(wingGeo(5.8, 2.0, 6.3, 36, 0.38, 1), navy, 0, 1.55, 15.8); fin.rotation.z = Math.PI / 2; G.add(fin);
  const gear = new THREE.Group();
  gear.add(rod([0, -1.9, -11.5], [0, -3.5, -11.5], 0.13, metal));
  for (const s of [-1, 1]) gear.add(mk(wheel(0.38, 0.24), black, s * 0.24, -3.57, -11.5));
  for (const s of [-1, 1]) {
    gear.add(rod([s * 3.8, -1.5, 1.5], [s * 3.8, -3.3, 1.5], 0.16, metal));
    gear.add(mk(wheel(0.6, 0.38), black, s * 3.55, -3.35, 1.5));
    gear.add(mk(wheel(0.6, 0.38), black, s * 4.05, -3.35, 1.5));
  }
  G.add(gear);
  G.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: G, prop: null, disc: null, gear };
}

function buildF50() {
  const G = new THREE.Group();
  const white = phong(0xf2f3f4, 80), grey = phong(0xb4b9bd, 60), blue = phong(0x1f4f8f, 70), glass = phong(0x16202a, 120), black = phong(0x111214, 10), metal = phong(0xc5c9cc, 90), dark = phong(0x1c1f22, 20);
  // flygkropp, nos och uppsvept stjärtkon
  G.add(mk(cylZ(1.3, 1.3, 19, 24), white, 0, 0, 0.5));
  const nose = mk(new THREE.SphereGeometry(1.3, 24, 14), white, 0, -0.1, -9.0); nose.scale.set(1, 0.95, 2.1); G.add(nose);
  const tail = mk(cylZ(1.3, 0.3, 6.5, 24), white, 0, 0.55, 13.2); tail.rotation.x = -0.15; G.add(tail);
  const belly = mk(cylZ(1.15, 1.15, 9, 18), grey, 0, -0.5, 0.5); belly.scale.set(1.08, 0.8, 1); G.add(belly);
  const cw = mk(new THREE.BoxGeometry(1.7, 0.42, 0.9), glass, 0, 0.62, -10.1); cw.rotation.x = -0.5; G.add(cw);
  for (const s of [-1, 1]) {
    G.add(mk(new THREE.BoxGeometry(0.06, 0.26, 15), glass, s * 1.27, 0.35, 0.8));
    G.add(mk(new THREE.BoxGeometry(0.06, 0.16, 21), blue, s * 1.29, -0.12, 0.6));
    // högt monterad vinge med lätt V-form
    const w = mk(wingGeo(3.5, 1.4, 13.5, 3, 0.45, s), white, s * 0.9, 1.3, -2.2); w.rotation.z = s * 2 * DEG; G.add(w);
    // motorgondol under vingen med huvudstället
    G.add(mk(cylZ(0.72, 0.55, 6.2, 16), white, s * 3.6, 0.6, -0.9));
    G.add(mk(new THREE.BoxGeometry(1.0, 1.0, 3.4), white, s * 3.6, 0.05, 0.6));
    const hs = mk(wingGeo(2.3, 1.1, 4.6, 14, 0.22, s), white, s * 0.3, 0.75, 12.3); hs.rotation.z = s * 6 * DEG; G.add(hs);
  }
  const fin = mk(wingGeo(4.3, 1.8, 5.4, 36, 0.36, 1), blue, 0, 1.0, 10.6); fin.rotation.z = Math.PI / 2; G.add(fin);
  // sexbladiga propellrar
  const props = [];
  for (const s of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(s * 3.6, 0.6, -4.15);
    const blades = new THREE.Group();
    for (let i = 0; i < 6; i++) { const bg = new THREE.BoxGeometry(0.2, 1.75, 0.05); bg.translate(0, 0.95, 0); const b = mk(bg, dark); b.rotation.z = i * Math.PI / 3; blades.add(b); }
    p.add(blades);
    const sp = new THREE.ConeGeometry(0.32, 0.8, 14); sp.rotateX(-Math.PI / 2); p.add(mk(sp, metal, 0, 0, -0.25));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.85, 36), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    p.add(disc); G.add(p); props.push({ g: p, blades, disc, dir: s });
  }
  // infällbart ställ
  const gear = new THREE.Group();
  gear.add(rod([0, -1.0, -8.8], [0, -2.4, -8.8], 0.1, metal));
  for (const s of [-1, 1]) gear.add(mk(wheel(0.32, 0.2), black, s * 0.2, -2.43, -8.8));
  for (const s of [-1, 1]) {
    gear.add(rod([s * 3.6, -0.4, 0.9], [s * 3.6, -2.2, 0.9], 0.14, metal));
    for (const d of [-0.22, 0.22]) gear.add(mk(wheel(0.5, 0.3), black, s * 3.6 + d, -2.25, 0.9));
  }
  G.add(gear);
  G.traverse(o => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
  return { group: G, prop: null, disc: null, props, gear };
}
// rotorvind: damm eller vattenstänk under helikoptern nära marken
const WASH = { pts: null, n: 90, ph: null };
function buildWash() {
  const g = new THREE.BufferGeometry(), p = new Float32Array(WASH.n * 3);
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  WASH.ph = Array.from({ length: WASH.n }, (_, i) => [Math.random(), (i / WASH.n) * Math.PI * 2 + Math.random() * 0.3, 0.5 + Math.random()]);
  WASH.pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xd9ccb0, size: 2.6, transparent: true, opacity: 0, depthWrite: false }));
  WASH.pts.frustumCulled = false; WASH.pts.visible = false; scene.add(WASH.pts);
}
function updateWash(S, dt, on) {
  if (!WASH.pts) buildWash();
  const h0 = terrainH(S.pos.x, S.pos.z), water = h0 < 0, gy = Math.max(h0, 0), agl = S.pos.y - gy;
  const k = on ? clamp(1 - agl / 22, 0, 1) * clamp((S.n1 - 0.25) / 0.4, 0, 1) : 0;
  WASH.pts.visible = k > 0.01;
  if (!WASH.pts.visible) return;
  WASH.pts.material.opacity = k * (water ? 0.75 : 0.55);
  WASH.pts.material.color.setHex(water ? 0xeef6fa : 0xcdbf9c);
  const a = WASH.pts.geometry.attributes.position;
  for (let i = 0; i < WASH.n; i++) {
    const P = WASH.ph[i]; P[0] = (P[0] + dt * 0.7 * P[2]) % 1;
    const r = 4 + P[0] * 16, y = gy + 0.4 + Math.sin(P[0] * Math.PI) * (water ? 2.2 : 1.4) * P[2];
    a.setXYZ(i, S.pos.x + Math.cos(P[1]) * r, y, S.pos.z + Math.sin(P[1]) * r);
  }
  a.needsUpdate = true;
}
function buildHeli() {
  const G = new THREE.Group();
  // gul ambulanshelikopter med mörka detaljer
  const red = phong(0xf2c100, 80), white = phong(0xf0eee8, 65), dark = phong(0x1c1f22, 20), glass = phong(0x1e2c36, 120), metal = phong(0xa9aeb2, 80), yel = phong(0x23272b, 40);
  const body = m => { m.userData.body = true; G.add(m); return m; };
  const cab = body(mk(cylZ(1.0, 0.95, 3.6, 18), red, 0, 0.1, -0.2)); cab.scale.set(0.82, 1.05, 1);
  const nose = body(mk(new THREE.SphereGeometry(1, 18, 12), red, 0, -0.05, -2.0)); nose.scale.set(0.82, 0.98, 1.25);
  const ws = body(mk(new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), glass, 0, 0.12, -2.2)); ws.scale.set(0.84, 0.95, 1.2); ws.rotation.x = -1.0;
  body(mk(new THREE.BoxGeometry(1.66, 0.14, 4.4), yel, 0, -0.25, -0.3));
  for (const s of [-1, 1]) body(mk(new THREE.BoxGeometry(0.04, 0.55, 1.5), glass, s * 0.83, 0.35, 0.1));
  body(mk(new THREE.BoxGeometry(1.1, 0.55, 2.6), white, 0, 1.2, 0.5));
  body(mk(new THREE.CylinderGeometry(0.14, 0.18, 0.5, 8), metal, 0, 1.6, 0));
  const boom = body(mk(cylZ(0.5, 0.2, 6.4, 12), red, 0, 0.55, 4.6)); boom.rotation.x = -0.04;
  body(mk(new THREE.BoxGeometry(2.6, 0.07, 0.6), white, 0, 0.72, 7.6));
  for (const s of [-1, 1]) body(mk(new THREE.BoxGeometry(0.06, 0.6, 0.5), red, s * 1.3, 0.85, 7.6));
  const fin = body(mk(new THREE.BoxGeometry(0.22, 1.9, 1.3), red, 0, 1.1, 9.2)); fin.rotation.x = -0.2;
  const fen = body(mk(new THREE.TorusGeometry(0.42, 0.12, 8, 18), dark, 0, 0.8, 9.15)); fen.rotation.y = Math.PI / 2;
  for (const s of [-1, 1]) {
    G.add(mk(cylZ(0.06, 0.06, 3.6, 8), metal, s * 1.1, -1.5, 0));
    G.add(rod([s * 0.55, -0.7, -1.2], [s * 1.1, -1.5, -1.2], 0.05, metal));
    G.add(rod([s * 0.55, -0.7, 1.0], [s * 1.1, -1.5, 1.0], 0.05, metal));
  }
  // huvudrotor: fyra blad och en suddig skiva i fart
  const rotor = new THREE.Group(); rotor.position.set(0, 1.9, 0);
  const blades = new THREE.Group();
  for (let i = 0; i < 4; i++) { const bg = new THREE.BoxGeometry(5.3, 0.05, 0.3); bg.translate(2.8, 0, 0); const b = mk(bg, dark); b.rotation.y = i * Math.PI / 2; blades.add(b); }
  blades.add(mk(new THREE.CylinderGeometry(0.3, 0.3, 0.25, 10), metal));
  rotor.add(blades);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(5.5, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  rotor.add(disc); G.add(rotor);
  G.traverse(o => { if (o.isMesh && o !== disc) o.castShadow = true; });
  return { group: G, prop: null, disc, rotor, blades, gear: null, cockpitParts: true };
}

async function buildWorld(progress) {
  buildEnv();
  progress('Loading the coastline…', 0.05);
  const [core, reg] = await decodeMask();
  progress('Computing distance to the coast…', 0.25);
  await new Promise(r => setTimeout(r, 20));
  initWorld(core, reg);
  buildSea();
  progress('Building the airfields…', 0.4);
  await new Promise(r => setTimeout(r, 20));
  buildAirfields();
  buildScenery();
  buildBuildingStreams();
  progress('Switching on the night lights…', 0.5);
  await new Promise(r => setTimeout(r, 20));
  buildNight();
  progress('Done', 0.55);
}
