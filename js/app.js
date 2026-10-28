// ===================== APP: meny, kontroller, kamera, huvudloop (ljudet finns i audio.js) =====================
const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('alandsflyg.' + k); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('alandsflyg.' + k, v); } catch (e) {} }
};

let sim = null, model = null;
let acId = store.get('ac', 'beaver'); if (!AIRCRAFT[acId]) acId = 'beaver';
let startId = store.get('start', AIRCRAFT[acId].starts[0].id);
let tab = store.get('tab', 'free');
let missionId = store.get('mission', MISSIONS[0].id);
const WINDS = [{ id: 'calm', n: 'Calm', kt: 0, gust: 0 }, { id: 'light', n: 'Light', kt: 6, gust: 0.2 }, { id: 'fresh', n: 'Fresh', kt: 14, gust: 0.4 }, { id: 'gusty', n: 'Gusty', kt: 20, gust: 0.7 }];
const WDIRS = [{ n: 'SW', d: 225 }, { n: 'W', d: 270 }, { n: 'NW', d: 315 }, { n: 'N', d: 0 }, { n: 'NE', d: 45 }, { n: 'E', d: 90 }, { n: 'SE', d: 135 }, { n: 'S', d: 180 }];
let todId = store.get('tod', 'day'); if (!TIMES.find(t => t.id === todId)) todId = 'day';
let windId = store.get('wind', 'light'), wdirIdx = +store.get('wdir', 0) || 0;
let wxId = store.get('wx', 'clear'); if (!WEATHERS.find(w => w.id === wxId)) wxId = 'clear';
let guideOn = store.get('guide', '1') === '1';
// grafikkvalitet: telefoner och surfplattor börjar på medel
const QUALITY = {
  low: { n: 'Low', pr: 1.0, shadow: false, l0: 256, l1: 64, r0: 9000, r1: 24000, r2: 52000, forest: 2, bld: 3, fog: 0.000042 },
  medium: { n: 'Medium', pr: 1.3, shadow: true, l0: 512, l1: 128, r0: 10000, r1: 32000, r2: 72000, forest: 3, bld: 5, fog: 0.000033 },
  high: { n: 'High', pr: 1.6, shadow: true, l0: 512, l1: 256, r0: 11000, r1: 42000, r2: 96000, forest: 4, bld: 6, fog: 0.000026 },
  ultra: { n: 'Ultra', pr: 2.0, shadow: true, sm: 2048, l0: 1024, l1: 256, r0: 14000, r1: 50000, r2: 110000, forest: 6, bld: 9, fog: 0.000022 }
};
const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
let qId = store.get('q', IS_MOBILE ? 'medium' : 'high'); if (!QUALITY[qId]) qId = 'medium';
// automatisk grafik: mäter bildfrekvensen och sänker upplösning/kvalitet om telefonen inte hinner med
let qAuto = store.get('qauto', '1') === '1';
const PERF = { t: 0, n: 0, fps: 60, prK: 1, slow: 0, fast: 0 };
function applyPixelRatio() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY[qId].pr) * PERF.prK); }
function perfUpdate(rawDt) {
  PERF.t += rawDt; PERF.n++;
  if (PERF.t < 2) return;
  PERF.fps = PERF.n / PERF.t; PERF.t = 0; PERF.n = 0;
  if (!qAuto || mode !== 'fly' || paused || WARP > 1 || document.hidden) return;
  if (PERF.fps < 40) { PERF.slow++; PERF.fast = 0; } else if (PERF.fps > 56) { PERF.fast++; PERF.slow = 0; } else { PERF.slow = PERF.fast = 0; }
  if (PERF.slow >= 1 && PERF.prK > 0.62) { PERF.prK = Math.max(0.6, PERF.prK - 0.15); applyPixelRatio(); resize(); PERF.slow = 0; }
  else if (PERF.slow >= 2 && qId !== 'low') {
    qId = qId === 'ultra' ? 'high' : qId === 'high' ? 'medium' : 'low'; store.set('q', qId); PERF.prK = 0.85; applyQuality(qId, true); PERF.slow = 0;
    apMsg('GRAPHICS LOWERED FOR A SMOOTHER FLIGHT');
  } else if (PERF.fast >= 3 && PERF.prK < 1) { PERF.prK = Math.min(1, PERF.prK + 0.1); applyPixelRatio(); resize(); PERF.fast = 0; }
}
function applyQuality(id, rebuild) {
  const q = QUALITY[id];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr) * PERF.prK);
  if (sunLight.castShadow !== q.shadow) sunLight.castShadow = q.shadow;
  const sm = q.sm || 1024;
  if (sunLight.shadow.mapSize.x !== sm) { sunLight.shadow.mapSize.set(sm, sm); if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null; } }
  const p0 = LODS[0].P;
  LODS[0].P = q.l0; LODS[0].E = Math.min(512, q.l0 / 2); LODS[1].P = q.l1; LODS[1].E = q.l1 / 4; LODS[0].range = q.r0; LODS[1].range = q.r1; LODS[2].range = q.r2;
  ROADS3D.maxC = id === 'low' ? 4 : 9;
  NEAR.rad = q.forest; BLD.rad = q.bld; NEAR.key = ''; BLD.key = '';
  FOG_BASE = q.fog; camera.far = q.r2 + 8000; camera.updateProjectionMatrix();
  sky.scale.setScalar(Math.min(1, camera.far * 0.9 / 70000)); // himlen måste ligga innanför bortre klipplanet
  if (rebuild) { for (const c of TER.chunks.values()) disposeChunk(c); TER.chunks.clear(); TER.job = null; TER.lastCam.set(1e9, 0, 0); }
  if (typeof resize === 'function' && rebuild) resize();
}
let routeAc = store.get('rac', 'a320'); if (!['a320', 'f50', 'beaver'].includes(routeAc)) routeAc = 'a320'; routeAc = routeAc, routeFrom = store.get('rfrom', 'EFMA'), routeTo = store.get('rto', 'ESSA');
if (!APT[routeFrom]) routeFrom = 'EFMA'; if (!APT[routeTo] || routeTo === routeFrom) routeTo = routeFrom === 'ESSA' ? 'EFMA' : 'ESSA';
let mode = 'loading'; // loading | menu | fly | crash | result
let paused = false, camMode = store.get('cam', 'chase'); if (!['chase', 'cockpit', 'hud'].includes(camMode)) camMode = 'chase';
const input = { thr: 0, stickX: 0, stickY: 0, kb: {}, kbE: 0, kbR: 0, kbRud: 0, brakeTouch: false };

