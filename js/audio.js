// ===================== LJUD =====================
// Motorerna syntetiseras sampel för sampel i en AudioWorklet utifrån hur de faktiskt låter:
//  - Beavern: niocylindrig stjärnmotor (R-985) med tändpulser i rätt takt, avgasknatter, baktändningar när
//    gasen dras av, och den tvåbladiga propellerns surr som blir rått när bladspetsarna närmar sig ljudfarten.
//  - Turbopropen: två sexbladiga propellrar som drönar på bladfrekvensen och svävar lite mot varandra,
//    plus turbinvisslan.
//  - Jetplanet: fläktens bladton, "buzz-saw" vid hög N1, kompressorvisslan och jetdånet (med knaster bakifrån).
//  - Helikoptern: bladslag från fyra rotorblad (hårdare i nedstigning och fart), turbiner och fenestron.
// Runt motorerna: fartvind, rullbrus och skarvar på banan, däck som tjuter när de spinner upp vid sättningen,
// ställ och luckor, klaffar, luftbromsar, skakningar vid överstegring, bromsar, regn och varningsljud.
const AU = { on: (() => { try { return localStorage.getItem('alandsflyg.sound') !== '0'; } catch (e) { return true; } })(), ctx: null, eng: null, st: null };

const AF_WORKLET = `
const TAU = Math.PI * 2, SR = sampleRate, TN = 2048;
function table(h, ph) {
  const t = new Float32Array(TN + 1); let m = 1e-9;
  for (let i = 0; i < TN; i++) { let v = 0; for (let k = 0; k < h.length; k++) if (h[k]) v += h[k] * Math.sin(TAU * (k + 1) * i / TN + (ph ? ph[k] : 0)); t[i] = v; if (Math.abs(v) > m) m = Math.abs(v); }
  for (let i = 0; i < TN; i++) t[i] /= m; t[TN] = t[0]; return t;
}
function rd(t, p) { const x = p * TN, i = x | 0, f = x - i; return t[i] + (t[i + 1] - t[i]) * f; }
function sv() { return { a: 0, b: 0, a1: 0, a2: 0, a3: 0, k: 1, lp: 0 }; }
function svs(f, fc, q) { const g = Math.tan(Math.PI * Math.min(Math.max(fc, 10), SR * 0.45) / SR); f.k = 1 / q; f.a1 = 1 / (1 + g * (g + f.k)); f.a2 = g * f.a1; f.a3 = g * f.a2; }
function svr(f, x) { const v3 = x - f.b, v1 = f.a1 * f.a + f.a2 * v3, v2 = f.b + f.a2 * f.a + f.a3 * v3; f.a = 2 * v1 - f.a; f.b = 2 * v2 - f.b; f.lp = v2; return v1; }
function op(fc) { return 1 - Math.exp(-TAU * fc / SR); }
function sm(a, b, x) { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); }
function wrap(p) { return p - Math.floor(p); }
class AFEngine extends AudioWorkletProcessor {
  constructor() {
    super();
    this.tg = { type: 'none', g: 0 }; this.p = {}; this.type = ''; this.s = null; this.dc = [0, 0, 0, 0];
    this.seed = 0x2545F491;
    this.port.onmessage = e => { const d = e.data; for (const k in d) this.tg[k] = d[k]; };
  }
  r() { let x = this.seed; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.seed = x; return x / 2147483648; }
  u() { return (this.r() + 1) / 2; }
  init(type) {
    this.type = type; this.p = {};
    const R = () => this.u();
    if (type === 'piston') {
      // varje cylinder låter lite olika: det ger stjärnmotorns ojämna, "klumpiga" puls
      this.s = { cyc: 0, next: 0, ci: 0, env: 0, penv: 0, body: 0, o: 0, pp: 0,
        amp: Array.from({ length: 9 }, () => 0.8 + 0.4 * R()), off: Array.from({ length: 9 }, () => (R() - 0.5) * 0.06),
        bark: sv(), crk: sv(), buzz: sv(), pop: sv(), pt: table([1, 0.55, 0.36, 0.24, 0.16, 0.11, 0.08, 0.06, 0.04, 0.03]) };
    } else if (type === 'tp') {
      const h = [1, 0.75, 0.5, 0.34, 0.24, 0.17, 0.12, 0.09, 0.07, 0.05, 0.04, 0.03];
      this.s = { p0: 0, p1: R(), w0: 0, w1: 0, rr: 0, oL: 0, oR: 0, bz0: sv(), bz1: sv(), hs: sv(),
        t0: table(h, h.map(() => R() * TAU)), t1: table(h, h.map(() => R() * TAU)) };
    } else if (type === 'jet') {
      // buzz-saw: fläktbladen är inte exakt lika, så vid överljudsfart i spetsarna hörs hela övertonsserien av axelvarvet
      const bz = () => Array.from({ length: 34 }, (_, k) => (0.25 + 0.75 * R() * R()) * Math.exp(-k / 14) * (k < 2 ? 0.5 : 1));
      const b0 = bz(), b1 = bz();
      this.s = { a: 0, b: R(), fa: 0, fb: 0, w: 0, w2: 0, lo: 0, ce: 0, oL: 0, oR: 0, ro: sv(), cr: sv(),
        ta: table(b0, b0.map(() => R() * TAU)), tb: table(b1, b1.map(() => R() * TAU)) };
    } else if (type === 'heli') {
      this.s = { b: 0, se: 0, lo: 0, f: 0, t: 0, g: 0, o: 0, sl: sv(), sh: sv(), wh: sv(), th: sv() };
    } else this.s = null;
  }
  piston(L, R, n, p) {
    const s = this.s, rpm = Math.max(p.rpm || 0, 0), load = p.load || 0, ins = p.inside || 0, out = 1 - ins, tip = p.tip || 0, pops = p.pops || 0;
    const rev = rpm / 60, cyc = rev / 2 / SR, ppInc = 2 * rev / SR;
    const rough = 0.25 + 0.75 * (1 - sm(900, 1800, rpm));
    const dec = Math.exp(-1 / (SR * 0.0032 * Math.sqrt(1500 / Math.max(rpm, 400)))), popDec = Math.exp(-1 / (SR * 0.035));
    svs(s.bark, 290 + 90 * load, 2.2); svs(s.crk, 1300, 1.1); svs(s.buzz, 1400 + 500 * tip, 0.8); svs(s.pop, 620, 0.9);
    const aBody = op(140 + 260 * load + 260 * out), aOut = op(2200 + 7000 * out);
    const vol = Math.min(rpm / 400, 1);
    const gBody = 2.4 * vol, gBark = (0.35 + 0.75 * load) * (0.55 + 0.6 * out) * vol, gCrk = 0.6 * out * (0.3 + load) * vol;
    const gTone = (0.06 + 0.22 * load) * (0.5 + 0.5 * Math.min(tip / 0.9, 1)) * vol;
    const gBuzz = sm(0.66, 0.93, tip) * (0.25 + 0.75 * load) * (0.35 + 0.55 * out) * 0.55 * vol;
    const gPop = 0.9 + 0.9 * out;
    for (let i = 0; i < n; i++) {
      s.cyc += cyc;
      if (s.cyc >= s.next) {
        const ci = s.ci; s.ci = (ci + 1) % 9;
        let a = s.amp[ci] * (0.28 + 0.72 * load) * (1 + 0.3 * rough * this.r());
        if (rough > 0.6 && this.r() > 0.93) a *= 0.2; // tomgångens ojämna tändningar
        s.env += a;
        if (pops > 0.02 && this.r() > 1 - pops * 0.2) s.penv = 0.9 + 0.6 * this.u();
        s.next += (1 + s.off[s.ci] + 0.05 * rough * this.r()) / 9;
      }
      if (s.cyc >= 1) { s.cyc -= 1; s.next -= 1; }
      s.env *= dec; s.penv *= popDec;
      const nz = this.r(), x = s.env * (0.75 + 0.25 * nz);
      s.body += aBody * (x - s.body);
      const bark = svr(s.bark, x), crk = svr(s.crk, x * nz), pop = svr(s.pop, s.penv * this.r());
      s.pp += ppInc; if (s.pp >= 1) s.pp -= 1;
      const cs = Math.cos(TAU * s.pp), sh = cs > 0 ? cs * cs * cs * cs : 0;
      const buzz = svr(s.buzz, this.r() * (0.2 + 1.6 * sh));
      const y = s.body * gBody + bark * gBark + crk * gCrk + pop * gPop + rd(s.pt, s.pp) * gTone + buzz * gBuzz;
      s.o += aOut * (y - s.o);
      L[i] = s.o; R[i] = s.o;
    }
  }
  tp(L, R, n, p) {
    const s = this.s, load = p.load || 0, ng = p.ng || 0, ins = p.inside || 0, out = 1 - ins, run = Math.min(ng / 0.3, 1);
    const inc0 = 6 * (p.rpmL || 0) / 60 / SR, inc1 = 6 * (p.rpmR || 0) / 60 / SR;
    const w0 = (1700 + 2600 * ng) / SR, w1 = w0 * 1.0037;
    svs(s.bz0, 720 + 320 * load, 0.8); svs(s.bz1, 760 + 320 * load, 0.8); svs(s.hs, 3300, 0.7);
    const aR = op(220 + 520 * load), aOut = op(2600 + 7000 * out);
    const gT = (0.12 + 0.34 * load) * run * (0.8 + 0.4 * ins), gB = (0.05 + 0.3 * load) * run * (0.35 + 0.65 * out);
    const gW = (0.02 + 0.04 * ng) * run * (0.7 + 0.5 * ins), gH = 0.06 * ng * run, gRr = (0.12 + 0.6 * load) * run * (0.4 + 0.6 * out);
    const pan = 0.22 + 0.16 * ins;
    for (let i = 0; i < n; i++) {
      s.p0 += inc0; if (s.p0 >= 1) s.p0 -= 1; s.p1 += inc1; if (s.p1 >= 1) s.p1 -= 1;
      s.w0 += w0; if (s.w0 >= 1) s.w0 -= 1; s.w1 += w1; if (s.w1 >= 1) s.w1 -= 1;
      const c0 = Math.cos(TAU * s.p0), c1 = Math.cos(TAU * s.p1), h0 = c0 > 0 ? c0 * c0 * c0 : 0, h1 = c1 > 0 ? c1 * c1 * c1 : 0;
      const e0 = rd(s.t0, s.p0) * gT + svr(s.bz0, this.r() * (0.3 + 1.4 * h0)) * gB + Math.sin(TAU * s.w0) * gW;
      const e1 = rd(s.t1, s.p1) * gT + svr(s.bz1, this.r() * (0.3 + 1.4 * h1)) * gB + Math.sin(TAU * s.w1) * gW;
      s.rr += aR * (this.r() - s.rr);
      const com = svr(s.hs, this.r()) * gH + s.rr * gRr;
      s.oL += aOut * (e0 * (0.5 + pan) + e1 * (0.5 - pan) + com - s.oL);
      s.oR += aOut * (e1 * (0.5 + pan) + e0 * (0.5 - pan) + com - s.oR);
      L[i] = s.oL; R[i] = s.oR;
    }
  }
  jet(L, R, n, p) {
    const s = this.s, ins = p.inside || 0, out = 1 - ins, n1 = p.n1 || 0, n2 = p.n2 || 0, Na = p.N1L || 0, Nb = p.N1R || 0;
    const f1a = Na * 83.3 / SR, f1b = Nb * 83.3 / SR, f2 = (2400 + 3600 * n2) / SR;
    const gBz = sm(0.8, 0.93, Math.max(Na, Nb)) * (0.05 + 0.14 * ins + 0.05 * out);
    const gFan = (0.03 + 0.05 * Na) * (0.6 + 0.4 * ins), gWh = (0.02 + 0.018 * n2) * (0.6 + 0.8 * ins);
    const gRoar = (0.12 + 1.05 * Math.pow(n1, 2.4)) * (0.22 + 0.78 * out);
    svs(s.ro, (260 + 1800 * Math.pow(n1, 1.4)) * (0.55 + 0.45 * out), 0.7); svs(s.cr, 2100, 0.7);
    const aLo = op(80 + 120 * n1), aOut = op(2500 + 8000 * out);
    const crP = 0.0007 * sm(0.72, 1, n1) * out, crDec = Math.exp(-1 / (SR * 0.0014));
    const pan = 0.2 + 0.15 * ins;
    for (let i = 0; i < n; i++) {
      s.a += f1a; if (s.a >= 1) s.a -= 1; s.b += f1b; if (s.b >= 1) s.b -= 1;
      s.fa = wrap(s.fa + 36 * f1a); s.fb = wrap(s.fb + 36 * f1b);
      s.w += f2; if (s.w >= 1) s.w -= 1; s.w2 = wrap(s.w2 + f2 * 1.004);
      const nz = this.r();
      svr(s.ro, nz); s.lo += aLo * (nz - s.lo);
      if (this.r() > 1 - 2 * crP) s.ce = 0.5 + 0.5 * this.u();
      s.ce *= crDec;
      const crk = svr(s.cr, s.ce * this.r());
      const ea = rd(s.ta, s.a) * gBz + Math.sin(TAU * s.fa) * gFan + Math.sin(TAU * s.w) * gWh;
      const eb = rd(s.tb, s.b) * gBz + Math.sin(TAU * s.fb) * gFan + Math.sin(TAU * s.w2) * gWh;
      const com = s.ro.lp * gRoar * 1.6 + s.lo * gRoar * 4 + crk * 0.9;
      s.oL += aOut * (ea * (0.5 + pan) + eb * (0.5 - pan) + com - s.oL);
      s.oR += aOut * (eb * (0.5 + pan) + ea * (0.5 - pan) + com - s.oR);
      L[i] = s.oL; R[i] = s.oR;
    }
  }
  heli(L, R, n, p) {
    const s = this.s, rps = p.rps || 0, rr = Math.min(rps / 6.4, 1), tq = p.tq || 0, slap = p.slap || 0, ng = p.ng || 0, ins = p.inside || 0, out = 1 - ins;
    const bInc = 4 * rps / SR, fen = 597 * rr / SR, tw = (2900 + 1500 * ng) / SR, gb = 1650 * rr / SR;
    svs(s.sl, 360 + 320 * slap, 1.3); svs(s.sh, 1300, 1.0); svs(s.wh, 520, 0.6); svs(s.th, 4200, 0.8);
    const aLo = op(85), dec = Math.exp(-1 / (SR * (0.006 + 0.005 * (1 - Math.min(slap, 1))))), aOut = op(2400 + 8000 * out);
    const gSlap = 0.4 + 0.6 * out, gW = 0.3 * rr * rr, gT = (0.02 + 0.05 * ng) * (0.6 + 0.6 * ins);
    const gF = (0.012 + 0.03 * tq) * rr * (0.6 + 0.4 * out), gG = 0.012 * rr * ins, gH = 0.1 * ng;
    for (let i = 0; i < n; i++) {
      s.b += bInc; if (s.b >= 1) { s.b -= 1; s.se = (0.45 + slap) * (0.9 + 0.1 * this.r()) * rr; }
      s.se *= dec;
      const nz = this.r(), ex = s.se * (0.55 + 0.45 * nz);
      s.lo += aLo * (s.se - s.lo);
      const sl = svr(s.sl, ex) + svr(s.sh, ex * nz) * slap * out * 0.8;
      const cs = Math.cos(TAU * s.b), wh = svr(s.wh, nz * (0.35 + 0.65 * cs * cs)) * gW;
      s.f = wrap(s.f + fen); s.t = wrap(s.t + tw); s.g = wrap(s.g + gb);
      const y = (sl * 1.2 + s.lo * 5) * gSlap + wh + (Math.sin(TAU * s.f) + 0.4 * Math.sin(TAU * 2 * s.f)) * gF + Math.sin(TAU * s.t) * gT + Math.sin(TAU * s.g) * gG + svr(s.th, this.r()) * gH;
      s.o += aOut * (y - s.o);
      L[i] = s.o; R[i] = s.o;
    }
  }
  process(ins, outs) {
    const o = outs[0], L = o[0], R = o[1] || o[0], n = L.length, tg = this.tg, p = this.p;
    if (tg.type !== this.type) this.init(tg.type);
    const c = 1 - Math.exp(-n / SR / 0.05);
    for (const k in tg) { const v = tg[k]; if (typeof v === 'number') p[k] = p[k] == null ? v : p[k] + (v - p[k]) * c; }
    if (!this.s || !(p.g > 1e-4)) { L.fill(0); if (R !== L) R.fill(0); return true; }
    this[this.type](L, R, n, p);
    // likspänningsfilter och mjuk begränsning
    const g = p.g, d = this.dc;
    for (let i = 0; i < n; i++) {
      let x = L[i], y = x - d[0] + 0.996 * d[1]; d[0] = x; d[1] = y; y *= g; y = y > 3 ? 1 : y < -3 ? -1 : y * (27 + y * y) / (27 + 9 * y * y); L[i] = y;
      if (R !== L) { x = R[i]; y = x - d[2] + 0.996 * d[3]; d[2] = x; d[3] = y; y *= g; y = y > 3 ? 1 : y < -3 ? -1 : y * (27 + y * y) / (27 + 9 * y * y); R[i] = y; }
    }
    return true;
  }
}
registerProcessor('af-engine', AFEngine);
`;
function auWorkletURL() { return URL.createObjectURL(new Blob([AF_WORKLET], { type: 'application/javascript' })); }

