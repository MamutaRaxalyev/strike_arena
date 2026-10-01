// Звук: выстрелы собираются из слоёв (щелчок + корпус + низкий удар + хвост с реверберацией),
// у каждого оружия свой профиль. Если положить свои файлы в public/sounds/ (ak47.wav, awp.mp3 ...),
// они будут проигрываться вместо синтеза.
(() => {
'use strict';
const SA = (window.SA = window.SA || {});
let AC = null, master = null, noiseBuf = null, verb = null, volume = 0.7;
const custom = {};

function init() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  AC = new Ctx();
  master = AC.createGain(); master.gain.value = volume;
  const comp = AC.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.18;
  master.connect(comp); comp.connect(AC.destination);
  const n = AC.sampleRate * 2;
  noiseBuf = AC.createBuffer(1, n, AC.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  // реверберация: затухающий шум, приглушённый фильтром
  const len = (AC.sampleRate * 1.7) | 0, ir = AC.createBuffer(2, len, AC.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch); let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len, white = Math.random() * 2 - 1;
      lp += (white - lp) * (0.55 - 0.45 * t);
      data[i] = lp * Math.pow(1 - t, 2.6) * (i < 600 ? i / 600 : 1);
    }
  }
  verb = AC.createConvolver(); verb.buffer = ir;
  const vo = AC.createGain(); vo.gain.value = 0.9;
  verb.connect(vo); vo.connect(master);
}
function setVolume(v) { volume = v; if (master) master.gain.value = v; }

// ───────── строительные блоки ─────────
function noise(dur) {
  const s = AC.createBufferSource(); s.buffer = noiseBuf;
  return { s, start(t) { s.start(t, Math.random() * (noiseBuf.duration - dur - 0.1), dur + 0.05); } };
}
function env(g, t, peak, a, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
// слой шума: фильтр + огибающая; send — доля, уходящая в реверберацию
function nz(out, t, o) {
  const dur = (o.a || 0.001) + o.d, src = noise(dur), f = AC.createBiquadFilter(), g = AC.createGain();
  f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f, t); f.Q.value = o.q || 0.8;
  if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
  env(g, t, o.peak, o.a || 0.001, o.d);
  src.s.connect(f); f.connect(g); g.connect(out);
  if (o.send && verb) { const sg = AC.createGain(); sg.gain.value = o.send; g.connect(sg); sg.connect(verb); }
  src.start(t);
}
function tone(out, t, o) {
  const dur = (o.a || 0.001) + o.d, osc = AC.createOscillator(), g = AC.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.f0, t); osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1 || o.f0), t + dur);
  env(g, t, o.peak, o.a || 0.001, o.d);
  osc.connect(g); g.connect(out);
  if (o.send && verb) { const sg = AC.createGain(); sg.gain.value = o.send; g.connect(sg); sg.connect(verb); }
  osc.start(t); osc.stop(t + dur + 0.05);
}
// выход с учётом расстояния и панорамы
function bus(opts) {
  const o = opts || {}, dist = o.dist || 0, g = AC.createGain(), lp = AC.createBiquadFilter();
  g.gain.value = (o.vol == null ? 1 : o.vol) / (1 + dist * 0.09);
  lp.type = 'lowpass'; lp.frequency.value = Math.max(1400, 17000 / (1 + dist * 0.12));
  let tail = g;
  g.connect(lp); tail = lp;
  if (AC.createStereoPanner && o.pan) { const p = AC.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); tail.connect(p); tail = p; }
  tail.connect(master);
  return g;
}