function currentWind() {
  if (tab === 'mission') return MISSIONS.find(m => m.id === missionId).wind;
  const w = WINDS.find(w => w.id === windId) || WINDS[1];
  return { dir: WDIRS[wdirIdx].d, kt: w.kt, gust: w.gust };
}
// tid på dygnet: uppdrag kan ha en egen tid (nattuppdrag)
let todCur = null;
function applyTod() {
  const m = tab === 'mission' ? MISSIONS.find(m => m.id === missionId) : null;
  const h = (TIMES.find(t => t.id === ((m && m.tod) || todId)) || TIMES[2]).h;
  if (h !== todCur) { todCur = h; setTimeOfDay(h); }
  setWeather((m && m.wx) || (m ? 'clear' : wxId));
}
function loadAircraft() {
  if (model) scene.remove(model.group);
  applyTod();
  let start;
  AP.on = false; WARP = 1;
  if (tab === 'route') { acId = routeAc; const r = planRoute(routeFrom, routeTo, acId, currentWind()); start = { type: 'rwy', zone: r.depZone.id }; }
  else clearRoute();
  if (tab === 'mission') { const m = MISSIONS.find(m => m.id === missionId); acId = m.ac; start = m.start(); }
  else if (tab !== 'route') { if (!AIRCRAFT[acId].starts.find(s => s.id === startId)) startId = AIRCRAFT[acId].starts[0].id; start = startId; }
  const A = AIRCRAFT[acId];
  model = A.model === 'a320' ? buildA320() : A.model === 'f50' ? buildF50() : A.model === 'heli' ? buildHeli() : buildBeaver(A.floats);
  model.rps = 0;
  addAircraftLights(model, A);
  buildCockpit(acId);
  scene.add(model.group);
  sim = createState(acId, start, currentWind());
  if (A.heli) sim.assist = store.get('hassist', '1') === '1';
  sim.easy = (store.get('diff', 'easy')) === 'easy' || (tab === 'mission' && missionId === 'tutorial');
  LAND.touches = 0; LAND.toast = null; LAND.said = {}; guideReset(); ATHR.on = false;
  input.thr = sim.thr;
  const sz = A.shadow;
  Object.assign(sunLight.shadow.camera, { left: -sz, right: sz, top: sz, bottom: -sz });
  sunLight.shadow.camera.updateProjectionMatrix();
  camInit = false;
  MAP.track = [];
  syncButtons();
}

