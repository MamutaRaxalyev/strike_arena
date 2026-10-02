'use strict';
// Strike Arena — сервер. Без зависимостей: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public');

// ───────────── настройки игры ─────────────
const EYE = 1.6;
const FREEZE_MS = +process.env.FREEZE_MS || 15000;   // фаза закупки
const ROUND_MS = +process.env.ROUND_MS || 105000;   // длительность раунда
const END_MS = +process.env.END_MS || 6000;       // пауза после раунда
const MATCH_END_MS = 10000;
const WIN_ROUNDS = +process.env.WIN_ROUNDS || 8;      // до скольких побед играем матч
const HALF = 7;            // после стольких раундов стороны меняются
const START_MONEY = 800;
const MAX_MONEY = 16000;
const MAX_PER_TEAM = 5;
const ARMOR_PRICE = 650;
const KIT_PRICE = 400;                                  // набор сапёра (CT): разминирование за 5 с вместо 10
const PLANT_MS = +process.env.PLANT_MS || 3200;         // установка бомбы
const DEFUSE_MS = +process.env.DEFUSE_MS || 10000;      // разминирование
const KIT_DEFUSE_MS = Math.round(DEFUSE_MS / 2);
const BOMB_MS = +process.env.BOMB_MS || 40000;          // таймер бомбы

// ───────────── оружие ─────────────
const W = {
  knife:  { name: 'Нож',          slot: 'knife',     price: 0,    dmg: 40,  rate: 550,  melee: true, range: 2.4, kill: 1500, speed: 1.1 },
  usp:    { name: 'USP-S',        slot: 'secondary', price: 0,    dmg: 28,  rate: 160,  mag: 12, res: 36,  reload: 2200, spread: 0.006,  auto: false, range: 200, kill: 300, kick: 0.018, speed: 1 },
  deagle: { name: 'Desert Eagle', slot: 'secondary', price: 700,  dmg: 55,  rate: 260,  mag: 7,  res: 35,  reload: 2200, spread: 0.008,  auto: false, range: 250, kill: 300, kick: 0.045, speed: 1 },
  mp9:    { name: 'MP9',          slot: 'primary',   price: 1250, dmg: 24,  rate: 70,   mag: 30, res: 120, reload: 2100, spread: 0.016,  auto: true,  range: 150, kill: 600, kick: 0.010, speed: 1.05 },
  ak47:   { name: 'AK-47',        slot: 'primary',   price: 2700, dmg: 36,  rate: 100,  mag: 30, res: 90,  reload: 2400, spread: 0.010,  auto: true,  range: 300, kill: 300, kick: 0.022, speed: 0.95 },
  m4a1:   { name: 'M4A1-S',       slot: 'primary',   price: 3100, dmg: 33,  rate: 90,   mag: 25, res: 75,  reload: 2300, spread: 0.008,  auto: true,  range: 300, kill: 300, kick: 0.016, speed: 0.97 },
  awp:    { name: 'AWP',          slot: 'primary',   price: 4750, dmg: 115, rate: 1450, mag: 5,  res: 30,  reload: 3600, spread: 0.0003, auto: false, range: 500, kill: 100, kick: 0.08,  speed: 0.85, scope: true },
};

// ───────────── карты ─────────────
// Бокс: центр (x,y,z) и размеры (w,h,d), m — материал. Север = -z.
function finishBoxes(list) {
  for (const b of list) {
    b.minx = b.x - b.w / 2; b.maxx = b.x + b.w / 2;
    b.miny = b.y - b.h / 2; b.maxy = b.y + b.h / 2;
    b.minz = b.z - b.d / 2; b.maxz = b.z + b.d / 2;
  }
  return list;
}

// Карта «Арена» (маленькая, из первой версии)
function buildArena() {
  const list = [];
  const B = (x, z, w, d, h, m) => list.push({ x, y: h / 2, z, w, h, d, m });
  const WALL = 'wall', COVER = 'cover', CRATE = 'crate', STONE = 'stone';
  B(0, -30.5, 62, 1, 6, WALL); B(0, 30.5, 62, 1, 6, WALL);
  B(-30.5, 0, 1, 62, 6, WALL); B(30.5, 0, 1, 62, 6, WALL);
  B(-17, 0, 18, 1, 4, COVER); B(17, 0, 18, 1, 4, COVER);
  B(0, 0, 2.6, 2.6, 1, CRATE);
  B(0, -14, 8, 1.5, 2.2, COVER); B(0, 14, 8, 1.5, 2.2, COVER);
  B(-12, -10, 3, 3, 2.5, STONE); B(12, -10, 3, 3, 2.5, STONE);
  B(-12, 10, 3, 3, 2.5, STONE);  B(12, 10, 3, 3, 2.5, STONE);
  B(-23, -14, 4, 4, 3, CRATE); B(23, 14, 4, 4, 3, CRATE);
  B(23, -14, 4, 4, 3, CRATE);  B(-23, 14, 4, 4, 3, CRATE);
  B(-5, -5, 2, 2, 1, CRATE); B(5, 5, 2, 2, 1, CRATE);
  B(5, -5, 2, 2, 1, CRATE);  B(-5, 5, 2, 2, 1, CRATE);
  B(-10.5, -25, 1, 6, 2, COVER); B(10.5, -25, 1, 6, 2, COVER);
  B(-10.5, 25, 1, 6, 2, COVER);  B(10.5, 25, 1, 6, 2, COVER);
  return {
    id: 'arena', name: 'Арена', theme: 'arena', half: 30, boxes: finishBoxes(list),
    spawns: {
      CT: [-8, -4, 0, 4, 8].map(x => ({ x, y: 0, z: -26, yaw: Math.PI })),
      T: [-8, -4, 0, 4, 8].map(x => ({ x, y: 0, z: 26, yaw: 0 })),
    },
    labels: [{ text: 'A', x: -20, z: -12 }, { text: 'B', x: 20, z: -12 }], banners: true,
    sites: [{ id: 'A', x: -20, z: -12, r: 8 }, { id: 'B', x: 20, z: -12, r: 8 }],
    dummies: [[-6, -19, -6, 6, 2], [6, 19, -6, 6, 2], [-7, 0, -7, -7, 0], [7, 0, 7, 7, 0]],
  };
}

