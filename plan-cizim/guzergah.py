"""Linye güzergâhları — kullanıcının çizim düzeni (onaylı projelerinden, 9 Kasım 2026):

- Linyeler tablodan çıkar, holde duvara paralel (10–30 cm içeride) yan yana demet hâlinde gider, köşelerde 90° döner.
- Her linye odasına kapıdan girer; aydınlatmada kapı yanındaki anahtara gelir, anahtardan lambalara düz çizgi çekilir.
- Prizler: duvar boyunca giden ana hat (duvardan ~15 cm içeride) + her prize kısa dik bağlantı.
Yol bulma: 5 cm ızgarada dönüş cezalı A* (yalnız yatay/dikey adım). Duvarlar geçilmez; kapı açıklıkları geçilir.
"""
import heapq
import math

import cv2
import numpy as np

G = 5.0                      # güzergâh ızgarası (cm)
DONUS = 12                   # dönüş cezası
DOLU = 9                     # başka hattın kullandığı hücre cezası (hatlar yan yana gitsin)
YONLER = [(1, 0), (0, 1), (-1, 0), (0, -1)]


class Izgara:
    def __init__(self, iz, odalar, kapilar, daire_odalari):
        """iz: oda.Izgara (2 cm). Geçilebilir alan: dairenin odaları + kapı açıklıkları."""
        self.iz = iz
        h, w = odalar[0].maske.shape if odalar and odalar[0].maske is not None else (iz.h, iz.g)
        gec = np.zeros((iz.h, iz.g), np.uint8)
        for o in daire_odalari:
            gec[o.maske] = 1
        for kp in kapilar:
            if not any(o in daire_odalari for o, _ in kp.odalar):
                continue
            # kapı açıklığı: menteşeden kilide, duvarın iki yanına 40 cm
            p = []
            for t, s in ((0, -40), (1, -40), (1, 40), (0, 40)):
                x = kp.mentese[0] + kp.u[0] * kp.genislik * t + kp.n[0] * s
                y = kp.mentese[1] + kp.u[1] * kp.genislik * t + kp.n[1] * s
                p.append(iz.px(x, y))
            cv2.fillPoly(gec, [np.array(p, np.int32)], 1)
        k = int(G / 2)                                   # 2 cm → 5 cm
        self.h, self.w = iz.h * 2 // 5, iz.g * 2 // 5
        self.gec = cv2.resize(gec, (self.w, self.h), interpolation=cv2.INTER_AREA) > 0.6
        d = cv2.distanceTransform(self.gec.astype(np.uint8), cv2.DIST_L2, 5) * G       # cm duvara uzaklık
        self.maliyet = np.where(d < 8, 6.0, np.where(d <= 30, 1.0, np.where(d <= 60, 2.5, 4.0)))
        self.dolu = np.zeros((self.h, self.w), np.float32)

    def hucre(self, x, y):
        i = int(round((x - self.iz.x0) / G)); j = int(round((y - self.iz.y0) / G))
        return min(max(i, 0), self.w - 1), min(max(j, 0), self.h - 1)

    def cm(self, i, j):
        return self.iz.x0 + i * G, self.iz.y0 + j * G

    def yakin_gecilebilir(self, i, j, r=12):
        if self.gec[j, i]:
            return i, j
        en = None
        for a in range(-r, r + 1):
            for b in range(-r, r + 1):
                ii, jj = i + a, j + b
                if 0 <= ii < self.w and 0 <= jj < self.h and self.gec[jj, ii]:
                    d = abs(a) + abs(b)
                    if en is None or d < en[0]:
                        en = (d, ii, jj)
        return (en[1], en[2]) if en else (i, j)

    def yol(self, a, b, hedefler=None):
        """a → b (cm) dik açılı yol; hedefler verilirse (hücre kümesi) en yakınına. Dönüş: köşe noktaları (cm)."""
        si, sj = self.yakin_gecilebilir(*self.hucre(*a))
        if hedefler is None:
            ti, tj = self.yakin_gecilebilir(*self.hucre(*b))
            hed = {(ti, tj)}
        else:
            hed = hedefler
        hx = [h[0] for h in hed]; hy = [h[1] for h in hed]
        def tah(i, j):
            return min(abs(i - x) + abs(j - y) for x, y in zip(hx[:40], hy[:40])) if len(hed) <= 40 else 0
        acik = [(tah(si, sj), 0.0, si, sj, -1)]
        en_iyi = {}
        geri = {}
        bitis = None
        while acik:
            f, g, i, j, yon = heapq.heappop(acik)
            if (i, j) in hed:
                bitis = (i, j, yon); break
            if en_iyi.get((i, j, yon), 1e18) < g:
                continue
            for k, (dx, dy) in enumerate(YONLER):
                ii, jj = i + dx, j + dy
                if not (0 <= ii < self.w and 0 <= jj < self.h) or not self.gec[jj, ii]:
                    continue
                if yon >= 0 and (k + 2) % 4 == yon:
                    continue
                gg = g + self.maliyet[jj, ii] + self.dolu[jj, ii] + (DONUS if yon >= 0 and k != yon else 0)
                if gg < en_iyi.get((ii, jj, k), 1e18):
                    en_iyi[(ii, jj, k)] = gg
                    geri[(ii, jj, k)] = (i, j, yon)
                    heapq.heappush(acik, (gg + tah(ii, jj), gg, ii, jj, k))
        if not bitis:
            return None
        hucreler = []
        d = bitis
        while d[2] != -1 or (d[0], d[1]) != (si, sj):
            hucreler.append((d[0], d[1]))
            if d not in geri:
                break
            d = geri[d]
        hucreler.append((si, sj))
        hucreler.reverse()
        for i, j in hucreler:                       # sonraki hatlar bunun yanından geçsin
            self.dolu[j, i] += DOLU
            for dx, dy in YONLER:
                ii, jj = i + dx, j + dy
                if 0 <= ii < self.w and 0 <= jj < self.h:
                    self.dolu[jj, ii] += 0.5
        return self._koseler(hucreler)

    def _koseler(self, h):
        if len(h) < 2:
            return [self.cm(*h[0])]
        out = [h[0]]
        for k in range(1, len(h) - 1):
            a, b, c = h[k - 1], h[k], h[k + 1]
            if (b[0] - a[0], b[1] - a[1]) != (c[0] - b[0], c[1] - b[1]):
                out.append(b)
        out.append(h[-1])
        return [self.cm(i, j) for i, j in out]