function audioInit() {
  if (AU.ctx) { try { AU.ctx.resume(); } catch (e) {} return; }
  try {
    const C = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    auBuild(C);
  } catch (e) { AU.ctx = null; }
}
// bygger hela ljudgrafen (används också av testrendering i en OfflineAudioContext)
function auBuild(C, dest) {
  AU.ctx = C;
  const comp = C.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = 0.005; comp.release.value = 0.25;
  comp.connect(dest || C.destination);
  const master = C.createGain(); master.gain.value = 0; master.connect(comp);
  const fx = C.createGain(); fx.connect(master);
  const crashBus = C.createGain(); crashBus.gain.value = 0.9; crashBus.connect(comp);
  // vitt och brunt brus (brunt för muller), fyra sekunder som loopar
  const len = C.sampleRate * 4, wb = C.createBuffer(1, len, C.sampleRate), bb = C.createBuffer(1, len, C.sampleRate);
  const w = wb.getChannelData(0), b = bb.getChannelData(0); let br = 0;
  for (let i = 0; i < len; i++) { w[i] = Math.random() * 2 - 1; br = (br + 0.02 * w[i]) / 1.02; b[i] = br * 3.5; }
  Object.assign(AU, { comp, master, fx, crashBus, wb, bb, eng: null, st: null });
  const osc = (type, f) => { const o = C.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; };
  const tone = (src, fl) => { let n = src; for (const [type, f, q] of fl) { const bq = auF(type, f, q); n.connect(bq); n = bq; } const g = auG(); n.connect(g); g.connect(master); return g; };
  const sq = osc('sine', 2350), vib = osc('sine', 6.5), vg = C.createGain(); vg.gain.value = 40; vib.connect(vg).connect(sq.frequency);
  const hyd = osc('sawtooth', 118), flap = osc('sawtooth', 320);
  const h1 = osc('square', 1750), h2 = osc('square', 1763), hm = C.createGain(); hm.gain.value = 0.5; h1.connect(hm); h2.connect(hm);
  AU.L = {
    wind: auLoop(wb, [['bandpass', 800, 0.6]]),
    whoosh: auLoop(wb, [['lowpass', 400, 0.5]]),
    whis: auLoop(wb, [['bandpass', 2000, 9]]),
    rumble: auLoop(bb, [['lowpass', 230, 0.7]]),
    buffet: auLoop(bb, [['lowpass', 160, 0.7]], [11, 'sine']),
    roll: auLoop(wb, [['bandpass', 300, 0.8]]),
    rollLo: auLoop(bb, [['lowpass', 170, 0.7]]),
    water: auLoop(wb, [['highpass', 1400, 0.7]]),
    brake: auLoop(bb, [['lowpass', 130, 1]]),
    rain: auLoop(wb, [['highpass', 2600, 0.6]]),
    hydN: auLoop(wb, [['bandpass', 1400, 2]]),
    shake: auLoop(bb, [['bandpass', 55, 1.2]], [18, 'square']),
    squeal: { g: tone(sq, [['bandpass', 2350, 4]]) },
    hyd: { g: tone(hyd, [['lowpass', 650, 0.8]]), o: hyd },
    flap: { g: tone(flap, [['bandpass', 700, 1.2]]), o: flap },
    horn: { g: tone(hm, [['bandpass', 1800, 3]]) }
  };
  auLegacyBuild(C);
  try {
    if (C.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
      AU.ready = C.audioWorklet.addModule(auWorkletURL()).then(() => {
        const n = new AudioWorkletNode(C, 'af-engine', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
        n.connect(master); AU.eng = n; auLegacyStop();
      }).catch(() => {});
    }
  } catch (e) {}
}
function auF(type, f, q) { const b = AU.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; }
function auG(v) { const g = AU.ctx.createGain(); g.gain.value = v || 0; return g; }
// loopande brus genom filter; am = [Hz, vågform] ger amplitudmodulation (skakningar)
function auLoop(buf, fl, am) {
  const C = AU.ctx, s = C.createBufferSource(); s.buffer = buf; s.loop = true;
  let n = s, f0 = null;
  for (const [type, f, q] of fl) { const b = auF(type, f, q); n.connect(b); n = b; if (!f0) f0 = b; }
  if (am) {
    const a = auG(0.5), lfo = C.createOscillator(), d = auG(0.5); lfo.type = am[1]; lfo.frequency.value = am[0];
    lfo.connect(d).connect(a.gain); lfo.start(); n.connect(a); n = a;
  }
  const g = auG(); n.connect(g); g.connect(AU.master);
  s.start(0, Math.random() * (buf.duration - 0.2));
  return { s, f: f0, g };
}
// enkel reservmotor om webbläsaren saknar AudioWorklet
function auLegacyBuild(C) {
  const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 60;
  const lp = auF('lowpass', 420, 0.7), g = auG(); o.connect(lp).connect(g).connect(AU.master); o.start();
  AU.leg = { o, g, n: auLoop(AU.wb, [['bandpass', 600, 0.8]]) };
}
function auLegacyStop() { const l = AU.leg; if (!l) return; AU.leg = null; try { l.o.stop(); l.n.s.stop(); l.g.disconnect(); l.n.g.disconnect(); } catch (e) {} }
function auLegacy(p, t) {
  const l = AU.leg; if (!l) return;
  let f = 60, a = 0, nf = 600, na = 0;
  if (p.type === 'piston') { f = Math.max(p.rpm, 1) / 60 * 4.5; a = 0.1 + 0.18 * p.load; nf = 300 + 400 * p.load; na = 0.04 + 0.1 * p.load; }
  else if (p.type === 'tp') { f = 6 * Math.max(p.rpmL, 1) / 60; a = 0.07 + 0.15 * p.load; nf = 500 + 900 * p.load; na = 0.05 + 0.16 * p.load; }
  else if (p.type === 'jet') { f = 40; a = 0.02; nf = 380 + 1500 * p.n1; na = 0.06 + 0.3 * p.n1; }
  else if (p.type === 'heli') { f = Math.max(3, 4 * p.rps); a = 0.14 + 0.2 * p.tq; nf = 800; na = 0.07; }
  l.o.frequency.setTargetAtTime(f, t, 0.1); l.g.gain.setTargetAtTime(a * p.g, t, 0.1);
  l.n.f.frequency.setTargetAtTime(nf, t, 0.1); l.n.g.gain.setTargetAtTime(na * p.g, t, 0.1);
}
// pausa ljudet när fliken inte syns
document.addEventListener('visibilitychange', () => { if (!AU.ctx) return; try { if (document.hidden) AU.ctx.suspend(); else AU.ctx.resume(); } catch (e) {} });

// ---------- engångsljud ----------
function auOut(pan) {
  const C = AU.ctx;
  if (!pan || !C.createStereoPanner) return AU.fx;
  const p = C.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(AU.fx); return p;
}
function auNz(t, dur, brown) { const s = AU.ctx.createBufferSource(), b = brown ? AU.bb : AU.wb; s.buffer = b; s.start(t, Math.random() * Math.max(b.duration - dur - 0.2, 0)); s.stop(t + dur + 0.05); return s; }
function auEnv(g, t, a, atk, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(Math.max(a, 0.0002), t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
function auNzShot(t, out, a, atk, dur, fl, brown) {
  let n = auNz(t, dur, brown); for (const [type, f, q] of fl) { const b = auF(type, f, q); n.connect(b); n = b; }
  const g = auG(); auEnv(g, t, a, atk, dur); n.connect(g).connect(out); return g;
}
// dov duns (hjul i marken, låsning, skarvar): sinus som faller i tonhöjd + kort brus
function sThump(t, a, f, dur, pan) {
  if (a < 0.003) return;
  const out = auOut(pan), o = AU.ctx.createOscillator(), g = auG();
  o.frequency.setValueAtTime(f * 2, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + dur);
  auEnv(g, t, a, 0.003, dur); o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
  auNzShot(t, out, a * 0.8, 0.002, dur * 0.5, [['lowpass', 420 + f * 2, 0.7]]);
}
// däcket står still i luften och slirar när det möter banan: gummitjut som glider ner i tonhöjd, sedan rök
function sChirp(t, a, pan, big) {
  const out = auOut(pan), dur = (big ? 0.18 : 0.12) + 0.25 * a, f0 = big ? 2300 : 2900, f1 = big ? 1100 : 1500;
  const n = auNz(t, dur + 0.05), bp = auF('bandpass', f0, 4), g = auG();
  bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
  auEnv(g, t, a * 0.9, 0.005, dur); n.connect(bp).connect(g).connect(out);
  const o = AU.ctx.createOscillator(), bo = auF('bandpass', big ? 1000 : 1300, 2), go = auG(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(big ? 980 : 1250, t); o.frequency.exponentialRampToValueAtTime(big ? 640 : 900, t + dur);
  auEnv(go, t, a * 0.16, 0.004, dur * 0.85); o.connect(bo).connect(go).connect(out); o.start(t); o.stop(t + dur + 0.05);
  auNzShot(t + 0.01, out, a * 0.12, 0.03, dur * 2.2, [['highpass', 3500, 0.7]]);
}
function sClunk(t, a, pan) {
  const out = auOut(pan);
  sThump(t, a, 55, 0.32, pan);
  auNzShot(t, out, a * 0.5, 0.001, 0.09, [['bandpass', 1700, 7]]);
  const o = AU.ctx.createOscillator(), g = auG(); o.frequency.value = 420; auEnv(g, t, a * 0.18, 0.001, 0.14); o.connect(g).connect(out); o.start(t); o.stop(t + 0.2);
}
function sClick(t, a) {
  if (a < 0.003) return;
  auNzShot(t, AU.fx, a, 0.001, 0.014, [['bandpass', 3200, 1.5]]);
  auNzShot(t + 0.035, AU.fx, a * 0.6, 0.001, 0.012, [['bandpass', 2600, 1.5]]);
}
function sHiss(t, a, dur) { auNzShot(t, AU.fx, a, 0.06, dur, [['highpass', 1800, 0.7]]); }
function sWhoomp(t, a) { auNzShot(t, AU.fx, a, 0.05, 0.9, [['lowpass', 260, 0.7]], true); sHiss(t, a * 0.3, 0.7); }
function sSplash(t, a, pan) {
  const out = auOut(pan);
  auNzShot(t, out, a * 0.8, 0.01, 0.9, [['lowpass', 1600, 0.7]]);
  auNzShot(t + 0.02, out, a * 0.45, 0.02, 0.7, [['highpass', 3000, 0.7]]);
  sThump(t, a * 0.6, 45, 0.35, pan);
}
function sSwish(t, a, pan) { auNzShot(t, auOut(pan), a * 0.4, 0.02, 0.3, [['bandpass', 700, 0.6]]); }
// Beavern fäller klaffarna med en hydraulisk handpump: ett slag i taget
function sPump(t, a) {
  sClick(t, a * 0.7);
  auNzShot(t + 0.02, AU.fx, a * 0.45, 0.02, 0.14, [['bandpass', 900, 3]]);
  sThump(t, a * 0.4, 140, 0.12, 0);
}
// Airbus överstegringsvarning: "syrsan"
function sCricket(t) {
  for (let i = 0; i < 6; i++) {
    const o = AU.ctx.createOscillator(), g = auG(), tt = t + i * 0.07; o.frequency.value = 3200;
    auEnv(g, tt, 0.06, 0.003, 0.03); o.connect(g).connect(AU.fx); o.start(tt); o.stop(tt + 0.05);
  }
}
function sCrash(t) {
  const out = AU.crashBus;
  const n = auNz(t, 3, true), lp = auF('lowpass', 1600, 0.7), g = auG();
  lp.frequency.setValueAtTime(1600, t); lp.frequency.exponentialRampToValueAtTime(140, t + 2.6);
  auEnv(g, t, 1.4, 0.01, 3); n.connect(lp).connect(g).connect(out);
  for (let i = 0; i < 8; i++) auNzShot(t + Math.random() * 0.9, out, 0.25 + 0.35 * Math.random(), 0.002, 0.08 + 0.15 * Math.random(), [['bandpass', 700 + Math.random() * 2600, 5]]);
  const o = AU.ctx.createOscillator(), go = auG(); o.frequency.setValueAtTime(34, t); o.frequency.exponentialRampToValueAtTime(18, t + 0.8);
  auEnv(go, t, 1, 0.005, 0.9); o.connect(go).connect(out); o.start(t); o.stop(t + 1);
}

// ---------- motorernas varv och last ----------
function auEngine(S, A, dt, st, ins) {
  const dead = !!S.crashed, thr = dead ? 0 : clamp(S.thr || 0, 0, 1), V = S.V || 0, ex = tau => 1 - Math.exp(-dt / tau);
  if (A.heli) {
    const rps = typeof model !== 'undefined' && model && model.rps != null ? model.rps : 6.4, vs = S.vs || 0, tq = clamp((S.tq || 0) / 100, 0, 1.2), rr = clamp(rps / 6.4, 0, 1);
    // bladvirvelinteraktion i nedstigning med låg fart och kompressibilitet i hög fart ger de hårda bladslagen
    const bvi = smooth(-0.6, -3, vs) * smooth(8, 18, V) * (1 - smooth(35, 50, V)), hs = smooth(50, 75, V);
    return { type: 'heli', rps, tq, ng: clamp(S.n1 || 0, 0, 1) * rr, slap: clamp(0.2 + 0.4 * tq + 0.9 * bvi + 0.5 * hs, 0, 1.4) * rr * rr, inside: ins, g: 0.7 };
  }
  if (A.cls === 'tp') {
    // konstantvarvspropellrar: markvarv, flygtomgång, marschvarv och startvarv
    let tgt = 820 + 200 * smooth(0.05, 0.35, thr) + 180 * smooth(0.75, 1, thr);
    if (!S.onGround) tgt = Math.max(tgt, 960);
    if (dead) tgt = 0;
    st.rpm = st.rpm == null ? tgt : st.rpm + (tgt - st.rpm) * ex(1.3);
    const ngT = dead ? 0 : 0.62 + 0.38 * thr;
    st.ng = st.ng == null ? ngT : st.ng + (ngT - st.ng) * ex(ngT > st.ng ? 1.6 : 1.1);
    st.load = st.load == null ? thr : st.load + (thr - st.load) * ex(0.5);
    st.ph = (st.ph || 0) + dt;
    const d = 1 + 0.0028 * Math.sin(st.ph * 0.09) + 0.0012 * Math.sin(st.ph * 0.37); // propellrarna glider lite isär: svävning
    return { type: 'tp', rpmL: st.rpm, rpmR: st.rpm * d, ng: st.ng, load: st.load, inside: ins, g: 0.95 };
  }
  if (A.prop) {
    // stjärnmotor med konstantvarvspropeller: varvet stiger med gasen tills regulatorn tar över
    const raw = 600 + 1900 * Math.pow(thr, 0.8) + V * 10, gov = 2000 + 300 * smooth(0.75, 1, thr), tgt = dead ? 0 : Math.min(raw, gov);
    st.rpm = st.rpm == null ? tgt : st.rpm + (tgt - st.rpm) * ex(tgt < st.rpm ? 0.8 : 0.5);
    // gasen av snabbt på högt varv: baktändningar i avgasröret
    const drop = (st.thrH == null ? thr : st.thrH) - thr; st.thrH = st.thrH == null ? thr : st.thrH + (thr - st.thrH) * ex(0.6);
    if (drop > 0.25 && st.rpm > 1300) st.pops = 1.6;
    st.pops = Math.max((st.pops || 0) - dt, 0);
    st.load = st.load == null ? thr : st.load + (thr - st.load) * ex(0.25);
    const tip = Math.hypot(Math.PI * 2.59 * st.rpm / 60, V) / 340;
    return { type: 'piston', rpm: st.rpm, load: st.load, tip, pops: Math.min(st.pops, 1), inside: ins, g: 1 };
  }
  const n1t = dead ? 0 : clamp(S.n1 || 0, 0, 1);
  st.n1 = st.n1 == null ? n1t : (dead ? st.n1 + (n1t - st.n1) * ex(2) : n1t);
  st.n1b = st.n1b == null ? st.n1 : st.n1b + (st.n1 - st.n1b) * ex(0.35); // höger motor ligger lite efter
  return { type: 'jet', n1: st.n1, N1L: 0.205 + 0.745 * st.n1, N1R: (0.205 + 0.745 * st.n1b) * 1.0035, n2: Math.pow(st.n1, 0.7), inside: ins, g: 1 };
}
function auState(S) {
  if (AU.st && AU.st.sim === S) return AU.st;
  const A = S.ac;
  return (AU.st = {
    sim: S, wheels: A.gear.map(g => ({ c: !!g.c, spin: g.c ? (S.gs || 0) : 0, air: g.c ? 0 : 9 })),
    gear: S.gearPos, gearMv: false, gearDown: S.gearDown, flapPos: S.flapPos, flap: S.flap, sb: !!S.speedbrake, spoil: !!S.spoilers,
    crashed: !!S.crashed, touches: S.touches, inside: camMode !== 'chase' ? 1 : 0, dist: 0, nextBump: 5, pumpT: 0, stallT: 0, jit: 0
  });
}
// ett hjul möter underlaget
function auTouch(S, A, gp, w, sink, gs, surf, t, ins) {
  const main = !!gp.brake || (!gp.steer && !A.heli), pan = clamp(gp.p[0] / 6, -0.8, 0.8) * (0.4 + 0.4 * ins), big = isBig(A);
  const tt = t + Math.random() * 0.03, skid = Math.max(gs - w.spin, 0), sinkN = clamp(sink / 3, 0, 1);
  if (w.air < 0.25 && skid < 2 && sink < 0.6) return; // bara fjädringen som gungar
  if (A.heli) { sThump(tt, 0.15 + 0.6 * sinkN, 45, 0.3, pan); return; }
  if (surf === 'water') { sSplash(tt, clamp(0.25 + sinkN * 0.6 + gs / 60, 0, 1), pan); return; }
  sThump(tt, (main ? 0.25 + 0.75 * sinkN : 0.15 + 0.5 * sinkN) * (0.6 + 0.5 * ins) * (big ? 1 : 0.7), big ? 48 : 70, big ? 0.4 : 0.25, pan);
  if (sink > 2.2) sClunk(tt + 0.02, 0.4 * sinkN, pan); // fjäderbenet bottnar
  if (surf === 'paved') {
    const ch = clamp(skid / (big ? 55 : 35), 0, 1) * (0.55 + 0.45 * Math.min(sink / 1.5, 1)) * (main ? 1 : 0.6);
    if (ch > 0.04) sChirp(tt, ch, pan, big);
  } else sSwish(tt, clamp(gs / 40, 0.1, 0.8), pan);
}
// fel i ljudet får aldrig stoppa spelet
function updateAudio() { try { auUpdate(); } catch (e) { if (!AU.err) { AU.err = true; console.error(e); } } }
function auUpdate() {
  if (!AU.ctx || !AU.L) return;
  const t = AU.ctx.currentTime, now = performance.now(), S = sim;
  const dt = Math.min(Math.max((now - (AU.tPrev || now)) / 1000, 0), 0.1); AU.tPrev = now;
  const on = AU.on && mode === 'fly' && !paused && !!S;
  AU.master.gain.setTargetAtTime(on ? 0.9 : 0, t, on ? 0.15 : 0.06);
  if (!S) return;
  const st = auState(S), A = S.ac;
  if (S.crashed && !st.crashed) { st.crashed = true; if (AU.on) sCrash(t); }
  if (!on) { if (AU.eng) AU.eng.port.postMessage({ g: 0 }); else auLegacy({ type: 'none', g: 0 }, t); return; }
  const ins = (st.inside += ((camMode !== 'chase' ? 1 : 0) - st.inside) * (1 - Math.exp(-dt / 0.12))), out = 1 - ins;
  const ep = auEngine(S, A, dt, st, ins);
  if (AU.eng) AU.eng.port.postMessage(ep); else auLegacy(ep, t);

  const L = AU.L, set = (p, v, tau) => p.setTargetAtTime(v, t, tau || 0.06);
  const V = S.ias || S.V || 0, gs = S.gs || 0, air = !S.onGround;
  const vRef = A.heli ? 65 : A.cls === 'jet' ? 115 : A.cls === 'tp' ? 95 : 60, vq = clamp(V / vRef, 0, 1.35), q = vq * vq;
  st.jit = st.jit * 0.85 + (Math.random() - 0.5) * 0.3; // fladder i luftströmmen

  // fartvind: sus i kabinen, brus utanför, visslande vid sidglidning och övervarv
  set(L.wind.g.gain, q * (0.14 + 0.16 * ins));
  set(L.wind.f.frequency, 300 + 1500 * Math.min(vq, 1.3) + 700 * ins);
  set(L.whoosh.g.gain, q * (0.22 * out + 0.1 * ins) * (1 + 0.25 * Math.sin(now / 900) * Math.sin(now / 370)));
  set(L.whoosh.f.frequency, 160 + 600 * Math.min(vq, 1.3));
  const over = smooth(0.92, 1.05, V / (A.vne || 999));
  set(L.whis.g.gain, q * (0.006 + 0.05 * smooth(0.03, 0.2, Math.abs(S.beta || 0)) + 0.05 * over) * (0.5 + ins));
  set(L.whis.f.frequency, 1500 + 1500 * Math.min(vq, 1.4));

  // muller från ställ, klaffar och luftbromsar i luftströmmen
  const nf = A.flaps.length - 1, flapF = nf > 0 ? (S.flapPos || 0) / nf : 0;
  const rum = Math.min(q, 2.2) * ((A.retract ? S.gearPos * 0.35 : 0.06) + flapF * 0.4 + (S.spoilers ? (air ? 0.8 : 0.6) : 0));
  set(L.rumble.g.gain, rum * 0.32 * (0.7 + ins * 0.5) * (1 + st.jit), 0.03);
  // överstegring: vingen skakar
  const aSt = S.aSt || A.aStall, buf = air && !A.heli ? smooth(aSt - 3.5 * DEG, aSt + 0.5 * DEG, Math.abs(S.alpha || 0)) * clamp(q * 1.5, 0.3, 1.6) : 0;
  set(L.buffet.g.gain, buf * 0.55 + (S.spoilers && air ? Math.min(q, 1.5) * 0.12 : 0), 0.05);

  // underlaget
  let surf = null, rw = null;
  if (S.onGround && !A.heli) {
    const x = S.pos.x, z = S.pos.z;
    if (A.floats && (terrainH(x, z) < 0.3 || isLake(x, z))) surf = 'water';
    else { rw = inRunway(x, z, 3); surf = rw ? (rw.kind === 'grass' ? 'grass' : 'paved') : (A.floats ? 'grass' : 'taxi'); }
  }
  const gr = surf ? smooth(0.5, 70, gs) : 0, hard = surf === 'paved' || surf === 'taxi';
  set(L.roll.g.gain, (hard ? gr : surf === 'grass' ? gr * 0.6 : 0) * (0.2 * out + 0.12 * ins) * (A.cls === 'ga' ? 0.7 : 1));
  set(L.roll.f.frequency, (surf === 'grass' ? 110 : 170) + gs * (surf === 'grass' ? 4 : 7));
  const lo = surf === 'grass' ? smooth(0, 30, gs) * 0.55 * (1 + st.jit * 2) : surf === 'water' ? smooth(0, 12, gs) * 0.35 * (1 + st.jit * 2) : surf ? smooth(0, 45, gs) * 0.22 : 0;
  set(L.rollLo.g.gain, lo * (0.6 + 0.6 * ins), 0.03);
  set(L.water.g.gain, surf === 'water' ? smooth(1, 22, gs) * (0.22 + 0.1 * out) : 0);
  // skarvar, banljus och gupp
  if (surf && gs > 1.5) {
    st.dist += gs * dt;
    if (st.dist >= st.nextBump) {
      const big = isBig(A), nose = A.gear.find(g => g.steer) || A.gear[0];
      let gap = 6 + Math.random() * 14, amp = 0.05;
      if (surf === 'paved' && big) {
        // noshjulet över mittlinjeljusen var 15:e meter
        const p = _auV.fromArray(nose.p).applyQuaternion(S.q).add(S.pos), c = Math.abs(zoneLocal(rw, p.x, p.z)[1]);
        gap = 15; amp = c < 1.3 ? 0.12 : 0.03;
      } else if (surf === 'paved') { gap = 10 + Math.random() * 25; amp = 0.04; }
      else if (surf === 'grass') { gap = 1.5 + Math.random() * 3.5; amp = (0.05 + 0.2 * Math.random()) * smooth(2, 25, gs); }
      else if (surf === 'water') { gap = 3 + Math.random() * 5; amp = 0.08 * smooth(2, 15, gs); }
      st.nextBump = st.dist + gap;
      if (surf === 'water') sSplash(t, amp, 0); else sThump(t, amp * (0.6 + 0.8 * ins), big ? 55 : 80, 0.18, 0);
    }
  }
  // bromsar: muller under inbromsningen och gnissel strax innan planet står still
  const brk = surf && surf !== 'water' ? clamp(S.brake || 0, 0, 1) : 0;
  set(L.brake.g.gain, brk * smooth(1, 25, gs) * 0.28 * (0.6 + 0.6 * ins) * (1 + st.jit));
  set(L.squeal.g.gain, brk * smooth(0.4, 2.5, gs) * (1 - smooth(4, 11, gs)) * 0.045);

  // hjulen: sättning, studs och upprullning (hjulen fortsätter snurra en stund i luften)
  const newTouch = S.touches !== st.touches; st.touches = S.touches;
  const sink = newTouch && S.touch ? Math.max(-S.touch.vs, 0) : Math.max(-(S.vs || 0), 0);
  A.gear.forEach((gp, i) => {
    const w = st.wheels[i]; if (!w) return;
    const c = !!gp.c;
    if (c && !w.c) auTouch(S, A, gp, w, sink, gs, surf, t, ins);
    if (c) { w.spin = gs; w.air = 0; } else { w.spin *= Math.exp(-dt / (A.retract && S.gearPos < 0.9 ? 2 : 14)); w.air += dt; }
    w.c = c;
  });

  // ställ: hydraulik och luckor, låsningarna slår i
  if (A.retract) {
    const mv = Math.abs(S.gearPos - st.gear) > 1e-6;
    set(L.hyd.g.gain, mv ? 0.006 + 0.012 * ins : 0, 0.15); set(L.hydN.g.gain, mv ? 0.012 + 0.018 * ins : 0, 0.15);
    set(L.hyd.o.frequency, mv ? 118 + 10 * Math.sin(now / 700) : 110, 0.2);
    if (mv && !st.gearMv) sThump(t, 0.1 + 0.12 * ins, 90, 0.25, 0); // luckorna öppnas
    if (S.gearPos >= 1 && st.gear < 1) for (let i = 0; i < 3; i++) sClunk(t + 0.05 + i * 0.13 + Math.random() * 0.06, (0.3 + 0.35 * ins) * (i ? 0.8 : 1), (i - 1) * 0.4);
    if (S.gearPos <= 0 && st.gear > 0) { sClunk(t, 0.22 + 0.2 * ins, 0); sThump(t + 0.25, 0.12 + 0.1 * ins, 80, 0.3, 0); }
    st.gearMv = mv; st.gear = S.gearPos;
  }
  if (S.gearDown !== st.gearDown) { sClick(t, 0.25 * (0.3 + ins)); st.gearDown = S.gearDown; }
  // klaffar: Beavern pumpar för hand, de andra har motor
  const fmv = Math.abs((S.flapPos || 0) - (st.flapPos || 0)) > 1e-6;
  if (A.cls === 'ga') {
    if (fmv) { st.pumpT -= dt; if (st.pumpT <= 0) { st.pumpT = 0.42 + Math.random() * 0.06; sPump(t, 0.16 + 0.3 * ins); } } else st.pumpT = 0;
  } else if (!A.heli) {
    set(L.flap.g.gain, fmv ? 0.01 + 0.02 * ins : 0, 0.12);
    set(L.flap.o.frequency, 300 + 40 * flapF + (fmv ? 15 : 0), 0.2);
  }
  if (S.flap !== st.flap) { sClick(t, 0.22 * (0.3 + ins)); st.flap = S.flap; }
  st.flapPos = S.flapPos;
  // luftbromsar: spak, hydraulsus och markspoilrarnas "whoomp" vid sättningen
  if (!!S.speedbrake !== st.sb) { sClick(t, 0.22 * (0.3 + ins)); st.sb = !!S.speedbrake; }
  if (!!S.spoilers !== st.spoil) {
    st.spoil = !!S.spoilers;
    if (st.spoil) { if (S.onGround) sWhoomp(t, 0.45 + 0.2 * ins); sHiss(t, 0.1 + 0.1 * ins, 0.6); } else sHiss(t, 0.05 + 0.06 * ins, 0.4);
  }

  // regn mot rutan och kroppen
  const rain = typeof WX !== 'undefined' && WX.rain && WX.rain.visible ? (WX.def.rain || 0) : 0;
  set(L.rain.g.gain, rain * (0.05 * out + (0.14 + 0.1 * Math.min(vq, 1)) * ins) * (1 + st.jit * 0.6), 0.2);

  // överstegringsvarning: signalhorn i Beavern, spakskakare i turbopropen, syrsan och "STALL" i Airbusen
  const warn = air && !!(typeof HUDSTATE !== 'undefined' && HUDSTATE.stallWarn);
  set(L.horn.g.gain, warn && A.cls === 'ga' ? 0.05 : 0, 0.02);
  set(L.shake.g.gain, warn && A.cls === 'tp' ? 0.5 * (0.5 + ins) : 0, 0.03);
  if (warn && A.cls === 'jet') { st.stallT -= dt; if (st.stallT <= 0) { st.stallT = 1.6; sCricket(t); setTimeout(() => { if (typeof say === 'function') say('stall, stall'); }, 600); } } else st.stallT = 0;
}
const _auV = new THREE.Vector3();
