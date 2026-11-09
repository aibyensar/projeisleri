"""Odaları, kapıları ve daireleri bulur.

Yöntem: duvar/kapı/pencere çizgileri 2 cm'lik ızgaraya çizilir; her oda adı yazısının ("SALON\\nA=21.60 M2") olduğu
noktadan taşma doldurması (flood fill) yapılır → oda alanı. Kapılar (açılış yayı + kanat çizgisi) odayı kapatır.
Bulunan alan yazıdaki alanla karşılaştırılır (%15'ten fazla fark → oda "şüpheli" işaretlenir).
"""
import math
import re

import cv2
import numpy as np

PX = 2.0                     # cm / piksel
CIZME = ('YAZI', 'YAZı', 'TEFR', 'AKS', 'KOT', 'NOT', 'MAHAL', 'KİRİŞ', 'KIRIŞ', 'KIRIS', 'KESİT', 'KESIT')   # odayı bölmeyen katmanlar

TURLER = [            # (aranan, tür) — sıra önemli
    ('SALON+MUTFAK', 'salon_mutfak'), ('SALON', 'salon'), ('OTURMA', 'salon'), ('MUTFAK', 'mutfak'),
    ('YATAK', 'oda'), ('ÇOCUK', 'oda'), ('CALISMA', 'oda'), ('ÇALIŞMA', 'oda'), ('ODA', 'oda'),
    ('BANYO', 'banyo'), ('DUŞ', 'banyo'), ('WC', 'wc'), ('TUVALET', 'wc'),
    ('KAT HOL', 'ortak'), ('GİRİŞ HOL', 'ortak'), ('MERD', 'ortak'), ('KORİDOR', 'ortak'),
    ('HOL', 'hol'), ('ANTRE', 'hol'), ('BALKON', 'balkon'), ('TERAS', 'balkon'),
    ('KİLER', 'kiler'), ('DEPO', 'kiler'), ('VESTİYER', 'kiler'), ('GİYİNME', 'kiler'),
    ('İŞ YERİ', 'isyeri'), ('DÜKKAN', 'isyeri'),
]
ORTAK = {'ortak', 'diger'}


def tur_bul(ad):
    a = ad.upper().replace('İ', 'İ')
    for k, t in TURLER:
        if k in a:
            return t
    return 'diger'


class Oda:
    def __init__(self, no, ad, alan_yazi, x, y):
        self.no, self.ad, self.alan_yazi, self.x, self.y = no, ad, alan_yazi, x, y
        self.tur = tur_bul(ad)
        self.maske = None
        self.alan = 0.0
        self.kontur = None          # [(x, y)] cm
        self.supheli = ''
        self.daire = None
        self.kapilar = []


class Kapi:
    def __init__(self, mentese, kilit, uc):
        self.mentese, self.kilit, self.uc = mentese, kilit, uc     # (x, y) cm
        mx, my = mentese; kx, ky = kilit
        self.genislik = math.hypot(kx - mx, ky - my)
        self.u = ((kx - mx) / self.genislik, (ky - my) / self.genislik)          # menteşeden kilide
        self.n = (-self.u[1], self.u[0])
        self.odalar = []          # [(oda, işaret)] işaret: n yönünde mi (+1) ters mi (-1)
        self.acilan = None        # kapının açıldığı oda


class Izgara:
    def __init__(self, kutu):
        self.x0, self.y0, x1, y1 = kutu
        self.g = int((x1 - self.x0) / PX) + 1
        self.h = int((y1 - self.y0) / PX) + 1

    def px(self, x, y):
        return int(round((x - self.x0) / PX)), int(round((y - self.y0) / PX))

    def cm(self, i, j):
        return self.x0 + i * PX, self.y0 + j * PX


def _kapi_cozumle(parca, yaylar):
    """Kapı bloğundan menteşe (yay merkezi), kilit tarafı ve kanat ucu (yayın kanada değen ucu)."""
    yay = [y for y in yaylar if 55 <= y[2] <= 140]
    if not yay:
        return None
    cx, cy, r, p0, p1 = max(yay, key=lambda y: y[2])
    uclar = [(x1, y1) for x1, y1, *_ in parca] + [(x2, y2) for _, _, x2, y2, _ in parca
                                                  if True]
    uzun = [p for p in parca if math.hypot(p[2] - p[0], p[3] - p[1]) >= 0.6 * r]
    def kanada_yakin(q):
        return min((min(math.hypot(q[0] - x1, q[1] - y1), math.hypot(q[0] - x2, q[1] - y2))
                    for x1, y1, x2, y2, _ in uzun), default=1e9)
    uc, kilit = (p0, p1) if kanada_yakin(p0) <= kanada_yakin(p1) else (p1, p0)
    return (cx, cy), kilit, uc