// ---------- meny ----------
const CARD_INFO = { beaver: 'Lifts off ~55 kt · cruise 110 kt', float: 'Lifts off ~60 kt · lands on water', a320: 'Rotate 140 kt · approach 135 kt', f50: 'Rotate 105 kt · approach 110 kt', heli: 'Hovers ~65% · cruise 130 kt · medevac' };
function chip(label, pressed, onClick, id) {
  const b = document.createElement('button'); b.className = 'chip'; if (id) b.id = id;
  b.textContent = label; b.setAttribute('aria-pressed', pressed); b.onclick = onClick; return b;
}
function renderMenu() {
  $('tabFree').setAttribute('aria-selected', tab === 'free'); $('tabMission').setAttribute('aria-selected', tab === 'mission'); $('tabRoute').setAttribute('aria-selected', tab === 'route');
  $('freePane').hidden = tab !== 'free'; $('missionPane').hidden = tab !== 'mission'; $('routePane').hidden = tab !== 'route'; $('windPane').hidden = tab === 'mission';
  // rutter
  $('routeAcList').innerHTML = '';
  for (const id of ['a320', 'f50', 'beaver']) $('routeAcList').appendChild(chip(AIRCRAFT[id].title, id === routeAc, () => { routeAc = id; store.set('rac', id); if (isBig(AIRCRAFT[id])) { if (!APT[routeFrom].big) routeFrom = 'EFMA'; if (!APT[routeTo].big) routeTo = routeFrom === 'ESSA' ? 'EFMA' : 'ESSA'; } loadAircraft(); renderMenu(); }, 'rac-' + id));
  const apts = AIRPORTS.filter(a => !a.heli && (!isBig(AIRCRAFT[routeAc]) || a.big));
  const aptLabel = a => (a.iata ? a.iata + ' ' : '') + a.name;
  $('fromList').innerHTML = ''; $('toList').innerHTML = '';
  for (const a of apts) {
    $('fromList').appendChild(chip(aptLabel(a), a.icao === routeFrom, () => { routeFrom = a.icao; if (routeTo === routeFrom) routeTo = apts.find(b => b.icao !== routeFrom).icao; store.set('rfrom', routeFrom); store.set('rto', routeTo); loadAircraft(); renderMenu(); }, 'from-' + a.icao));
    if (a.icao !== routeFrom) $('toList').appendChild(chip(aptLabel(a), a.icao === routeTo, () => { routeTo = a.icao; store.set('rto', routeTo); loadAircraft(); renderMenu(); }, 'to-' + a.icao));
  }
  if (ROUTE.on) {
    const kmh = routeAc === 'a320' ? 480 : routeAc === 'f50' ? 380 : 190, min = ROUTE.dist / 1000 / kmh * 60 + (isBig(AIRCRAFT[routeAc]) ? 6 : 3);
    $('routeInfo').textContent = `${ROUTE.from.label} → ${ROUTE.to.label}: ${Math.round(ROUTE.dist / 1000)} km, about ${Math.round(min)} minutes in real time. Take off from runway ${ROUTE.depZone.ends[ROUTE.depEnd]}, land on runway ${ROUTE.zone.ends[ROUTE.end]}. Engage the autopilot after takeoff and time-warp the cruise, or jump straight to the approach.`;
  }
  $('acList').innerHTML = '';
  for (const id of ['beaver', 'float', 'f50', 'a320', 'heli']) {
    const A = AIRCRAFT[id], b = document.createElement('button');
    b.className = 'card'; b.id = 'ac-' + id; b.setAttribute('aria-pressed', id === acId);
    b.innerHTML = `<span class="n">${A.title}</span><span class="s">${A.sub}</span><span class="st">${CARD_INFO[id]}</span>`;
    b.onclick = () => { acId = id; store.set('ac', id); startId = AIRCRAFT[id].starts[0].id; loadAircraft(); renderMenu(); };
    $('acList').appendChild(b);
  }
  $('startList').innerHTML = '';
  for (const s of AIRCRAFT[acId].starts) $('startList').appendChild(chip(s.n, s.id === startId, () => { startId = s.id; store.set('start', s.id); loadAircraft(); renderMenu(); }, 'st-' + s.id));
  $('qList').innerHTML = '';
  for (const [id, q] of Object.entries(QUALITY)) $('qList').appendChild(chip(q.n, id === qId, () => { qId = id; store.set('q', id); PERF.prK = 1; applyQuality(id, true); renderMenu(); }, 'q-' + id));
  $('qList').appendChild(chip(qAuto ? 'Auto-adjust on' : 'Auto-adjust off', qAuto, () => { qAuto = !qAuto; store.set('qauto', qAuto ? '1' : '0'); if (!qAuto) { PERF.prK = 1; applyPixelRatio(); resize(); } renderMenu(); }, 'q-auto'));
  $('qList').appendChild(chip(showFps ? 'FPS meter on' : 'FPS meter off', showFps, () => { showFps = !showFps; store.set('fps', showFps ? '1' : '0'); renderMenu(); }, 'q-fps'));
  $('diffList').innerHTML = '';
  for (const [id, n] of [['easy', 'Easy – landing help'], ['real', 'Realistic']]) $('diffList').appendChild(chip(n, id === diffId, () => { diffId = id; store.set('diff', id); if (sim) sim.easy = id === 'easy'; renderMenu(); }, 'diff-' + id));
  $('todList').innerHTML = '';
  for (const t of TIMES) $('todList').appendChild(chip(t.n, t.id === todId, () => { todId = t.id; store.set('tod', t.id); applyTod(); renderMenu(); }, 'tod-' + t.id));
  $('windList').innerHTML = '';
  for (const w of WINDS) $('windList').appendChild(chip(w.n + (w.kt ? ' ' + w.kt + ' kt' : ''), w.id === windId, () => { windId = w.id; store.set('wind', w.id); loadAircraft(); renderMenu(); }, 'w-' + w.id));
  $('wxList').innerHTML = '';
  for (const w of WEATHERS) $('wxList').appendChild(chip(wxLabel(w), w.id === wxId, () => { wxId = w.id; store.set('wx', w.id); setWeather(w.id); renderMenu(); }, 'wx-' + w.id));
  if (windId !== 'calm') $('windList').appendChild(chip('From ' + WDIRS[wdirIdx].n + ' ↻', false, () => { wdirIdx = (wdirIdx + 1) % WDIRS.length; store.set('wdir', wdirIdx); loadAircraft(); renderMenu(); }, 'wdir'));
  $('missionList').innerHTML = '';
  for (const m of MISSIONS) {
    const b = document.createElement('button'), best = missionBest(m.id);
    b.className = 'card mission'; b.id = 'mi-' + m.id; b.setAttribute('aria-pressed', m.id === missionId);
    const bestTxt = best ? (best.time != null ? 'Best time ' + fmtTime(best.time) : 'Best ' + best.points + ' points') : 'Not flown yet';
    b.innerHTML = `<span class="n">${m.title}</span><span class="s">${m.sub}</span><span class="st">${bestTxt}</span>`;
    b.onclick = () => { missionId = m.id; store.set('mission', m.id); loadAircraft(); renderMenu(); };
    $('missionList').appendChild(b);
  }
  const m = MISSIONS.find(m => m.id === missionId);
  $('missionBrief').textContent = m.brief + ` Wind ${String(m.wind.dir).padStart(3, '0')}° ${m.wind.kt} kt` + (m.wx ? ', ' + wxLabel(WEATHERS.find(w => w.id === m.wx)).toLowerCase() : '') + (m.tod ? ', at night.' : '.');
  try { $('tutGo').hidden = localStorage.getItem('alandsflyg.tutDone') === '1'; } catch (e) { $('tutGo').hidden = true; }
  $('rotHint').hidden = !(innerHeight > innerWidth && matchMedia('(pointer:coarse)').matches);
  $('guide').setAttribute('aria-pressed', guideOn); $('guide').textContent = guideOn ? 'Landing guide on' : 'Landing guide off';
  $('miniOpt').setAttribute('aria-pressed', MINI.on); $('miniOpt').textContent = MINI.on ? 'Mini map on' : 'Mini map off';
}
function setTab(t) { tab = t; store.set('tab', t); loadAircraft(); renderMenu(); }
$('tabFree').onclick = () => setTab('free');
$('tabMission').onclick = () => setTab('mission');
$('tabRoute').onclick = () => setTab('route');
function hideOverlays() { for (const id of ['menu', 'crash', 'result', 'loading', 'keys']) $(id).hidden = true; }
function showMenu() {
  CG.stop();
  mode = 'menu'; paused = false; mapToggle(false); AP.on = false; WARP = 1;
  hideOverlays(); $('menu').hidden = false; $('ui').hidden = true;
  missionStart(null);
  loadAircraft(); renderMenu();
}
async function waitTerrain(pos) {
  if (terrainPending(pos, 25000)[0] === 0) { computeDesired(pos); if (terrainPending(pos, 25000)[0] === 0) return; }
  mode = 'loading'; hideOverlays(); $('loading').hidden = false; $('ui').hidden = true;
  $('loadMsg').textContent = 'Loading terrain…';
  await ensureTerrain(pos.clone(), p => { $('loadBar').style.width = Math.round(p * 100) + '%'; });
  updateBuildings(pos); updateNearForest(pos);
}
async function startFlight() {
  audioInit();
  loadAircraft();
  await waitTerrain(sim.pos);
  missionStart(tab === 'mission' ? MISSIONS.find(m => m.id === missionId) : null);
  mode = 'fly'; paused = false;
  hideOverlays(); $('ui').hidden = false;
  fitThrottle(); hudResize(); stickRest(); if (MINI.on) miniResize();
  CABIN.belts = sim.onGround;
  CG.start(); trackEvent('flight_start', { ac: acId, start: tab === 'mission' ? missionId : startId, tab });
  try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => {}); } catch (e) {}
}
$('go').onclick = startFlight;
// snabbstart: bushplanet på inflygning till Mariehamn, i luften direkt
$('quickGo').onclick = () => { tab = 'free'; store.set('tab', tab); acId = 'beaver'; store.set('ac', acId); startId = 'app'; store.set('start', startId); trackEvent('quick_fly'); startFlight(); };
// naturlig paus: midgame-annons på portalen (ljudet pausas under annonsen)
function portalBreak() { CG.stop(); CG.midgame(() => { try { AU.ctx && AU.ctx.suspend(); } catch (e) {} }, () => { try { AU.ctx && AU.ctx.resume(); } catch (e) {} }); }
$('tutGo').onclick = () => { tab = 'mission'; store.set('tab', tab); missionId = 'tutorial'; store.set('mission', missionId); startFlight(); };
// uppdrag som flyttar planet mitt i flygningen (första flygningen hoppar till inflygningen)
async function missionReposition(start) {
  const easy = sim.easy, assist = sim.assist;
  sim = createState(acId, start, currentWind()); sim.easy = easy; sim.assist = assist;
  LAND.touches = 0; LAND.toast = null; MAP.track = []; camInit = false; input.thr = sim.thr; WARP = 1; AP.on = false; ATHR.on = false; guideReset();
  await waitTerrain(sim.pos);
  mode = 'fly'; hideOverlays(); $('ui').hidden = false; syncButtons();
}
$('miniOpt').onclick = () => { miniToggle(); renderMenu(); };
$('keysClose').onclick = () => { $('keys').hidden = true; };
$('guide').onclick = () => { guideOn = !guideOn; store.set('guide', guideOn ? '1' : '0'); renderMenu(); };
$('retry').onclick = startFlight; $('toMenu').onclick = showMenu;
$('rRetry').onclick = startFlight; $('rMenu').onclick = showMenu;
$('rFly').onclick = () => { MS.state = 'idle'; clearMarkers(); mode = 'fly'; hideOverlays(); $('ui').hidden = false; CG.start(); };
$('fs').onclick = () => { try { const d = document.documentElement, f = d.requestFullscreen || d.webkitRequestFullscreen; const p = f && f.call(d); if (p && p.catch) p.catch(() => {}); } catch (e) {} };

