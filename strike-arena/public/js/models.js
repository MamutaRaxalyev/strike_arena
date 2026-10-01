// Модели: оружие, руки от первого лица (с пальцами, перчатками, рукавами), персонажи.
(() => {
'use strict';
const SA = (window.SA = window.SA || {});
const col = hex => new THREE.Color(hex).convertSRGBToLinear();
const std = (hex, rough, metal, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: col(hex), roughness: rough, metalness: metal || 0 }, extra || {}));

// ───────── оружие ─────────
const GM = {
  metal: std(0x2b2e33, 0.42, 0.55), dark: std(0x16171a, 0.55, 0.35), steel: std(0xaeb4bc, 0.28, 0.75),
  wood: std(0x80501f, 0.75, 0), olive: std(0x3d4a35, 0.65, 0.12), grip: std(0x202022, 0.9, 0),
  glass: std(0x4ab0ff, 0.1, 0.2, { emissive: col(0x0b3556) }), brass: std(0xb89a3a, 0.4, 0.7),
};
// ['b', w,h,d, x,y,z, мат, rotX]  коробка;   ['c', r,длина, x,y,z, мат]  цилиндр вдоль ствола
const GUNS = {
  knife:  [['b', .014, .075, .26, 0, 0, -.18, 'steel'], ['b', .03, .035, .12, 0, 0, .01, 'grip'], ['b', .06, .02, .02, 0, 0, -.05, 'dark'], ['b', .004, .02, .2, 0, .035, -.17, 'steel']],
  usp:    [['b', .036, .045, .21, 0, .025, -.09, 'dark'], ['b', .03, .03, .17, 0, -.008, -.07, 'metal'], ['b', .034, .1, .05, 0, -.07, .01, 'grip', -.2], ['c', .009, .06, 0, .025, -.21, 'steel'], ['c', .017, .14, 0, .025, -.3, 'dark'], ['b', .02, .012, .012, 0, .052, -.17, 'steel'], ['b', .006, .02, .02, 0, -.03, -.045, 'steel']],
  deagle: [['b', .04, .055, .28, 0, .02, -.11, 'steel'], ['b', .036, .04, .22, 0, -.02, -.08, 'metal'], ['b', .038, .11, .055, 0, -.075, .02, 'grip', -.2], ['c', .012, .05, 0, .02, -.27, 'dark'], ['b', .02, .01, .26, 0, .05, -.11, 'dark']],
  mp9:    [['b', .05, .08, .3, 0, 0, -.13, 'dark'], ['b', .03, .16, .04, 0, -.12, -.1, 'metal'], ['b', .035, .1, .045, 0, -.08, .04, 'grip', -.2], ['c', .012, .12, 0, .01, -.34, 'metal'], ['b', .025, .04, .2, 0, .01, .2, 'metal'], ['b', .02, .02, .22, 0, .05, -.1, 'dark']],
  ak47:   [['b', .055, .085, .32, 0, 0, -.16, 'metal'], ['b', .06, .065, .26, 0, -.005, -.45, 'wood'], ['c', .011, .3, 0, .01, -.74, 'dark'], ['c', .009, .3, 0, .055, -.52, 'dark'], ['b', .04, .2, .07, 0, -.15, -.2, 'dark', .3], ['b', .045, .1, .3, 0, -.01, .17, 'wood', .08], ['b', .04, .11, .05, 0, -.1, .0, 'grip', -.2], ['b', .012, .04, .012, 0, .05, -.85, 'dark'], ['b', .05, .01, .12, 0, .048, -.06, 'metal'], ['b', .062, .012, .1, 0, .036, -.5, 'dark']],
  m4a1:   [['b', .055, .09, .34, 0, 0, -.15, 'dark'], ['b', .06, .07, .3, 0, 0, -.49, 'metal'], ['c', .01, .2, 0, .01, -.74, 'dark'], ['c', .02, .2, 0, .01, -.86, 'dark'], ['b', .04, .17, .06, 0, -.13, -.18, 'dark', .15], ['b', .05, .09, .22, 0, -.005, .18, 'dark'], ['b', .03, .025, .34, 0, .058, -.15, 'metal'], ['b', .04, .11, .05, 0, -.1, .0, 'grip', -.2], ['b', .014, .03, .02, 0, .082, -.04, 'dark']],
  awp:    [['b', .06, .1, .5, 0, 0, -.2, 'olive'], ['c', .014, .55, 0, .01, -.78, 'dark'], ['c', .022, .07, 0, .01, -1.08, 'metal'], ['c', .03, .3, 0, .115, -.25, 'dark'], ['c', .022, .02, 0, .115, -.41, 'glass'], ['c', .034, .04, 0, .115, -.1, 'dark'], ['b', .05, .11, .35, 0, -.005, .2, 'olive'], ['b', .04, .07, .1, 0, -.08, -.2, 'dark'], ['b', .04, .1, .05, 0, -.09, .02, 'grip', -.2], ['b', .015, .015, .06, .045, .025, -.05, 'steel']],
};
const MUZZLE_Z = { knife: -.3, usp: -.38, deagle: -.3, mp9: -.42, ak47: -.9, m4a1: -.97, awp: -1.12 };
// где держат руки: r — правая (рукоять), l — левая (цевьё/магазин); rotation для поворота кисти
const ANCH = {
  knife:  { r: [0, 0.03, 0.06] },
  usp:    { r: [0, -0.02, 0.04], l: [-0.04, -0.085, 0.03] },
  deagle: { r: [0, -0.02, 0.05], l: [-0.045, -0.09, 0.04] },
  mp9:    { r: [0, -0.03, 0.07], l: [-0.05, -0.03, -0.22] },
  ak47:   { r: [0, -0.045, 0.03], l: [-0.055, -0.03, -0.46] },
  m4a1:   { r: [0, -0.045, 0.03], l: [-0.055, -0.03, -0.5] },
  awp:    { r: [0, -0.04, 0.05], l: [-0.052, -0.03, -0.42] },
};
const cylCache = {};
function buildGun(id, shadows) {
  const g = new THREE.Group();
  for (const p of GUNS[id] || []) {
    let mesh;
    if (p[0] === 'b') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(p[1], p[2], p[3]), GM[p[7]]);
      mesh.position.set(p[4], p[5], p[6]);
      if (p[8]) mesh.rotation.x = p[8];
    } else {
      const key = p[1] + '_' + p[2];
      if (!cylCache[key]) cylCache[key] = new THREE.CylinderGeometry(p[1], p[1], p[2], 10).rotateX(Math.PI / 2);
      mesh = new THREE.Mesh(cylCache[key], GM[p[6]]);
      mesh.position.set(p[3], p[4], p[5]);
    }
    mesh.castShadow = !!shadows;
    g.add(mesh);
  }
  return g;
}