def bul(plan, kutu):
    iz = Izgara(kutu)
    duvar = np.zeros((iz.h, iz.g), np.uint8)
    for x1, y1, x2, y2, k in plan.cizgiler:
        if k in plan.kesikli or any(c in k.upper() for c in CIZME):
            continue
        cv2.line(duvar, iz.px(x1, y1), iz.px(x2, y2), 255, 2)
    duvar = cv2.dilate(duvar, np.ones((2, 2), np.uint8))
    pencere = np.zeros((iz.h, iz.g), np.uint8)
    for x1, y1, x2, y2, k in plan.cizgiler:
        ku = k.upper()
        if 'PENC' in ku or 'WINDOW' in ku or ku == 'CAM':
            cv2.line(pencere, iz.px(x1, y1), iz.px(x2, y2), 255, 1)
    iz.pencere_uzak = cv2.distanceTransform((pencere == 0).astype(np.uint8), cv2.DIST_L2, 5) * PX   # cm

    # oda adları
    odalar = []
    for x, y, s, k in plan.yazilar:
        m = re.match(r'^(.*?)\s*\n\s*A\s*=\s*([\d.,]+)', s, re.S)
        if not m:
            continue
        ad = re.sub(r'\s+', ' ', m.group(1)).strip()
        if 'MESKEN' in ad.upper() or 'MER.ASN' in ad.upper():
            continue
        odalar.append(Oda(len(odalar) + 1, ad, float(m.group(2).replace(',', '.')), x, y))

    etiket = np.zeros((iz.h, iz.g), np.int32)
    for o in odalar:
        i, j = iz.px(o.x, o.y)
        if not (0 <= i < iz.g and 0 <= j < iz.h):
            o.supheli = 'plan dışında'; continue
        if duvar[j, i]:                                   # yazı çizginin üstündeyse yakında boş nokta ara
            yak = [(abs(a) + abs(b), i + a, j + b) for a in range(-15, 16) for b in range(-15, 16)
                   if 0 <= i + a < iz.g and 0 <= j + b < iz.h and not duvar[j + b, i + a]]
            if not yak:
                o.supheli = 'boş yer yok'; continue
            _, i, j = min(yak)
        if etiket[j, i]:
            o.supheli = f'oda {etiket[j, i]} ile aynı alan'; continue
        maske = np.zeros((iz.h + 2, iz.g + 2), np.uint8)
        cv2.floodFill(duvar.copy(), maske, (i, j), 128, flags=4 | (255 << 8) | cv2.FLOODFILL_MASK_ONLY)
        m = maske[1:-1, 1:-1] > 0
        o.alan = cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8)).sum() * PX * PX / 1e4   # çizgi kalınlığı payı
        if m[0, :].any() or m[-1, :].any() or m[:, 0].any() or m[:, -1].any():
            o.supheli = 'oda kapanmıyor (dışarı taşıyor)'; continue
        if o.alan_yazi and abs(o.alan - o.alan_yazi) / o.alan_yazi > 0.15:
            o.supheli = f'alan farkı: bulunan {o.alan:.1f} m², yazan {o.alan_yazi:.1f} m²'
        etiket[m] = o.no
        o.maske = m
        kon, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        kon = max(kon, key=cv2.contourArea)
        kon = cv2.approxPolyDP(kon, 2.5, True)
        o.kontur = [iz.cm(int(p[0][0]), int(p[0][1])) for p in kon]

    # kapılar
    kapilar = []
    for ad, x, y, r, sx, sy, k, parca, yaylar in plan.bloklar:
        if 'KAP' not in ad.upper() and 'DOOR' not in ad.upper():
            continue
        c = _kapi_cozumle(parca, yaylar)
        if not c:
            continue
        kp = Kapi(*c)
        ox, oy = (kp.mentese[0] + kp.kilit[0]) / 2, (kp.mentese[1] + kp.kilit[1]) / 2
        for isaret in (1, -1):
            for d in range(20, 150, 10):          # açılış tarafında kanat-yay arasındaki çeyrek daireyi aşmak için uzağa kadar
                i, j = iz.px(ox + isaret * kp.n[0] * d, oy + isaret * kp.n[1] * d)
                if 0 <= i < iz.g and 0 <= j < iz.h and etiket[j, i]:
                    oda = next(o for o in odalar if o.no == etiket[j, i])
                    kp.odalar.append((oda, isaret)); oda.kapilar.append(kp)
                    break
        # kanat ucu hangi taraftaysa kapı o odaya açılır
        ux = (kp.uc[0] - ox) * kp.n[0] + (kp.uc[1] - oy) * kp.n[1]
        for oda, isaret in kp.odalar:
            if ux * isaret > 0:
                kp.acilan = oda
        kapilar.append(kp)

    # daireler: ortak alanlar dışındaki odalar kapılarla birbirine bağlanır
    komsu = {o.no: set() for o in odalar}
    for kp in kapilar:
        oo = [o for o, _ in kp.odalar if o.tur not in ORTAK]
        for a in oo:
            for b in oo:
                if a is not b:
                    komsu[a.no].add(b.no)
    no = 0
    for o in odalar:
        if o.tur in ORTAK or o.daire or o.maske is None:
            continue
        no += 1
        yigin = [o.no]
        while yigin:
            n = yigin.pop()
            oo = next(x for x in odalar if x.no == n)
            if oo.daire:
                continue
            oo.daire = no
            yigin.extend(komsu[n])
    return iz, duvar, etiket, odalar, kapilar