// Карты из maps/*.json: сетка клеток по 2 м. Слои: floor (# стена, . пол, 1-4 платформы) и objects (ящики, двери).
const CELL = 2, LEVEL_H = 0.45;
const OBJ = {   // размер (в метрах), высота, материал
  x: { s: 1.6, h: 1.6, m: 'crate' }, y: { s: 1.6, h: 0.9, m: 'crate' }, X: { s: 1.9, h: 3.0, m: 'crate' },
  D: { s: 2, h: 3.4, m: 'door' }, W: { s: 2, h: 2.4, m: 'cover' }, w: { s: 2, h: 1.2, m: 'cover' },
};
const GATE_Y = 3.3, GATE_H = 1.1;   // арка: перемычка над проходом (игрок проходит под ней)
function greedy(grid, pred, emit) {   // сливает клетки, подходящие под pred, в прямоугольники
  const n = grid.length, used = grid.map(r => Array(r.length).fill(false));
  for (let r = 0; r < n; r++) for (let c = 0; c < grid[r].length; c++) {
    if (used[r][c] || !pred(r, c)) continue;
    let w = 1; while (c + w < grid[r].length && !used[r][c + w] && pred(r, c + w)) w++;
    let h = 1;
    outer: while (r + h < n) { for (let k = 0; k < w; k++) if (used[r + h][c + k] || !pred(r + h, c + k)) break outer; h++; }
    for (let a = 0; a < h; a++) for (let b = 0; b < w; b++) used[r + a][c + b] = true;
    emit(r, c, h, w);
  }
}
function buildGridMap(def) {
  const half = def.half, n = def.floor.length, floor = def.floor.map(r => r.split('')), objs = def.objects.map(r => r.split(''));
  const list = [];
  const cx = c => -half + c * CELL, cz = r => -half + r * CELL;
  const isSolid = (r, c) => r < 0 || c < 0 || r >= n || c >= n || floor[r][c] === '#';
  // стены: оставляем только клетки, которые касаются открытого пространства (иначе невидимы)
  const skin = (r, c) => {
    if (floor[r][c] !== '#') return false;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (!isSolid(r + a, c + b)) return true;
    return false;
  };
  const push = (r, c, h, w, height, m) => list.push({ x: cx(c) + w * CELL / 2, y: height / 2, z: cz(r) + h * CELL / 2, w: w * CELL, h: height, d: h * CELL, m });
  const decor = [];
  greedy(floor, skin, (r, c, h, w) => { push(r, c, h, w, 6, 'wall'); list[list.length - 1].v = (r * 13 + c * 7) % 5; });   // v — вариант окраски стены
  for (const L of [1, 2, 3, 4]) {
    greedy(floor, (r, c) => floor[r][c] === String(L), (r, c, h, w) => push(r, c, h, w, L * LEVEL_H, 'plat'));
  }
  // ворота: маркер 'a' растягиваем на всё сечение прохода (по короткой оси), чтобы перемычка опиралась на стены с обеих сторон
  const gateCells = new Set();
  const runLen = (r, c, dr, dc) => { let p = 0, q = 0; while (!isSolid(r + dr * (p + 1), c + dc * (p + 1))) p++; while (!isSolid(r - dr * (q + 1), c - dc * (q + 1))) q++; return { n: p + q + 1, p, q }; };
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (objs[r][c] !== 'a' || floor[r][c] === '#') continue;
    const rx = runLen(r, c, 0, 1), rz = runLen(r, c, 1, 0), alongX = rx.n < rz.n, run = alongX ? rx : rz;
    if (run.n > 7) continue;                                   // в открытом месте ворота без стен не ставим
    for (let k = -run.q; k <= run.p; k++) gateCells.add(alongX ? r + ',' + (c + k) : (r + k) + ',' + c);
  }
  const awnCells = new Set();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (objs[r][c] === 'n' && floor[r][c] !== '#') awnCells.add(r + ',' + c);
  const poles = new Set();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (floor[r][c] === '#') continue;                                                                         // объекты внутри стен не создаём
    const ch = objs[r][c], lv = /\d/.test(floor[r][c]) ? +floor[r][c] * LEVEL_H : 0, X = cx(c) + CELL / 2, Z = cz(r) + CELL / 2;
    if (gateCells.has(r + ',' + c)) {                                                                            // ворота: перемычка и пилоны у стен
      list.push({ x: X, y: lv + GATE_Y + GATE_H / 2, z: Z, w: CELL, h: GATE_H, d: CELL, m: 'door' });
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        if (!isSolid(r + dr, c + dc)) continue;
        list.push({ x: X + dc * (CELL - 0.5) / 2, y: lv + (GATE_Y + GATE_H) / 2, z: Z + dr * (CELL - 0.5) / 2, w: dc ? 0.5 : CELL, h: GATE_Y + GATE_H, d: dr ? 0.5 : CELL, m: 'stone' });
      }
      continue;
    }
    if (ch === 'a') continue;
    if (ch === 'P') { decor.push({ k: 'palm', x: X, y: lv, z: Z }); continue; }                                   // пальма: только декор
    if (ch === 'n') {                                                                                            // торговый прилавок с навесом: сквозь него не пройти
      const mat = 'awn' + ((r * 7 + c * 3) % 4);
      list.push({ x: X, y: lv + 0.7, z: Z, w: 1.7, h: 1.4, d: 1.7, m: mat });                                   // прилавок, выше прыжка
      list.push({ x: X, y: lv + 3.35, z: Z, w: CELL, h: 0.12, d: CELL, m: mat });                                // полотно навеса
      for (const sr of [-1, 1]) for (const sc of [-1, 1]) {
        const others = [[r + sr, c], [r, c + sc], [r + sr, c + sc]];
        if (others.some(([a, b]) => isSolid(a, b))) continue;                                                    // угол у стены: навес крепится к ней
        const px = X + sc * CELL / 2, pz = Z + sr * CELL / 2, key = px + ',' + pz;
        if (!poles.has(key)) { poles.add(key); list.push({ x: px, y: lv + 1.7, z: pz, w: 0.16, h: 3.4, d: 0.16, m: 'crate' }); }   // опора
      }
      continue;
    }
    const o = OBJ[ch];
    if (!o) continue;
    list.push({ x: X, y: lv + o.h / 2, z: Z, w: o.s, h: o.h, d: o.s, m: o.m });
  }
  if (def.roof) {                                                                                                // сплошная крыша: толстые плиты вровень с верхом стен
    const roof = def.roof.map(r => r.split(''));
    const roofAt = (r, c) => r >= 0 && c >= 0 && r < n && c < n && roof[r][c] === 'R' && floor[r][c] !== '#';
    const ROOF_TOP = 6.0, ROOF_H = 1.1;
    greedy(roof, (r, c) => roofAt(r, c), (r, c, h, w) => list.push({ x: cx(c) + w * CELL / 2, y: ROOF_TOP - ROOF_H / 2, z: cz(r) + h * CELL / 2, w: w * CELL, h: ROOF_H, d: h * CELL, m: 'roof' }));
    // на открытых концах крыши у стен ставим пилоны, чтобы она на что-то опиралась
    const seen = new Set();
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!roofAt(r, c)) continue;
      const X = cx(c) + CELL / 2, Z = cz(r) + CELL / 2;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        if (isSolid(r + dr, c + dc) || roofAt(r + dr, c + dc)) continue;                                           // край над открытым местом
        for (const [pr, pc] of dr ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]]) {
          if (!isSolid(r + pr, c + pc)) continue;                                                                  // угол у стены
          const px = X + (dc + pc) * 0.65, pz = Z + (dr + pr) * 0.65, key = px.toFixed(2) + ',' + pz.toFixed(2);
          if (seen.has(key)) continue;
          seen.add(key);
          list.push({ x: px, y: (ROOF_TOP - ROOF_H) / 2, z: pz, w: 0.7, h: ROOF_TOP - ROOF_H, d: 0.7, m: 'stone' });
        }
      }
    }
  }
  const mk = (arr, yaw) => arr.map(([x, z]) => ({ x, y: 0, z, yaw }));
  return {
    id: def.id, name: def.name, theme: def.theme, half, boxes: finishBoxes(list),
    spawns: { CT: mk(def.spawns.CT, def.yaw.CT), T: mk(def.spawns.T, def.yaw.T) },
    labels: def.labels, banners: false, dummies: def.dummies, decor,
    sites: (def.labels || []).map(l => ({ id: l.text, x: l.x, z: l.z, r: 9 })),
  };
}