def priz_hatti(o, iz, prizler, ic=15):
    """Oda içinde duvardan 'ic' cm içeride, prizleri kapsayan en kısa halka parçası + dik bağlantılar.
    Dönüş: (ana_hat_noktaları, [(priz, bağlantı_ucu)])"""
    m = o.maske.astype(np.uint8)
    e = cv2.erode(m, np.ones((2 * int(ic / 2) + 1, 2 * int(ic / 2) + 1), np.uint8))
    kon, _ = cv2.findContours(e, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not kon:
        return None
    kon = max(kon, key=cv2.contourArea)[:, 0, :]
    halka = [iz.cm(int(p[0]), int(p[1])) for p in kon]
    n = len(halka)
    izd = []
    for p in prizler:
        k = min(range(n), key=lambda t: (halka[t][0] - p['x']) ** 2 + (halka[t][1] - p['y']) ** 2)
        izd.append(k)
    s = sorted(set(izd))
    if not s:
        return None
    # en büyük boşluğu dışarıda bırakan yay
    bosluk = [((s[(i + 1) % len(s)] - s[i]) % n or n, i) for i in range(len(s))]
    _, i = max(bosluk)
    bas = s[(i + 1) % len(s)]
    son = s[i]
    yol = []
    t = bas
    while True:
        yol.append(halka[t])
        if t == son:
            break
        t = (t + 1) % n
    # köşelere indir (2 cm basamakları düzelt)
    if len(yol) > 2:
        sade = [tuple(map(float, q[0])) for q in cv2.approxPolyDP(np.array(yol, np.float32).reshape(-1, 1, 2), 3.0, False)]
    else:
        sade = yol
    baglar = [(p, halka[k]) for p, k in zip(prizler, izd)]
    return sade, baglar