// ───────── руки от первого лица ─────────
const SLEEVE = { CT: 0x34568f, T: 0x7f6a43 };
const GLOVE = { CT: 0x1c1e22, T: 0x5b4a2c };
const SKIN = 0xd9ab88;
const FINGER = [[0.040, 0.026, 0.020], [0.046, 0.029, 0.022], [0.042, 0.027, 0.020], [0.033, 0.021, 0.017]];
const boxCache = {};
function box(w, h, d) { const k = w + '_' + h + '_' + d; return boxCache[k] || (boxCache[k] = new THREE.BoxGeometry(w, h, d)); }

// кулак (правая рука; левая получается зеркалом по X). Начало координат — тыльная сторона кисти, пальцы смотрят в -z и загибаются вниз.
function makeFist(team, withWatch) {
  const glove = std(GLOVE[team] || 0x222222, 0.85, 0.05), pad = std(0x0e0f10, 0.7, 0.1), skin = std(SKIN, 0.8, 0);
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); (parent || g).add(m); return m; };
  add(box(0.088, 0.03, 0.095), glove, 0, 0, 0);                            // тыльная сторона ладони
  add(box(0.07, 0.008, 0.045), pad, 0, 0.018, -0.015);                      // накладка на костяшках
  for (let i = 0; i < 4; i++) {
    const base = new THREE.Group();
    base.position.set((i - 1.5) * 0.0215, -0.002, -0.046);
    base.rotation.x = -1.05 - (i === 3 ? 0.1 : 0);
    g.add(base);
    let parent = base;
    FINGER[i].forEach((len, s) => {
      const seg = new THREE.Group();
      if (s > 0) { seg.position.z = -FINGER[i][s - 1]; seg.rotation.x = -(0.95 + s * 0.2); parent.add(seg); }
      else parent.add(seg);
      add(box(0.019 - s * 0.001, 0.0185 - s * 0.001, len), s === 2 ? skin : glove, 0, 0, -len / 2, seg);   // кончики пальцев без перчатки
      parent = seg;
    });
  }
  const th = new THREE.Group(); th.position.set(-0.047, -0.002, -0.015); th.rotation.set(-0.25, 0.55, 0); g.add(th);
  add(box(0.022, 0.021, 0.05), glove, 0, 0, -0.025, th);
  const th2 = new THREE.Group(); th2.position.z = -0.05; th2.rotation.x = -0.35; th.add(th2);
  add(box(0.02, 0.019, 0.034), skin, 0, 0, -0.017, th2);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.046, 0.05, 12).rotateX(Math.PI / 2), glove);   // манжета перчатки
  cuff.position.set(0, -0.004, 0.07); g.add(cuff);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.01, 12).rotateX(Math.PI / 2), pad);
  band.position.set(0, -0.004, 0.092); g.add(band);
  if (withWatch) {
    add(box(0.05, 0.012, 0.042), pad, 0, 0.034, 0.08);
    add(box(0.03, 0.003, 0.024), std(0x55e0ff, 0.2, 0, { emissive: col(0x1a8aa8) }), 0, 0.041, 0.08);
  }
  return g;
}
// предплечье: цилиндр единичной длины, растягивается между двумя точками
function makeLimb(mat, r0, r1) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 1, 12), mat);
  return m;
}
const UP = new THREE.Vector3(0, 1, 0), tmpD = new THREE.Vector3(), tmpM = new THREE.Vector3();
function placeLimb(m, from, to) {
  tmpD.subVectors(to, from);
  const len = tmpD.length();
  m.position.copy(from).addScaledVector(tmpD, 0.5);
  m.quaternion.setFromUnitVectors(UP, tmpD.normalize());
  m.scale.set(1, len, 1);
}

