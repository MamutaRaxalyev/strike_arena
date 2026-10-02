// Атмосфера: диск солнца, мягкие лучи света из-за стен и пылинки в воздухе.
// Лучи начинаются у верхнего края стен на теневой стороне и идут вниз вдоль направления солнца, поэтому
// всегда «упираются» в стену, а не висят в воздухе. Яркость лучей задаётся BEAM_INTENSITY.
(() => {
'use strict';
const SA = (window.SA = window.SA || {});
const BEAM_INTENSITY = 0.13;     // пиковая прозрачность луча (0.05 едва заметно, 0.3 уже ярко)
const MAX_BEAMS = 26;

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// Чистая функция (без THREE): возвращает описания лучей. sd — единичный вектор на солнце {x,y,z}.
function computeBeams(boxes, sd, seed) {
  const rnd = rng(seed || 7), out = [];
  const hl = Math.hypot(sd.x, sd.z) || 1, hx = sd.x / hl, hz = sd.z / hl;
  const L = { x: -sd.x, y: -sd.y, z: -sd.z };
  const inside = (x, y, z) => { for (const b of boxes) if (x > b.minx && x < b.maxx && y > b.miny && y < b.maxy && z > b.minz && z < b.maxz) return true; return false; };
  const cand = [];
  for (const b of boxes) {
    if ((b.m !== 'wall' && b.m !== 'roof') || b.maxy < 5) continue;
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (nx * hx + nz * hz > -0.35) continue;                     // нужна грань, отвёрнутая от солнца (там тень)
      const len = nx ? b.maxz - b.minz : b.maxx - b.minx;
      for (let t = 1.5; t < len - 1.0; t += 6 + rnd() * 3) {
        const x = nx ? (nx > 0 ? b.maxx + 0.03 : b.minx - 0.03) : b.minx + t;
        const z = nz ? (nz > 0 ? b.maxz + 0.03 : b.minz - 0.03) : b.minz + t;
        cand.push({ x, y: b.maxy, z, tx: nx ? 0 : 1, tz: nx ? 1 : 0 });
      }
    }
  }
  for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
  for (const c of cand) {
    if (out.length >= MAX_BEAMS) break;
    const dist = c.y / sd.y;                                       // длина луча до земли
    const g = { x: c.x + L.x * dist, y: 0, z: c.z + L.z * dist };
    let ok = true;
    for (let k = 1; k <= 8 && ok; k++) { const f = k / 8; if (inside(c.x + L.x * dist * f, c.y + L.y * dist * f + (k === 8 ? 0.25 : 0), c.z + L.z * dist * f)) ok = false; }
    if (!ok || out.some(o => Math.hypot(o.top.x - c.x, o.top.z - c.z) < 5)) continue;
    out.push({ top: { x: c.x, y: c.y, z: c.z }, ground: g, len: dist, width: 1.3 + rnd() * 1.4, tan: { x: c.tx, y: 0, z: c.tz }, phase: rnd() * 6.28 });
  }
  return out;
}

function beamTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d'), img = g.createImageData(64, 256), d = img.data;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 64; x++) {
    const v = 1 - y / 255, u = x / 63;                             // v: 1 вверху (у стены), 0 внизу (у земли)
    const w = Math.pow(Math.sin(Math.PI * u), 1.6);
    const l = Math.pow(v, 0.75) * (v > 0.9 ? (1 - v) / 0.1 : 1);
    const i = (y * 64 + x) * 4;
    d[i] = 255; d[i + 1] = 232; d[i + 2] = 176; d[i + 3] = Math.round(255 * w * l);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}
function softDot(size, stops) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [p, col] of stops) gr.addColorStop(p, col);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}

let sunSprite = null, haloSprite = null, beamTex = null, dotTex = null;
const state = { group: null, beams: [], dust: null, level: 2, dustBase: null };