const MAPS = { arena: buildArena() };
for (const id of ['sirocco', 'medina']) {
  try {
    const def = JSON.parse(fs.readFileSync(path.join(__dirname, 'maps', id + '.json'), 'utf8'));
    MAPS[def.id] = buildGridMap(def);
  } catch (e) { console.error('Не удалось загрузить карту', id, e.message); }
}
let cur = MAPS[process.env.MAP] || MAPS.sirocco || MAPS.arena;   // карта по умолчанию (MAP=arena node server.js)
const mapInfo = m => ({ id: m.id, name: m.name, theme: m.theme, half: m.half, MAP: m.boxes, SPAWNS: m.spawns, labels: m.labels, banners: m.banners, sites: m.sites, decor: m.decor || [] });

// ───────────── минимальный WebSocket ─────────────
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function wsSend(sock, str) {
  if (sock.destroyed || !sock.writable) return;
  const payload = Buffer.from(str);
  const len = payload.length;
  let header;
  if (len < 126) header = Buffer.from([0x81, len]);
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
  stats.bytes += header.length + len;
  sock.write(Buffer.concat([header, payload]));
}
// статистика сервера: лаг цикла, время работы тика, исходящий трафик
const stats = { bytes: 0, bps: 0, lag: 0, work: 0, dropped: 0 };
setInterval(() => { stats.bps = stats.bytes; stats.bytes = 0; }, 1000).unref();

function wsParse(c, chunk, onMessage, onClose) {
  c.buf = Buffer.concat([c.buf, chunk]);
  while (c.buf.length >= 2) {
    const b = c.buf;
    const opcode = b[0] & 0x0f;
    const masked = (b[1] & 0x80) !== 0;
    let len = b[1] & 0x7f;
    let off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
    if (len > (1 << 20)) { onClose(); return; }
    const maskLen = masked ? 4 : 0;
    if (b.length < off + maskLen + len) return;
    let payload = Buffer.from(b.slice(off + maskLen, off + maskLen + len));
    if (masked) { const m = b.slice(off, off + 4); for (let i = 0; i < payload.length; i++) payload[i] ^= m[i & 3]; }
    c.buf = b.slice(off + maskLen + len);
    if (opcode === 0x8) { onClose(); return; }
    if (opcode === 0x9) { c.sock.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload])); continue; }
    if (opcode === 0x1) onMessage(payload.toString('utf8'));
  }
}