// ───────── профили выстрелов ─────────
const SHOT = {
  ak47(o, t) {
    nz(o, t, { type: 'highpass', f: 2600, peak: 1.0, d: 0.030 });
    nz(o, t, { f: 1800, q: 0.8, peak: 0.9, d: 0.075 });
    nz(o, t, { type: 'lowpass', f: 1000, peak: 1.1, d: 0.15 });
    tone(o, t, { f0: 165, f1: 52, peak: 1.0, d: 0.17 });
    nz(o, t, { type: 'lowpass', f: 1500, f2: 350, peak: 0.55, d: 0.6, send: 0.55 });
  },
  m4a1(o, t) {                                  // с глушителем
    nz(o, t, { f: 3300, q: 0.7, peak: 0.55, d: 0.055 });
    nz(o, t, { type: 'lowpass', f: 1300, peak: 0.6, d: 0.10 });
    tone(o, t, { f0: 125, f1: 58, peak: 0.45, d: 0.10 });
    nz(o, t + 0.012, { type: 'highpass', f: 4200, peak: 0.22, d: 0.02 });
    nz(o, t, { type: 'lowpass', f: 1100, f2: 400, peak: 0.25, d: 0.25, send: 0.25 });
  },
  usp(o, t) {                                   // пистолет с глушителем
    nz(o, t, { f: 3600, q: 0.8, peak: 0.42, d: 0.045 });
    nz(o, t, { type: 'lowpass', f: 1500, peak: 0.42, d: 0.07 });
    tone(o, t, { f0: 150, f1: 70, peak: 0.28, d: 0.07 });
    nz(o, t + 0.05, { type: 'highpass', f: 3500, peak: 0.25, d: 0.02 });    // затвор
    nz(o, t, { type: 'lowpass', f: 1200, f2: 500, peak: 0.2, d: 0.2, send: 0.2 });
  },
  deagle(o, t) {
    nz(o, t, { type: 'highpass', f: 2800, peak: 1.15, d: 0.045 });
    nz(o, t, { f: 1400, q: 0.7, peak: 0.9, d: 0.10 });
    nz(o, t, { type: 'lowpass', f: 750, peak: 1.3, d: 0.30 });
    tone(o, t, { f0: 135, f1: 38, peak: 1.2, d: 0.34 });
    nz(o, t, { type: 'lowpass', f: 1300, f2: 300, peak: 0.7, d: 0.95, send: 0.7 });
  },
  mp9(o, t) {
    nz(o, t, { type: 'highpass', f: 3500, peak: 0.75, d: 0.022 });
    nz(o, t, { f: 1500, q: 0.9, peak: 0.85, d: 0.06 });
    nz(o, t, { type: 'lowpass', f: 1100, peak: 0.7, d: 0.08 });
    tone(o, t, { f0: 210, f1: 85, peak: 0.6, d: 0.08 });
    nz(o, t, { type: 'lowpass', f: 1700, f2: 450, peak: 0.3, d: 0.3, send: 0.3 });
  },
  awp(o, t) {
    nz(o, t, { type: 'highpass', f: 2000, peak: 1.3, d: 0.07 });
    nz(o, t, { f: 1100, q: 0.6, peak: 1.0, d: 0.18 });
    nz(o, t, { type: 'lowpass', f: 520, peak: 1.5, d: 0.55 });
    tone(o, t, { f0: 95, f1: 28, peak: 1.5, d: 0.65 });
    nz(o, t, { type: 'lowpass', f: 1000, f2: 220, peak: 0.9, d: 1.5, send: 1.0 });
    // перезатворная рукоятка
    nz(o, t + 0.55, { f: 2600, q: 2.5, peak: 0.45, d: 0.035 });
    nz(o, t + 0.64, { f: 1500, f2: 800, q: 1.2, peak: 0.35, d: 0.13 });
    nz(o, t + 0.82, { f: 2300, q: 2.5, peak: 0.5, d: 0.04 });
    tone(o, t + 0.82, { f0: 400, f1: 180, peak: 0.25, d: 0.05, type: 'triangle' });
  },
  knife(o, t) {
    nz(o, t, { f: 700, f2: 2800, q: 1.8, peak: 0.28, a: 0.03, d: 0.13 });
  },
};

function playCustom(name, opts) {
  const buf = custom[name]; if (!buf) return false;
  const src = AC.createBufferSource(); src.buffer = buf;
  src.connect(bus(opts)); src.start();
  return true;
}

