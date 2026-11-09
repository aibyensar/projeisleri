"""İç tesisat plan sembolleri (taslak 1).

Esas: TS EN 60617 / IEC 60617 (kurulum planı sembolleri) ve Türkiye'de yaygın gösterim.
Birim: santimetre (plan 1/50 çizilir; 10 cm = kâğıtta 2 mm).
Duvara takılan sembollerde (priz, anahtar, aplik) yerel eksen: başlangıç noktası duvar yüzü, +y odanın içine doğru.
Tavan sembollerinde başlangıç noktası sembolün ortası.

Her sembol bir çizim listesi döndürür:
  ('cizgi', x1, y1, x2, y2) · ('daire', x, y, r) · ('yay', x, y, r, a0, a1)  (derece, saat yönü tersine)
  ('dolu', [(x, y), …]) çokgen dolgu · ('yazi', x, y, yukseklik, metin)
"""
import math

R = 10          # tavan armatürü yarıçapı (20 cm = kâğıtta 4 mm)


def _x(cx, cy, r):
    k = r * math.cos(math.radians(45))
    return [('cizgi', cx - k, cy - k, cx + k, cy + k), ('cizgi', cx - k, cy + k, cx + k, cy - k)]


def _yarim_daire_dolu(cx, cy, r, n=16):
    return ('dolu', [(cx + r * math.cos(math.pi * i / n), cy + r * math.sin(math.pi * i / n)) for i in range(n + 1)])


# ---------------------------------------------------------------- aydınlatma
def lamba():
    return [('daire', 0, 0, R)] + _x(0, 0, R)


def etanj_lamba():
    return lamba() + [('daire', 0, 0, R + 3)]


def aplik(etanj=False):
    r = 8
    s = [('cizgi', 0, 0, 0, 6), ('daire', 0, 6 + r, r)] + _x(0, 6 + r, r)
    return s + ([('daire', 0, 6 + r, r + 2.5)] if etanj else [])


def led_panel():
    return [('cizgi', -20, -5, 20, -5), ('cizgi', 20, -5, 20, 5), ('cizgi', 20, 5, -20, 5), ('cizgi', -20, 5, -20, -5),
            ('cizgi', -20, 0, 20, 0)]


def acil_lamba():
    n = 16
    return lamba() + [('dolu', [(R * math.cos(math.pi + math.pi * i / n), R * math.sin(math.pi + math.pi * i / n)) for i in range(n + 1)])]


# ---------------------------------------------------------------- anahtarlar (duvarda)
def _kol(cx, cy, aci, boy=13, tik=4, cift_tik=False):
    a = math.radians(aci)
    x1, y1 = cx + 3 * math.cos(a), cy + 3 * math.sin(a)
    x2, y2 = cx + boy * math.cos(a), cy + boy * math.sin(a)
    t = math.radians(aci - 90)
    s = [('cizgi', x1, y1, x2, y2), ('cizgi', x2, y2, x2 + tik * math.cos(t), y2 + tik * math.sin(t))]
    if cift_tik:
        x3, y3 = cx + (boy - 4) * math.cos(a), cy + (boy - 4) * math.sin(a)
        s.append(('cizgi', x3, y3, x3 + tik * math.cos(t), y3 + tik * math.sin(t)))
    return s


def anahtar():
    return [('cizgi', 0, 0, 0, 5), ('daire', 0, 8, 3)] + _kol(0, 8, 45)


def komutator():
    return [('cizgi', 0, 0, 0, 5), ('daire', 0, 8, 3)] + _kol(0, 8, 35) + _kol(0, 8, 70)


def vavien():
    return [('cizgi', 0, 0, 0, 5), ('daire', 0, 8, 3)] + _kol(0, 8, 45) + _kol(0, 8, 225)


def etanj_anahtar():
    return [('cizgi', 0, 0, 0, 5), ('dolu', [(3 * math.cos(math.pi * i / 8), 8 + 3 * math.sin(math.pi * i / 8)) for i in range(16)])] + _kol(0, 8, 45)