function createViewmodel(camera, flashTex) {
  const root = new THREE.Group();
  root.position.set(0.2, -0.2, -0.4);
  camera.add(root);
  const gunG = new THREE.Group(), handsG = new THREE.Group();
  root.add(gunG, handsG);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  flash.scale.set(0.34, 0.34, 1); flash.visible = false;
  root.add(flash);

  const V = new THREE.Vector3;
  const st = { id: '', team: '', anch: null, rWrist: new THREE.Vector3(), lBase: new THREE.Vector3(), lHand: null, rHand: null, rArm: null, lArm: null,
               rElbow: new THREE.Vector3(0.24, -0.3, 0.56), lElbow: new THREE.Vector3(-0.3, -0.32, 0.5), t: 0, draw: 1, kickZ: 0, kickR: 0, flashUntil: 0 };

  function setWeapon(id, team) {
    if (st.id === id && st.team === team) return;
    const newWeapon = st.id !== id;
    st.id = id; st.team = team;
    while (gunG.children.length) gunG.remove(gunG.children[0]);
    while (handsG.children.length) handsG.remove(handsG.children[0]);
    if (!id) return;
    gunG.add(buildGun(id, false));
    const A = ANCH[id] || ANCH.ak47;
    const sleeve = std(SLEEVE[team] || 0x444444, 0.9, 0);
    st.rHand = makeFist(team, false); st.rHand.position.set(...A.r);
    st.rArm = makeLimb(sleeve, 0.046, 0.057); st.rWrist.set(A.r[0], A.r[1] - 0.004, A.r[2] + 0.1);
    handsG.add(st.rHand, st.rArm);
    placeLimb(st.rArm, st.rWrist, st.rElbow);
    st.lHand = st.lArm = null;
    if (A.l) {
      st.lHand = makeFist(team, true);
      st.lHand.scale.x = -1;                                // зеркало: левая рука
      st.lHand.rotation.z = Math.PI / 2;                    // тыл кисти смотрит влево, пальцы обхватывают оружие
      st.lBase.set(...A.l);
      st.lHand.position.copy(st.lBase);
      st.lArm = makeLimb(sleeve, 0.046, 0.057);
      handsG.add(st.lHand, st.lArm);
      placeLimb(st.lArm, V.set(st.lBase.x, st.lBase.y, st.lBase.z + 0.1), st.lElbow);
    }
    flash.position.set(0, 0.02, MUZZLE_Z[id] || -0.4);
    if (newWeapon) st.draw = 1;                               // анимация доставания
  }

  // input: { speed, air, reload (0..1 или -1), dt }
  function update(dt, inp) {
    st.t += dt;
    st.draw = Math.max(0, st.draw - dt * 4.5);
    st.kickZ *= Math.exp(-dt * 16); st.kickR *= Math.exp(-dt * 13);
    const sp = Math.min(1, (inp.speed || 0) / 5.5), walk = st.t * (6 + sp * 5);
    const bobX = Math.sin(walk) * 0.006 * sp, bobY = Math.abs(Math.cos(walk)) * 0.007 * sp;
    const breathe = Math.sin(st.t * 1.5) * 0.0015;
    let rx = -st.kickR * 0.07, rz = 0, dy = -st.draw * st.draw * 0.28, dz = st.kickZ * 0.06;
    let rel = inp.reload;
    if (rel >= 0) {                                           // перезарядка: оружие уходит вниз и влево
      const k = Math.sin(Math.min(1, rel) * Math.PI);
      rx += -k * 0.32; rz += k * 0.22; dy += -k * 0.06;
    }
    root.position.set(0.2 + bobX, -0.2 + bobY + breathe + dy + (inp.air ? 0.012 : 0), -0.4 + dz);
    root.rotation.set(rx, 0, rz);
    // левая рука тянется к магазину
    if (st.lHand) {
      let ox = 0, oy = 0, oz = 0;
      if (rel >= 0) {
        const r = Math.min(1, rel);
        const a = r < 0.2 ? r / 0.2 : r < 0.55 ? 1 : Math.max(0, 1 - (r - 0.55) / 0.2);
        const mag = ST_MAG[st.id] || ST_MAG.ak47;
        ox = (mag[0] - st.lBase.x) * a; oy = (mag[1] - st.lBase.y) * a; oz = (mag[2] - st.lBase.z) * a;
      }
      st.lHand.position.set(st.lBase.x + ox, st.lBase.y + oy, st.lBase.z + oz);
      placeLimb(st.lArm, V.set(st.lBase.x + ox, st.lBase.y + oy, st.lBase.z + oz + 0.1), st.lElbow);
    }
    flash.visible = performance.now() < st.flashUntil;
  }
  const ST_MAG = { usp: [-0.01, -0.13, 0.04], deagle: [-0.01, -0.13, 0.05], mp9: [-0.03, -0.14, -0.1], ak47: [-0.03, -0.16, -0.2], m4a1: [-0.03, -0.15, -0.18], awp: [-0.03, -0.1, -0.2] };

  return {
    group: root, setWeapon, update,
    kick(s) { st.kickZ = Math.min(1.6, st.kickZ + s); st.kickR = Math.min(1.8, st.kickR + s); },
    muzzle(ms) { st.flashUntil = performance.now() + ms; },
    get id() { return st.id; },
  };
}