// ───────── публичные звуки ─────────
const A = SA.audio = {
  init, setVolume,
  shot(id, opts) {
    if (!AC) return;
    if (playCustom(id, opts)) return;
    const f = SHOT[id] || SHOT.ak47, o = bus(opts);
    f(o, AC.currentTime + 0.001);
  },
  hit(headshot) {
    if (!AC) return;
    if (playCustom(headshot ? 'headshot' : 'hit', { vol: 0.9 })) return;
    const o = bus({ vol: 0.8 }), t = AC.currentTime;
    tone(o, t, { f0: 230, f1: 90, peak: 0.7, d: 0.09 });
    nz(o, t, { type: 'lowpass', f: 1800, peak: 0.5, d: 0.05 });
    if (headshot) {                                           // металлический «дзынь» как по шлему
      tone(o, t, { f0: 2350, peak: 0.34, d: 0.16 });
      tone(o, t, { f0: 3320, peak: 0.22, d: 0.11 });
      nz(o, t, { type: 'highpass', f: 4500, peak: 0.3, d: 0.03 });
    }
  },
  hurt() {
    if (!AC) return;
    const o = bus({ vol: 0.7 }), t = AC.currentTime;
    tone(o, t, { f0: 140, f1: 60, peak: 0.6, d: 0.14 });
    nz(o, t, { type: 'lowpass', f: 700, peak: 0.5, d: 0.1 });
  },
  step(opts) {
    if (!AC) return;
    const o = bus(Object.assign({ vol: 0.22 }, opts || {})), t = AC.currentTime, k = 0.85 + Math.random() * 0.3;
    nz(o, t, { type: 'lowpass', f: 520 * k, f2: 260, q: 0.7, peak: 0.9, d: 0.07 });
    tone(o, t, { f0: 95 * k, f1: 55, peak: 0.5, d: 0.07 });
    nz(o, t + 0.005, { type: 'highpass', f: 3000, peak: 0.12, d: 0.02 });
  },
  land() {
    if (!AC) return;
    const o = bus({ vol: 0.4 }), t = AC.currentTime;
    nz(o, t, { type: 'lowpass', f: 380, peak: 1, d: 0.14 });
    tone(o, t, { f0: 80, f1: 38, peak: 0.7, d: 0.14 });
  },
  click(vol) {
    if (!AC) return;
    const o = bus({ vol: vol || 0.35 }), t = AC.currentTime;
    nz(o, t, { type: 'highpass', f: 3200, peak: 0.8, d: 0.018 });
    nz(o, t + 0.012, { f: 1300, q: 1.5, peak: 0.6, d: 0.035 });
  },
  empty() {
    if (!AC) return;
    const o = bus({ vol: 0.4 }), t = AC.currentTime;
    nz(o, t, { f: 2200, q: 2, peak: 0.7, d: 0.025 });
  },
  buy() {
    if (!AC) return;
    const o = bus({ vol: 0.35 }), t = AC.currentTime;
    tone(o, t, { f0: 1320, peak: 0.5, d: 0.13, type: 'triangle' });
    tone(o, t + 0.08, { f0: 1760, peak: 0.5, d: 0.18, type: 'triangle' });
    nz(o, t, { type: 'highpass', f: 5000, peak: 0.2, d: 0.03 });
  },
  beep(freq, dur, vol) {
    if (!AC) return;
    tone(bus({ vol: vol || 0.3 }), AC.currentTime, { f0: freq, peak: 0.6, d: dur || 0.12, type: 'square' });
  },
  // перезарядка: магазин вышел, магазин вошёл, затвор; ms — длительность перезарядки
  reload(id, ms) {
    if (!AC) return;
    const t = AC.currentTime, dur = ms / 1000, big = id === 'awp';
    const o = bus({ vol: 0.5 });
    const clack = (at, v, f) => { nz(o, t + at, { f, q: 1.4, peak: v, d: 0.05 }); tone(o, t + at, { f0: 320, f1: 160, peak: v * 0.5, d: 0.05, type: 'triangle' }); };
    if (big) {
      clack(dur * 0.2, 0.7, 1800); clack(dur * 0.45, 0.9, 1500);
      nz(o, t + dur * 0.7, { f: 2400, q: 2.5, peak: 0.6, d: 0.04 });
      nz(o, t + dur * 0.78, { f: 1400, f2: 800, q: 1.2, peak: 0.4, d: 0.12 });
      nz(o, t + dur * 0.92, { f: 2300, q: 2.5, peak: 0.7, d: 0.04 });
    } else {
      clack(dur * 0.28, 0.6, 1200);                          // магазин вышел
      clack(dur * 0.66, 0.95, 1500);                          // магазин вошёл
      if (id !== 'usp' && id !== 'deagle') {                  // передёрнуть затвор
        nz(o, t + dur * 0.84, { f: 2300, q: 2.5, peak: 0.55, d: 0.035 });
        nz(o, t + dur * 0.91, { f: 2000, q: 2.5, peak: 0.7, d: 0.04 });
      }
    }
  },
  bombBeep(opts) {
    if (!AC) return;
    tone(bus(Object.assign({ vol: 0.55 }, opts || {})), AC.currentTime, { f0: 1760, peak: 0.7, d: 0.07, type: 'square' });
  },
  plantTick() {
    if (!AC) return;
    tone(bus({ vol: 0.3 }), AC.currentTime, { f0: 980, peak: 0.6, d: 0.05, type: 'square' });
  },
  planted() {
    if (!AC) return;
    const o = bus({ vol: 0.5 }), t = AC.currentTime;
    for (let i = 0; i < 3; i++) tone(o, t + i * 0.16, { f0: 1100 + i * 220, peak: 0.6, d: 0.1, type: 'square' });
    tone(o, t + 0.55, { f0: 440, f1: 330, peak: 0.5, d: 0.35, type: 'triangle' });
  },
  defused() {
    if (!AC) return;
    const o = bus({ vol: 0.5 }), t = AC.currentTime;
    tone(o, t, { f0: 600, f1: 1500, peak: 0.55, d: 0.35, type: 'sine' });
    nz(o, t + 0.36, { f: 2800, q: 2, peak: 0.5, d: 0.04 });
  },
  boom(dist) {
    if (!AC) return;
    const o = bus({ vol: 1.15, dist: Math.min(dist || 0, 25) }), t = AC.currentTime;
    nz(o, t, { type: 'highpass', f: 1500, peak: 1.2, d: 0.3 });
    nz(o, t, { f: 700, q: 0.5, peak: 1.4, d: 0.7 });
    nz(o, t, { type: 'lowpass', f: 380, f2: 90, peak: 1.8, d: 2.2, send: 1.0 });
    tone(o, t, { f0: 62, f1: 20, peak: 1.8, d: 2.0 });
  },
  loadCustom(names) {                                        // names: ['ak47.wav', ...] из /api/status
    if (!AC) return;
    for (const file of names || []) {
      const key = file.replace(/\.[^.]+$/, '');
      fetch('sounds/' + encodeURIComponent(file)).then(r => r.arrayBuffer())
        .then(b => new Promise((res, rej) => AC.decodeAudioData(b, res, rej)))
        .then(buf => { custom[key] = buf; }).catch(() => {});
    }
  },
};
})();