// ───────────── HTTP (раздача клиента) ─────────────
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({
      map: cur.id, phase, players: players.size, canChange: phase === 'waiting',
      server: { lagMs: Math.round(stats.lag), workMs: +stats.work.toFixed(2), kbps: Math.round(stats.bps * 8 / 1000), droppedSnapshots: stats.dropped },
      sounds: (() => { try { return fs.readdirSync(path.join(PUB, 'sounds')).filter(f => /\.(wav|mp3|ogg)$/i.test(f)); } catch (e) { return []; } })(),
      maps: Object.values(MAPS).map(m => ({ id: m.id, name: m.name })),
    }));
  }
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(PUB, url));
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ───────────── состояние игры ─────────────
const players = new Map();
// Мишени для разминки (когда в игре нет игроков обеих команд); расстановка зависит от карты
let dummies = [];
function makeDummies() {
  dummies = cur.dummies.map(([x, z, ax, bx, speed], i) => ({
    id: -(i + 1), x, z, ax: Math.min(ax, bx), bx: Math.max(ax, bx), dir: ax <= bx ? 1 : -1, speed,
    name: 'Мишень', team: 'X', y: 0, yaw: 0, hp: 100, armor: 0, alive: true, bot: true, respawnAt: 0, sock: null,
  }));
}
makeDummies();
let nextId = 1;
let phase = 'waiting', phaseEnd = 0;
let score = { CT: 0, T: 0 };
let roundNo = 0;
let lossStreak = { CT: 0, T: 0 };
let matchWinner = null;

const rd = v => Math.round(v * 100) / 100;
const now = () => Date.now();
const send = (p, obj) => { if (p.sock) wsSend(p.sock, JSON.stringify(obj)); };
const bcast = obj => { const s = JSON.stringify(obj); for (const p of players.values()) wsSend(p.sock, s); };
const setPhase = (ph, ms) => { phase = ph; phaseEnd = now() + ms; };
const teamPlayers = t => [...players.values()].filter(p => p.team === t);
const aliveCount = t => teamPlayers(t).filter(p => p.alive).length;
const mkGun = id => ({ id, mag: W[id].mag, res: W[id].res });

function resetLoadout(p) {
  p.inv = { primary: null, secondary: mkGun('usp'), knife: { id: 'knife', mag: 0, res: 0 } };
  p.armor = 0;
  p.kit = false;
  p.cur = 'secondary';
  p.resetLoadout = false;
}

function createPlayer(sock, name, pref) {
  const ct = teamPlayers('CT').length, t = teamPlayers('T').length;
  if (ct >= MAX_PER_TEAM && t >= MAX_PER_TEAM) return null;
  let team = (ct <= t && ct < MAX_PER_TEAM) ? 'CT' : 'T';
  if (pref === 'CT' || pref === 'T') {      // желаемую сторону даём, если команды остаются ровными
    const mine = pref === 'CT' ? ct : t, other = pref === 'CT' ? t : ct;
    if (mine < MAX_PER_TEAM && mine <= other) team = pref;
  }
  rosterSig.clear();
  const p = {
    id: nextId++, name, sock, team,
    x: 0, y: 0, z: 0, yaw: 0, pitch: 0, speed: 0, lastPos: now(), scoped: false,
    hp: 100, armor: 0, money: START_MONEY, alive: false, k: 0, d: 0, use: false, kit: false,
    inv: null, cur: 'secondary', nextShot: 0, reloadUntil: 0, reloadGun: null, resetLoadout: true,
  };
  resetLoadout(p);
  players.set(p.id, p);
  return p;
}

function spawnAll() {
  for (const team of ['CT', 'T']) {
    teamPlayers(team).forEach((p, i) => {
      const s = cur.spawns[team][i % cur.spawns[team].length];
      // погибшие в прошлом раунде теряют снаряжение
      if (p.resetLoadout || p.lostLoadout) resetLoadout(p);
      p.lostLoadout = false;
      for (const slot of ['primary', 'secondary']) {
        const g = p.inv[slot];
        if (g) { g.mag = W[g.id].mag; g.res = W[g.id].res; }
      }
      p.cur = p.inv.primary ? 'primary' : 'secondary';
      p.alive = true; p.hp = 100;
      p.x = s.x; p.y = s.y; p.z = s.z; p.yaw = s.yaw; p.pitch = 0;
      p.lastPos = now(); p.reloadUntil = 0; p.nextShot = 0; p.scoped = false; p.speed = 0; p.use = false;
      send(p, { t: 'spawn', x: s.x, y: s.y, z: s.z, yaw: s.yaw });
    });
  }
}

// Разминка: пока нет игроков в обеих командах, все живы, оружие и покупки бесплатны
function warmupSpawn(p) {
  const idx = Math.max(0, teamPlayers(p.team).indexOf(p));
  const s = cur.spawns[p.team][idx % cur.spawns[p.team].length];
  resetLoadout(p);
  p.inv.primary = mkGun(p.team === 'CT' ? 'm4a1' : 'ak47');
  p.cur = 'primary';
  p.money = MAX_MONEY; p.alive = true; p.hp = 100; p.armor = 100;
  p.x = s.x; p.y = s.y; p.z = s.z; p.yaw = s.yaw; p.pitch = 0;
  p.lastPos = now(); p.reloadUntil = 0; p.nextShot = 0; p.scoped = false; p.speed = 0; p.use = false;
  send(p, { t: 'spawn', x: s.x, y: s.y, z: s.z, yaw: s.yaw });
}

function startRound() {
  roundNo++;
  matchWinner = null;
  spawnAll();
  giveBomb();
  setPhase('freeze', FREEZE_MS);
  bcast({ t: 'msg', text: `Раунд ${roundNo}. Счёт CT ${score.CT} : ${score.T} T` });
}