// ───────── бомба C4 ─────────
function makeBomb() {
  const g = new THREE.Group();
  const olive = std(0x3f4630, 0.8, 0.1), brick = std(0xc6b88c, 0.9, 0), dark = std(0x17181a, 0.6, 0.3), wireR = std(0xb02a22, 0.7, 0), wireB = std(0x2a4fb0, 0.7, 0);
  const add = (geo, mat, x, y, z) => { const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.castShadow = true; g.add(mesh); return mesh; };
  add(box(0.52, 0.11, 0.32), olive, 0, 0.055, 0);
  add(box(0.19, 0.09, 0.28), brick, -0.16, 0.155, 0); add(box(0.19, 0.09, 0.28), brick, 0.16, 0.155, 0);
  add(box(0.13, 0.02, 0.26), dark, 0, 0.12, 0);
  add(box(0.5, 0.015, 0.03), dark, 0, 0.205, -0.09); add(box(0.5, 0.015, 0.03), dark, 0, 0.205, 0.09);   // ремни
  add(box(0.012, 0.012, 0.16), wireR, -0.03, 0.135, 0.17); add(box(0.012, 0.012, 0.16), wireB, 0.03, 0.135, 0.17);
  add(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 6), dark, 0.2, 0.3, -0.1);                          // антенна
  const c = SA.tex.canvas(128, 64), cx = c.getContext('2d'), tex = new THREE.CanvasTexture(c);
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.115, 0.058), new THREE.MeshBasicMaterial({ map: tex }));
  disp.rotation.x = -Math.PI / 2; disp.position.set(0, 0.1315, 0.045); g.add(disp);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x330000 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), ledMat); led.position.set(0, 0.138, -0.085); g.add(led);
  let lastTxt = null, lastCol = null;
  return {
    g,
    setText(txt, color) {
      if (txt === lastTxt && color === lastCol) return;
      lastTxt = txt; lastCol = color;
      cx.fillStyle = '#060906'; cx.fillRect(0, 0, 128, 64);
      cx.fillStyle = color || '#ff3b2f'; cx.font = 'bold 46px monospace'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillText(txt, 64, 34); tex.needsUpdate = true;
    },
    setLed(on, hex) { ledMat.color.set(on ? (hex || 0xff2a1a) : 0x2a0805); },
  };
}
function makeBackBomb() {            // бомба на спине у носителя
  const g = new THREE.Group();
  const a = new THREE.Mesh(box(0.34, 0.26, 0.1), std(0x3f4630, 0.8, 0.1)); a.position.set(0, 1.18, 0.38);
  const b = new THREE.Mesh(box(0.1, 0.2, 0.08), std(0xc6b88c, 0.9, 0)); b.position.set(-0.09, 1.18, 0.45);
  const c = new THREE.Mesh(box(0.1, 0.2, 0.08), std(0xc6b88c, 0.9, 0)); c.position.set(0.09, 1.18, 0.45);
  g.add(a, b, c);
  return g;
}

