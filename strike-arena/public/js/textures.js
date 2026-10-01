// Процедурные текстуры: цвет + карта нормалей (рельеф). Рисуются один раз при загрузке карты, внешних файлов нет.
(() => {
'use strict';
const SA = (window.SA = window.SA || {});
let ANISO = 4;

// ───────── инструменты ─────────
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;
function toTex(c, srgb) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.encoding = THREE.sRGBEncoding;
  t.anisotropy = ANISO;
  return t;
}
function grain(g, S, amp, r) {
  const img = g.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * amp; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
}
function normalFromHeight(hc, S, k) {
  const src = hc.getContext('2d').getImageData(0, 0, S, S).data;
  const out = canvas(S), og = out.getContext('2d'), img = og.createImageData(S, S), d = img.data;
  const H = (x, y) => src[((((y + S) % S) * S) + ((x + S) % S)) * 4] / 255;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const nx = -(H(x + 1, y) - H(x - 1, y)) * k, ny = (H(x, y + 1) - H(x, y - 1)) * k;
    const l = Math.sqrt(nx * nx + ny * ny + 1), i = (y * S + x) * 4;
    d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  og.putImageData(img, 0, 0);
  return out;
}
function partition(total, min, max, r) {     // делит total на куски min..max, сумма ровно total (для бесшовности)
  const out = []; let left = total;
  while (left > 0) {
    let v = min + r() * (max - min) | 0;
    if (left - v < min) v = left;
    out.push(v); left -= v;
  }
  return out;
}

// «Холст» из двух слоёв: цвет и высота
function surface(S, seed, paint, normalK, grainAmp) {
  const c = canvas(S), g = c.getContext('2d'), hc = canvas(S), hg = hc.getContext('2d'), r = rng(seed);
  hg.fillStyle = 'rgb(128,128,128)'; hg.fillRect(0, 0, S, S);
  const wrap = fn => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) fn(ox, oy); };
  const a = {
    g, hg, S, r, wrap,
    rect(x, y, w, h, color, hv) {
      g.fillStyle = color; g.fillRect(x, y, w, h);
      if (hv != null) { hg.fillStyle = rgb(hv, hv, hv); hg.fillRect(x, y, w, h); }
    },
    hrect(x, y, w, h, hv, alpha) { hg.fillStyle = `rgba(${hv},${hv},${hv},${alpha == null ? 1 : alpha})`; hg.fillRect(x, y, w, h); },
    blob(x, y, rad, col, alpha, hv, ha) {
      wrap((ox, oy) => {
        const X = x + ox, Y = y + oy;
        if (X + rad < 0 || Y + rad < 0 || X - rad > S || Y - rad > S) return;
        let gr = g.createRadialGradient(X, Y, 0, X, Y, rad);
        gr.addColorStop(0, `rgba(${col},${alpha})`); gr.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = gr; g.fillRect(X - rad, Y - rad, rad * 2, rad * 2);
        if (hv != null) {
          gr = hg.createRadialGradient(X, Y, 0, X, Y, rad);
          gr.addColorStop(0, `rgba(${hv},${hv},${hv},${ha})`); gr.addColorStop(1, `rgba(${hv},${hv},${hv},0)`);
          hg.fillStyle = gr; hg.fillRect(X - rad, Y - rad, rad * 2, rad * 2);
        }
      });
    },
    crack(x, y, len, col, alpha, hv) {
      const pts = [[x, y]]; let ang = r() * 6.28;
      for (let i = 0; i < len; i++) { ang += (r() - 0.5) * 1.1; x += Math.cos(ang) * (3 + r() * 5); y += Math.sin(ang) * (3 + r() * 5); pts.push([x, y]); }
      wrap((ox, oy) => {
        g.strokeStyle = `rgba(${col},${alpha})`; g.lineWidth = 1.4; g.beginPath(); g.moveTo(pts[0][0] + ox, pts[0][1] + oy);
        for (const p of pts) g.lineTo(p[0] + ox, p[1] + oy); g.stroke();
        hg.strokeStyle = `rgba(${hv},${hv},${hv},.9)`; hg.lineWidth = 2; hg.beginPath(); hg.moveTo(pts[0][0] + ox, pts[0][1] + oy);
        for (const p of pts) hg.lineTo(p[0] + ox, p[1] + oy); hg.stroke();
      });
    },
  };
  paint(a);
  grain(g, S, grainAmp == null ? 20 : grainAmp, r);
  grain(hg, S, 14, r);
  return { map: toTex(c, true), normalMap: toTex(normalFromHeight(hc, S, normalK || 2.5), false) };
}