function resetMatchState() {
  score = { CT: 0, T: 0 }; roundNo = 0; lossStreak = { CT: 0, T: 0 };
  for (const p of players.values()) { p.money = START_MONEY; p.k = 0; p.d = 0; p.resetLoadout = true; p.lostLoadout = false; }
}

function fullReset() {
  phase = 'waiting';
  bomb = { st: 'none' };
  resetMatchState();
  for (const p of players.values()) warmupSpawn(p);
}

// ───────────── бомба ─────────────
// none | carried (несёт игрок T) | dropped (лежит) | planted (тикает) | defused | exploded
let bomb = { st: 'none' };
const siteAt = (x, z) => cur.sites.find(s => Math.hypot(x - s.x, z - s.z) <= s.r) || null;

function giveBomb() {
  bomb = { st: 'none' };
  const ts = teamPlayers('T').filter(p => p.alive);
  if (!ts.length) return;
  const c = ts[Math.floor(Math.random() * ts.length)];
  bomb = { st: 'carried', carrier: c.id, x: c.x, y: c.y, z: c.z };
}
function dropBomb(p) {
  if (bomb.st === 'carried' && bomb.carrier === p.id) {
    bomb = { st: 'dropped', x: p.x, y: p.y, z: p.z };
    bcast({ t: 'bombev', ev: 'dropped' });
  }
}
function plantBomb(q, t) {
  const s = siteAt(q.x, q.z);
  bomb = { st: 'planted', x: q.x, y: q.y, z: q.z, site: s.id, explodeAt: t + BOMB_MS, wasPlanted: true };
  if (phase === 'live') { phaseEnd = bomb.explodeAt; q.money = Math.min(MAX_MONEY, q.money + 300); }
  bcast({ t: 'bombev', ev: 'planted' });
}
function defuseBomb(q) {
  bomb = { st: 'defused', x: bomb.x, y: bomb.y, z: bomb.z, site: bomb.site, wasPlanted: true, resetAt: now() + 3000 };
  bcast({ t: 'bombev', ev: 'defused' });
  if (phase === 'live') { q.money = Math.min(MAX_MONEY, q.money + 300); endRound('CT', 'defuse'); }
}
function explode() {
  const b = bomb;
  bcast({ t: 'boom', x: rd(b.x), y: rd(b.y), z: rd(b.z) });
  if (phase !== 'live') { bomb = { st: 'none' }; return; }   // в разминке бомба никого не убивает
  for (const q of players.values()) {
    if (!q.alive) continue;
    const d = Math.hypot(q.x - b.x, q.y - b.y, q.z - b.z);
    if (d >= 24) continue;
    let dmg = 800 * Math.pow(1 - d / 24, 1.6);
    if (q.armor > 0) dmg *= 0.75;
    q.hp -= dmg;
    send(q, { t: 'dmg', ax: b.x, az: b.z });
    if (q.hp <= 0) {
      q.hp = 0; q.alive = false; q.d++; q.lostLoadout = true; q.scoped = false; q.use = false;
      bcast({ t: 'kill', k: 'C4', kt: 'T', v: q.name, vt: q.team, w: 'Взрыв', hs: false });
    }
  }
  bomb = { st: 'exploded', x: b.x, y: b.y, z: b.z, wasPlanted: true };
  endRound('T', 'boom');
}
const nearBomb = q => Math.hypot(q.x - bomb.x, q.z - bomb.z) < 2.4 && Math.abs(q.y - bomb.y) < 1.6;
function bombTick(t) {
  const practice = phase === 'waiting';
  if (!practice && phase !== 'live') { if (bomb.act) bomb.act = null; return; }
  if (bomb.st === 'defused' && practice && t >= bomb.resetAt) bomb = { st: 'none' };
  if (bomb.st === 'dropped') {
    for (const q of teamPlayers('T')) {
      if (q.alive && Math.hypot(q.x - bomb.x, q.z - bomb.z) < 1.4 && Math.abs(q.y - bomb.y) < 1.5) {
        bomb = { st: 'carried', carrier: q.id, x: q.x, y: q.y, z: q.z };
        send(q, { t: 'msg', text: 'Вы подобрали бомбу' });
        bcast({ t: 'bombev', ev: 'pickup' });
        break;
      }
    }
  }
  if (bomb.st === 'carried') {
    const c = players.get(bomb.carrier);
    if (!c || !c.alive) { if (c) dropBomb(c); else bomb = { st: 'none' }; }
    else { bomb.x = c.x; bomb.y = c.y; bomb.z = c.z; }
  }
  if (bomb.st === 'planted' && t >= bomb.explodeAt) { explode(); return; }

  const a = bomb.act;
  if (a) {
    const q = players.get(a.pid);
    let ok = false;
    if (q && q.alive && q.use) {
      if (a.kind === 'plant') ok = q.team === 'T' && bomb.st !== 'planted' && q.speed < 2.5 && q.y <= 3 && !!siteAt(q.x, q.z) && (practice || (bomb.st === 'carried' && bomb.carrier === q.id));
      else ok = q.team === 'CT' && bomb.st === 'planted' && nearBomb(q);
    }
    if (!ok) bomb.act = null;
    else if (t - a.start >= a.need) { bomb.act = null; if (a.kind === 'plant') plantBomb(q, t); else defuseBomb(q); }
    return;
  }
  for (const q of players.values()) {
    if (!q.alive || !q.use) continue;
    if (bomb.st === 'planted') {
      if (q.team === 'CT' && nearBomb(q)) { bomb.act = { kind: 'defuse', pid: q.id, start: t, need: q.kit ? KIT_DEFUSE_MS : DEFUSE_MS }; break; }
    } else if (q.team === 'T' && (practice || (bomb.st === 'carried' && bomb.carrier === q.id)) && q.speed < 2.5 && q.y <= 3 && siteAt(q.x, q.z)) {
      bomb.act = { kind: 'plant', pid: q.id, start: t, need: PLANT_MS }; break;
    }
  }
}
function bombView(t) {
  if (bomb.st === 'none' && !bomb.act) return null;   // в тренировке установка идёт при состоянии none
  return {
    st: bomb.st, x: rd(bomb.x || 0), y: rd(bomb.y || 0), z: rd(bomb.z || 0), c: bomb.carrier || 0,
    tl: bomb.st === 'planted' ? Math.max(0, bomb.explodeAt - t) : 0,
    act: bomb.act ? { k: bomb.act.kind, id: bomb.act.pid, p: Math.min(1, (t - bomb.act.start) / bomb.act.need) } : null,
  };
}

