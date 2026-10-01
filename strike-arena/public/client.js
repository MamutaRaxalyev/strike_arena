(() => {
'use strict';
const SA = window.SA;
const $ = id => document.getElementById(id);
const EYE = 1.6, RAD = 0.4, HGT = 1.8, STEP = 0.5;
const BUY = ['deagle', 'mp9', 'ak47', 'm4a1', 'awp', 'armor', 'kit'];
const LOW = /[?&]low\b/.test(location.search);   // http://localhost:3000/?low — режим для слабых ПК

// Движение как в CS (метры, секунды): трение, ускорение, воздушное ускорение, прыжок
const TICK = 1 / 64, GRAV = 17.6, JUMP = 6.64, MAXSPEED = 5.5, ACCEL = 5.5, AIRACCEL = 12, AIRCAP = 0.66, FRICTION = 5.2, STOP = 1.76, SPEEDCAP = 12;
const U = 45.5;   // единиц CS в метре (для индикатора скорости)

// Отдача: накопленное смещение прицела (градусы) после каждого выстрела очереди, как «паттерн разброса» в CS.
// p — вверх, y — вправо (минус = влево). reset — пауза (мс), после которой очередь начинается заново.
const REC = {
  ak47:  { reset: 380, p: [0, .35, 1.2, 2.4, 3.8, 5.3, 6.7, 7.9, 8.9, 9.6, 10.1, 10.5, 10.8, 11, 11.2, 11.3, 11.4, 11.5, 11.55, 11.6, 11.65, 11.7, 11.7, 11.75, 11.8, 11.8, 11.85, 11.9, 11.9, 11.9],
           y: [0, 0, .05, .1, .05, 0, -.2, -.6, -1.2, -2, -2.9, -3.7, -4.3, -4.5, -4.1, -3.3, -2.2, -1, .3, 1.4, 2.2, 2.7, 2.8, 2.3, 1.5, .4, -.8, -1.7, -2.3, -2.5] },
  m4a1:  { reset: 360, p: [0, .3, .9, 1.7, 2.6, 3.4, 4.1, 4.7, 5.2, 5.6, 5.9, 6.1, 6.3, 6.4, 6.5, 6.6, 6.65, 6.7, 6.7, 6.75, 6.8, 6.8, 6.8, 6.85, 6.9],
           y: [0, 0, .05, .1, 0, -.2, -.5, -.8, -1, -.9, -.6, -.2, .2, .6, .9, 1.1, 1.1, .9, .6, .2, -.2, -.5, -.7, -.8, -.8] },
  mp9:   { reset: 280, p: [0, .25, .75, 1.4, 2.1, 2.8, 3.4, 3.9, 4.3, 4.6, 4.85, 5, 5.1, 5.2, 5.3, 5.35, 5.4, 5.45, 5.5, 5.5, 5.55, 5.55, 5.6, 5.6, 5.6, 5.65, 5.65, 5.7, 5.7, 5.7],
           y: [0, .05, .1, 0, -.2, -.4, -.3, 0, .35, .6, .5, .2, -.15, -.5, -.7, -.5, -.2, .2, .5, .6, .35, 0, -.3, -.5, -.4, -.1, .2, .4, .3, 0] },
  usp:   { reset: 340, p: [0, .9, 1.9, 3, 4, 5, 5.9, 6.7, 7.4, 8, 8.5, 8.9, 9.2], y: [0, .05, -.1, .15, -.1, .2, -.15, .1, -.1, .15, -.1, .05, 0] },
  deagle: { reset: 520, p: [0, 2.6, 5.2, 7.6, 9.6, 11.2, 12.4, 13.2], y: [0, .2, .5, .3, -.1, -.4, -.2, 0] },
  awp:   { reset: 1700, p: [0, 3.4, 6], y: [0, .2, .1] },
};
const DEG = Math.PI / 180;
let sens = 5.5;   // чувствительность мыши в единицах CS (5.5 ≈ как было в первой версии)

// ───────── состояние ─────────
let ws = null, myId = null, W = {}, boxes = [], mapInfo = null, mapList = [], armorPrice = 650;
let me = null, players = [], phase = 'waiting', phaseLeft = 0, score = { CT: 0, T: 0 };
let joined = false, locked = false, menuOpen = false, mapMenuOpen = false, scoped = false;
let yaw = 0, pitch = 0, vx = 0, vz = 0, vy = 0, onGround = true;
const pos = { x: 0, y: 0, z: 0 }, prev = { x: 0, y: 0, z: 0 };
let accum = 0, jumpBuffer = 0, stepDist = 0, airFall = 0;
const keys = {};
let mouseDown = false, firedThisClick = false, lastFire = 0, lastSend = 0;
let punchP = 0, punchY = 0, targetP = 0, targetY = 0, shotIdx = 0, lastShotT = 0;
let flashV = 0, hitV = 0, bigUntil = 0, lastPhase = '', lastWeapon = '', lastRl = 0, reloadStart = 0, reloadDur = 0;
let chosenMap = null, serverStatus = null, kitPrice = 400;
let rtt = 0, srvLag = 0, fpsFrames = 0, fpsT0 = performance.now(), fps = 0;
let bombS = null, snapAt = 0, lastBeep = 0, lastPlantTick = 0, shakeV = 0, whiteV = 0, boomAt = 0, radarBase = null;
const booms = [];
const avatars = new Map();
const tracers = [];

// ───────── рендерер и сцена ─────────
const renderer = new THREE.WebGLRenderer({ antialias: !LOW, powerPreference: 'high-performance' });
renderer.setPixelRatio(LOW ? 1 : Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;   // включено всегда, отключаем у самого света (sun.castShadow)
document.body.insertBefore(renderer.domElement, document.body.firstChild);
SA.tex.init(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb9cfe2);
scene.fog = new THREE.Fog(0xb9cfe2, 45, 120);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 260);
camera.rotation.order = 'YXZ';
scene.add(camera);

const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x8f8068, 0.75);
const sun = new THREE.DirectionalLight(0xfff0d8, 0.95);
scene.add(hemi, sun);
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x3f78c0) }, bot: { value: new THREE.Color(0xc9dcec) } },
  vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying float h; void main(){ gl_FragColor = vec4(mix(bot, top, clamp(h * 1.5, 0.0, 1.0)), 1.0); }',
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 16, 10), skyMat);
sky.renderOrder = -1;
scene.add(sky);
const col = hex => new THREE.Color(hex).convertSRGBToLinear();
const outerMat = new THREE.MeshStandardMaterial({ color: col(0x8c7e62), roughness: 1 });
const outer = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), outerMat);
outer.rotation.x = -Math.PI / 2; outer.position.y = -0.03;
scene.add(outer);