// ───────── кладка (кирпич, песчаник, блоки) ─────────
function paintMasonry(a, o) {
  const { S, r } = a, m = o.mortarW || 4;
  a.rect(0, 0, S, S, o.mortar, 55);
  const rows = S / o.bh;
  for (let row = 0; row < rows; row++) {
    const off = (row % 2) * o.bw / 2;
    for (let x = -o.bw; x < S + o.bw; x += o.bw) {
      const x0 = x + off + m / 2, y0 = row * o.bh + m / 2, w = o.bw - m, h = o.bh - m;
      const k = r();
      a.rect(x0, y0, w, h, o.pal(k, r), 165 + k * 50);
      // фаска: свет сверху-слева, тень снизу-справа
      a.g.fillStyle = 'rgba(255,248,230,.20)'; a.g.fillRect(x0, y0, w, 2); a.g.fillRect(x0, y0, 2, h);
      a.g.fillStyle = 'rgba(30,20,10,.28)'; a.g.fillRect(x0, y0 + h - 3, w, 3); a.g.fillRect(x0 + w - 2, y0, 2, h);
      a.hrect(x0, y0, w, 3, 110); a.hrect(x0, y0, 3, h, 110); a.hrect(x0, y0 + h - 3, w, 3, 100); a.hrect(x0 + w - 3, y0, 3, h, 100);
      if (r() < o.chip) {                                   // сколы
        const cx = x0 + r() * w, cy = y0 + r() * h;
        a.blob(cx, cy, 6 + r() * 12, '60,45,30', 0.5, 60, 0.8);
      }
    }
  }
  for (let i = 0; i < o.stains; i++) a.blob(r() * S, r() * S, 30 + r() * 80, o.stainRGB, 0.10 + r() * 0.14);
  for (let i = 0; i < 6; i++) a.crack(r() * S, r() * S, 10 + r() * 14, '30,22,14', 0.55, 40);
}
const brickPal = (k, r) => rgb(168 + k * 56, 104 + k * 40, 74 + k * 28);
const sandPal = (k) => rgb(206 + k * 22 - 10, 174 + k * 20 - 10, 124 + k * 16 - 8);
const grayPal = (k) => rgb(142 + k * 30, 140 + k * 29, 134 + k * 27);
const creamPal = (k) => rgb(214 + k * 18, 200 + k * 16, 172 + k * 14);