function endRound(winner, why) {
  const loser = winner === 'CT' ? 'T' : 'CT';
  score[winner]++;
  const lossBonus = Math.min(3400, 1400 + 500 * lossStreak[loser]);
  const plantBonus = loser === 'T' && bomb.wasPlanted ? 800 : 0;   // T проиграли, но заложили бомбу
  for (const p of players.values()) {
    p.money = Math.min(MAX_MONEY, p.money + (p.team === winner ? 3250 : lossBonus + (p.team === 'T' ? plantBonus : 0)));
  }
  lossStreak[loser] = Math.min(4, lossStreak[loser] + 1);
  lossStreak[winner] = 0;
  bcast({ t: 'round', winner, score, why: why || 'elim' });
  if (score[winner] >= WIN_ROUNDS) {
    matchWinner = winner;
    bcast({ t: 'match', winner });
    setPhase('end', MATCH_END_MS);
  } else {
    setPhase('end', END_MS);
  }
}

const votes = new Map();
function setMap(id) {
  if (!MAPS[id]) return false;
  cur = MAPS[id];
  bomb = { st: 'none' };
  makeDummies();
  bcast(Object.assign({ t: 'map' }, mapInfo(cur)));
  return true;
}
function tallyVotes() {
  const count = {};
  for (const [pid, m] of votes) if (players.has(pid) && MAPS[m]) count[m] = (count[m] || 0) + 1;
  votes.clear();
  let best = cur.id, n = count[cur.id] || 0;
  for (const [m, c] of Object.entries(count)) if (c > n) { best = m; n = c; }
  return best;
}

function afterRoundEnd() {
  if (matchWinner) {
    const next = tallyVotes();
    if (next !== cur.id) { setMap(next); bcast({ t: 'msg', text: 'Следующая карта: ' + cur.name }); }
    resetMatchState();
    startRound();
    return;
  }
  if (roundNo === HALF) {
    // смена сторон
    for (const p of players.values()) {
      p.team = p.team === 'CT' ? 'T' : 'CT';
      p.money = START_MONEY; p.resetLoadout = true;
    }
    score = { CT: score.T, T: score.CT };
    lossStreak = { CT: 0, T: 0 };
    bcast({ t: 'msg', text: 'Смена сторон! Экономика сброшена.' });
  }
  startRound();
}

function checkRoundEnd() {
  if (phase !== 'live') return;
  const aCT = aliveCount('CT'), aT = aliveCount('T'), planted = bomb.st === 'planted';
  if (aCT === 0) endRound(aT > 0 || planted ? 'T' : 'CT', 'elim');
  else if (aT === 0 && !planted) endRound('CT', 'elim');
  else if (!planted && now() >= phaseEnd) endRound('CT', 'time');   // бомба не заложена и время вышло
}