// ---------- knappar ----------
function syncButtons() {
  if (!sim) return;
  requestAnimationFrame(fitThrottle);
  const A = sim.ac;
  const H = !!A.heli;
  $('bGear').hidden = !A.retract;
  $('bTrimU').hidden = $('bTrimD').hidden = A.fbw;
  $('bFlapUp').hidden = $('bFlapDn').hidden = H;
  $('bBelts').hidden = $('bCabin').hidden = H;
  $('bAssist').hidden = !H; $('bAssist').classList.toggle('on', !!sim.assist); $('bAssist').textContent = sim.assist ? 'ASSIST ON' : 'ASSIST OFF';
  $('thrLbl').textContent = H ? (sim.assist ? 'V/S' : 'COLL') : 'THR';
  $('thr').classList.toggle('vs', H && !!sim.assist);
  $('bGear').classList.toggle('on', A.retract && !sim.gearDown);
  $('bGear').textContent = A.retract ? (sim.gearDown ? 'GEAR ↓' : 'GEAR ↑') : 'GEAR';
  $('bCam').classList.toggle('on', camMode !== 'chase'); $('bCam').textContent = camMode === 'chase' ? 'VIEW' : camMode === 'cockpit' ? 'COCKPIT' : 'HUD';
  $('bPause').classList.toggle('on', paused);
  $('bSound').classList.toggle('on', !AU.on);
  $('bBrake').hidden = A.floats || H;
  $('bSpd').hidden = !A.spoilers; $('bSpd').classList.toggle('on', !!sim.speedbrake);
  $('bBelts').classList.toggle('on', CABIN.belts);
  $('bAP').classList.toggle('on', AP.on); $('bAP').textContent = AP.on ? (AP.app ? 'AUTOLAND ' + ({ APP: 'APP', FLARE: 'FLARE', ROLL: 'ROLL' }[AP.lat] || '') : 'AP ' + AP.lat) : 'AP';
  $('bATHR').hidden = H || AP.on; $('bATHR').classList.toggle('on', ATHR.on);
  $('bAuto').hidden = !autolandReady();
  $('bWarp').textContent = '▶ ×' + WARP; $('bWarp').classList.toggle('on', WARP > 1);
  $('bJump').hidden = !ROUTE.on;
  $('bInstr').hidden = camMode !== 'cockpit'; $('bInstr').textContent = CK_SIZES[CK_SIZE].n;
}
// autolandning går att koppla in när man är på väg in mot en bana
function autolandReady() {
  if (!sim || sim.ac.heli || sim.ac.floats || AP.on || sim.onGround || mode !== 'fly') return false;
  const ap = approachInfo(sim);
  return !!ap && ap.dist > 300 && ap.dist < (isBig(sim.ac) ? 22000 : 9000) && Math.abs(ap.c) < ap.dist * 0.4 + 150;
}
const act = {
  flapDn() { if (sim && !sim.ac.heli) sim.flap = Math.min(sim.flap + 1, sim.ac.flaps.length - 1); },
  flapUp() { if (sim) sim.flap = Math.max(sim.flap - 1, 0); },
  gear() { if (sim && sim.ac.retract && !(sim.onGround && sim.gearDown)) { sim.gearDown = !sim.gearDown; syncButtons(); } },
  trim(d) {
    // helikoptern med stöd: TRIM ställer marschfarten som den håller med släppt spak
    if (sim && sim.ac.heli && sim.assist) sim.hspd = clamp((sim.hspd || 0) + d * 1.6, 0, 72);
    else if (sim && sim.ac.heli) sim.htrim = clamp((sim.htrim || 0) - d * 0.5, -14, 6);
    else if (sim && !sim.ac.fbw) sim.trim = clamp(sim.trim + d * 0.006, -0.15, 0.15);
  },
  cam() { camMode = camMode === 'chase' ? 'cockpit' : camMode === 'cockpit' ? 'hud' : 'chase'; store.set('cam', camMode); camInit = false; syncButtons(); },
  pause() { if (mode === 'fly') { paused = !paused; if (paused) CG.stop(); else CG.start(); syncButtons(); } },
  sound() { AU.on = !AU.on; store.set('sound', AU.on ? '1' : '0'); if (AU.on) audioInit(); syncButtons(); },
  map() { if (mode === 'fly') mapToggle(); },
  spd() { if (sim && sim.ac.spoilers) { sim.speedbrake = !sim.speedbrake; syncButtons(); } },
  assist() {
    if (!sim || !sim.ac.heli) return;
    sim.assist = !sim.assist; store.set('hassist', sim.assist ? '1' : '0');
    // byt utan ryck: i stödläget betyder mitten att höjden hålls, annars ta över nuvarande kollektiv
    input.thr = sim.thr = sim.assist ? (sim.onGround ? 0 : 0.5) : (sim.coll || sim.thr);
    syncButtons();
  },
  ap() { if (!sim) return; if (AP.on) apOff(); else apOn(sim); input.thr = sim.thr; syncButtons(); },
  athr() { if (!sim || sim.ac.heli || AP.on) return; if (ATHR.on) athrOff(); else athrOn(sim); syncButtons(); },
  autoland() { if (!sim || AP.on || !autolandReady()) return; apOn(sim); input.thr = sim.thr; syncButtons(); },
  warp(d) {
    if (!sim) return;
    if (!warpAllowed(sim)) { WARP = 1; apMsg(AP.on ? (sim.ac.heli ? 'NO TIME WARP LOW OR CLOSE TO THE TARGET' : 'NO TIME WARP NEAR THE GROUND OR ON APPROACH') : 'ENGAGE THE AUTOPILOT TO TIME WARP'); syncButtons(); return; }
    const i = WARPS.indexOf(WARP); WARP = WARPS[d < 0 ? Math.max(i - 1, 0) : (i + 1) % WARPS.length]; syncButtons();
  },
  async jump() {
    if (!ROUTE.on || mode !== 'fly') return;
    const st = jumpStart(acId), keepModel = model;
    sim = createState(acId, st, currentWind());
    sim.gearDown = !AIRCRAFT[acId].retract; sim.gearPos = sim.gearDown ? 1 : 0;
    LAND.touches = 0; MAP.track = []; camInit = false; WARP = 1;
    ROUTE.idx = ROUTE.wp.length - 2;
    await waitTerrain(sim.pos);
    mode = 'fly'; hideOverlays(); $('ui').hidden = false;
    AP.on = false; apOn(sim); AP.lat = 'NAV'; ROUTE.idx = ROUTE.wp.length - 2; input.thr = sim.thr;
    syncButtons();
  }
};
const tap = (id, fn) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); fn(); });
tap('bFlapDn', () => act.flapDn()); tap('bFlapUp', () => act.flapUp()); tap('bGear', () => act.gear()); tap('bCam', () => act.cam());
tap('bPause', () => act.pause()); tap('bSound', () => act.sound()); tap('bMenu', () => showMenu()); tap('bMap', () => act.map()); tap('bBelts', () => toggleBelts()); tap('bSpd', () => act.spd()); tap('bCabin', () => cabinAnnounce()); tap('bAP', () => act.ap()); tap('bATHR', () => act.athr()); tap('bAuto', () => act.autoland()); tap('bInstr', () => { CK_SIZE = (CK_SIZE + 1) % 3; try { localStorage.setItem('alandsflyg.ck', CK_SIZE); } catch (e) {} syncButtons(); }); tap('bWarp', () => act.warp(1)); tap('bAssist', () => act.assist()); tap('bJump', () => act.jump());
let trimHold = 0;
for (const [id, d] of [['bTrimU', -1], ['bTrimD', 1]]) {
  $(id).addEventListener('pointerdown', e => { e.preventDefault(); trimHold = d; });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $(id).addEventListener(ev, () => { trimHold = 0; });
}
$('bBrake').addEventListener('pointerdown', e => { e.preventDefault(); input.brakeTouch = true; $('bBrake').classList.add('on'); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('bBrake').addEventListener(ev, () => { input.brakeTouch = false; $('bBrake').classList.remove('on'); });

(function throttle() {
  const el = $('thr'); let id = null;
  const set = e => { const r = el.getBoundingClientRect(); input.thr = clamp(1 - (e.clientY - r.top) / r.height, 0, 1); };
  el.addEventListener('pointerdown', e => { e.preventDefault(); id = e.pointerId; el.setPointerCapture(id); set(e); if (ATHR.on) { athrOff('AUTOTHRUST OFF · YOU HAVE THE THROTTLE'); syncButtons(); } });
  el.addEventListener('pointermove', e => { if (e.pointerId === id) set(e); });
  for (const ev of ['pointerup', 'pointercancel']) el.addEventListener(ev, e => { if (e.pointerId === id) id = null; });
})();
let stickRest = () => {};
(function stick() {
  const zone = $('stickZone'), base = $('stickBase'), knob = $('stickKnob');
  let id = null, ox = 0, oy = 0; const R = 58;
  stickRest = () => { base.style.left = 'calc(100% - 100px)'; base.style.top = 'calc(100% - 100px)'; knob.style.transform = ''; base.classList.add('idle'); };
  stickRest();
  zone.addEventListener('pointerdown', e => {
    e.preventDefault(); if (id != null) return;
    id = e.pointerId; zone.setPointerCapture(id);
    const r = zone.getBoundingClientRect(); ox = e.clientX; oy = e.clientY;
    base.style.left = (ox - r.left) + 'px'; base.style.top = (oy - r.top) + 'px'; base.classList.remove('idle');
  });
  zone.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    let dx = e.clientX - ox, dy = e.clientY - oy; const l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    input.stickX = dx / R; input.stickY = dy / R;
  });
  for (const ev of ['pointerup', 'pointercancel']) zone.addEventListener(ev, e => { if (e.pointerId !== id) return; id = null; input.stickX = input.stickY = 0; stickRest(); });
})();

addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  input.kb[k] = true;
  if (e.repeat) return;
  if (mode !== 'fly') { if (k === 'enter' && mode === 'menu') startFlight(); return; }
  if (k === 'f') act.flapDn(); if (k === 'v') act.flapUp(); if (k === 'g') act.gear(); if (k === 'c') act.cam();
  if (k === 'p') act.pause(); if (k === 'l' && !e.shiftKey) act.sound(); if (k === 'm') act.map(); if (k === 'n') miniToggle(); if (k === 'u') act.spd(); if (k === 'o') act.ap(); if (k === '[') act.athr(); if (k === ']') act.autoland(); if (k === '.') act.warp(1); if (k === ',') act.warp(-1); if (k === 'i') { const i = (TIMES.findIndex(t => t.id === todId) + 1) % TIMES.length; todId = TIMES[i].id; store.set('tod', todId); todCur = TIMES[i].h; setTimeOfDay(TIMES[i].h); } if (k === 'v' && sim && sim.ac.heli) act.assist(); if (k === 'k') toggleBelts(); if (k === 'j') cabinAnnounce(); if (k === 'h' || k === '?') $('keys').hidden = !$('keys').hidden; if (k === 'r') startFlight(); if (k === 'escape') showMenu();
});
addEventListener('keyup', e => { input.kb[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { input.kb = {}; });

function updateInputs(dt) {
  const kb = input.kb;
  const tgt = (p, n) => (kb[p[0]] || kb[p[1]] ? 1 : 0) - (kb[n[0]] || kb[n[1]] ? 1 : 0);
  const ramp = (cur, t) => cur + clamp(t - cur, -dt * 3, dt * 3);
  input.kbE = ramp(input.kbE, tgt(['arrowdown', 's'], ['arrowup', 'w']));
  input.kbR = ramp(input.kbR, tgt(['arrowright', 'd'], ['arrowleft', 'a']));
  input.kbRud = ramp(input.kbRud, tgt(['e', 'x'], ['q', 'z']));
  const kThr = (kb['shift'] || kb['+'] || kb['='] || kb['pageup']) ? 1 : (kb['control'] || kb['-'] || kb['pagedown']) ? -1 : 0;
  if (kThr && ATHR.on) { athrOff('AUTOTHRUST OFF · YOU HAVE THE THROTTLE'); syncButtons(); }
  if (kThr) input.thr = clamp(input.thr + kThr * dt * 0.5, 0, 1);
  if (kb['t']) act.trim(-dt * 8); if (kb['y']) act.trim(dt * 8);
  if (trimHold) act.trim(trimHold * dt * 8);
  const expo = v => Math.sign(v) * Math.pow(Math.abs(v), 1.6);
  if (AP.on) {
    // piloten tar över om spaken används
    if (Math.abs(input.stickX) > 0.35 || Math.abs(input.stickY) > 0.35 || Math.abs(input.kbE) > 0.5 || Math.abs(input.kbR) > 0.5) { apOff('PILOT TOOK OVER'); syncButtons(); }
    else { input.thr = sim.thr; sim.brake = 0; return; }
  }
  sim.inp.e = clamp(expo(input.stickY) + input.kbE, -1, 1);
  sim.inp.r = clamp(expo(input.stickX) + input.kbR, -1, 1);
  sim.inp.rud = sim.ac.heli ? input.kbRud : clamp(input.kbRud + sim.inp.r * (sim.onGround ? 1 : 0.22), -1, 1);
  if (ATHR.on && !sim.ac.heli) {
    // autogas: följer den rosa målfarten; drar av gasen i utplaningen och kopplar ur på marken
    const ap = approachInfo(sim), fk = FLAREK[sim.ac.cls] || FLAREK.ga;
    if (sim.onGround) { athrOff('AUTOTHRUST OFF'); syncButtons(); input.thr = 0; }
    else if (ap && ap.dist < 1500 && ft(sim.agl) < fk[2] * 1.2) { input.thr = Math.max(0, input.thr - dt * 0.5); if (!ATHR.retard) { ATHR.retard = true; if (sim.ac.callouts) say('retard'); } }
    else { ATHR.retard = false; input.thr = autothrottle(sim, speedTarget(sim, ap), dt, ATHR); }
  }
  if (!sim.alphaFloor) sim.thr = input.thr; else input.thr = sim.thr;
  sim.brake = (kb['b'] || kb[' '] || input.brakeTouch) ? 1 : 0;
}

// ---------- kamera ----------
let camInit = false, orbitA = 0, ckLook = -8 * DEG;
const camPos = new THREE.Vector3(), _c1 = new THREE.Vector3(), _c2 = new THREE.Vector3(), _lookQ = new THREE.Quaternion(), _xAxis = new THREE.Vector3(1, 0, 0);
function setNear(n) { if (camera.near !== n) { camera.near = n; camera.updateProjectionMatrix(); } }
function updateCamera(dt) {
  const A = sim.ac;
  // bredbildsskärm: smalare vertikal synvinkel så att banor och mål inte blir pyttesmå (vågrätt ca 90°)
  // inifrån (HUD) har samma vida synfält som förr, så att man ser banan rusa förbi vid starten
  const wide = camera.aspect > 1.3, fovOut = mode === 'fly' && camMode === 'hud' ? 62 : (wide ? 54 : 62);
  if ((mode !== 'fly' || camMode !== 'cockpit') && camera.fov !== fovOut) { camera.fov = fovOut; camera.updateProjectionMatrix(); }
  if (mode === 'menu' || mode === 'loading') {
    orbitA += dt * 0.12;
    const d = A.chase[2] * 1.15;
    camera.position.set(sim.pos.x + Math.sin(orbitA) * d, sim.pos.y + A.chase[1] * 0.55 + 2, sim.pos.z + Math.cos(orbitA) * d);
    camera.up.set(0, 1, 0); camera.lookAt(sim.pos.x, sim.pos.y + 0.5, sim.pos.z); setNear(1.5); return;
  }
  if (camMode === 'cockpit' || camMode === 'hud') {
    camera.position.copy(_c1.fromArray(A.cockpit).applyQuaternion(sim.q).add(sim.pos));
    camera.quaternion.copy(sim.q);
    // sporrhjulsplanet står med nosen 10° upp på marken: piloten tittar ner mer så att banan syns
    const lookT = CK_LOOK[CK.kind] - (sim.onGround && !A.retract ? Math.max(sim.pitch, 0) : 0);
    ckLook += (lookT - ckLook) * (1 - Math.exp(-dt * 3));
    if (camMode === 'cockpit') camera.quaternion.multiply(_lookQ.setFromAxisAngle(_xAxis, ckLook));
    const fv = camMode === 'cockpit' ? CK_FOV : fovOut; if (camera.fov !== fv) { camera.fov = fv; camera.updateProjectionMatrix(); }
    setNear(1.2); return;
  }
  const h = sim.hdg * DEG, fx = Math.sin(h), fz = -Math.cos(h);
  _c1.set(sim.pos.x - fx * A.chase[2], sim.pos.y + A.chase[1], sim.pos.z - fz * A.chase[2]);
  _c1.y = Math.max(_c1.y, Math.max(terrainH(_c1.x, _c1.z), 0) + 2);
  if (!camInit) { camPos.copy(_c1); camInit = true; }
  camPos.lerp(_c1, 1 - Math.exp(-dt * 4));
  camera.position.copy(camPos); camera.up.set(0, 1, 0);
  camera.lookAt(_c2.set(0, 0, -A.chase[2] * 0.4).applyQuaternion(sim.q).add(sim.pos));
  setNear(A.chase[2] > 30 ? 3 : 1.5);
}

// ---------- ljud: se js/audio.js ----------

// ---------- visuellt ----------
function updateVisuals(dt) {
  const S = sim, A = S.ac;
  model.group.position.copy(S.pos); model.group.quaternion.copy(S.q);
  if (model.prop) {
    const rps = mode === 'fly' || mode === 'result' ? (S.crashed ? 0 : 6 + S.thr * 30) : 0;
    model.prop.rotation.z += rps * dt * 2 * Math.PI * 0.37;
    model.disc.material.opacity = clamp((rps - 8) / 40, 0, 0.32);
    model.prop.children[0].visible = rps < 30 && !(mode === 'fly' && camMode !== 'chase');
  }
  if (model.props) {
    const run = (mode === 'fly' || mode === 'result') && !S.crashed;
    const rps = run ? 12 + S.thr * 6 : 0;
    for (const p of model.props) {
      p.g.rotation.z += p.dir * rps * dt * 2 * Math.PI * 0.11;
      p.disc.material.opacity = clamp((rps - 4) / 10, 0, 1) * 0.28;
      p.blades.visible = rps < 6;
    }
  }
  if (A.heli) updateWash(S, dt, mode === 'fly' || mode === 'result'); else if (WASH.pts) WASH.pts.visible = false;
  if (model.rotor) {
    const run = (mode === 'fly' || mode === 'result') && !S.crashed;
    model.rps += ((run ? 6.4 : 0) - model.rps) * (1 - Math.exp(-dt * (run ? 0.5 : 0.25)));
    model.rotor.rotation.y -= model.rps * dt * 2 * Math.PI * (model.rps > 4 ? 0.13 : 1);
    model.disc.material.opacity = clamp((model.rps - 2) / 3, 0, 1) * 0.3;
    model.blades.visible = model.rps < 4;
  }
  const cock = mode === 'fly' && camMode !== 'chase';
  if (model.cockpitParts) { model.group.visible = true; model.group.traverse(o => { if (o.userData.body) o.visible = !cock; }); }
  else model.group.visible = !cock;
  terrainUniforms.uTime.value += dt;
  LIGHTU.uTime.value += dt;
  updateNearForest(camera.position);
  updateAircraftLights(S, model);
  // tunnare dis högre upp
  scene.fog.density = FOG_BASE;
  wxFrame(dt, camera.position, mode === 'fly' ? S : null);
  S.wxTurb = wxTurb(S.pos.y);
  if (model.gear) { model.gear.visible = S.gearPos > 0.02; model.gear.scale.y = 0.3 + 0.7 * S.gearPos; }
  sunLight.position.copy(S.pos).addScaledVector(LDIR, 600); sunLight.target.position.copy(S.pos);
  sky.position.copy(camera.position);
  updatePAPI(camera.position); updateWindsocks(S); updateTurbines(S, dt);
  // ringar pulserar svagt
  for (const m of markerGroup.children) if (m.isMesh) m.material.opacity = m.material.opacity > 0.5 ? 0.75 + Math.sin(performance.now() / 300) * 0.2 : m.material.opacity;
}
// gasreglaget får aldrig nå upp till knapparna uppe till vänster, oavsett skärm eller ram runt sidan
function fitThrottle() {
  const thr = $('thr'), ab = document.querySelector('.apbar');
  if (!thr || !ab || $('ui').hidden) return;
  thr.style.height = '';
  const t = thr.getBoundingClientRect(), b = ab.getBoundingClientRect();
  const minTop = b.bottom + 26; // knoppen sticker ut 19 px ovanför reglaget
  if (t.top < minTop) thr.style.height = Math.max(110, t.bottom - minTop) + 'px';
}
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  hudResize(); lightsResize(); if (MAP.open) mapResize(); if (MINI.on) miniResize();
  if (mode === 'menu') renderMenu();
  fitThrottle();
}
addEventListener('resize', resize);

// ---------- kabin: plingar och utrop ----------
const CABIN = { belts: true };
function chime(kind) {
  if (!AU.ctx || !AU.on) return;
  const C = AU.ctx, t0 = C.currentTime + 0.02, out = C.createGain(); out.gain.value = 0.32; out.connect(C.destination);
  const tone = (f, t, dur) => {
    for (const [mul, amp] of [[1, 1], [2.01, 0.28], [3.02, 0.08]]) {
      const o = C.createOscillator(), g = C.createGain();
      o.type = 'sine'; o.frequency.value = f * mul;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
    }
  };
  if (kind === 'ding') tone(1046, t0, 1.6);              // bältesskylten
  else if (kind === 'tick') { out.gain.value = 0.12; tone(1568, t0, 0.25); } // passerad grind
  else if (kind === 'win') { tone(784, t0, 0.5); tone(988, t0 + 0.12, 0.5); tone(1175, t0 + 0.24, 0.5); tone(1568, t0 + 0.36, 1.4); } // lyckad landning
  else { tone(1175, t0, 1.3); tone(880, t0 + 0.55, 1.6); } // kabinsignal hög–låg
}
function sayLocal(txt, lang) {
  if (!AU.on || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(txt); u.lang = lang; u.rate = 1.0;
    const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith(lang.slice(0, 2)));
    if (v) u.voice = v;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) {}
}
function toggleBelts() {
  CABIN.belts = !CABIN.belts; chime('ding'); syncButtons();
}
function cabinAnnounce() {
  const S = sim; chime('dingdong');
  let near = ZONES[0], nd = Infinity;
  for (const z of ZONES) { if (z.kind === 'scene' || z.kind === 'helipad') continue; const d = Math.hypot(z.x - S.pos.x, z.z - S.pos.z); if (d < nd) { nd = d; near = z; } }
  const field = (APT[near.apt] || {}).name || near.name;
  let txt;
  if (ROUTE.on && near.apt === ROUTE.to.icao) near = ROUTE.zone;
  if (S.onGround && S.touches === 0) txt = 'Ladies and gentlemen, welcome on board' + (ROUTE.on ? ' this flight to ' + ROUTE.to.name : '') + '. Please fasten your seat belt and stow your tray table. We will be taking off shortly.';
  else if (S.onGround) txt = 'Welcome to ' + field + '. Please remain seated with your seat belt fastened until the aircraft has come to a complete stop.';
  else if (S.vs < -2 && nd < 15000) txt = 'We have started our approach to ' + field + '. Cabin crew, prepare for landing.';
  else txt = 'This is your captain speaking. We are now flying at ' + Math.round(S.pos.y * 3.281 / 100) * 100 + ' feet' + (ROUTE.on ? ', and expect to land in ' + ROUTE.to.name + ' in about ' + Math.max(1, Math.round(routeRemaining(S) / Math.max(S.gs, 30) / 60)) + ' minutes. ' : ' over the archipelago. ') + (CABIN.belts ? 'The seat belt sign is on, please remain seated with your seat belt fastened.' : 'The seat belt sign is off, but please keep your belt loosely fastened while seated.');
  setTimeout(() => sayLocal(txt, 'en-GB'), 1600);
}

