# Генератор карт: python3 tools/gen_maps.py maps   (нужны Python 3 и Pillow). Пишет maps/*.json и preview_*.png.
import json, math, sys
from collections import deque
from PIL import Image, ImageDraw

CELL = 2  # метра на клетку

class G:
    def __init__(s, half):
        s.half = half; s.n = half
        s.f = [['#'] * s.n for _ in range(s.n)]
        s.o = [['.'] * s.n for _ in range(s.n)]
        s.rf = [['.'] * s.n for _ in range(s.n)]      # слой крыш: R — плита крыши над клеткой
    def idx(s, v): return int((v + s.half) // CELL)
    def rect(s, x0, z0, x1, z1, ch='.'):
        for r in range(s.idx(z0), s.idx(z1)):
            for c in range(s.idx(x0), s.idx(x1)):
                s.f[r][c] = ch
    def roof(s, x0, z0, x1, z1, gaps=()):
        # крыша над открытыми клетками прямоугольника; gaps — полосы по z (z0, z1), оставленные открытыми (световые проёмы)
        for r in range(s.idx(z0), s.idx(z1)):
            zc = -s.half + r * CELL + 1
            if any(a <= zc <= b for a, b in gaps): continue
            for c in range(s.idx(x0), s.idx(x1)):
                if s.f[r][c] != '#': s.rf[r][c] = 'R'
    def obj(s, x, z, ch):
        s.o[s.idx(z)][s.idx(x)] = ch

def build_sirocco():
    d = G(44)
    d.rect(-24, 30, -4, 42)                  # T spawn (юго-запад)
    d.rect(-32, 34, -24, 40)                 # T -> западный переулок
    d.rect(-40, -14, -32, 40)                # западный переулок
    d.rect(-12, -6, -4, 30)                  # средняя улица
    d.rect(-18, -18, 6, -6)                  # центральная площадь
    d.rect(-4, 34, 30, 40)                   # T -> восточная дорога
    d.rect(30, -10, 38, 40)                  # восточная дорога
    d.rect(-32, 16, -12, 20)                 # переулок между западной и средней улицей
    d.rect(-4, -30, 4, -18)                  # улица CT
    d.rect(-2, -42, 18, -30)                 # CT spawn (северо-восток)
    d.rect(-40, -40, -18, -12, '3')          # A: крыша-площадь
    d.rect(-40, -10, -32, -8, '1'); d.rect(-40, -12, -32, -10, '2')   # рампа с западного переулка
    d.rect(-14, -38, -2, -32)                # коридор CT -> A
    d.rect(-16, -38, -14, -32, '1'); d.rect(-18, -38, -16, -32, '2')
    d.rect(20, -38, 42, -10)                 # B: нижний двор
    d.rect(18, -38, 20, -30)                 # CT -> B
    d.rect(6, -14, 20, -10)                  # площадь -> B
    d.rect(-24, 34, -4, 40, 'T'); d.rect(0, -40, 16, -34, 'C')
    for x, z in ((-11, 23), (-9, 23), (-7, 23), (-5, 23)): d.obj(x, z, 'a')     # ворота на средней улице
    for z in (13, 15): pass
    for x in (31, 33, 35, 37): d.obj(x, 9, 'a')                                  # ворота на восточной дороге
    for x in (-3, -1, 1, 3): d.obj(x, -25, 'a')                                  # ворота улицы CT
    for x in (-39, -37, -35, -33): d.obj(x, 3, 'a')                              # ворота западного переулка
    d.obj(-29, 18, 'a'); d.obj(-27, 18, 'a')                                     # арка в переулке
    for x, z, ch in [(-1, -13, 'W'), (-1, -11, 'W'), (-3, -12, 'w'), (1, -12, 'w'),     # фонтан на площади
                     (-16, -16, 'P'), (4, -16, 'P'), (-16, -8, 'P'), (4, -8, 'P'),
                     (-10, 4, 'n'), (-10, 6, 'n'), (-10, 8, 'n'), (-10, 10, 'n'), (-8, 4, 'y'), (-8, 8, 'x'),   # рынок с навесами
                     (-6, 14, 'n'), (-6, 16, 'n'), (-4, 12, 'y'),
                     (36, 22, 'x'), (32, 28, 'y'), (36, -2, 'x'), (32, -4, 'X'),                              # восточная дорога
                     (-37, 22, 'x'), (-39, 28, 'y'), (-35, 8, 'n'), (-35, 10, 'n'), (-37, -4, 'x'),            # западный переулок
                     (-30, -30, 'X'), (-26, -24, 'x'), (-36, -34, 'y'), (-22, -34, 'x'), (-34, -18, 'P'),     # A
                     (26, -30, 'X'), (34, -22, 'x'), (38, -34, 'y'), (30, -16, 'P'), (24, -14, 'n'), (26, -14, 'n'), (40, -14, 'P'),   # B
                     (-12, -34, 'P'), (16, -32, 'y'), (14, -36, 'x'), (12, 28, 'n')]:
        if (ch != 'n' or True): d.obj(x, z, ch)
    d.obj(12, 28, '.')
    d.roof(-12, -6, -4, 30)                                                  # сплошная крыша над всей средней улицей
    meta = dict(id='sirocco', name='Sirocco', theme='sirocco', half=44,
        spawns=dict(CT=[[2, -37], [5, -37], [8, -37], [11, -37], [14, -37]], T=[[-21, 37], [-17, 37], [-13, 37], [-9, 37], [-5, 37]]),
        labels=[dict(text='A', x=-29, z=-26), dict(text='B', x=31, z=-24)],
        dummies=[[-10, 20, -10, -6, 2], [4, -12, 4, 4, 0], [-1, -22, -3, 3, 2], [-39, 10, -39, -39, 0], [34, 20, 34, 34, 0]])
    return d, meta

def build_medina():
    m = G(36)
    m.rect(-12, 26, 12, 34)                 # T spawn
    m.rect(-4, -14, 4, 28)                  # mid
    m.rect(-6, -22, 6, -14)                 # top mid
    m.rect(-4, -26, 4, -22)                 # к спавну CT
    m.rect(-10, -34, 6, -26)                # CT spawn
    m.rect(12, 26, 28, 34)                  # T -> rampa
    m.rect(20, 4, 28, 34)                   # ramp base
    m.rect(-28, 26, -12, 34)                # T -> apartments
    m.rect(-26, -8, -20, 34)                # apartments
    m.rect(-20, 8, -4, 12)                  # underpass
    m.rect(-34, -30, -14, -8)               # B site
    m.rect(-14, -4, -4, 2)                  # short B
    m.rect(-14, -12, -10, -4)
    m.rect(-14, -30, -10, -26)              # CT -> B
    m.rect(10, -30, 30, 0, '3')             # A site (platform)
    m.rect(20, 2, 28, 4, '1'); m.rect(20, 0, 28, 2, '2')   # ramp steps
    m.rect(4, -12, 10, -6)                  # connector
    m.rect(4, -12, 6, -6, '1'); m.rect(6, -12, 8, -6, '2'); m.rect(8, -12, 10, -6, '3')
    m.rect(6, -30, 10, -26, '1'); m.rect(8, -30, 10, -26, '2')   # jungle/stairs CT -> A
    m.rect(-8, 28, 8, 32, 'T'); m.rect(-8, -32, 4, -28, 'C')
    for x, z, ch in [(16, -14, 'X'), (14, -26, 'x'), (26, -8, 'y'), (24, -22, 'x'), (28, -28, 'X'), (12, -4, 'y'),
                     (-26, -18, 'X'), (-20, -24, 'x'), (-30, -12, 'y'), (-32, -26, 'x'), (-16, -16, 'W'),
                     (1, 6, 'y'), (-5, -20, 'x'), (22, 18, 'y'), (-23, 16, 'x'), (-12, 10, 'y')]:
        m.obj(x, z, ch)
    for x in (-3, -1, 1, 3): m.obj(x, -23, 'a')                                 # ворота верхнего мида
    for z in (-1, 1, 3): m.obj(-23, z, 'a')                                      # ворота в апартаментах
    m.obj(-13, -27, 'a'); m.obj(-13, -29, 'a')                                    # арка CT -> B
    for x, z in [(-12, -12), (-30, -10), (14, -4), (26, -4), (-8, -30), (4, -28), (-28, 28), (-16, 28), (16, 30), (24, 30)]: m.obj(x, z, 'P')
    for x, z in [(-23, 8), (-23, 10), (-23, 24), (-23, 26), (-8, 10), (-12, 10), (8, 12), (8, 14), (22, 10), (26, 10)]: m.obj(x, z, 'n')
    m.roof(-4, -14, 4, 26)                                                       # сплошная крыша над всем мидом (до спавна T)
    meta = dict(id='medina', name='Azure Medina', theme='medina', half=36,
        spawns=dict(CT=[[-8, -30], [-5, -30], [-2, -30], [1, -30], [4, -30]], T=[[-8, 30], [-4, 30], [0, 30], [4, 30], [8, 30]]),
        labels=[dict(text='A', x=20, z=-16), dict(text='B', x=-24, z=-20)],
        dummies=[[-3, 16, -3, 3, 2], [0, -4, 0, 0, 0], [-3, -18, 3, -3, 2], [-25, 15, -25, -25, 0], [25, 24, 25, 25, 0]])
    return m, meta

LVL = 0.45
def lvl(ch): return int(ch) if ch.isdigit() else 0
def blocked(ch): return ch in 'xXDWwn'     # n — прилавок под навесом непроходим; a (арка) и P (пальма) проходимы

def reach(g, start):
    seen = {start}; q = deque([start]); dist = {start: 0}
    while q:
        r, c = q.popleft()
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            rr, cc = r + dr, c + dc
            if not (0 <= rr < g.n and 0 <= cc < g.n): continue
            if g.f[rr][cc] == '#' or blocked(g.o[rr][cc]) or (rr, cc) in seen: continue
            if abs(lvl(g.f[rr][cc]) - lvl(g.f[r][c])) > 1: continue
            seen.add((rr, cc)); dist[(rr, cc)] = dist[(r, c)] + 1; q.append((rr, cc))
    return seen, dist

def cell(g, x, z): return (g.idx(z), g.idx(x))

def check(g, meta):
    ok = True
    ct = cell(g, *meta['spawns']['CT'][0])
    seen, dist = reach(g, ct)
    pts = dict(T=meta['spawns']['T'][0], **{l['text'] + '_site': (l['x'], l['z']) for l in meta['labels']})
    for i, d in enumerate(meta['dummies']): pts['dummy%d' % i] = (d[0], d[1])
    for s in meta['spawns']['CT'] + meta['spawns']['T']: pts['spawn%s' % (s,)] = tuple(s)
    for name, (x, z) in pts.items():
        c = cell(g, x, z)
        if g.f[c[0]][c[1]] == '#' or blocked(g.o[c[0]][c[1]]): print('  !! внутри стены/ящика:', name, x, z); ok = False
        elif c not in seen: print('  !! недостижимо:', name, x, z); ok = False
    for dname in ('T', 'A_site', 'B_site'):
        c = cell(g, *pts[dname])
        if c in seen: print('  путь CT -> %s: %d клеток (~%d м)' % (dname, dist[c], dist[c] * CELL))
    # все открытые клетки достижимы?
    unreachable = 0
    for r in range(g.n):
        for c in range(g.n):
            if g.f[r][c] != '#' and not blocked(g.o[r][c]) and (r, c) not in seen: unreachable += 1
    print('  недостижимых открытых клеток:', unreachable)
    # путь T -> A и B
    ts, td = reach(g, cell(g, *meta['spawns']['T'][0]))
    for dname in ('A_site', 'B_site'):
        c = cell(g, *pts[dname]); print('  путь T -> %s: %d клеток (~%d м)' % (dname, td.get(c, -1), td.get(c, -1) * CELL))
    return ok

COL = {'#': (45, 42, 40), '.': (200, 186, 150), 'T': (240, 170, 60), 'C': (90, 140, 240),
       '1': (180, 205, 150), '2': (150, 190, 120), '3': (120, 170, 95)}
def render(g, meta, path, S=14):
    im = Image.new('RGB', (g.n * S, g.n * S)); d = ImageDraw.Draw(im)
    for r in range(g.n):
        for c in range(g.n):
            ch = g.f[r][c]; d.rectangle([c * S, r * S, c * S + S - 1, r * S + S - 1], fill=COL.get(ch, (255, 0, 255)))
            o = g.o[r][c]
            if o != '.':
                colr = {'x': (140, 90, 40), 'y': (190, 140, 70), 'X': (110, 60, 20), 'D': (40, 90, 200), 'W': (120, 120, 120), 'w': (150, 150, 150), 'a': (230, 90, 60), 'n': (240, 200, 60), 'P': (40, 160, 70)}[o]
                d.rectangle([c * S + 2, r * S + 2, c * S + S - 3, r * S + S - 3], fill=colr)
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
    for r in range(g.n):
        for c in range(g.n):
            if g.rf[r][c] == 'R': od.rectangle([c * S, r * S, c * S + S - 1, r * S + S - 1], fill=(120, 40, 160, 110))
    im.paste(Image.alpha_composite(im.convert('RGBA'), ov).convert('RGB')); d = ImageDraw.Draw(im)
    for team, colr in (('CT', (0, 60, 255)), ('T', (200, 100, 0))):
        for x, z in meta['spawns'][team]:
            px, pz = (x + g.half) / CELL * S, (z + g.half) / CELL * S
            d.ellipse([px - 4, pz - 4, px + 4, pz + 4], outline=colr, width=2)
    for l in meta['labels']:
        px, pz = (l['x'] + g.half) / CELL * S, (l['z'] + g.half) / CELL * S
        d.text((px - 3, pz - 5), l['text'], fill=(255, 0, 0))
    for dm in meta['dummies']:
        px, pz = (dm[0] + g.half) / CELL * S, (dm[1] + g.half) / CELL * S
        d.rectangle([px - 3, pz - 3, px + 3, pz + 3], fill=(220, 30, 30))
    im.save(path)

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    for fn in (build_sirocco, build_medina):
        g, meta = fn()
        print(meta['name'])
        ok = check(g, meta)
        render(g, meta, 'preview_%s.png' % meta['id'])
        meta['yaw'] = dict(CT=math.pi, T=0)
        meta['floor'] = [''.join(r) for r in g.f]
        meta['objects'] = [''.join(r) for r in g.o]
        meta['roof'] = [''.join(r) for r in g.rf]
        json.dump(meta, open('%s/%s.json' % (out, meta['id']), 'w'), ensure_ascii=False, indent=0)
        print('  OK' if ok else '  ПРОБЛЕМЫ')