SA.fx = {
  computeBeams,
  // солнце крепится к небесной сфере (она следует за камерой)
  attachSun(skyMesh) {
    if (sunSprite) return;
    const mk = (tex, scale, opacity) => {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity }));
      m.scale.set(scale, scale, 1); skyMesh.add(m); return m;
    };
    sunSprite = mk(softDot(128, [[0, 'rgba(255,252,235,1)'], [0.16, 'rgba(255,244,200,.95)'], [0.3, 'rgba(255,214,130,.35)'], [1, 'rgba(255,190,90,0)']]), 34, 0.95);
    haloSprite = mk(softDot(128, [[0, 'rgba(255,225,150,.38)'], [0.4, 'rgba(255,200,110,.12)'], [1, 'rgba(255,190,100,0)']]), 120, 0.7);
  },
  setSunDir(sd) {
    if (!sunSprite) return;
    sunSprite.position.set(sd.x * 182, sd.y * 182, sd.z * 182);
    haloSprite.position.copy(sunSprite.position);
  },
  // лучи и пыль для карты; возвращает группу (её добавляют в сцену)
  build(boxes, sd, half) {
    const g = new THREE.Group();
    beamTex = beamTex || beamTexture();
    const beams = computeBeams(boxes, sd, 11);
    state.beams = [];
    const geo = new THREE.PlaneGeometry(1, 1);
    for (const b of beams) {
      const mat = new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: BEAM_INTENSITY, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
      mat.userData.ownMat = true;
      // базис: ось Y вдоль луча (к солнцу), X вдоль стены
      const y = new THREE.Vector3(sd.x, sd.y, sd.z).normalize();
      let x = new THREE.Vector3(b.tan.x, 0, b.tan.z); x.addScaledVector(y, -x.dot(y)).normalize();
      const z = new THREE.Vector3().crossVectors(x, y).normalize();
      const mid = new THREE.Vector3((b.top.x + b.ground.x) / 2, (b.top.y + b.ground.y) / 2 + 0.2, (b.top.z + b.ground.z) / 2);
      for (const cross of [false, true]) {
        const m = new THREE.Mesh(geo, mat);
        const bx = cross ? z : x, bz = cross ? x.clone().negate() : z;
        m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(bx, y, bz));
        m.position.copy(mid); m.scale.set(b.width, b.len + 0.9, 1); m.renderOrder = 5; m.userData.ownMat = true;
        g.add(m);
      }
      state.beams.push({ mat, phase: b.phase });
    }
    // пылинки вокруг игрока
    dotTex = dotTex || softDot(32, [[0, 'rgba(255,240,205,1)'], [0.5, 'rgba(255,230,180,.45)'], [1, 'rgba(255,225,170,0)']]);
    const N = 140, pos = new Float32Array(N * 3), base = new Float32Array(N * 3), r = rng(5);
    for (let i = 0; i < N; i++) { base[i * 3] = r() * 44 - 22; base[i * 3 + 1] = 0.4 + r() * 6.5; base[i * 3 + 2] = r() * 44 - 22; }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pm = new THREE.PointsMaterial({ size: 0.11, map: dotTex, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    pm.userData.ownMat = true;
    const pts = new THREE.Points(pg, pm); pts.frustumCulled = false; pts.userData.ownMat = true; g.add(pts);
    state.dust = { pts, pos, base, N };
    state.group = g;
    SA.fx.setLevel(state.level);
    return g;
  },
  // 0 — выключено, 1 — только лучи, 2 — лучи и пыль
  setLevel(q) {
    state.level = q;
    if (!state.group) return;
    state.group.visible = q >= 1;
    if (state.dust) state.dust.pts.visible = q >= 2;
  },
  update(t, camPos) {
    if (!state.group || !state.group.visible) return;
    const s = t / 1000;
    for (const b of state.beams) b.mat.opacity = BEAM_INTENSITY * (0.82 + 0.18 * Math.sin(s * 0.7 + b.phase));
    const d = state.dust;
    if (d && d.pts.visible) {
      for (let i = 0; i < d.N; i++) {
        const bx = d.base[i * 3], by = d.base[i * 3 + 1], bz = d.base[i * 3 + 2];
        const ox = Math.sin(s * 0.17 + i) * 0.7, oy = Math.sin(s * 0.23 + i * 1.7) * 0.4, oz = Math.cos(s * 0.19 + i * 0.6) * 0.7;
        d.pos[i * 3] = camPos.x + ((bx + ox - camPos.x + 22) % 44 + 44) % 44 - 22;      // зациклено вокруг камеры
        d.pos[i * 3 + 1] = by + oy;
        d.pos[i * 3 + 2] = camPos.z + ((bz + oz - camPos.z + 22) % 44 + 44) % 44 - 22;
      }
      d.pts.geometry.attributes.position.needsUpdate = true;
    }
  },
};
})();