// ───────── отдельные текстуры ─────────
const PAINT = {
  brick: () => surface(512, 23, a => paintMasonry(a, { bw: 64, bh: 32, mortar: '#9a8e7a', pal: brickPal, chip: 0.10, stains: 16, stainRGB: '50,35,25' }), 3),
  dustWall: () => surface(512, 29, a => {
    paintMasonry(a, { bw: 128, bh: 64, mortar: '#a89674', mortarW: 5, pal: sandPal, chip: 0.22, stains: 26, stainRGB: '120,90,50' });
    // кусочки штукатурки
    for (let i = 0; i < 8; i++) a.blob(a.r() * 512, a.r() * 512, 20 + a.r() * 40, '236,214,170', 0.35, 150, 0.4);
  }, 3.2),
  stucco: () => surface(512, 31, a => {                      // Mirage: бежевая штукатурка
    const { S, r } = a;
    a.rect(0, 0, S, S, rgb(226, 210, 182), 128);
    for (let i = 0; i < 70; i++) a.blob(r() * S, r() * S, 30 + r() * 90, r() < 0.5 ? '255,244,220' : '150,120,80', 0.08 + r() * 0.14);
    for (let i = 0; i < 22; i++) {                           // подтёки
      const x = r() * S, y = r() * S, h = 80 + r() * 200;
      const gr = a.g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(90,70,45,.0)'); gr.addColorStop(0.2, 'rgba(90,70,45,.13)'); gr.addColorStop(1, 'rgba(90,70,45,0)');
      a.wrap((ox, oy) => { a.g.fillStyle = gr; a.g.fillRect(x + ox, y + oy, 3 + r() * 5, h); });
    }
    for (let y = 0; y < S; y += 128) {                       // швы панелей
      a.rect(0, y, S, 2, 'rgba(110,90,60,.45)', 70);
      a.rect(0, y + 2, S, 1, 'rgba(255,255,255,.35)', 150);
    }
    for (let i = 0; i < 5; i++) {                            // отвалившаяся штукатурка, видна кладка
      const cx = r() * S, cy = r() * S, n = 8, pts = [];
      for (let k = 0; k < n; k++) { const an = k / n * 6.283, rr = 18 + r() * 26; pts.push([cx + Math.cos(an) * rr, cy + Math.sin(an) * rr * 0.8]); }
      a.wrap((ox, oy) => {
        for (const [ctx, fill] of [[a.g, rgb(176 + r() * 20, 116 + r() * 16, 84)], [a.hg, 'rgb(60,60,60)']]) {
          ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(pts[0][0] + ox, pts[0][1] + oy);
          for (const p of pts) ctx.lineTo(p[0] + ox, p[1] + oy); ctx.closePath(); ctx.fill();
        }
        a.g.strokeStyle = 'rgba(80,60,40,.6)'; a.g.lineWidth = 1;
        for (let k = -3; k <= 3; k++) { a.g.beginPath(); a.g.moveTo(cx - 40 + ox, cy + k * 8 + oy); a.g.lineTo(cx + 40 + ox, cy + k * 8 + oy); a.g.stroke(); }
      });
    }
    for (let i = 0; i < 9; i++) a.crack(r() * S, r() * S, 12 + r() * 16, '70,52,34', 0.5, 40);
  }, 2.6, 16),
  blocksGray: () => surface(512, 37, a => paintMasonry(a, { bw: 128, bh: 64, mortar: '#7d7b74', pal: grayPal, chip: 0.2, stains: 18, stainRGB: '40,40,36' }), 3),
  dustBlocks: () => surface(512, 41, a => paintMasonry(a, { bw: 128, bh: 64, mortar: '#8f7e5c', pal: (k) => rgb(176 + k * 26, 146 + k * 22, 102 + k * 18), chip: 0.25, stains: 22, stainRGB: '90,64,34' }), 3.2),
  stuccoBlocks: () => surface(512, 43, a => paintMasonry(a, { bw: 128, bh: 64, mortar: '#b8a98a', mortarW: 3, pal: creamPal, chip: 0.12, stains: 14, stainRGB: '120,96,60' }), 2.6),
  crate: () => surface(512, 51, a => {
    const { S, r } = a;
    a.rect(0, 0, S, S, '#8f6535', 120);
    for (let i = 0; i < 4; i++) {                            // 4 вертикальные доски
      const v = 128 + r() * 30;
      a.rect(i * 128, 0, 128, S, rgb(v, v * 0.72, v * 0.42), 150 + r() * 25);
      a.rect(i * 128, 0, 3, S, 'rgba(25,14,5,.7)', 50);
      for (let k = 0; k < 70; k++) {                         // волокна
        const x = i * 128 + 6 + r() * 116, y = r() * S, l = 30 + r() * 140;
        a.g.strokeStyle = r() < 0.5 ? 'rgba(40,22,8,.20)' : 'rgba(255,220,160,.14)'; a.g.lineWidth = 1 + r();
        a.g.beginPath(); a.g.moveTo(x, y); a.g.quadraticCurveTo(x + (r() - 0.5) * 8, y + l / 2, x + (r() - 0.5) * 5, y + l); a.g.stroke();
      }
      if (r() < 0.8) a.blob(i * 128 + 20 + r() * 88, r() * S, 10 + r() * 8, '50,26,8', 0.55, 90, 0.7);   // сучок
    }
    const F = 40;                                            // рама
    for (const [x, y, w, h] of [[0, 0, S, F], [0, S - F, S, F], [0, 0, F, S], [S - F, 0, F, S]]) {
      a.rect(x, y, w, h, '#5c3d1c', 205);
      a.g.fillStyle = 'rgba(255,220,160,.18)'; a.g.fillRect(x, y, w, 2);
      a.g.fillStyle = 'rgba(0,0,0,.35)'; a.g.fillRect(x, y + h - 3, w, 3);
    }
    a.g.save(); a.g.translate(S / 2, S / 2); a.g.rotate(Math.PI / 4);   // раскос
    a.g.fillStyle = '#5c3d1c'; a.g.fillRect(-S * 0.73, -22, S * 1.46, 44);
    a.g.fillStyle = 'rgba(0,0,0,.3)'; a.g.fillRect(-S * 0.73, 18, S * 1.46, 4);
    a.hg.save(); a.hg.translate(S / 2, S / 2); a.hg.rotate(Math.PI / 4); a.hg.fillStyle = 'rgb(215,215,215)'; a.hg.fillRect(-S * 0.73, -22, S * 1.46, 44); a.hg.restore();
    a.g.restore();
    for (const [x, y] of [[20, 20], [S - 20, 20], [20, S - 20], [S - 20, S - 20], [S / 2, S / 2], [20, S / 2], [S - 20, S / 2], [S / 2, 20], [S / 2, S - 20]]) {
      a.g.fillStyle = '#2b2b2b'; a.g.beginPath(); a.g.arc(x, y, 5, 0, 7); a.g.fill();
      a.g.fillStyle = 'rgba(255,255,255,.35)'; a.g.beginPath(); a.g.arc(x - 1.5, y - 1.5, 1.8, 0, 7); a.g.fill();
      a.hg.fillStyle = 'rgb(240,240,240)'; a.hg.beginPath(); a.hg.arc(x, y, 5, 0, 7); a.hg.fill();
    }
    for (let i = 0; i < 6; i++) a.blob(r() * S, r() * S, 40 + r() * 60, '30,18,6', 0.16);
    // трафарет
    a.g.save(); a.g.font = 'bold 54px Arial'; a.g.fillStyle = 'rgba(235,230,210,.55)'; a.g.textAlign = 'center'; a.g.translate(S / 2, S * 0.28); a.g.fillText('FRAGILE', 0, 0); a.g.restore();
  }, 3, 12),
  stone: () => surface(512, 77, a => {
    const { S, r } = a;
    a.rect(0, 0, S, S, '#75716a', 128);
    for (let i = 0; i < 90; i++) a.blob(r() * S, r() * S, 12 + r() * 50, r() < 0.5 ? '40,38,34' : '176,170,156', 0.25 + r() * 0.2, r() < 0.5 ? 70 : 190, 0.5);
    for (let i = 0; i < 14; i++) a.crack(r() * S, r() * S, 14 + r() * 20, '20,18,16', 0.5, 40);
  }, 4.5, 30),
  floorConcrete: () => surface(512, 11, a => {              // плиты 1×1 м
    const { S, r } = a, T = S / 4;
    a.rect(0, 0, S, S, '#aea594', 120);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const v = 164 + r() * 28;
      a.rect(i * T + 3, j * T + 3, T - 6, T - 6, rgb(v, v - 5, v - 16), 150 + r() * 20);
      a.g.fillStyle = 'rgba(255,255,255,.16)'; a.g.fillRect(i * T + 3, j * T + 3, T - 6, 2);
    }
    for (let i = 0; i < 24; i++) a.blob(r() * S, r() * S, 18 + r() * 60, '70,64,52', 0.14 + r() * 0.18);
    for (let i = 0; i < 400; i++) a.blob(r() * S, r() * S, 1.5 + r() * 2, r() < 0.5 ? '230,225,210' : '60,55,45', 0.6, r() < 0.5 ? 170 : 90, 0.8);   // заполнитель
    for (let i = 0; i < 7; i++) a.crack(r() * S, r() * S, 12 + r() * 18, '40,34,28', 0.55, 40);
  }, 3, 24),
  floorSand: () => surface(512, 61, a => {                  // Dust II: тёсаные плиты и песок
    const { S, r } = a;
    a.rect(0, 0, S, S, '#7e6a46', 70);
    let y = 0;
    for (const rh of partition(S, 56, 110, r)) {
      let x = 0;
      for (const rw of partition(S, 70, 150, r)) {
        const v = r(), g0 = 6;
        a.rect(x + g0 / 2, y + g0 / 2, rw - g0, rh - g0, rgb(186 + v * 30, 160 + v * 26, 116 + v * 20), 150 + v * 40);
        a.g.fillStyle = 'rgba(255,240,205,.2)'; a.g.fillRect(x + 3, y + 3, rw - 6, 2);
        a.g.fillStyle = 'rgba(50,34,14,.25)'; a.g.fillRect(x + 3, y + rh - 5, rw - 6, 2);
        a.blob(x + rw * 0.5, y + rh * 0.5, Math.min(rw, rh) * 0.5, '90,66,34', 0.14 + r() * 0.12, 105, 0.5);
        x += rw;
      }
      y += rh;
    }
    for (let i = 0; i < 40; i++) a.blob(r() * S, r() * S, 25 + r() * 70, r() < 0.55 ? '236,218,170' : '110,84,50', 0.14 + r() * 0.16);   // песок/грязь
    for (let i = 0; i < 260; i++) a.blob(r() * S, r() * S, 2 + r() * 3.5, r() < 0.5 ? '70,52,30' : '230,212,170', 0.7, 190, 0.7);       // камешки
    for (let i = 0; i < 6; i++) a.crack(r() * S, r() * S, 10 + r() * 14, '50,36,18', 0.55, 40);
  }, 3.4, 22),
  floorTile: () => surface(512, 71, a => {                  // Mirage: керамическая плитка 25 см
    const { S, r } = a, T = 32;
    a.rect(0, 0, S, S, '#a39580', 70);
    for (let i = 0; i < S / T; i++) for (let j = 0; j < S / T; j++) {
      const v = r(), inlay = (i % 4 === 2 && j % 4 === 2);
      const base = inlay ? rgb(232, 218, 188) : rgb(196 + v * 22, 160 + v * 18, 118 + v * 14);
      a.rect(i * T + 1, j * T + 1, T - 2, T - 2, base, 170 + v * 25);
      a.g.fillStyle = 'rgba(255,255,255,.2)'; a.g.fillRect(i * T + 1, j * T + 1, T - 2, 1.5);
      a.g.fillStyle = 'rgba(40,26,10,.22)'; a.g.fillRect(i * T + 1, j * T + T - 2, T - 2, 1.5);
      if (r() < 0.05) a.blob(i * T + r() * T, j * T + r() * T, 5 + r() * 6, '50,36,20', 0.5, 80, 0.7);   // выбоины
    }
    for (let i = 0; i < 30; i++) a.blob(r() * S, r() * S, 20 + r() * 70, r() < 0.5 ? '255,244,220' : '90,70,40', 0.10 + r() * 0.12);
    for (let i = 0; i < 6; i++) a.crack(r() * S, r() * S, 10 + r() * 14, '60,44,26', 0.5, 40);
  }, 2.8, 18),
  door: () => surface(512, 83, a => {                       // синяя крашеная дверь
    const { S, r } = a;
    a.rect(0, 0, S, S, '#245394', 150);
    for (let i = 0; i < 8; i++) {
      const v = r();
      a.rect(i * 64 + 2, 0, 60, S, rgb(32 + v * 14, 80 + v * 18, 146 + v * 18), 160 + v * 25);
      a.rect(i * 64, 0, 3, S, 'rgba(8,16,36,.8)', 40);
    }
    for (let i = 0; i < 26; i++) {                           // облупившаяся краска
      const x = r() * S, y = r() * S, rad = 8 + r() * 26;
      a.blob(x, y, rad, r() < 0.5 ? '150,106,62' : '170,150,120', 0.75, 95, 0.8);
    }
    for (const y of [96, S - 130]) {                          // металлические полосы
      a.rect(0, y, S, 34, '#3a3d44', 215);
      a.g.fillStyle = 'rgba(255,255,255,.18)'; a.g.fillRect(0, y, S, 2);
      for (let x = 20; x < S; x += 56) { a.g.fillStyle = '#17181b'; a.g.beginPath(); a.g.arc(x, y + 17, 5, 0, 7); a.g.fill(); a.hg.fillStyle = 'rgb(250,250,250)'; a.hg.beginPath(); a.hg.arc(x, y + 17, 5, 0, 7); a.hg.fill(); }
    }
    for (let i = 0; i < 8; i++) a.blob(r() * S, r() * S, 40 + r() * 60, '8,14,30', 0.18);
  }, 3, 14),
};