// ───────── персонажи ─────────
const PAL = {
  CT: { uni: 0x34568f, vest: 0x1d2535, hat: 0x222d44, pant: 0x2b3040, boot: 0x151515 },
  T:  { uni: 0x7f6a43, vest: 0x3b3226, hat: 0x161616, pant: 0x4a4636, boot: 0x1b1612 },
  X:  { uni: 0xb83a3a, vest: 0xe8e8e8, hat: 0xffffff, pant: 0x808080, boot: 0x303030 },
};
const palCache = {};
function pal(team) {
  if (palCache[team]) return palCache[team];
  const p = PAL[team] || PAL.X;
  return (palCache[team] = { uni: std(p.uni, 0.85), vest: std(p.vest, 0.8), hat: std(p.hat, 0.6, 0.1), pant: std(p.pant, 0.9), boot: std(p.boot, 0.8), skin: std(SKIN, 0.8), glove: std(GLOVE[team] || 0x333333, 0.85) });
}
const AG = {
  torso: new THREE.BoxGeometry(0.58, 0.5, 0.3), vest: new THREE.BoxGeometry(0.64, 0.4, 0.36), pelvis: new THREE.BoxGeometry(0.52, 0.16, 0.3),
  pack: new THREE.BoxGeometry(0.4, 0.42, 0.14), leg: new THREE.CylinderGeometry(0.11, 0.085, 0.8, 8), boot: new THREE.BoxGeometry(0.18, 0.12, 0.32),
  arm: new THREE.CylinderGeometry(0.075, 0.065, 0.52, 8), hand: new THREE.SphereGeometry(0.06, 8, 6), head: new THREE.SphereGeometry(0.16, 14, 12),
  helmet: new THREE.SphereGeometry(0.19, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), mask: new THREE.BoxGeometry(0.3, 0.12, 0.2),
  pouch: new THREE.BoxGeometry(0.1, 0.12, 0.06), knee: new THREE.BoxGeometry(0.16, 0.1, 0.06),
};
function makeLabel(text, color) {
  const c = SA.tex.canvas(256, 64), g = c.getContext('2d');
  g.font = 'bold 32px Arial'; g.textAlign = 'center'; g.lineWidth = 6; g.strokeStyle = '#000'; g.fillStyle = color;
  g.strokeText(text, 128, 42); g.fillText(text, 128, 42);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.set(2, 0.5, 1); s.position.y = 2.25;
  return s;
}
function makeAvatar(q) {
  const P = pal(q.tm), g = new THREE.Group();
  const add = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; (parent || g).add(m); return m; };
  add(AG.pelvis, P.pant, 0, 0.98, 0); add(AG.torso, P.uni, 0, 1.28, 0); add(AG.vest, P.vest, 0, 1.27, 0); add(AG.pack, P.vest, 0, 1.3, 0.24);
  add(AG.pouch, P.vest, -0.18, 1.12, -0.19); add(AG.pouch, P.vest, 0.0, 1.12, -0.19); add(AG.pouch, P.vest, 0.18, 1.12, -0.19);
  add(AG.head, P.skin, 0, 1.63, 0);
  if (q.tm !== 'X') add(AG.helmet, P.hat, 0, 1.65, 0);
  if (q.tm === 'T') add(AG.mask, P.hat, 0, 1.58, -0.08);
  const legs = [];
  for (const sx of [-1, 1]) {
    const lg = new THREE.Group(); lg.position.set(sx * 0.14, 0.92, 0); g.add(lg);
    add(AG.leg, P.pant, 0, -0.4, 0, lg); add(AG.boot, P.boot, 0, -0.86, -0.04, lg); add(AG.knee, P.vest, 0, -0.38, -0.09, lg);
    legs.push(lg);
    const outer = new THREE.Group(); outer.position.set(sx * 0.37, 1.46, 0); outer.rotation.y = sx > 0 ? 0.4 : -0.8; g.add(outer);
    const inner = new THREE.Group(); inner.rotation.x = 1.25; outer.add(inner);
    add(AG.arm, P.uni, 0, -0.26, 0, inner); add(AG.hand, P.glove, 0, -0.55, 0, inner);
  }
  const mount = new THREE.Group(); mount.position.set(0.17, 1.27, -0.38); g.add(mount);
  const label = makeLabel(q.n, q.tm === 'CT' ? '#7fb2ff' : '#ffc563');
  g.add(label);
  const back = makeBackBomb(); back.visible = false; g.add(back);
  return { g, label, back, mount, legs, team: q.tm, name: q.n, gunId: '', tx: q.x, ty: q.y, tz: q.z, tyaw: q.yw, phase: 0, spd: 0, lastStep: 0 };
}

SA.models = { buildGun, createViewmodel, makeAvatar, makeBomb, MUZZLE_Z };
})();