// ---------- landningsbetyg och utrop ----------
const LAND = { touches: 0, lastT: -9, toast: null, raPrev: 9999, said: {} };
function landingWatch(S) {
  if (S.touches === LAND.touches) return;
  LAND.touches = S.touches;
  const t = S.touch, fpm = -t.vs * 196.85, bounce = t.t - LAND.lastT < 2.5, A = S.ac;
  LAND.lastT = t.t;
  if (bounce && LAND.toast) { LAND.toast.txt = 'BOUNCE'; LAND.toast.col = C_AMBER; LAND.toast.stars = Math.min(LAND.toast.stars, 1); LAND.toast.best = false; return; }
  const rw = inRunway(t.x, t.z, 2), lines = [], auto = AP.on && AP.app;
  let stars = 0, txt, col = C_HUD, best = false;
  const sinkOk = fpm < 300;
  lines.push([Math.round(fpm) + ' ft/min' + (fpm < 120 ? ' · butter' : fpm < 300 ? ' · smooth' : fpm < 450 ? ' · firm' : ' · hard'), sinkOk]);
  if (rw && !rw.small && !A.heli) {
    const ap = approachInfo(S) || approachGeom(S, rw, 0);
    const cOk = Math.abs(ap.c) < Math.max(3, rw.wid * 0.12);
    const lo = Math.max(40, A.tdz * 0.35), hi = A.tdz + (isBig(A) ? 600 : 280), tdzOk = ap.fromThr > lo && ap.fromThr < hi;
    const vr = vref(A), ias = kt(S.ias), spdOk = ias > vr - 25 && ias < vr + 10;
    lines.push([Math.abs(ap.c).toFixed(1) + ' m from the centreline', cOk]);
    lines.push([Math.round(ap.fromThr) + ' m past the threshold' + (tdzOk ? ' · in the touchdown zone' : ap.fromThr <= lo ? ' · too short' : ' · long'), tdzOk]);
    lines.push([Math.round(ias) + ' kt' + (spdOk ? ' · right speed' : ias >= vr + 10 ? ' · too fast' : ' · slow'), spdOk]);
    stars = (sinkOk ? 1 : 0) + (cOk ? 1 : 0) + (tdzOk ? 1 : 0);
    if (!spdOk && stars === 3) stars = 2;
    txt = fpm >= 450 ? 'HARD LANDING' : stars === 3 && fpm < 120 ? 'BUTTER! PERFECT LANDING' : stars === 3 ? 'GREAT LANDING' : stars === 2 ? 'GOOD LANDING' : 'LANDED';
    col = stars >= 2 && fpm < 450 ? C_OK : stars === 1 ? C_AMBER : C_WARN;
    if (auto) { txt = 'AUTOLAND · ' + txt; }
    else {
      // bästa landning per flygplan och bana sparas
      const k = 'best.' + acId + '.' + rw.id, prev = JSON.parse(store.get(k, 'null') || 'null');
      if (!prev || stars > prev.s || (stars === prev.s && fpm < prev.f)) { best = !!prev || stars === 3; store.set(k, JSON.stringify({ s: stars, f: Math.round(fpm) })); }
    }
  } else if (rw && (rw.small || A.heli)) {
    const [, c] = zoneLocal(rw, t.x, t.z); const cOk = Math.abs(c) < 4;
    lines.push([Math.abs(c).toFixed(1) + ' m from the ' + (rw.kind === 'helipad' ? 'pad centre' : 'centre'), cOk]);
    stars = (sinkOk ? 2 : 0) + (cOk ? 1 : 0); txt = fpm < 120 ? 'BUTTER LANDING' : sinkOk ? 'NICE LANDING' : 'HARD LANDING'; col = sinkOk ? C_OK : C_WARN;
  } else if (t.water) { stars = sinkOk ? 2 + (fpm < 150 ? 1 : 0) : 0; txt = sinkOk ? 'NICE WATER LANDING' : 'HARD SPLASHDOWN'; col = sinkOk ? C_OK : C_WARN; }
  else { txt = 'OFF THE RUNWAY'; col = C_AMBER; stars = 0; }
  LAND.toast = { txt, col, stars, best, lines, t0: performance.now(), until: performance.now() + 9000 };
  if (stars >= 2 && fpm < 450) chime('win');
  LAND.said = {};
}
let voices = null;
function say(txt) {
  if (!AU.on || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(txt); u.lang = 'en-US'; u.rate = 1.15; u.volume = 0.9;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) {}
}
function callouts(S) {
  if (!S.ac.callouts) return;
  const ra = ft(Math.max(S.agl, 0));
  if (S.onGround || S.vs > 0.5) { if (ra > 300) LAND.said = {}; LAND.raPrev = ra; return; }
  for (const [h, w] of [[1000, 'one thousand'], [500, 'five hundred'], [100, 'one hundred'], [50, 'fifty'], [40, 'forty'], [30, 'thirty'], [20, 'twenty'], [10, 'ten']]) {
    if (LAND.raPrev > h && ra <= h && !LAND.said[h]) { LAND.said[h] = 1; say(h === 20 && S.thr > 0.1 ? 'retard' : w); }
  }
  LAND.raPrev = ra;
}