// ───────────── геометрия попаданий ─────────────
function rayBox(o, d, mn, mx) {
  let tmin = 0, tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) return -1; }
    else {
      let t1 = (mn[i] - o[i]) / d[i], t2 = (mx[i] - o[i]) / d[i];
      if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

// ───────────── действия игроков ─────────────
function startReload(p) {
  const g = p.inv[p.cur];
  const w = W[g.id];
  if (w.melee || g.mag >= w.mag || g.res <= 0 || p.reloadUntil) return;
  p.reloadUntil = now() + w.reload;
  p.reloadGun = g;
}

function finishReload(p) {
  const g = p.reloadGun;
  p.reloadUntil = 0; p.reloadGun = null;
  if (!g || p.inv[p.cur] !== g) return;
  const take = Math.min(W[g.id].mag - g.mag, g.res);
  g.mag += take; g.res -= take;
}

function applyDamage(v, k, dmg, head, w) {
  let hpLoss = dmg;
  if (v.armor > 0) { hpLoss = dmg * 0.6; v.armor = Math.max(0, v.armor - dmg * 0.4); }
  v.hp -= hpLoss;
  const dead = v.hp <= 0;
  send(k, { t: 'hit', hs: head, kill: dead });
  if (!v.bot) send(v, { t: 'dmg', ax: rd(k.x), az: rd(k.z) });
  if (dead && v.bot) {
    v.hp = 0; v.alive = false; v.respawnAt = now() + 2000;
    return;
  }
  if (dead) {
    v.hp = 0; v.alive = false; v.d++; v.lostLoadout = true; v.scoped = false;
    dropBomb(v); v.use = false;
    k.k++;
    k.money = Math.min(MAX_MONEY, k.money + w.kill);
    bcast({ t: 'kill', k: k.name, kt: k.team, v: v.name, vt: v.team, w: w.name, hs: head });
    checkRoundEnd();
  }
}

function shoot(p, m) {
  if ((phase !== 'live' && phase !== 'waiting') || !p.alive) return;
  const t = now();
  if (t < p.nextShot || t < p.reloadUntil) return;
  const g = p.inv[p.cur];
  const w = W[g.id];
  let dx = +m.dx, dy = +m.dy, dz = +m.dz;
  const len = Math.hypot(dx, dy, dz);
  if (!isFinite(len) || len < 0.5) return;
  dx /= len; dy /= len; dz /= len;

  if (!w.melee) {
    if (g.mag <= 0) { startReload(p); return; }
    g.mag--;
  }
  p.nextShot = t + w.rate;

  // разброс: хуже в движении и в прыжке, у AWP — без прицела
  let s = w.spread || 0;
  if (w.scope && !p.scoped) s = 0.05;
  s *= 1 + Math.min(p.speed, 7) / 2;
  if (p.crouch) s *= 0.8;
  if (p.y > 0.05) s *= 2;
  if (s > 0) {
    dx += (Math.random() * 2 - 1) * s; dy += (Math.random() * 2 - 1) * s; dz += (Math.random() * 2 - 1) * s;
    const l2 = Math.hypot(dx, dy, dz); dx /= l2; dy /= l2; dz /= l2;
  }

  const o = [p.x, p.y + (p.crouch ? 1.15 : EYE), p.z], d = [dx, dy, dz];
  let bt = w.range;
  for (const b of cur.boxes) {
    const tt = rayBox(o, d, [b.minx, b.miny, b.minz], [b.maxx, b.maxy, b.maxz]);
    if (tt >= 0 && tt < bt) bt = tt;
  }
  let target = null;
  const targets = phase === 'waiting' ? [...players.values(), ...dummies] : players.values();
  for (const q of targets) {
    if (q === p || !q.alive) continue;
    const tt = rayBox(o, d, [q.x - 0.4, q.y, q.z - 0.4], [q.x + 0.4, q.y + (q.crouch ? 1.4 : 1.8), q.z + 0.4]);
    if (tt >= 0 && tt < bt) { bt = tt; target = q; }
  }
  bcast({ t: 'shot', id: p.id, w: g.id, ex: rd(o[0] + dx * bt), ey: rd(o[1] + dy * bt), ez: rd(o[2] + dz * bt) });

  if (target && target.team !== p.team) {
    const hy = o[1] + dy * bt - target.y;
    const head = !w.melee && hy > (target.crouch ? 1.0 : 1.4);
    const leg = hy < (target.crouch ? 0.45 : 0.6);
    applyDamage(target, p, w.dmg * (head ? 4 : leg ? 0.75 : 1), head, w);
  }
  if (!w.melee && g.mag === 0) startReload(p);
}

function buy(p, item) {
  if ((phase !== 'freeze' && phase !== 'waiting') || !p.alive) return;
  const free = phase === 'waiting';
  if (item === 'kit') {
    if (p.team !== 'CT' || p.kit || (!free && p.money < KIT_PRICE)) return;
    if (!free) p.money -= KIT_PRICE;
    p.kit = true; return;
  }
  if (item === 'armor') {
    if (p.armor >= 100 || (!free && p.money < ARMOR_PRICE)) return;
    if (!free) p.money -= ARMOR_PRICE;
    p.armor = 100; return;
  }
  const w = W[item];
  if (!w || w.slot === 'knife' || w.price <= 0 || (!free && p.money < w.price)) return;
  if (!free) p.money -= w.price;
  p.inv[w.slot] = mkGun(item);
  p.cur = w.slot; p.reloadUntil = 0;
}

function onMessage(client, raw) {
  let m;
  try { m = JSON.parse(raw); } catch { return; }
  if (!m || typeof m.t !== 'string') return;
  let p = client.player;

  if (m.t === 'join') {
    if (p) return;
    const name = String(m.name || 'Игрок').replace(/[\r\n<>]/g, '').trim().slice(0, 16) || 'Игрок';
    if (phase === 'waiting' && m.map && m.map !== cur.id && MAPS[m.map]) {
      setMap(m.map);
      for (const q of players.values()) warmupSpawn(q);
    }
    p = createPlayer(client.sock, name, m.team);
    if (!p) { wsSend(client.sock, JSON.stringify({ t: 'full' })); return; }
    client.player = p;
    send(p, { t: 'init', id: p.id, W, team: p.team, armorPrice: ARMOR_PRICE, kitPrice: KIT_PRICE, maps: Object.values(MAPS).map(x => ({ id: x.id, name: x.name })), map: mapInfo(cur) });
    if (phase === 'waiting') warmupSpawn(p);
    bcast({ t: 'msg', text: `${p.name} подключился (${p.team})` });
    return;
  }
  if (!p) return;

  switch (m.t) {
    case 'state': {
      const yaw = +m.yaw, pitch = +m.pitch;
      if (isFinite(yaw)) p.yaw = yaw;
      if (isFinite(pitch)) p.pitch = Math.max(-1.6, Math.min(1.6, pitch));
      p.scoped = !!m.sc;
      p.crouch = m.cr ? 1 : 0;
      if (Number.isFinite(+m.a)) p.ack = +m.a;   // номер последнего принятого снимка (если клиент его присылает)
      if ((phase === 'live' || phase === 'waiting') && p.alive) {
        const nx = +m.x, ny = +m.y, nz = +m.z;
        if (![nx, ny, nz].every(isFinite)) break;
        const dt = Math.min(0.5, (now() - p.lastPos) / 1000);
        const dist = Math.hypot(nx - p.x, nz - p.z);
        if (dist <= 14 * dt + 0.8 && ny >= -0.1 && ny <= 8 && Math.abs(nx) < cur.half && Math.abs(nz) < cur.half) {
          p.speed = dist / Math.max(dt, 0.016);
          p.x = nx; p.y = Math.max(0, ny); p.z = nz; p.lastPos = now();
        }
      }
      break;
    }
    case 'shoot': shoot(p, m); break;
    case 'reload': if (p.alive && phase !== 'end') startReload(p); break;
    case 'switch':
      if (p.alive && ['primary', 'secondary', 'knife'].includes(m.slot) && p.inv[m.slot] && p.cur !== m.slot) {
        p.cur = m.slot; p.reloadUntil = 0; p.nextShot = now() + 250; p.scoped = false;
      }
      break;
    case 'buy': buy(p, String(m.item)); break;
    case 'use': p.use = !!m.on; break;
    case 'ping': send(p, { t: 'pong', c: +m.c || 0, lag: Math.round(stats.lag) }); break;
    case 'map':      // смена карты возможна только в разминке
      if (phase === 'waiting' && MAPS[m.id] && m.id !== cur.id) {
        setMap(m.id);
        for (const q of players.values()) warmupSpawn(q);
        bcast({ t: 'msg', text: `${p.name} выбрал карту ${cur.name}` });
      }
      break;
    case 'vote': if (matchWinner && MAPS[m.map]) votes.set(p.id, m.map); break;
  }
}

// ───────────── сеть ─────────────
server.on('upgrade', (req, sock) => {
  if (String(req.headers.upgrade || '').toLowerCase() !== 'websocket' || !req.headers['sec-websocket-key']) return sock.destroy();
  const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + GUID).digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  const client = { sock, buf: Buffer.alloc(0), player: null, closed: false };
  const close = () => {
    if (client.closed) return;
    client.closed = true;
    if (client.player) {
      dropBomb(client.player);
      players.delete(client.player.id);
      rosterSig.clear();
      bcast({ t: 'msg', text: `${client.player.name} вышел` });
      checkRoundEnd();
    }
    sock.destroy();
  };
  sock.on('data', d => wsParse(client, d, raw => onMessage(client, raw), close));
  sock.on('close', close);
  sock.on('error', close);
});

