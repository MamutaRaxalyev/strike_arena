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
    def idx(s, v): return int((v + s.half) // CELL)
    def rect(s, x0, z0, x1, z1, ch='.'):
        for r in range(s.idx(z0), s.idx(z1)):
            for c in range(s.idx(x0), s.idx(x1)):
                s.f[r][c] = ch
    def obj(s, x, z, ch):
        s.o[s.idx(z)][s.idx(x)] = ch

def build_dust2():
    d = G(44)
    d.rect(-16, 30, 16, 42)                 # T spawn
    d.rect(-4, -30, 4, 32)                  # mid + CT mid
    d.rect(-8, -42, 14, -30)                # CT spawn
    d.rect(-28, 34, -16, 40)                # T -> tunnels
    d.rect(-34, -14, -28, 40)               # B tunnels
    d.rect(-28, 4, -4, 8)                   # lower tunnels link
    d.rect(-40, -38, -20, -14)              # B site
    d.rect(-20, -36, -8, -30)               # CT -> B
    d.rect(-14, -8, -4, 0)                  # suicide
    d.rect(-14, -24, -10, -8)               # B window / suicide north
    d.rect(-20, -24, -10, -20)              # to B site
    d.rect(4, -12, 26, -6)                  # catwalk
    d.rect(20, -24, 26, -6)                 # catwalk north
    d.rect(20, -22, 26, -20, '1'); d.rect(20, -24, 26, -22, '2')
    d.rect(20, -42, 42, -24, '3')           # A site (platform)
    d.rect(14, -38, 20, -28, '.')           # CT -> A ramp
    d.rect(14, -38, 16, -28, '1'); d.rect(16, -38, 18, -28, '2'); d.rect(18, -38, 20, -28, '3')
    d.rect(16, 34, 30, 40)                  # T -> long
    d.rect(30, -24, 38, 40)                 # long
    d.rect(30, -20, 38, -18, '1'); d.rect(30, -22, 38, -20, '2'); d.rect(30, -24, 38, -22, '3')
    d.rect(-10, 34, 10, 40, 'T'); d.rect(-4, -40, 10, -34, 'C')
    # двери
    for x in (-3, 3): d.obj(x, -17, 'D')
    for x in (31, 33): d.obj(x, 21, 'D')
    # укрытия
    for x, z, ch in [(1, 6, 'x'), (-3, -24, 'y'),
                     (36, 10, 'x'), (32, 2, 'X'), (36, -10, 'x'), (32, 28, 'y'),
                     (24, -34, 'X'), (34, -30, 'x'), (36, -38, 'y'), (28, -28, 'x'), (38, -34, 'X'),
                     (-30, -28, 'X'), (-26, -22, 'x'), (-36, -34, 'y'), (-34, -20, 'x'), (-24, -32, 'X'),
                     (-31, 20, 'y'), (-31, 0, 'x'), (-12, -4, 'y'), (8, -9, 'y')]:
        d.obj(x, z, ch)
    meta = dict(id='dust2', name='Dust II', theme='dust2', half=44,
        spawns=dict(CT=[[-3, -37], [1, -37], [5, -37], [9, -37], [-7, -37]], T=[[-7, 37], [-3, 37], [1, 37], [5, 37], [9, 37]]),
        labels=[dict(text='A', x=31, z=-33), dict(text='B', x=-30, z=-26)],
        dummies=[[-3, 18, -3, 3, 2], [0, -4, 0, 0, 0], [-3, -27, 3, -3, 2], [-31, 10, -31, -31, 0], [34, 14, 34, 34, 0]])
    return d, meta

def build_mirage():
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
    meta = dict(id='mirage', name='Mirage', theme='mirage', half=36,
        spawns=dict(CT=[[-8, -30], [-5, -30], [-2, -30], [1, -30], [4, -30]], T=[[-8, 30], [-4, 30], [0, 30], [4, 30], [8, 30]]),
        labels=[dict(text='A', x=20, z=-16), dict(text='B', x=-24, z=-20)],
        dummies=[[-3, 16, -3, 3, 2], [0, -4, 0, 0, 0], [-3, -18, 3, -3, 2], [-23, 12, -23, -23, 0], [25, 24, 25, 25, 0]])
    return m, meta

LVL = 0.45
def lvl(ch): return int(ch) if ch.isdigit() else 0
def blocked(ch): return ch in 'xXDWw'

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
                colr = {'x': (140, 90, 40), 'y': (190, 140, 70), 'X': (110, 60, 20), 'D': (40, 90, 200), 'W': (120, 120, 120), 'w': (150, 150, 150)}[o]
                d.rectangle([c * S + 2, r * S + 2, c * S + S - 3, r * S + S - 3], fill=colr)
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
    for fn in (build_dust2, build_mirage):
        g, meta = fn()
        print(meta['name'])
        ok = check(g, meta)
        render(g, meta, 'preview_%s.png' % meta['id'])
        meta['yaw'] = dict(CT=math.pi, T=0)
        meta['floor'] = [''.join(r) for r in g.f]
        meta['objects'] = [''.join(r) for r in g.o]
        json.dump(meta, open('%s/%s.json' % (out, meta['id']), 'w'), ensure_ascii=False, indent=0)
        print('  OK' if ok else '  ПРОБЛЕМЫ')
