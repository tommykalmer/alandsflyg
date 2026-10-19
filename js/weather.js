// ===================== VÄDER: molntäcke, dis, regn och turbulens =====================
// Ett molnlager med bas och topp. Under lagret är det grått, disigt och kanske regnigt;
// inne i molnet ser man nästan ingenting; ovanför lyser solen över ett hav av moln.
const WEATHERS = [
  { id: 'clear', n: 'Clear', cover: 0 },
  { id: 'scattered', n: 'Scattered clouds', base: 2500, top: 4200, cover: 0.45, fog: 1.2, turb: 0.4 },
  { id: 'overcast', n: 'Overcast', base: 1600, top: 4500, cover: 1, fog: 2.6, rain: 0, turb: 0.6 },
  { id: 'rain', n: 'Rain', base: 900, top: 6000, cover: 1, fog: 5.5, rain: 1, turb: 1.1 },
  { id: 'fog', n: 'Low fog', base: 250, top: 1100, cover: 1, fog: 70, rain: 0, turb: 0.2 }
];
const WX = { def: WEATHERS[0], base: 0, top: 0, below: 0, inCloud: 0, deck: null, rain: null, t: 0 };
const _wxC = new THREE.Color(), _wxC2 = new THREE.Color();

// sömlöst brus för molnen (periodiskt så att texturen kan upprepas utan skarvar)
function wxNoiseTex() {
  const N = 256, id = new ImageData(N, N), R = rng(31);
  const oct = [[8, 0.5], [16, 0.27], [32, 0.15], [64, 0.08]].map(([p, a]) => { const g = []; for (let i = 0; i < p * p; i++) g.push(R()); return { p, a, g }; });
  const sm = t => t * t * (3 - 2 * t);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0;
    for (const o of oct) {
      const fx = x / N * o.p, fy = y / N * o.p, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
      const G = (i, j) => o.g[((j % o.p) + o.p) % o.p * o.p + ((i % o.p) + o.p) % o.p];
      v += o.a * ((G(ix, iy) * (1 - tx) + G(ix + 1, iy) * tx) * (1 - ty) + (G(ix, iy + 1) * (1 - tx) + G(ix + 1, iy + 1) * tx) * ty);
    }
    const i = (y * N + x) * 4; id.data[i] = id.data[i + 1] = id.data[i + 2] = Math.round(v * 255); id.data[i + 3] = 255;
  }
  const cv = document.createElement('canvas'); cv.width = cv.height = N; cv.getContext('2d').putImageData(id, 0, 0);
  WX.noise = id.data; WX.noiseN = N; // samma brus används för att veta om kameran är inne i ett moln
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