// ---------- gasguide: rosa markering på gasreglaget där gasen ungefär ska stå för att hålla den rosa farten ----------
// Utgår från nuvarande gas och rättar med fartfelet om 6 sekunder (fart + trend), som A/THR gör. Grön när du ligger rätt.
const THRH = { v: null, el: null, st: null };
function throttleHint(dt) {
  if (!THRH.el) THRH.el = $('thrSug');
  const S = sim, A = S.ac;
  const ap = !A.heli && guideOn && !AP.on && !ATHR.on && !S.onGround ? approachInfo(S) : null;
  if (!ap || ap.dist < -100) { if (!THRH.el.hidden) THRH.el.hidden = true; THRH.v = null; THRH.st = null; return; }
  // samma lugna regulator som A/THR, men utan att röra gasen: följer du markeringen flyger du som A/THR
  if (!THRH.st) THRH.st = { at: S.thr, last: null };
  const fk = FLAREK[A.cls] || FLAREK.ga;
  let tgt = autothrottle(S, speedTarget(S, ap), dt, THRH.st);
  if (ap.dist < 1500 && ft(S.agl) < fk[2] * 1.2) { tgt = 0; THRH.st.at = 0; } // utplaning: tomgång
  THRH.v = THRH.v == null ? tgt : THRH.v + (tgt - THRH.v) * (1 - Math.exp(-dt * 3));
  THRH.el.hidden = false;
  THRH.el.style.top = ((1 - THRH.v) * 100).toFixed(1) + '%';
  THRH.el.classList.toggle('ok', Math.abs(S.thr - THRH.v) < 0.05);
}

