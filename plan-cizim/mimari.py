"""Mimari planı okur: libredwg-web JSON'u (baglanti-hatti/araclar/dwg-oku.mjs çıktısı) → düz çizim parçaları.

Bloklar açılır (iç içe en çok 6 kat). Çıktı:
  cizgiler: [(x1, y1, x2, y2, katman)]   (yay ve daireler kısa çizgilere bölünür)
  yazilar:  [(x, y, metin, katman)]      (MTEXT biçim kodları temizlenir)
  bloklar:  [(ad, x, y, dönüş_rad, sx, sy, katman, parcalar, yaylar)]  parcalar: bloğun açılmış çizgileri,
            yaylar: [(merkez_x, merkez_y, r, (bas_x, bas_y), (son_x, son_y))] bloğun içindeki yaylar (kapı açılışı için)
"""
import json
import math
import re

ATLA = ('TARAMA', 'OLCU', 'ÖLÇÜ', 'DEFPOINTS', 'DIM')    # bu sözcükleri içeren katmanlar çizilmez


def atlanir(katman: str) -> bool:
    k = katman.upper()
    return any(a in k for a in ATLA)


def mtext_temiz(s: str) -> str:
    s = s.replace('\\P', '\n')
    s = re.sub(r'\\[A-Za-z][^;\\]*;', '', s)
    s = s.replace('{', '').replace('}', '')
    return re.sub(r'[ \t]+', ' ', s).strip()


def _carp(m, n):
    a, b, c, d, e, f = m
    A, B, C, D, E, F = n
    return (a * A + b * C, a * B + b * D, c * A + d * C, c * B + d * D, a * E + b * F + e, c * E + d * F + f)


def _uygula(m, x, y):
    a, b, c, d, e, f = m
    return a * x + b * y + e, c * x + d * y + f


class Plan:
    def __init__(self, yol, kutu=None):
        db = json.load(open(yol, encoding='utf-8'))
        self.bloktanim = {b['name']: b for b in db['tables']['BLOCK_RECORD']['entries']}
        # kesikli çizgi tipli katmanlar (kiriş, gizli çizgi…) odayı bölmez
        self.kesikli = {l['name'] for l in db['tables'].get('LAYER', {}).get('entries', [])
                        if (l.get('lineType') or 'Continuous').upper() not in ('CONTINUOUS', 'BYLAYER', 'BYBLOCK', '')}
        self.kutu = kutu
        self.cizgiler, self.yazilar, self.bloklar = [], [], []
        self._ac(db['entities'], (1, 0, 0, 1, 0, 0), None, 0, self.cizgiler, [], ust=True)

    def _icinde(self, x, y, pay=100):
        if not self.kutu:
            return True
        x0, y0, x1, y1 = self.kutu
        return x0 - pay <= x <= x1 + pay and y0 - pay <= y <= y1 + pay

    def _ac(self, ents, m, ust_katman, derin, hedef, yaylar, ust=False):
        for e in ents:
            k = e.get('layer', '') or ''
            if k == '0' and ust_katman:
                k = ust_katman
            if atlanir(k):
                continue
            t = e['type']
            if t == 'LINE':
                a = _uygula(m, e['startPoint']['x'], e['startPoint']['y'])
                b = _uygula(m, e['endPoint']['x'], e['endPoint']['y'])
                if self._icinde(*a) or self._icinde(*b):
                    hedef.append((a[0], a[1], b[0], b[1], k))
            elif t == 'LWPOLYLINE':
                v = [_uygula(m, p['x'], p['y']) for p in e.get('vertices', [])]
                if not v or not any(self._icinde(*p) for p in v):
                    continue
                if e.get('flag', 0) & 1:
                    v = v + [v[0]]
                for p, q in zip(v, v[1:]):
                    hedef.append((p[0], p[1], q[0], q[1], k))
            elif t in ('ARC', 'CIRCLE'):
                c = e['center']; r = e['radius']
                a0 = e.get('startAngle', 0.0) if t == 'ARC' else 0.0
                a1 = e.get('endAngle', 2 * math.pi) if t == 'ARC' else 2 * math.pi
                if a1 <= a0:
                    a1 += 2 * math.pi
                n = max(6, int((a1 - a0) / (math.pi / 24)))
                p = [_uygula(m, c['x'] + r * math.cos(a0 + (a1 - a0) * i / n), c['y'] + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]
                if any(self._icinde(*q) for q in p):
                    for q1, q2 in zip(p, p[1:]):
                        hedef.append((q1[0], q1[1], q2[0], q2[1], k))
                    if t == 'ARC':
                        mx, my = _uygula(m, c['x'], c['y'])
                        olcek = math.sqrt(abs(m[0] * m[3] - m[1] * m[2]))
                        yaylar.append((mx, my, r * olcek, p[0], p[-1]))
            elif t in ('TEXT', 'MTEXT') and ust:
                p = e.get('insertionPoint') or e.get('startPoint')
                if p and self._icinde(p['x'], p['y'], 0):
                    s = e.get('text') or e.get('contents') or ''
                    x, y = p['x'], p['y']
                    if t == 'MTEXT':                       # yazı bloğunun ortası (ekleme noktası köşede olabilir)
                        a = e.get('attachmentPoint') or 1
                        w = e.get('rectWidth') or e.get('extentsWidth') or 0
                        h = e.get('extentsHeight') or 0
                        sut, sat = (a - 1) % 3, (a - 1) // 3
                        dx, dy = w * (0.5 - sut / 2), -h * (0.5 - sat / 2)
                        rr = e.get('rotation') or 0
                        x += dx * math.cos(rr) - dy * math.sin(rr)
                        y += dx * math.sin(rr) + dy * math.cos(rr)
                    self.yazilar.append((x, y, mtext_temiz(s) if t == 'MTEXT' else s.strip(), k))
            elif t == 'INSERT' and derin < 6:
                b = self.bloktanim.get(e['name'])
                if not b:
                    continue
                p = e['insertionPoint']; r = e.get('rotation', 0.0)
                sx = e.get('xScale', 1) or 1; sy = e.get('yScale', 1) or 1
                bp = b.get('basePoint') or {'x': 0, 'y': 0}
                n = (sx * math.cos(r), -sy * math.sin(r), sx * math.sin(r), sy * math.cos(r), p['x'], p['y'])
                n = _carp(m, _carp(n, (1, 0, 0, 1, -bp['x'], -bp['y'])))
                parca, yay = [], []
                self._ac(b.get('entities', []), n, k if k != '0' else ust_katman, derin + 1, parca, yay)
                hedef.extend(parca)
                yaylar.extend(yay)
                if ust:
                    x, y = _uygula(m, p['x'], p['y'])
                    if self._icinde(x, y, 0):
                        self.bloklar.append((e['name'], x, y, r, sx, sy, k, parca, yay))