const WXU = {
  uNoise: { value: null }, uCover: { value: 1 }, uTime: { value: 0 }, uLit: { value: new THREE.Color(1, 1, 1) },
  uShade: { value: new THREE.Color(0.55, 0.6, 0.68) }, uFar: { value: new THREE.Color(0.8, 0.85, 0.9) }, uSun: { value: SUN },
  uAlpha: { value: 1 }, uOff: { value: 0 }, uBottom: { value: 0 }
};
function wxMaterial(off, alpha, bottom) {
  const u = Object.assign({}, WXU, { uOff: { value: off }, uAlpha: { value: alpha }, uBottom: { value: bottom ? 1 : 0 } });
  return new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform sampler2D uNoise; uniform float uCover; uniform float uTime; uniform float uAlpha; uniform float uOff; uniform float uBottom;
uniform vec3 uLit; uniform vec3 uShade; uniform vec3 uFar; uniform vec3 uSun;
varying vec3 vW;
void main() {
  vec2 p = vW.xz + vec2(uTime * 6.0, uTime * 2.5);
  float n = texture2D(uNoise, p / 21000.0).r * 0.55 + texture2D(uNoise, p / 6100.0 + 0.37).r * 0.3 + texture2D(uNoise, p / 1700.0 + 0.71).r * 0.15;
  // täckningsgrad: tröskeln flyttas så att rätt andel av himlen blir moln; djupare skikt är lite mindre
  float thr = mix(0.72, 0.2, uCover) + uOff * 0.025;
  float d = smoothstep(thr - 0.05, thr + 0.05, n);
  float bump = texture2D(uNoise, p / 900.0 + 0.13).r * 0.6 + texture2D(uNoise, p / 260.0).r * 0.4;
  vec3 c;
  if (uBottom > 0.5) c = uShade * (0.78 + bump * 0.35);
  else {
    // ovansidan: solbelyst, med mjuka skuggor i gropar och gråare kanter där molnen är tunna
    float lit = clamp(0.62 + (bump - 0.5) * 0.9 + uSun.y * 0.25, 0.0, 1.0);
    c = mix(uShade, uLit, lit) * mix(0.85, 1.0, d);
  }
  float dist = length(vW.xz - cameraPosition.xz);
  c = mix(c, uFar, smoothstep(6000.0, 70000.0, dist) * 0.85);
  float a = d * uAlpha * (1.0 - smoothstep(90000.0, 120000.0, dist));
  gl_FragColor = vec4(c, a);
}`
  });
}
function wxBuild() {
  WXU.uNoise.value = wxNoiseTex();
  const G = new THREE.Group(); G.renderOrder = 3;
  const geo = new THREE.PlaneGeometry(240000, 240000, 1, 1).rotateX(-Math.PI / 2);
  // tre skikt ger djup åt ovansidan, ett skikt är molnbasen sedd underifrån
  const layers = [[0, 1, false, 0], [1, 0.9, false, -45], [2, 0.75, false, -110], [3, 1, true, 0]];
  WX.layers = layers.map(([off, a, bottom, dy]) => { const m = new THREE.Mesh(geo, wxMaterial(off, a, bottom)); m.userData.dy = dy; m.userData.bottom = bottom; m.frustumCulled = false; m.renderOrder = bottom ? 3 : 4 + off; G.add(m); return m; });
  G.visible = false; scene.add(G); WX.deck = G;
  // regn: korta streck runt kameran
  const n = 1800, pos = new Float32Array(n * 6);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  WX.drops = Array.from({ length: n }, () => [(Math.random() - 0.5) * 120, Math.random() * 80 - 30, (Math.random() - 0.5) * 120]);
  WX.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xc9d3dc, transparent: true, opacity: 0.35, depthWrite: false }));
  WX.rain.frustumCulled = false; WX.rain.visible = false; scene.add(WX.rain);
}
// molntäthet i en punkt, exakt samma beräkning som i molnshadern (så att det man ser är det man flyger in i)
function wxTex(u, v) {
  const N = WX.noiseN, D = WX.noise;
  const x = (u - Math.floor(u)) * N - 0.5, y = (1 - (v - Math.floor(v))) * N - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
  const at = (i, j) => D[((((j % N) + N) % N) * N + (((i % N) + N) % N)) * 4] / 255;
  return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
}
function wxDensity(x, z, off) {
  const c = WX.def.cover; if (!c) return 0; if (c >= 0.999) return 1;
  const px = x + WX.t * 6, pz = z + WX.t * 2.5;
  const n = wxTex(px / 21000, pz / 21000) * 0.55 + wxTex(px / 6100 + 0.37, pz / 6100 + 0.37) * 0.3 + wxTex(px / 1700 + 0.71, pz / 1700 + 0.71) * 0.15;
  const thr = 0.72 + (0.2 - 0.72) * c + (off || 0) * 0.025;
  return smooth(thr - 0.05, thr + 0.05, n);
}
function setWeather(id) {
  if (!WX.deck) wxBuild();
  WX.hemi = scene.children.find(o => o.isHemisphereLight);
  const d = WEATHERS.find(w => w.id === id) || WEATHERS[0];
  WX.def = d; WX.base = (d.base || 0) * 0.3048; WX.top = (d.top || 0) * 0.3048;
  WX.deck.visible = d.cover > 0;
  WXU.uCover.value = d.cover;
  for (const m of WX.layers) m.material.uniforms.uCover.value = d.cover;
  // de små stackmolnen passar inte ihop med ett heltäckande lager
  for (const m of CLOUD_MATS) m.opacity = d.cover > 0 ? 0 : 1;
}
function wxLabel(d) { return d.cover ? `${d.n} ${d.base} ft` : d.n; }

// körs varje bildruta efter tid-på-dygnet: blandar in vädret i himmel, ljus och dis
function wxFrame(dt, cam, S) {
  if (!WX.deck) return;
  const d = WX.def, base0 = TOD.base;
  if (!base0) return;
  WX.t += dt;
  // baslägen från tid på dygnet
  ZENITH.copy(base0.zen); HORIZON.copy(base0.hor);
  sunLight.intensity = base0.sunI; WX.hemi.intensity = base0.hemiI;
  SKYU.disc.value = base0.disc; SKYU.glow.value = base0.glow; terrainUniforms.uGlit.value = base0.glit;
  HAZE.p.x = 1400; HAZE.p.y = base0.haze || 0;
  if (!d.cover) { WX.below = 0; WX.inCloud = 0; WX.rain.visible = false; if (WX.white || (WX.white = document.getElementById('wxfog'))) WX.white.style.opacity = '0'; scene.background.copy(HORIZON); scene.fog.color.copy(HORIZON); return; }
  const y = cam.y, light = TOD.light, dusk = clamp(light * 0.85 + 0.15 * (1 - TOD.night), 0, 1);
  // hur mycket av molnlagret som ligger ovanför kameran (0 = ovanför molnen, 1 = under)
  const below = 1 - smooth(WX.base, WX.top, y);
  // inne i molnet först när kameran faktiskt passerat molnbasen/molntoppen, och bara där det finns moln
  const dens = wxDensity(cam.x, cam.z, 0);
  const inCloud = smooth(WX.base, WX.base + 45, y) * (1 - smooth(WX.top - 45, WX.top, y)) * dens;
  WX.below = below; WX.inCloud = inCloud;
  const grey = below * d.cover;
  // under molnen: grå himmel, ingen sol, svagare och platt ljus
  const g2 = new THREE.Color().setRGB(0.5, 0.54, 0.58).multiplyScalar(0.1 + 0.9 * dusk);
  ZENITH.lerp(g2, grey * 0.92); HORIZON.lerp(g2.clone().multiplyScalar(1.12), grey * 0.85);
  SKYU.disc.value *= 1 - grey; SKYU.glow.value *= 1 - grey * 0.9;
  sunLight.intensity = base0.sunI * (1 - 0.78 * grey);
  WX.hemi.intensity = base0.hemiI * (1 + 0.25 * grey);
  terrainUniforms.uGlit.value = base0.glit * (1 - grey);
  scene.background.copy(HORIZON);
  // färger på molnen
  const lit = _wxC.copy(sunLight.color).multiplyScalar(0.25 + 0.85 * dusk).lerp(new THREE.Color(1, 1, 1), 0.35 * dusk);
  for (const m of WX.layers) {
    const u = m.material.uniforms; u.uTime.value = WX.t;
    u.uLit.value.copy(lit);
    u.uShade.value.setRGB(0.46, 0.5, 0.57).multiplyScalar(0.12 + 0.88 * dusk);
    if (m.userData.bottom) { u.uShade.value.multiplyScalar(d.rain ? 0.72 : 0.9); u.uFar.value.copy(HORIZON); }
    else u.uFar.value.copy(base0.hor);
    m.position.set(cam.x, (m.userData.bottom ? WX.base : WX.top + m.userData.dy), cam.z);
  }
  // dis: tätare under molnen, nästan noll sikt inne i molnet
  const cloudC = _wxC2.setRGB(0.62, 0.66, 0.7).multiplyScalar(0.12 + 0.88 * dusk);
  scene.fog.color.copy(HORIZON).lerp(cloudC, inCloud);
  scene.fog.density = scene.fog.density * (1 + (d.fog - 1) * below) + inCloud * 0.006;
  // under ett molntäcke ligger diset jämnt upp till molnbasen; i molnet är det lika tätt åt alla håll
  HAZE.p.x = lerp(1400, Math.max(1400, WX.base * 1.6), grey) + inCloud * 1e6;
  HAZE.p.y *= 1 - grey;
  LIGHTU.uFog.value = scene.fog.density;
  // inne i molnet: allt blir vitgrått (även himlen och molnskikten)
  if (!WX.white) WX.white = document.getElementById('wxfog');
  if (WX.white) { const o = clamp(inCloud * 1.05, 0, 0.93); WX.white.style.opacity = o.toFixed(3); if (o > 0.01) WX.white.style.background = '#' + cloudC.getHexString(); }
  // regn
  const rainOn = d.rain && below > 0.5 && inCloud < 0.8;
  WX.rain.visible = !!rainOn;
  if (rainOn) {
    const a = WX.rain.geometry.attributes.position, v = S ? S.vel : null, fall = 9;
    WX.rain.material.opacity = 0.3 + 0.3 * dusk;
    for (let i = 0; i < WX.drops.length; i++) {
      const p = WX.drops[i]; p[1] -= fall * dt;
      if (v) { p[0] -= v.x * dt; p[1] -= v.y * dt; p[2] -= v.z * dt; }
      if (p[1] < -40 || Math.abs(p[0]) > 60 || Math.abs(p[2]) > 60 || p[1] > 50) { p[0] = (Math.random() - 0.5) * 120; p[1] = 30 + Math.random() * 15; p[2] = (Math.random() - 0.5) * 120; }
      // strecken pekar längs den relativa farten så att regnet piskar mot rutan i fart
      const k = 0.045, sx = v ? -v.x * k : 0, sy = -fall * k + (v ? -v.y * k : 0), sz = v ? -v.z * k : 0;
      a.setXYZ(i * 2, cam.x + p[0], cam.y + p[1], cam.z + p[2]);
      a.setXYZ(i * 2 + 1, cam.x + p[0] - sx, cam.y + p[1] - sy, cam.z + p[2] - sz);
    }
    a.needsUpdate = true;
  }
}
// turbulens i och under molnen (läggs på vindbyarna)
function wxTurb(y) {
  const d = WX.def; if (!d.cover) return 0;
  const inC = WX.inCloud > 0.3 ? 1 : 0;
  return (d.turb || 0) * (inC ? 1.6 : y < WX.base ? 0.8 : 0.15);
}