// ───────── качество графики ─────────
// 0 низкое: без теней и рельефа; 1 среднее: тени 1024; 2 высокое: тени 2048, рельеф, повышенная чёткость
let gfxPref = 'auto', quality = LOW ? 0 : 2, lowCount = 0, mapLoadedAt = 0;
function applyQuality(q) {
  quality = q;
  renderer.setPixelRatio(q >= 2 ? Math.min(devicePixelRatio, 1.5) : 1);
  renderer.setSize(innerWidth, innerHeight);
  sun.castShadow = q >= 1;
  if (q >= 1) {
    const sz = q >= 2 ? 2048 : 1024;
    if (sun.shadow.mapSize.x !== sz) { sun.shadow.mapSize.set(sz, sz); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  }
  SA.tex.setDetail(q >= 2);
}
function setGfx(v, save) {
  gfxPref = v;
  $('gfx').value = v; $('gfx2').value = v;
  applyQuality(v === 'auto' ? (LOW ? 0 : 2) : +v);
  lowCount = 0; mapLoadedAt = performance.now();
  if (save) { try { localStorage.setItem('sa_gfx', v); } catch (e) {} }
}

// ───────── загрузка карты ─────────
let mapGroup = null;
function disposeGroup(g) {
  g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.userData.ownMat && o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
}
function floorY(x, z) {      // высота пола в точке (платформы), нужна для надписей на полу
  let y = 0;
  for (const b of boxes) if (x > b.minx && x < b.maxx && z > b.minz && z < b.maxz && b.maxy <= 1.9 && b.maxy > y) y = b.maxy;
  return y;
}
function decal(w, h, texCanvas, x, y, z) {
  const t = new THREE.CanvasTexture(texCanvas); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.userData.ownMat = true;
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}
function ringCanvas(team, n) {
  const c = SA.tex.canvas(128), g = c.getContext('2d'), rgb = team === 'CT' ? '90,150,255' : '255,175,60';
  g.fillStyle = `rgba(${rgb},.22)`; g.beginPath(); g.arc(64, 64, 54, 0, 7); g.fill();
  g.strokeStyle = `rgba(${rgb},.95)`; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 54, 0, 7); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.9)'; g.font = 'bold 54px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 68);
  return c;
}
function textCanvas(text, rgb, w, h, size) {
  const c = SA.tex.canvas(w, h), g = c.getContext('2d');
  g.fillStyle = `rgba(${rgb},.9)`; g.font = `bold ${size}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + size * 0.05);
  return c;
}
function bannerCanvas(team) {
  const c = SA.tex.canvas(1024, 256), g = c.getContext('2d'), isCT = team === 'CT';
  g.fillStyle = isCT ? '#1f4aa8' : '#b87414'; g.fillRect(0, 0, 1024, 256);
  g.fillStyle = 'rgba(255,255,255,.12)';
  for (let i = -2; i < 14; i++) { g.save(); g.translate(i * 90, 0); g.transform(1, 0, -0.5, 1, 0, 0); g.fillRect(0, 0, 40, 256); g.restore(); }
  g.fillStyle = '#fff'; g.font = 'bold 118px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(isCT ? 'СПАВН CT' : 'СПАВН T', 512, 108);
  g.font = '44px Arial'; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(isCT ? 'Контр-террористы' : 'Террористы', 512, 202);
  return c;
}

function siteRing() {
  const c = SA.tex.canvas(256), g = c.getContext('2d');
  g.fillStyle = 'rgba(255,90,70,.07)'; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,100,80,.85)'; g.lineWidth = 7; g.setLineDash([26, 16]); g.beginPath(); g.arc(128, 128, 118, 0, 7); g.stroke();
  return c;
}

function loadMap(info) {
  if (mapGroup) { scene.remove(mapGroup); disposeGroup(mapGroup); }
  for (const [, a] of avatars) scene.remove(a.g);
  avatars.clear();
  mapInfo = info; boxes = info.MAP;
  mapGroup = new THREE.Group();
  scene.add(mapGroup);
  const mats = SA.tex.materials(info.theme), L = SA.tex.light(info.theme), half = info.half;

  // освещение, небо, туман
  hemi.color.set(L.hemiSky); hemi.groundColor.set(L.hemiGnd); hemi.intensity = L.hemiI;
  sun.color.set(L.sun); sun.intensity = L.sunI;
  sun.position.set(half * 0.9, half * 1.6, half * 0.6);
  {
    const sc = sun.shadow.camera, e = half * 1.5;
    sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e; sc.near = 5; sc.far = half * 5; sc.updateProjectionMatrix();
  }
  skyMat.uniforms.top.value.set(L.skyTop); skyMat.uniforms.bot.value.set(L.skyBot);
  scene.background.set(L.fog); scene.fog.color.set(L.fog); scene.fog.near = half * 1.1; scene.fog.far = half * 3.4;
  outerMat.color.copy(col(L.ground));

  // пол
  const fm = mats.floor, fgeo = new THREE.PlaneGeometry(half * 2, half * 2);
  const fuv = fgeo.attributes.uv, k = half * 2 / fm.tile;
  for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * k, fuv.getY(i) * k);
  const floor = new THREE.Mesh(fgeo, fm.mat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  mapGroup.add(floor);

  // коробки (стены, платформы, ящики)
  for (const b of boxes) {
    const m = mats[b.m] || mats.cover;
    const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
    SA.tex.tileUV(geo, b.w, b.h, b.d, m.tile);
    const mesh = new THREE.Mesh(geo, m.mat);
    mesh.position.set(b.x, b.y, b.z);
    mesh.castShadow = b.h > 0.5; mesh.receiveShadow = true;
    mapGroup.add(mesh);
  }

  // базы команд
  const sp = info.SPAWNS;
  for (const team of ['CT', 'T']) {
    const list = sp[team];
    list.forEach((s, i) => mapGroup.add(decal(1.7, 1.7, ringCanvas(team, i + 1), s.x, floorY(s.x, s.z) + 0.02, s.z)));
    const ax = list.reduce((a, s) => a + s.x, 0) / list.length, az = list.reduce((a, s) => a + s.z, 0) / list.length;
    const back = list[0].yaw === 0 ? 1 : -1;              // «назад» от направления взгляда
    mapGroup.add(decal(8, 2.6, textCanvas(team === 'CT' ? 'СПАВН CT' : 'СПАВН T', team === 'CT' ? '120,170,255' : '255,185,80', 512, 160, 96), ax, 0.02, az + back * 2.6));
    if (info.banners) {
      const tex = new THREE.CanvasTexture(bannerCanvas(team)); tex.encoding = THREE.sRGBEncoding;
      const b = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: tex }));
      b.userData.ownMat = true;
      const sign = list[0].z < 0 ? -1 : 1;
      b.position.set(0, 3.6, sign * (half - 0.03)); if (sign > 0) b.rotation.y = Math.PI;
      mapGroup.add(b);
    }
  }
  // метки бомбсайтов
  for (const l of info.labels || []) mapGroup.add(decal(9, 9, textCanvas(l.text, '255,255,255', 256, 256, 200), l.x, floorY(l.x, l.z) + 0.025, l.z));

  // зоны закладки бомбы
  for (const z of info.sites || []) mapGroup.add(decal(z.r * 2, z.r * 2, siteRing(), z.x, floorY(z.x, z.z) + 0.015, z.z));
  buildRadarBase(info);
  bombS = null;
  $('mapName').textContent = info.name;
  mapLoadedAt = performance.now();
  clampPos();
}
function clampPos() {
  const lim = mapInfo ? mapInfo.half - 0.55 : 29;
  pos.x = Math.max(-lim, Math.min(lim, pos.x)); pos.z = Math.max(-lim, Math.min(lim, pos.z));
}

// ───────── модели ─────────
const flashTex = (() => {
  const c = SA.tex.canvas(64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,250,210,1)'); gr.addColorStop(0.35, 'rgba(255,190,70,.8)'); gr.addColorStop(1, 'rgba(255,120,20,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const vm = SA.models.createViewmodel(camera, flashTex);
const bombMesh = SA.models.makeBomb();
bombMesh.g.visible = false; scene.add(bombMesh.g);
const boomLight = new THREE.PointLight(0xffa040, 0, 90);
scene.add(boomLight);

function updateAvatars(list) {
  const seen = new Set(), myTeam = me ? me.tm : '';
  for (const q of list) {
    if (q.id === myId) continue;
    seen.add(q.id);
    let a = avatars.get(q.id);
    if (a && (a.team !== q.tm || a.name !== q.n)) { scene.remove(a.g); avatars.delete(q.id); a = null; }
    if (!a) { a = SA.models.makeAvatar(q); scene.add(a.g); avatars.set(q.id, a); a.g.position.set(q.x, q.y, q.z); a.g.rotation.y = q.yw; }
    if (!a.wasAlive && q.a) a.g.position.set(q.x, q.y, q.z);
    a.wasAlive = !!q.a;
    a.tx = q.x; a.ty = q.y; a.tz = q.z; a.tyaw = q.yw;
    a.g.visible = !!q.a;
    a.label.visible = q.tm === myTeam;
    a.back.visible = !!(bombS && bombS.st === 'carried' && bombS.c === q.id);
    const gid = q.tm === 'X' ? 'ak47' : (q.w || 'knife');
    if (a.gunId !== gid) {
      while (a.mount.children.length) a.mount.remove(a.mount.children[0]);
      a.mount.add(SA.models.buildGun(gid, true));
      a.gunId = gid;
    }
  }
  for (const [id, a] of avatars) if (!seen.has(id)) { scene.remove(a.g); avatars.delete(id); }
}
function lerpAngle(a, b, t) {
  const d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return a + d * t;
}
// панорама и расстояние до источника звука
function soundPos(x, z) {
  const dx = x - camera.position.x, dz = z - camera.position.z, d = Math.hypot(dx, dz) || 1;
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);       // вектор «вправо» камеры
  return { dist: d, pan: (dx * rx + dz * rz) / d };
}

// ───────── сеть ─────────
function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
function connect(name) {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => send({ t: 'join', name, team: $('team').value || undefined, map: serverStatus && serverStatus.canChange ? chosenMap : undefined });
  ws.onmessage = e => onMsg(JSON.parse(e.data));
  ws.onclose = () => {
    if (joined) { showBig('Соединение потеряно. Обновите страницу', '#ff5a4d', 1e9); document.exitPointerLock(); }
    else $('err').textContent = 'Не удалось подключиться к серверу';
  };
}
function onMsg(m) {
  switch (m.t) {
    case 'full': $('err').textContent = 'Сервер заполнен (5 на 5)'; ws.close(); break;
    case 'init':
      myId = m.id; W = m.W; armorPrice = m.armorPrice; kitPrice = m.kitPrice || 400; mapList = m.maps;
      loadMap(m.map); buildBuyMenu(); buildMapMenu();
      joined = true;
      $('join').classList.add('hidden'); $('hud').classList.remove('hidden');
      updateLockMsg();
      break;
    case 'map':
      loadMap(m); buildMapMenu(); closeMapMenu();
      addNote('Карта: ' + m.name);
      break;
    case 'spawn':
      pos.x = prev.x = m.x; pos.y = prev.y = m.y; pos.z = prev.z = m.z; yaw = m.yaw; pitch = 0;
      punchP = punchY = targetP = targetY = 0; shotIdx = 0;
      vx = vz = vy = 0; scoped = false; bigUntil = 0; $('bigMsg').textContent = ''; $('vote').classList.add('hidden');
      break;
    case 's': onSnap(m); break;
    case 'shot': onShot(m); break;
    case 'hit':
      hitV = 1; $('hitm').className = m.kill ? 'kill' : '';
      SA.audio.hit(m.hs);
      break;
    case 'dmg': flashV = 0.9; SA.audio.hurt(); break;
    case 'pong': rtt = rtt ? rtt * 0.7 + (performance.now() - m.c) * 0.3 : performance.now() - m.c; srvLag = m.lag || 0; break;
    case 'kill': addFeed(m); break;
    case 'msg': addNote(m.text); break;
    case 'bombev':
      if (m.ev === 'planted') { SA.audio.planted(); showBig('Бомба заложена на ' + m.site, '#ff8a5c', 2600); lastBeep = performance.now(); }
      else if (m.ev === 'defused') { SA.audio.defused(); showBig('Бомба обезврежена', '#7ddc8a', 2600); }
      else if (m.ev === 'dropped') addNote('Бомба выпала');
      else if (m.ev === 'pickup') addNote('Бомбу подобрали');
      break;
    case 'boom': doBoom(m); break;
    case 'round': {
      const mine = me && me.tm === m.winner;
      const text = m.why === 'boom' ? 'Бомба взорвалась. Победа террористов' : m.why === 'defuse' ? 'Бомба обезврежена. Победа контр-террористов'
        : m.why === 'time' ? 'Время вышло. Победа контр-террористов' : (m.winner === 'CT' ? 'Победа контр-террористов' : 'Победа террористов');
      showBig(text, mine ? '#7ddc8a' : '#ff8a7d', 5500);
      break;
    }
    case 'match':
      showBig(`Матч выиграли ${m.winner}`, '#f2a93b', 9500);
      openVote();
      break;
  }
}
const roster = new Map();
let lastSeq = 0;
function mergeRoster(list) {              // сервер шлёт имя/команду/оружие/счёт только при изменении
  const out = [], seen = new Set();
  for (const e of list) {
    const r = roster.get(e.id) || {};
    Object.assign(r, e); roster.set(e.id, r); seen.add(e.id);
    if (r.n !== undefined) out.push(r);
  }
  for (const id of roster.keys()) if (!seen.has(id)) roster.delete(id);
  return out;
}
function onSnap(s) {
  lastSeq = s.q || 0;
  phase = s.ph; phaseLeft = s.tl; score = s.sc; me = s.me; players = mergeRoster(s.pl);
  bombS = s.bomb || null; snapAt = performance.now();
  if (me.al && (Math.hypot(me.x - pos.x, me.z - pos.z) > 4 || Math.abs(me.y - pos.y) > 4)) {
    pos.x = prev.x = me.x; pos.y = prev.y = me.y; pos.z = prev.z = me.z; vx = vz = vy = 0;
  }
  updateAvatars(players);
  if (!me.al) scoped = false;
  if (phase !== lastPhase) {
    if (phase === 'freeze') addNote('Закупка оружия: нажмите B');
    if (lastPhase === 'freeze' && phase === 'live') SA.audio.beep(880, 0.14, 0.25);
    if (phase === 'waiting' || phase === 'freeze') $('vote').classList.add('hidden');
    lastPhase = phase;
  }
  // звуки перезарядки и смены оружия
  const id = curId();
  if (me.rl > 0 && lastRl <= 0 && W[id]) { reloadStart = performance.now(); reloadDur = W[id].reload; SA.audio.reload(id, reloadDur); }
  lastRl = me.rl;
  if (id && id !== lastWeapon) { if (lastWeapon) SA.audio.click(0.4); lastWeapon = id; }
  updateHud();
}
function onShot(m) {
  const mine = m.id === myId, w = W[m.w], end = new THREE.Vector3(m.ex, m.ey, m.ez);
  let start;
  if (mine) {
    camera.updateMatrixWorld(true);
    start = new THREE.Vector3(0.2, -0.17, -0.9).applyMatrix4(camera.matrixWorld);
  } else {
    const a = avatars.get(m.id);
    if (!a) return;
    start = new THREE.Vector3(a.g.position.x, a.g.position.y + 1.3, a.g.position.z);
    const sp = soundPos(a.g.position.x, a.g.position.z);
    SA.audio.shot(m.w, { vol: 1, dist: sp.dist, pan: sp.pan });
  }
  if (w && !w.melee) {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.8 }));
    const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    spark.scale.set(0.35, 0.35, 1); spark.position.copy(end);
    scene.add(line, spark);
    tracers.push({ line, spark, until: performance.now() + 90 });
  }
}

// ───────── HUD ─────────
function showBig(text, color, ms) { const e = $('bigMsg'); e.textContent = text; e.style.color = color || '#fff'; bigUntil = performance.now() + ms; }
function addNote(text) {
  const d = document.createElement('div'); d.textContent = text; d.style.color = '#c9c6bb';
  $('feed').appendChild(d); setTimeout(() => d.remove(), 4500);
}
function addFeed(m) {
  const d = document.createElement('div'), k = document.createElement('span'), v = document.createElement('span');
  k.textContent = m.k; k.className = m.kt === 'CT' ? 'ct' : 'tt';
  v.textContent = m.v; v.className = m.vt === 'CT' ? 'ct' : 'tt';
  d.append(k, document.createTextNode(` [${m.w}${m.hs ? ', в голову' : ''}] `), v);
  $('feed').appendChild(d); setTimeout(() => d.remove(), 6000);
}
function fmtTime(ms) { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function gunOf(slot) { return me && me.inv && me.inv[slot] ? me.inv[slot] : null; }
function curId() { if (!me) return ''; return me.cur === 'knife' ? 'knife' : (gunOf(me.cur) ? gunOf(me.cur).id : ''); }

function updateHud() {
  $('ctScore').textContent = score.CT; $('tScore').textContent = score.T;
  $('timer').textContent = (phase === 'freeze' || phase === 'live') ? fmtTime(phaseLeft) : '–:––';
  $('timer').style.color = (bombS && bombS.st === 'planted' && phase === 'live') ? '#ff5a4d' : phase === 'freeze' ? '#f2a93b' : '';
  const teamName = me.tm === 'CT' ? 'контр-террористов (CT)' : 'террористов (T)';
  $('phaseMsg').textContent =
    phase === 'waiting' ? 'Разминка: оружие и покупки бесплатны (B). M — карта. E в круге A/B — тренировка с бомбой. Матч начнётся, когда зайдёт игрок в другую команду' :
    phase === 'freeze' ? (me.al ? `Вы за ${teamName}. Закупка: B — меню. Движение разблокируется после таймера` : 'Вы подключились посреди раунда, ждите следующего') : '';
  $('hp').textContent = me.hp; $('hp').style.color = me.hp <= 30 ? '#ff5a4d' : '';
  $('armor').textContent = me.ar;
  $('money').textContent = phase === 'waiting' ? '∞' : '$' + me.mo;
  $('dead').classList.toggle('hidden', me.al || phase === 'waiting');

  const id = curId(), w = W[id];
  if (me.cur === 'knife') $('ammo').textContent = '∞';
  else { const g = gunOf(me.cur); $('ammo').innerHTML = (g ? g.mag : 0) + ' <span>/ ' + (g ? g.res : 0) + '</span>'; }
  $('wname').textContent = w ? w.name + (me.rl > 0 ? ' — перезарядка' : '') : '';
  vm.setWeapon(me.al ? id : '', me.tm);
  if (!w || !w.scope) scoped = false;

  const slots = $('slots'); slots.innerHTML = '';
  [['primary', '1'], ['secondary', '2'], ['knife', '3']].forEach(([slot, key]) => {
    const g = slot === 'knife' ? { id: 'knife' } : gunOf(slot);
    if (!g) return;
    const d = document.createElement('div'); d.textContent = key + '  ' + W[g.id].name;
    if (me.cur === slot) d.className = 'cur';
    slots.appendChild(d);
  });
  if (me.hb) { const d = document.createElement('div'); d.textContent = '■ Бомба (E на A/B)'; slots.appendChild(d); }
  if (me.kit) { const d = document.createElement('div'); d.textContent = '■ Набор сапёра'; slots.appendChild(d); }
  updateBombHud();
  if (menuOpen) refreshBuy();
  if (!$('board').classList.contains('hidden')) renderBoard();
}
function updateBombHud() {
  const b = bombS, practice = phase === 'waiting', live = phase === 'live', freeze = phase === 'freeze';
  let msg = '', red = false;
  const speedNow = Math.hypot(vx, vz);
  const carrier = b && b.st === 'carried' ? players.find(q => q.id === b.c) : null;
  if (me.al) {
    if (b && b.st === 'planted') {
      if (me.tm === 'CT' || practice) {
        const near = Math.hypot(me.x - b.x, me.z - b.z) < 2.4 && Math.abs(me.y - b.y) < 1.6;
        msg = near ? 'Зажмите E — разминировать' + (me.kit ? ' (с набором: быстрее)' : '') : 'Бомба заложена на ' + b.s + '. Подойдите к ней вплотную';
      } else msg = 'Бомба заложена на ' + b.s + '. Защищайте её';
    } else if (me.hb && (live || freeze)) {
      if (freeze) msg = 'У вас бомба: отнесите на A или B (круг на полу). Ставить можно, когда начнётся раунд';
      else if (!me.site) msg = 'У вас бомба: отнесите её на A или B (красный круг на полу)';
      else msg = speedNow > 1.5 ? 'Остановитесь: бомбу можно ставить только стоя. Затем зажмите E' : 'Зажмите E — установить бомбу';
    } else if (practice) {
      msg = me.site ? 'Тренировка: зажмите E — установить бомбу' : 'Тренировка: встаньте в круг A или B';
    } else if (b && b.st === 'dropped' && me.tm === 'T') msg = 'Бомба выпала: подойдите к ней вплотную, чтобы подобрать';
    else if (me.tm === 'T' && carrier && (live || freeze)) msg = 'Бомба у игрока ' + carrier.n + ' (ставит только он)';
    else if (me.tm === 'CT' && freeze) msg = 'Вы за CT: бомбу ставят T. Защищайте A и B, разминируйте клавишей E';
    if (b && b.act && b.act.k === 'defuse' && me.tm === 'T' && b.act.id !== myId) { msg = 'CT разминируют бомбу!'; red = true; }
  }
  $('bombMsg').textContent = msg; $('bombMsg').style.color = red ? '#ff5a4d' : '';
  const mine = b && b.act && b.act.id === myId && me.al;
  $('prog').classList.toggle('hidden', !mine);
  if (mine) { $('progLabel').textContent = b.act.k === 'plant' ? 'Установка бомбы' : 'Разминирование'; $('progFill').style.width = Math.round(b.act.p * 100) + '%'; }
}
function renderBoard() {
  const b = $('board'); b.innerHTML = '';
  for (const team of ['CT', 'T']) {
    const h = document.createElement('h3');
    h.className = team === 'CT' ? 'ct' : 'tt';
    h.textContent = (team === 'CT' ? 'Контр-террористы' : 'Террористы') + ' — ' + score[team];
    const table = document.createElement('table');
    table.innerHTML = '<tr><th>Игрок</th><th>У</th><th>С</th></tr>';
    players.filter(p => p.tm === team).sort((a, c) => c.k - a.k).forEach(p => {
      const tr = document.createElement('tr');
      if (!p.a) tr.className = 'dead';
      if (p.id === myId) tr.className += ' me';
      for (const v of [p.n, p.k, p.d]) { const td = document.createElement('td'); td.textContent = v; tr.appendChild(td); }
      table.appendChild(tr);
    });
    b.append(h, table);
  }
}

// ───────── меню закупки, выбор карты, голосование ─────────
function priceOf(item) { return item === 'armor' ? armorPrice : item === 'kit' ? kitPrice : W[item].price; }
function buildBuyMenu() {
  const list = $('buyList'); list.innerHTML = '';
  BUY.forEach((item, i) => {
    const btn = document.createElement('button');
    btn.className = 'item'; btn.dataset.item = item;
    const price = priceOf(item);
    const name = item === 'armor' ? 'Бронежилет' : item === 'kit' ? 'Набор сапёра' : W[item].name;
    const type = item === 'armor' ? '' : item === 'kit' ? 'только CT, разминирование за 5 с' : ({ primary: 'основное', secondary: 'пистолет' })[W[item].slot];
    btn.innerHTML = `<span><b>${i + 1}</b>${name}<small>${type}</small></span><span>$${price}</span>`;
    btn.onclick = () => doBuy(item);
    list.appendChild(btn);
  });
}
function refreshBuy() {
  const free = phase === 'waiting', can = (phase === 'freeze' || free) && me && me.al;
  $('buyMoney').textContent = free ? 'бесплатно' : '$' + (me ? me.mo : 0);
  $('buyNote').textContent = can ? (free ? 'Разминка: всё бесплатно. Нажмите на предмет или цифру. B или Esc — закрыть.' : 'Нажмите на предмет или цифру на клавиатуре. B или Esc — закрыть.') : 'Закупка доступна только в начале раунда.';
  for (const btn of $('buyList').children) {
    const item = btn.dataset.item, price = priceOf(item);
    const owned = item === 'armor' ? me.ar >= 100 : item === 'kit' ? !!me.kit : (gunOf(W[item].slot) && gunOf(W[item].slot).id === item);
    const blocked = item === 'kit' && me.tm !== 'CT';
    btn.classList.toggle('off', !can || blocked || (!free && me.mo < price) || ((item === 'armor' || item === 'kit') && owned));
    btn.classList.toggle('owned', !!owned);
  }
}
function doBuy(item) { if (menuOpen) { send({ t: 'buy', item }); SA.audio.buy(); } }
function toggleMenu(open) {
  if (mapMenuOpen) closeMapMenu();
  menuOpen = open === undefined ? !menuOpen : open;
  $('buy').classList.toggle('hidden', !menuOpen);
  if (menuOpen) { document.exitPointerLock(); mouseDown = false; if (me) refreshBuy(); }
  else renderer.domElement.requestPointerLock();
  updateLockMsg();
}

function buildMapMenu() {
  const list = $('mapList'); list.innerHTML = '';
  mapList.forEach((m, i) => {
    const b = document.createElement('button');
    b.className = 'item' + (mapInfo && mapInfo.id === m.id ? ' owned' : '');
    b.innerHTML = `<span><b>${i + 1}</b>${m.name}</span><span>${mapInfo && mapInfo.id === m.id ? 'сейчас' : ''}</span>`;
    b.onclick = () => { if (mapInfo && mapInfo.id === m.id) closeMapMenu(); else send({ t: 'map', id: m.id }); };
    list.appendChild(b);
  });
}
function openMapMenu() {
  if (phase !== 'waiting') { addNote('Карту можно менять только в разминке'); return; }
  if (menuOpen) toggleMenu(false);
  mapMenuOpen = true; $('mapMenu').classList.remove('hidden'); document.exitPointerLock(); mouseDown = false; updateLockMsg();
}
function closeMapMenu() {
  if (!mapMenuOpen) return;
  mapMenuOpen = false; $('mapMenu').classList.add('hidden'); renderer.domElement.requestPointerLock(); updateLockMsg();
}
function openVote() {
  const box = $('voteList'); box.innerHTML = '';
  mapList.forEach((m, i) => {
    const b = document.createElement('button');
    b.className = 'item'; b.dataset.id = m.id;
    b.innerHTML = `<span><b>${i + 1}</b>${m.name}</span><span>${mapInfo && mapInfo.id === m.id ? 'текущая' : ''}</span>`;
    b.onclick = () => castVote(m.id);
    box.appendChild(b);
  });
  $('vote').classList.remove('hidden');
}
function castVote(id) {
  send({ t: 'vote', map: id });
  for (const b of $('voteList').children) b.classList.toggle('owned', b.dataset.id === id);
}

// ───────── ввод ─────────
function updateLockMsg() { $('lockmsg').classList.toggle('hidden', !joined || locked || menuOpen || mapMenuOpen); }
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  if (!locked) { mouseDown = false; scoped = false; send({ t: 'use', on: false }); }
  updateLockMsg();
});
$('lockmsg').addEventListener('click', e => { if (!e.target.closest('.setrow')) renderer.domElement.requestPointerLock(); });
function setSens(v, save) {
  v = Math.min(10, Math.max(0.1, Math.round(v * 100) / 100));
  if (!isFinite(v)) return;
  sens = v;
  for (const id of ['sens', 'sens2', 'sensNum', 'sensNum2']) if ($(id) !== document.activeElement || id.startsWith('sens') && !id.includes('Num')) $(id).value = v;
  if (save) { try { localStorage.setItem('sa_sens', String(v)); } catch (e) {} }
}
for (const id of ['sens', 'sens2', 'sensNum', 'sensNum2']) {
  $(id).addEventListener('input', () => { const v = parseFloat($(id).value); if (isFinite(v) && v > 0) setSens(v, true); });
  $(id).addEventListener('change', () => { setSens(parseFloat($(id).value) || sens, true); $(id).value = sens; });
}
function setVol(v, save) {
  SA.audio.setVolume(v / 100); $('vol').value = v; $('vol2').value = v;
  if (save) { try { localStorage.setItem('sa_vol', String(v)); } catch (e) {} }
}
$('vol2').addEventListener('input', () => setVol(+$('vol2').value, true));
try { const sv = parseFloat(localStorage.getItem('sa_sens')); if (isFinite(sv) && sv > 0) setSens(sv, false); } catch (e) {}
for (const id of ['gfx', 'gfx2']) $(id).addEventListener('change', () => setGfx($(id).value, true));
try { const g = localStorage.getItem('sa_gfx'); setGfx(LOW ? '0' : (g || 'auto'), false); } catch (e) { setGfx(LOW ? '0' : 'auto', false); }
document.addEventListener('mousemove', e => {
  if (!locked) return;
  const s = sens * 0.022 * DEG * (scoped ? 0.35 : 1);   // как в CS: градусов на единицу движения = 0.022 × sens
  yaw -= e.movementX * s;
  pitch = Math.max(-1.5, Math.min(1.5, pitch - e.movementY * s));
});
document.addEventListener('mousedown', e => {
  if (!locked) return;
  if (e.button === 0) { mouseDown = true; firedThisClick = false; }
  if (e.button === 2 && me && me.al && W[curId()] && W[curId()].scope) { scoped = !scoped; SA.audio.click(0.3); }
});
document.addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; });
document.addEventListener('wheel', e => { if (locked) { jumpBuffer = 0.12; e.preventDefault(); } }, { passive: false });   // колесо мыши = прыжок, как в CS
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
  if (!joined) return;
  if (e.code === 'Tab') { e.preventDefault(); renderBoard(); $('board').classList.remove('hidden'); return; }
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  const repeat = e.repeat;
  keys[e.code] = true;
  if (repeat) return;
  if (e.code === 'KeyE' && canAct()) send({ t: 'use', on: true });
  if (!$('vote').classList.contains('hidden')) {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= mapList.length) { castVote(mapList[n - 1].id); return; }
  }
  if (e.code === 'KeyM') { mapMenuOpen ? closeMapMenu() : openMapMenu(); return; }
  if (mapMenuOpen) {
    if (e.code === 'Escape') closeMapMenu();
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= mapList.length) { if (mapInfo && mapInfo.id === mapList[n - 1].id) closeMapMenu(); else send({ t: 'map', id: mapList[n - 1].id }); }
    return;
  }
  if (e.code === 'KeyB') { toggleMenu(); return; }
  if (menuOpen) {
    if (e.code === 'Escape') toggleMenu(false);
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= BUY.length) doBuy(BUY[n - 1]);
    return;
  }
  if (e.code === 'KeyR') send({ t: 'reload' });
  if (e.code === 'Digit1') send({ t: 'switch', slot: 'primary' });
  if (e.code === 'Digit2') send({ t: 'switch', slot: 'secondary' });
  if (e.code === 'Digit3') send({ t: 'switch', slot: 'knife' });
});
document.addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'KeyE') send({ t: 'use', on: false }); if (e.code === 'Tab') $('board').classList.add('hidden'); });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = false; send({ t: 'use', on: false }); });
window.addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});

// ───────── физика игрока (фиксированный шаг 64 Гц, как в CS) ─────────
function overlaps(b) {
  return pos.x + RAD > b.minx && pos.x - RAD < b.maxx && pos.z + RAD > b.minz && pos.z - RAD < b.maxz && pos.y + HGT > b.miny && pos.y < b.maxy;
}
function anyOverlap() { for (const b of boxes) if (overlaps(b)) return true; return false; }
function moveAxis(axis, delta) {
  pos[axis] += delta;
  const old = pos[axis] - delta;
  for (const b of boxes) {
    if (!overlaps(b)) continue;
    if (axis === 'y') {
      // вертикальное столкновение засчитываем, только если до шага мы были над/под боксом (иначе горизонтальный проход вытолкнет)
      if (delta > 0) { if (old + HGT <= b.miny + 0.02) { pos.y = b.miny - HGT - 0.001; if (vy > 0) vy = 0; } }
      else if (old >= b.maxy - 0.02) { pos.y = b.maxy; vy = 0; onGround = true; }
      continue;
    }
    const rise = b.maxy - pos.y;                  // ступенька: заходим на неё без прыжка (лестницы, пандусы)
    if (rise > 0 && rise <= STEP) {
      const oy = pos.y; pos.y = b.maxy + 0.0005;
      if (!anyOverlap()) { if (vy <= 0) { vy = 0; onGround = true; } continue; }
      pos.y = oy;
    }
    if (axis === 'x') pos.x = delta > 0 ? b.minx - RAD - 0.001 : b.maxx + RAD + 0.001;
    else pos.z = delta > 0 ? b.minz - RAD - 0.001 : b.maxz + RAD + 0.001;
  }
}
function snapDown() {                             // прилипание к земле при спуске по лестнице
  const oy = pos.y; pos.y = oy - STEP;
  let top = 0;
  for (const b of boxes) if (overlaps(b) && b.maxy > top) top = b.maxy;
  pos.y = oy;
  if (top <= oy + 0.001 && oy - top <= STEP) { pos.y = top; vy = 0; onGround = true; }
}
function accelerate(wx, wz, wishspeed, accel, dt, cap) {
  const wishspd = cap ? Math.min(wishspeed, cap) : wishspeed;
  const cur = vx * wx + vz * wz, add = wishspd - cur;
  if (add <= 0) return;
  const a = Math.min(accel * wishspeed * dt, add);
  vx += a * wx; vz += a * wz;
}
function canAct() { return joined && locked && !menuOpen && !mapMenuOpen && me && me.al && (phase === 'live' || phase === 'waiting'); }

function tick(dt) {
  prev.x = pos.x; prev.y = pos.y; prev.z = pos.z;
  const move = canAct();
  let fx = 0, fz = 0;
  if (move) {
    if (keys.KeyW) fz -= 1;
    if (keys.KeyS) fz += 1;
    if (keys.KeyA) fx -= 1;
    if (keys.KeyD) fx += 1;
  }
  const l = Math.hypot(fx, fz);
  if (l) { fx /= l; fz /= l; }
  const w = W[curId()];
  const wishspeed = (l ? 1 : 0) * MAXSPEED * (keys.ShiftLeft || keys.ShiftRight ? 0.52 : 1) * (w ? w.speed : 1) * (scoped ? 0.6 : 1);
  const s = Math.sin(yaw), c = Math.cos(yaw);
  const wx = fx * c + fz * s, wz = -fx * s + fz * c;

  // прыжок: удерживайте пробел (или крутите колесо) — «распрыжка», без трения на приземлении
  jumpBuffer = Math.max(0, jumpBuffer - dt);
  const wasGround = onGround;
  if (move && onGround && (keys.Space || jumpBuffer > 0)) { vy = JUMP; onGround = false; jumpBuffer = 0; }

  if (onGround) {
    const sp = Math.hypot(vx, vz);
    if (sp > 0.01) { const drop = Math.max(sp, STOP) * FRICTION * dt, ns = Math.max(0, sp - drop) / sp; vx *= ns; vz *= ns; }
    if (wishspeed > 0) accelerate(wx, wz, wishspeed, ACCEL, dt);
  } else if (wishspeed > 0) {
    accelerate(wx, wz, wishspeed, AIRACCEL, dt, AIRCAP);   // воздушный стрейф: поворот мыши + A/D набирает скорость
  }
  const hs = Math.hypot(vx, vz);
  if (hs > SPEEDCAP) { vx *= SPEEDCAP / hs; vz *= SPEEDCAP / hs; }

  vy -= GRAV * dt;
  const fall = vy;
  onGround = false;
  moveAxis('x', vx * dt);
  moveAxis('z', vz * dt);
  moveAxis('y', vy * dt);
  if (pos.y <= 0) { pos.y = 0; vy = 0; onGround = true; }
  if (!onGround && wasGround && vy <= 0 && fall > -3) snapDown();
  clampPos();

  // звуки шагов и приземления
  const speedNow = Math.hypot(vx, vz);
  if (onGround && !wasGround && airFall < -4) SA.audio.land();
  airFall = onGround ? 0 : Math.min(airFall, fall);
  if (onGround && move && speedNow > 3.3) {
    stepDist += speedNow * dt;
    if (stepDist > 2.1) { stepDist = 0; SA.audio.step(); }
  } else if (!onGround) stepDist = 1.2;
}

// ───────── стрельба и отдача ─────────
function fire(t, id, w) {
  const g = gunOf(me.cur);
  if (!w.melee && g && g.mag <= 0) {                       // магазин пуст
    if (!firedThisClick) SA.audio.empty();
    firedThisClick = true; lastFire = t; send({ t: 'reload' });
    return;
  }
  lastFire = t; firedThisClick = true;
  // направление выстрела = прицел + текущая отдача
  const pe = pitch + punchP * DEG, ye = yaw - punchY * DEG;
  send({ t: 'shoot', dx: -Math.sin(ye) * Math.cos(pe), dy: Math.sin(pe), dz: -Math.cos(ye) * Math.cos(pe) });
  if (w.melee) { vm.kick(1.2); SA.audio.shot('knife', { vol: 0.8 }); return; }
  vm.kick(0.5 + (w.kick || 0.02) * 12); vm.muzzle(55);
  SA.audio.shot(id, { vol: 1 });
  // следующая точка паттерна отдачи
  const rec = REC[id];
  if (rec) {
    shotIdx = (t - lastShotT > rec.reset) ? 0 : Math.min(shotIdx + 1, rec.p.length - 1);
    const n = Math.min(shotIdx + 1, rec.p.length - 1);
    targetP = rec.p[n]; targetY = rec.y[n];
    lastShotT = t;
  }
}

// ───────── радар ─────────
const radarCtx = $('radar').getContext('2d');
function buildRadarBase(info) {
  const K = 4, S = info.half * 2 * K, c = SA.tex.canvas(S), g = c.getContext('2d');
  g.fillStyle = '#9c957f'; g.fillRect(0, 0, S, S);
  const colr = { wall: '#25272a', plat: '#c9c2a4', crate: '#7b5a34', cover: '#555a60', stone: '#555a60', door: '#2d5aa0' };
  for (const b of info.MAP) {
    g.fillStyle = colr[b.m] || '#555';
    g.fillRect((b.x - b.w / 2 + info.half) * K, (b.z - b.d / 2 + info.half) * K, b.w * K, b.d * K);
  }
  radarBase = c;
}
function drawRadar() {
  const R = 95, V = 32, k = R / V, g = radarCtx;
  g.clearRect(0, 0, 190, 190);
  if (!radarBase || !me || !mapInfo) return;
  g.save();
  g.beginPath(); g.arc(R, R, R - 2, 0, 7); g.clip();
  g.fillStyle = '#14161a'; g.fillRect(0, 0, 190, 190);
  g.translate(R, R); g.rotate(yaw); g.scale(k, k); g.translate(-pos.x, -pos.z);
  g.globalAlpha = 0.93; g.drawImage(radarBase, -mapInfo.half, -mapInfo.half, mapInfo.half * 2, mapInfo.half * 2); g.globalAlpha = 1;
  for (const z of mapInfo.sites || []) {                      // зоны A/B (буквы всегда читаются)
    g.strokeStyle = 'rgba(255,90,70,.9)'; g.lineWidth = 1.2 / k; g.beginPath(); g.arc(z.x, z.z, z.r, 0, 7); g.stroke();
    g.save(); g.translate(z.x, z.z); g.rotate(-yaw); g.scale(1 / k, 1 / k);
    g.fillStyle = '#fff'; g.font = 'bold 16px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(z.id, 0, 1); g.restore();
  }
  const dot = (x, z, color, r, yw) => {
    g.fillStyle = color; g.beginPath(); g.arc(x, z, r / k, 0, 7); g.fill();
    if (yw != null) { g.strokeStyle = color; g.lineWidth = 1.6 / k; g.beginPath(); g.moveTo(x, z); g.lineTo(x - Math.sin(yw) * 9 / k, z - Math.cos(yw) * 9 / k); g.stroke(); }
  };
  for (const q of players) {                                   // только союзники (и мишени в разминке)
    if (q.id === myId || !q.a) continue;
    if (q.tm === 'X') dot(q.x, q.z, '#ff4d4d', 3.5);
    else if (q.tm === me.tm) dot(q.x, q.z, q.tm === 'CT' ? '#5b9bff' : '#f2a93b', 4.5, q.yw);
  }
  const b = bombS;
  if (b && b.st === 'planted') {
    const on = Math.floor(performance.now() / 300) % 2 === 0;
    dot(b.x, b.z, on ? '#ff3b2f' : '#8a1a12', 5.5);
  } else if (b && b.st === 'dropped' && me.tm === 'T') dot(b.x, b.z, '#ff3b2f', 4);
  if (b && b.st === 'carried' && me.tm === 'T' && b.c !== myId) {
    const c = players.find(q => q.id === b.c); if (c && c.a) { g.strokeStyle = '#ff3b2f'; g.lineWidth = 1.5 / k; g.beginPath(); g.arc(c.x, c.z, 7 / k, 0, 7); g.stroke(); }
  }
  g.restore();
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(R, R - 7); g.lineTo(R - 5, R + 5); g.lineTo(R + 5, R + 5); g.closePath(); g.fill();   // вы
  g.strokeStyle = 'rgba(233,230,223,.35)'; g.lineWidth = 2; g.beginPath(); g.arc(R, R, R - 2, 0, 7); g.stroke();
}

// ───────── взрыв и бомба на земле ─────────
function doBoom(m) {
  const d = Math.hypot(m.x - camera.position.x, m.z - camera.position.z);
  SA.audio.boom(d);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sp.position.set(m.x, m.y + 1.5, m.z); sp.scale.set(3, 3, 1); scene.add(sp);
  booms.push({ sp, t0: performance.now() });
  boomLight.position.set(m.x, m.y + 4, m.z); boomAt = performance.now();
  shakeV = Math.max(shakeV, Math.min(1, 1.5 - d / 35)); whiteV = Math.max(whiteV, Math.min(0.85, 1.1 - d / 45));
}
function updateBombVisual(t) {
  const b = bombS, g = bombMesh.g;
  const show = !!b && (b.st === 'planted' || b.st === 'dropped' || b.st === 'defused');
  g.visible = show;
  if (!show) return;
  g.position.set(b.x, b.y + 0.02, b.z);
  if (b.st === 'planted') {
    const left = Math.max(0, b.tl - (t - snapAt));
    bombMesh.setText(String(Math.ceil(left / 1000)).padStart(2, '0'), '#ff3b2f');
    bombMesh.setLed(t - lastBeep < 90, 0xff2a1a);
    if (phase !== 'end' && left > 0) {                         // писк ускоряется к концу
      const interval = Math.max(110, 120 + left * 0.9);
      if (t - lastBeep >= interval) {
        lastBeep = t;
        const sp = soundPos(b.x, b.z);
        SA.audio.bombBeep({ dist: sp.dist, pan: sp.pan });
      }
    }
  } else if (b.st === 'defused') { bombMesh.setText('OFF', '#55ff7a'); bombMesh.setLed(true, 0x33ff66); }
  else { bombMesh.setText('--', '#ff3b2f'); bombMesh.setLed(false); }
}

// ───────── кадр ─────────
setInterval(() => { if (joined) send({ t: 'ping', c: performance.now() }); }, 1000);
function updateDiag(t) {
  fpsFrames++;
  if (t - fpsT0 < 1000) return;
  fps = Math.round(fpsFrames * 1000 / (t - fpsT0)); fpsFrames = 0; fpsT0 = t;
  const d = $('diag');
  const q = ['низк.', 'средн.', 'выс.'][quality];
  d.textContent = `${Math.round(rtt)} мс · ${fps} fps · ${q}` + (srvLag > 30 ? ` · сервер тормозит (${srvLag} мс)` : '');
  d.style.color = (rtt > 150 || fps < 40 || srvLag > 30) ? '#ff8a7d' : '';
  // автоснижение качества, если игра идёт рывками
  if (gfxPref === 'auto' && quality > 0 && joined && t - mapLoadedAt > 6000) {
    lowCount = fps < 36 ? lowCount + 1 : 0;
    if (lowCount >= 3) { applyQuality(quality - 1); lowCount = 0; mapLoadedAt = t; addNote('Графика упрощена для плавности (можно изменить в паузе, Esc)'); }
  }
}
let last = performance.now();
function frame(t) {
  requestAnimationFrame(frame);
  updateDiag(t);
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;

  if (joined && me) {
    accum += dt; let n = 0;
    while (accum >= TICK && n < 6) { tick(TICK); accum -= TICK; n++; }
    if (n === 6) accum = 0;

    if (t - lastSend > 33) { lastSend = t; send({ t: 'state', x: pos.x, y: pos.y, z: pos.z, yaw, pitch, sc: scoped ? 1 : 0, a: lastSeq }); }

    const id = curId(), w = W[id];
    if (mouseDown && canAct() && w && t - lastFire >= w.rate && (w.auto || !firedThisClick) && me.rl <= 0) fire(t, id, w);

    // отдача: быстро к цели во время стрельбы, плавно возвращается после
    const rec = REC[id];
    if (!rec || t - lastShotT > (w ? w.rate * 1.35 + 60 : 200)) { targetP = 0; targetY = 0; }
    const k = 1 - Math.exp(-dt * ((targetP === 0 && targetY === 0) ? 6.5 : 38));
    punchP += (targetP - punchP) * k; punchY += (targetY - punchY) * k;
  }

  const spectating = !!(me && !me.al && phase !== 'waiting');
  const al = accum / TICK;
  camera.position.set(prev.x + (pos.x - prev.x) * al, prev.y + (pos.y - prev.y) * al + (spectating ? 0.6 : EYE), prev.z + (pos.z - prev.z) * al);
  camera.rotation.x = pitch + punchP * DEG;
  camera.rotation.y = yaw - punchY * DEG;
  camera.rotation.z = 0;
  if (shakeV > 0.01) {
    camera.rotation.x += (Math.random() - 0.5) * 0.07 * shakeV; camera.rotation.y += (Math.random() - 0.5) * 0.07 * shakeV;
    camera.position.y += (Math.random() - 0.5) * 0.08 * shakeV;
    shakeV = Math.max(0, shakeV - dt * 0.9);
  }
  sky.position.copy(camera.position);

  const targetFov = scoped ? 22 : 75;
  if (Math.abs(camera.fov - targetFov) > 0.1) { camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 16); camera.updateProjectionMatrix(); }
  $('scope').classList.toggle('hidden', !(scoped && camera.fov < 40));
  vm.group.visible = !!vm.id && !scoped && !!(me && me.al);
  const hspd = Math.hypot(vx, vz);
  const rel = (me && me.rl > 0 && reloadDur) ? (performance.now() - reloadStart) / reloadDur : -1;
  vm.update(dt, { speed: onGround ? hspd : hspd * 0.3, air: !onGround, reload: rel });
  $('speed').textContent = Math.round(hspd * U);
  $('speed').style.color = hspd * U > 300 ? '#7ddc8a' : '';

  const f = 1 - Math.exp(-dt * 18);
  for (const a of avatars.values()) {
    const px = a.g.position.x, pz = a.g.position.z;
    a.g.position.x += (a.tx - px) * f; a.g.position.y += (a.ty - a.g.position.y) * f; a.g.position.z += (a.tz - pz) * f;
    a.g.rotation.y = lerpAngle(a.g.rotation.y, a.tyaw, f);
    const spd = Math.hypot(a.g.position.x - px, a.g.position.z - pz) / Math.max(dt, 0.001);
    a.spd += (spd - a.spd) * Math.min(1, dt * 8);
    a.phase += a.spd * dt * 2.2;
    const amp = Math.min(1, a.spd / 3.5) * 0.75;
    a.legs[0].rotation.x = Math.sin(a.phase) * amp; a.legs[1].rotation.x = -Math.sin(a.phase) * amp;
    if (a.g.visible && a.spd > 3.6 && a.ty < 0.3) {          // шаги других игроков слышны на расстоянии
      a.lastStep += a.spd * dt;
      if (a.lastStep > 2.1) {
        a.lastStep = 0;
        const sp = soundPos(a.g.position.x, a.g.position.z);
        if (sp.dist < 28) SA.audio.step({ vol: 0.2, dist: sp.dist, pan: sp.pan });
      }
    }
  }
  for (let i = tracers.length - 1; i >= 0; i--) {
    if (t > tracers[i].until) {
      scene.remove(tracers[i].line, tracers[i].spark);
      tracers[i].line.geometry.dispose(); tracers[i].spark.material.dispose();
      tracers.splice(i, 1);
    }
  }
  flashV = Math.max(0, flashV - dt * 1.6); $('flash').style.opacity = flashV;
  hitV = Math.max(0, hitV - dt * 5); $('hitm').style.opacity = hitV;
  if (bigUntil && t > bigUntil) { $('bigMsg').textContent = ''; bigUntil = 0; }
  $('cross').style.display = scoped ? 'none' : '';

  updateBombVisual(t);
  if (bombS && bombS.act && bombS.act.id === myId && t - lastPlantTick > (bombS.act.k === 'plant' ? 420 : 800)) { lastPlantTick = t; bombS.act.k === 'plant' ? SA.audio.plantTick() : SA.audio.click(0.35); }
  for (let i = booms.length - 1; i >= 0; i--) {
    const age = (t - booms[i].t0) / 1000, sp = booms[i].sp;
    if (age > 1.1) { scene.remove(sp); sp.material.dispose(); booms.splice(i, 1); continue; }
    const s = 4 + age * 44; sp.scale.set(s, s, 1); sp.material.opacity = Math.max(0, 1 - age / 1.1);
  }
  boomLight.intensity = Math.max(0, 9 * (1 - (t - boomAt) / 900));
  whiteV = Math.max(0, whiteV - dt * 0.7); $('white').style.opacity = whiteV;
  drawRadar();

  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// ───────── экран входа: выбор карты, громкость ─────────
function renderJoinMaps() {
  const box = $('mapPick'); box.innerHTML = '';
  if (!serverStatus) return;
  const can = serverStatus.canChange;
  if (!chosenMap || !serverStatus.maps.some(m => m.id === chosenMap)) chosenMap = serverStatus.map;
  if (!can) chosenMap = serverStatus.map;
  const DESC = { arena: 'Небольшая тренировочная арена', dust2: 'Длинный A, туннели B, центр', mirage: 'Рампа A, апартаменты B, миддл' };
  serverStatus.maps.forEach(m => {
    const b = document.createElement('button');
    b.className = 'mapcard' + (m.id === chosenMap ? ' sel' : '') + (!can && m.id !== serverStatus.map ? ' lock' : '');
    b.innerHTML = '<b></b><small></small>';
    b.firstChild.textContent = m.name; b.lastChild.textContent = DESC[m.id] || '';
    b.onclick = () => { if (can) { chosenMap = m.id; renderJoinMaps(); } };
    box.appendChild(b);
  });
  const cm = serverStatus.maps.find(m => m.id === serverStatus.map);
  $('mapNote').textContent = can ? 'Карту можно выбрать, пока на сервере разминка.' : 'Сейчас идёт матч на карте «' + (cm ? cm.name : '') + '». Следующую карту выберут голосованием после матча.';
}
function pollStatus() {
  fetch('api/status').then(r => r.json()).then(s => { serverStatus = s; if (!joined) renderJoinMaps(); })
    .catch(() => {}).finally(() => { if (!joined) setTimeout(pollStatus, 3000); });
}
pollStatus();

function start() {
  const name = $('name').value.trim() || 'Игрок' + Math.floor(Math.random() * 900 + 100);
  SA.audio.init();
  SA.audio.setVolume(+$('vol').value / 100);
  if (serverStatus && serverStatus.sounds) SA.audio.loadCustom(serverStatus.sounds);
  renderer.domElement.requestPointerLock();
  $('err').textContent = '';
  connect(name);
}
$('go').addEventListener('click', start);
$('name').addEventListener('keydown', e => { if (e.key === 'Enter') start(); });
$('vol').addEventListener('input', () => setVol(+$('vol').value, true));
try { $('name').value = localStorage.getItem('sa_name') || ''; const v = localStorage.getItem('sa_vol'); if (v) { $('vol').value = v; $('vol2').value = v; } } catch (e) {}
$('name').addEventListener('input', () => { try { localStorage.setItem('sa_name', $('name').value); } catch (e) {} });
})();