// ---------- huvudloop ----------
let last = performance.now(), APK = 0;
const thrKnob = $('thrKnob'), thrFill = $('thrFill');
function showResult() {
  const r = MS.result; mode = 'result'; $('ui').hidden = true; mapToggle(false);
  $('rTitle').textContent = r.ok ? 'Mission complete' : 'Mission failed';
  $('result').querySelector('.crashbox').classList.toggle('ok', r.ok);
  $('rText').textContent = r.text + (r.best ? ' · new record!' : '');
  $('rLines').innerHTML = (r.lines || []).map(l => `<li>${l}</li>`).join('');
  $('result').hidden = false;
  if (r.ok) CG.happy();
  trackEvent('mission_result', { mission: MS.def && MS.def.id, ok: r.ok ? 1 : 0 });
  portalBreak();
}
let diffId = store.get('diff', 'easy'), showFps = store.get('fps', '0') === '1';
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = (now - last) / 1000, dt = Math.min(rawDt, 0.05); last = now;
  if (rawDt > 0 && rawDt < 1) perfUpdate(rawDt);
  if (!sim) return;
  if (mode === 'fly' && !paused) {
    updateInputs(dt);
    if (WARP > 1 && !warpAllowed(sim)) { WARP = 1; syncButtons(); }
    const sdt = dt * WARP, n = Math.max(1, Math.ceil(sdt / (1 / 240))), h = sdt / n;
    const apWas = AP.on;
    for (let i = 0; i < n; i++) { if (AP.on && (APK++ & 7) === 0) apUpdate(sim, h * 8); step(sim, h); }
    if (apWas !== AP.on) { if (sim.ac.heli && !AP.on) { sim.apVs = null; sim.thr = sim.assist ? 0.5 : (sim.coll || sim.thr); } input.thr = sim.thr; syncButtons(); }
    if (AP.on || ((now / 500) | 0) !== LAND.btnT) { LAND.btnT = (now / 500) | 0; if ($('bAuto').hidden === autolandReady() || AP.on) syncButtons(); }
    missionUpdate(sim, sdt);
    landingWatch(sim);
    callouts(sim);
    mapTrack(sim, sdt);
    if (sim.crashed) {
      mode = 'crash'; mapToggle(false);
      $('crashWhy').textContent = sim.crashed + '.';
      $('crash').hidden = false; $('ui').hidden = true;
      trackEvent('crash', { ac: acId });
      portalBreak();
    } else if (MS.state === 'done' || MS.state === 'failed') showResult();
  } else if (mode === 'result' && !sim.crashed) {
    // planet rullar ut efter uppdraget
    for (let i = 0; i < 4; i++) step(sim, dt / 4);
  }
  updateVisuals(dt);
  updateCamera(dt);
  updateTerrain(camera.position, mode === 'fly' ? (WARP > 1 ? 9 : 5) : 8);
  updateBuildings(camera.position);
  camera.updateMatrixWorld(); hazeCamera(camera);
  renderer.render(scene, camera);
  if (mode === 'fly' && camMode === 'cockpit') { updateCockpit(sim, dt); renderCockpit(sim); }
  HUDMIN = camMode === 'cockpit';
  drawHUD(sim, mode === 'fly', paused);
  if (mode === 'fly') drawGuide(sim, guideOn, LAND.toast);
  drawMap(sim);
  if (mode === 'fly') drawMini(sim);
  if (mode === 'fly') throttleHint(dt);
  if (mode === 'fly') { const t = sim.thr; thrKnob.style.top = ((1 - t) * 100) + '%'; thrFill.style.height = (t * 100) + '%'; const tx = sim.ac.heli && sim.assist && !AP.on ? (t > 0.42 && t < 0.58 ? 'HOLD' : (t > 0.5 ? '▲' : '▼') + Math.round(Math.abs(t > 0.5 ? (t - 0.58) / 0.42 * 8 : (t - 0.42) / 0.42 * 6) * 196.85 / 100) * 100) : String(Math.round(t * 100)); if (thrKnob.textContent !== tx) thrKnob.textContent = tx; }
  updateAudio();
  if (mode === 'fly') tutorialShow(sim); else if (!$('tut').hidden) $('tut').hidden = true;
}

// ---------- start ----------
// installerbar webbapp: service worker (bara på den riktiga sajten, inte i förhandsvisningar)
try { if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window) navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {}
(async function boot() {
  applyQuality(qId, false);
  resize();
  mapInit(); miniInit(); MINI.on = store.get('mini', '0') === '1'; $('mini').hidden = !MINI.on;
  const bar = $('loadBar'), msg = $('loadMsg');
  try {
    await buildWorld((m, p) => { msg.textContent = m; bar.style.width = Math.round(p * 100) + '%'; });
    msg.textContent = 'Drawing the chart…';
    await new Promise(r => setTimeout(r, 10));
    buildMapBase();
    applyTod();
  } catch (e) {
    msg.textContent = 'Could not build the world: ' + e.message; console.error(e); return;
  }
  loadAircraft();
  msg.textContent = 'Loading terrain…';
  await ensureTerrain(sim.pos.clone(), p => { bar.style.width = Math.round(55 + p * 45) + '%'; });
  showMenu();
  window.__afReady = true; CG.loadingStop();
  requestAnimationFrame(frame);
})();