def zil_butonu():
    return [('cizgi', 0, 0, 0, 4), ('daire', 0, 8, 4), ('dolu', [(1.2 * math.cos(math.pi * i / 4), 8 + 1.2 * math.sin(math.pi * i / 4)) for i in range(8)])]


# ---------------------------------------------------------------- prizler (duvarda)
def _priz_govde(r=8, y0=4):
    return [('cizgi', 0, 0, 0, y0), ('cizgi', -r, y0, r, y0), ('yay', 0, y0, r, 0, 180)]


def priz():
    """Topraklı priz (konutta bütün prizler topraklı)."""
    return _priz_govde() + [('cizgi', -6, 12, 6, 12)]


def cift_priz():
    return priz() + [('yazi', 9, 4, 6, '2')]


def etanj_priz():
    return [('cizgi', 0, 0, 0, 4), _yarim_daire_dolu(0, 4, 8), ('cizgi', -6, 12, 6, 12)]


def trifaze_priz():
    s = _priz_govde()
    for dx in (-4, 0, 4):
        s.append(('cizgi', dx - 1.5, 12.5, dx + 1.5, 17))
    return s


def cihaz_prizi(harf):
    """Ayrı linyeli cihaz prizi: Ç çamaşır, B bulaşık, F fırın, O ocak, K kombi, KL klima, L lift."""
    return priz() + [('yazi', 9, 4, 6, harf)]


def tv_prizi():
    return _priz_govde() + [('yazi', 9, 4, 6, 'TV')]


def data_prizi():
    return _priz_govde() + [('yazi', 9, 4, 6, 'D')]


# ---------------------------------------------------------------- tablo, buat, diafon
def daire_tablosu():
    return [('cizgi', -20, 0, 20, 0), ('cizgi', 20, 0, 20, 14), ('cizgi', 20, 14, -20, 14), ('cizgi', -20, 14, -20, 0),
            ('dolu', [(-20, 0), (20, 0), (20, 7), (-20, 7)])]


def buat():
    return [('daire', 0, 0, 3)]


def diafon():
    return [('cizgi', 0, 0, 0, 3), ('cizgi', -6, 3, 6, 3), ('cizgi', 6, 3, 6, 15), ('cizgi', 6, 15, -6, 15), ('cizgi', -6, 15, -6, 3),
            ('yazi', -4.5, 6.5, 5, 'DF')]


def linye_ornegi(iletken=3, boy=60):
    s = [('cizgi', -boy / 2, 0, boy / 2, 0)]
    for i in range(iletken):
        x = -3 * (iletken - 1) / 2 + 3 * i
        s.append(('cizgi', x - 2, -3, x + 2, 3))
    return s


LISTE = [
    ('Aydınlatma', [
        ('Tavan armatürü', lamba), ('Etanj tavan armatürü (IP44)', etanj_lamba), ('Aplik (duvar armatürü)', aplik),
        ('Etanj aplik', lambda: aplik(True)), ('LED panel / floresan', led_panel), ('Acil aydınlatma armatürü', acil_lamba)]),
    ('Anahtar', [
        ('Adi anahtar', anahtar), ('Komütatör', komutator), ('Vavien anahtar', vavien),
        ('Etanj anahtar', etanj_anahtar), ('Zil butonu', zil_butonu)]),
    ('Priz', [
        ('Topraklı priz', priz), ('Çift topraklı priz', cift_priz), ('Etanj topraklı priz', etanj_priz),
        ('Trifaze priz', trifaze_priz), ('Çamaşır mak. prizi (ayrı linye)', lambda: cihaz_prizi('Ç')),
        ('Bulaşık mak. prizi (ayrı linye)', lambda: cihaz_prizi('B')), ('Fırın prizi (ayrı linye)', lambda: cihaz_prizi('F')),
        ('Kombi prizi (ayrı linye)', lambda: cihaz_prizi('K')), ('Klima prizi (ayrı linye)', lambda: cihaz_prizi('KL')),
        ('TV prizi', tv_prizi), ('Data / internet prizi', data_prizi)]),
    ('Tablo ve diğer', [
        ('Daire tablosu', daire_tablosu), ('Buat', buat), ('Diafon', diafon), ('Linye (3 iletkenli)', linye_ornegi)]),
]