// ───────────── игровой цикл (20 Гц) ─────────────
let lastTickAt = 0, tickNo = 0;
const rosterSig = new Map();
setInterval(() => {
  const t = now();
  if (lastTickAt) stats.lag = Math.max(Math.max(0, t - lastTickAt - 50), stats.lag * 0.95);
  lastTickAt = t;
  for (const p of players.values()) if (p.reloadUntil && t >= p.reloadUntil) finishReload(p);

  const nCT = teamPlayers('CT').length, nT = teamPlayers('T').length;
  bombTick(t);
  if (phase === 'waiting') {
    if (nCT > 0 && nT > 0) { resetMatchState(); startRound(); }
    else {
      for (const d of dummies) {
        if (!d.alive) { if (t >= d.respawnAt) { d.alive = true; d.hp = 100; } continue; }
        if (d.speed) {
          d.x += d.dir * d.speed * 0.05;
          if (d.x > d.bx) { d.x = d.bx; d.dir = -1; } else if (d.x < d.ax) { d.x = d.ax; d.dir = 1; }
          d.yaw = d.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
        }
      }
    }
  } else if (nCT === 0 || nT === 0) {
    fullReset();
  } else if (phase === 'freeze' && t >= phaseEnd) {
    setPhase('live', ROUND_MS);
  } else if (phase === 'live') {
    checkRoundEnd();
  } else if (phase === 'end' && t >= phaseEnd) {
    afterRoundEnd();
  }

  // снимок мира: неизменные поля (имя, команда, оружие, счёт) шлём только при изменении и раз в секунду
  tickNo++;
  const pl = [];
  const entry = (id, name, tm, x, y, z, yaw, pitch, alive, w, k, d, cr) => {
    const sig = name + '|' + tm + '|' + w + '|' + k + '|' + d;
    if (rosterSig.get(id) !== sig || tickNo % 20 === 0) {
      rosterSig.set(id, sig);
      pl.push({ id, n: name, tm, x: rd(x), y: rd(y), z: rd(z), yw: rd(yaw), pt: rd(pitch), a: alive ? 1 : 0, w, k, d, c: cr ? 1 : 0 });
    } else pl.push({ id, x: rd(x), y: rd(y), z: rd(z), yw: rd(yaw), a: alive ? 1 : 0, c: cr ? 1 : 0 });
  };
  for (const q of players.values()) entry(q.id, q.name, q.team, q.x, q.y, q.z, q.yaw, q.pitch, q.alive, q.alive ? q.inv[q.cur].id : '', q.k, q.d, q.crouch);
  if (phase === 'waiting') for (const d of dummies) entry(d.id, d.name, 'X', d.x, 0, d.z, d.yaw, 0, d.alive, '', 0, 0);
  const base = { t: 's', q: tickNo, ph: phase, tl: Math.max(0, phaseEnd - t), sc: score, rn: roundNo, pl, bomb: bombView(t) };
  for (const q of players.values()) {
    // клиент не успевает принимать (медленный канал): устаревший снимок не копим, иначе задержка растёт без конца
    if (q.sock && q.sock.writableLength > 48 * 1024) { stats.dropped++; continue; }
    // клиент сильно отстал от последнего снимка: шлём реже (каждый 4-й), чтобы очередь не росла
    if (q.ack !== undefined && tickNo - q.ack > 10 && tickNo % 4) { stats.dropped++; continue; }
    send(q, Object.assign({}, base, {
      me: {
        hp: Math.ceil(q.hp), ar: Math.ceil(q.armor), mo: q.money, cur: q.cur, al: q.alive, tm: q.team,
        inv: { primary: q.inv.primary, secondary: q.inv.secondary },
        rl: q.reloadUntil ? q.reloadUntil - t : 0,
        kit: q.kit ? 1 : 0, hb: bomb.st === 'carried' && bomb.carrier === q.id ? 1 : 0, site: (siteAt(q.x, q.z) || {}).id || '',
        x: rd(q.x), y: rd(q.y), z: rd(q.z),
      },
    }));
  }
  stats.work = stats.work * 0.9 + (now() - t) * 0.1;
}, 50);

server.listen(PORT, () => console.log(`Strike Arena: http://localhost:${PORT}`));