// ───────── материалы по темам ─────────
const THEMES = {
  arena:  { wall: ['brick', 4],       cover: ['blocksGray', 4],   crate: ['crate', 2], stone: ['stone', 3], plat: ['floorConcrete', 4], door: ['door', 2], floor: ['floorConcrete', 4] },
  dust2:  { wall: ['dustWall', 6],    cover: ['dustBlocks', 4],   crate: ['crate', 2], stone: ['stone', 3], plat: ['floorSand', 4],     door: ['door', 2], floor: ['floorSand', 4] },
  mirage: { wall: ['stucco', 5],      cover: ['stuccoBlocks', 4], crate: ['crate', 2], stone: ['stone', 3], plat: ['floorTile', 4],     door: ['door', 2], floor: ['floorTile', 4] },
};
const texCache = {}, matCache = {};
let detailOn = true;
function material(name) {
  if (matCache[name]) return matCache[name];
  const t = texCache[name] || (texCache[name] = PAINT[name]());
  return (matCache[name] = new THREE.MeshStandardMaterial({ map: t.map, normalMap: detailOn ? t.normalMap : null, normalScale: new THREE.Vector2(1, 1), roughness: 0.92, metalness: 0 }));
}

// Освещение и небо для каждой карты
const LIGHT = {
  arena:  { skyTop: 0x3f78c0, skyBot: 0xc9dcec, fog: 0xb9cfe2, sun: 0xfff0d8, sunI: 0.95, hemiSky: 0xcfe3ff, hemiGnd: 0x8f8068, hemiI: 0.75, ground: 0x8c7e62 },
  dust2:  { skyTop: 0x4f86c8, skyBot: 0xe8d9b8, fog: 0xdcc9a2, sun: 0xffe2b0, sunI: 1.05, hemiSky: 0xdbe6f3, hemiGnd: 0xa08a60, hemiI: 0.72, ground: 0x9a8560 },
  mirage: { skyTop: 0x3d7cd0, skyBot: 0xd6e6f5, fog: 0xcfdde8, sun: 0xfff1d8, sunI: 1.0, hemiSky: 0xd6e8ff, hemiGnd: 0x9a8b70, hemiI: 0.78, ground: 0x8e8068 },
};

SA.tex = {
  init(aniso) { ANISO = aniso || 4; },
  setDetail(on) {                       // рельеф (карты нормалей) можно отключить на слабых видеокартах
    detailOn = !!on;
    for (const n in matCache) { matCache[n].normalMap = detailOn ? texCache[n].normalMap : null; matCache[n].needsUpdate = true; }
  },
  materials(theme) {
    const t = THEMES[theme] || THEMES.arena, out = {};
    for (const k in t) out[k] = { mat: material(t[k][0]), tile: t[k][1] };
    return out;
  },
  light(theme) { return LIGHT[theme] || LIGHT.arena; },
  // масштабирует UV коробки по реальным размерам граней, чтобы текстура не растягивалась
  tileUV(geo, w, h, d, t) {
    const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * dims[f][0] / t, uv.getY(k) * dims[f][1] / t);
    }
    uv.needsUpdate = true;
  },
  canvas, rng,
};
})();
