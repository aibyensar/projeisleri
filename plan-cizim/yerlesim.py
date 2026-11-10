"""Sembolleri odalara yerleştirir ve linyeleri kurar (kurallar: KURALLAR.md).

Girdi: oda.bul() çıktısı. Çıktı: Yerlesim (semboller, linyeler, uyarılar).
Sembol: dict(tur, x, y, aci (derece; sembolün +y ekseni odanın içine), oda, linye, guc)
"""
import math

import cv2
import numpy as np

import aydinlatma as AY
import guzergah as GZ
import oda as O

_IZ = None          # yerlestir() içinde kurulur (pencere uzaklığı için)

LAMBA_W, APLIK_W, PRIZ_W = 20, 20, 300          # kullanıcının projeleri: J-20W, C-20W, B-20W (LED)
AYDINLATMA_W_M2 = 12
CIHAZ_W = {'Ç': 2000, 'B': 2000, 'F': 2500, 'K': 300, 'KL': 2200}
EN_COK = {'aydinlatma': 9, 'priz': 7}


class Yerlesim:
    def __init__(self):
        self.semboller, self.linyeler, self.uyarilar = [], [], []

    def ekle(self, tur, x, y, aci, oda, **k):
        s = dict(tur=tur, x=x, y=y, aci=aci, oda=oda, **k)
        self.semboller.append(s)
        return s


# ---------------------------------------------------------------- geometri yardımcıları
def _kenarlar(o):
    """Oda konturunun kenarları: [(p1, p2, uzunluk, içe_normal)] (cm)."""
    k = o.kontur
    alan2 = sum(k[i][0] * k[(i + 1) % len(k)][1] - k[(i + 1) % len(k)][0] * k[i][1] for i in range(len(k)))
    ccw = alan2 > 0
    out = []
    for i in range(len(k)):
        (x1, y1), (x2, y2) = k[i], k[(i + 1) % len(k)]
        L = math.hypot(x2 - x1, y2 - y1)
        if L < 1:
            continue
        dx, dy = (x2 - x1) / L, (y2 - y1) / L
        n = (-dy, dx) if ccw else (dy, -dx)
        out.append(((x1, y1), (x2, y2), L, n))
    return out


def _aci(n):
    return math.degrees(math.atan2(n[1], n[0])) - 90


def _kapidan_uzak(o, x, y, mentese_pay=25, kilit_pay=40):
    for kp in o.kapilar:
        if math.hypot(x - kp.mentese[0], y - kp.mentese[1]) < kp.genislik + mentese_pay:
            return False
        if math.hypot(x - kp.kilit[0], y - kp.kilit[1]) < kilit_pay:
            return False
    return True


def _pencere_onu(x, y, pay=30):
    if _IZ is None or getattr(_IZ, 'pencere_uzak', None) is None:
        return False
    i, j = _IZ.px(x, y)
    if not (0 <= j < _IZ.pencere_uzak.shape[0] and 0 <= i < _IZ.pencere_uzak.shape[1]):
        return False
    return _IZ.pencere_uzak[j, i] < pay


def _duvar_adaylari(o, adim=20, kose=35, kenar_min=70):
    """Duvar boyunca priz konabilecek noktalar: [(x, y, içe_normal, kenar_no)]."""
    aday = []
    for no, (p1, p2, L, n) in enumerate(_kenarlar(o)):
        if L < kenar_min:
            continue
        t = kose
        while t <= L - kose:
            x = p1[0] + (p2[0] - p1[0]) * t / L
            y = p1[1] + (p2[1] - p1[1]) * t / L
            if _kapidan_uzak(o, x, y) and not _pencere_onu(x, y):
                aday.append((x, y, n, no))
            t += adim
    return aday


def _ic_duvar_mi(o, a, odalar):
    """Aday noktanın duvarının arkasında başka bir oda var mı (iç duvar)?"""
    x, y, n, _ = a
    for d in range(10, 60, 4):
        i, j = _IZ.px(x - n[0] * d, y - n[1] * d)
        for b in odalar:
            if b is not o and b.maske is not None and 0 <= j < b.maske.shape[0] and 0 <= i < b.maske.shape[1] and b.maske[j, i]:
                return True
    return False


def _duvarda_topla(o, aday, adet, odalar, aralik=45):
    """Kullanıcının düzeni: prizler bir iç duvarda (tercihen kapıya yakın) toplanır; sığmazsa sonraki duvar."""
    if not aday or adet <= 0:
        return []
    kenarlar = {}
    for a in aday:
        kenarlar.setdefault(a[3], []).append(a)
    kapi = o.kapilar[0].kilit if o.kapilar else (o.x, o.y)
    def puan(k):
        aa = kenarlar[k]
        ic = _ic_duvar_mi(o, aa[len(aa) // 2], odalar)
        uzak = min(math.hypot(a[0] - kapi[0], a[1] - kapi[1]) for a in aa)
        return (0 if ic else 400) + uzak - 2 * len(aa)
    secim = []
    for k in sorted(kenarlar, key=puan):
        aa = kenarlar[k]
        while len(secim) < adet:
            uygun = [a for a in aa if all(math.hypot(a[0] - s[0], a[1] - s[1]) >= aralik for s in secim)]
            if not uygun:
                break
            # kenar boyunca eşit dağılsın: seçilmişlere en uzak, ilk seçimde kenarın ortası
            if not any(s[3] == k for s in secim):
                secim.append(uygun[len(uygun) // 2] if adet - len(secim) == 1 else uygun[len(uygun) // 4])
            else:
                secim.append(max(uygun, key=lambda a: min(math.hypot(a[0] - s[0], a[1] - s[1]) for s in secim if s[3] == k)))
        if len(secim) >= adet:
            break
    return secim


def _yayil(aday, adet, bas=None):
    """Adaylardan birbirine en uzak 'adet' tane seçer (ilk: en uzun kenarın ortası ya da 'bas'a en yakın)."""
    if not aday or adet <= 0:
        return []
    if bas is None:
        say = {}
        for a in aday:
            say[a[3]] = say.get(a[3], 0) + 1
        en = max(say, key=say.get)
        kenar = [a for a in aday if a[3] == en]
        secim = [kenar[len(kenar) // 2]]
    else:
        secim = [min(aday, key=lambda a: math.hypot(a[0] - bas[0], a[1] - bas[1]))]
    while len(secim) < adet:
        kalan = [a for a in aday if a not in secim]
        if not kalan:
            break
        secim.append(max(kalan, key=lambda a: min(math.hypot(a[0] - s[0], a[1] - s[1]) for s in secim)))
    return secim


def _lamba_yerleri(o, iz, adet):
    jj, ii = np.nonzero(o.maske)
    if adet <= 1 or len(ii) < 50:
        cx, cy = ii.mean(), jj.mean()
        merk = [(cx, cy)]
    else:
        pts = np.stack([ii, jj], 1).astype(np.float32)
        _, _, c = cv2.kmeans(pts, adet, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5), 3, cv2.KMEANS_PP_CENTERS)
        merk = [tuple(m) for m in c]
    uzaklik = cv2.distanceTransform(o.maske.astype(np.uint8), cv2.DIST_L2, 5)
    out = []
    for cx, cy in merk:
        i, j = int(round(cx)), int(round(cy))
        if not (0 <= j < o.maske.shape[0] and 0 <= i < o.maske.shape[1]) or uzaklik[j, i] < 15:
            # oda dışına ya da duvara yakın düştü: en yakın iç noktaya çek
            yak = np.argwhere(uzaklik >= min(15, uzaklik.max() * 0.8))
            d = (yak[:, 1] - cx) ** 2 + (yak[:, 0] - cy) ** 2
            j, i = yak[int(d.argmin())]
        out.append(iz.cm(int(i), int(j)))
    return out


def _duvara_otur(iz, maske, x, y, n_tahmin, en_cok=60):
    """(x, y)'den n yönünde/tersinde ilerleyip odanın duvar yüzündeki ilk iç noktayı bulur → (x, y, içe_normal)."""
    for d in range(0, en_cok, 2):
        for s in (1, -1):
            px, py = x + s * n_tahmin[0] * d, y + s * n_tahmin[1] * d
            i, j = iz.px(px, py)
            if 0 <= j < maske.shape[0] and 0 <= i < maske.shape[1] and maske[j, i]:
                return px, py, (s * n_tahmin[0], s * n_tahmin[1])
    return None


# ---------------------------------------------------------------- odalar
LAMBA_SAYISI = {'salon': lambda a: 1 if a <= 20 else 2, 'salon_mutfak': lambda a: 2, 'hol': lambda a: 1 if a <= 6 else 2}
PRIZ_SAYISI = {'salon': 3, 'salon_mutfak': 4, 'oda': 2, 'mutfak': 4, 'hol': 1, 'banyo': 1}
DISARIDAN = {'banyo', 'wc', 'kiler', 'balkon'}        # anahtarı kapının dışında olan odalar


def yerlestir(iz, odalar, kapilar, plan):
    global _IZ
    _IZ = iz
    Y = Yerlesim()
    daireler = sorted({o.daire for o in odalar if o.daire})
    # kapısı bulunamayan oda: duvar ötesindeki en çok temas ettiği daireye
    for o in odalar:
        if o.maske is not None and o.tur not in O.ORTAK and not o.kapilar:
            genis = cv2.dilate(o.maske.astype(np.uint8), np.ones((25, 25), np.uint8)) > 0
            temas = {}
            for b in odalar:
                if b is not o and b.daire and b.maske is not None and b.kapilar:
                    temas[b.daire] = temas.get(b.daire, 0) + int((genis & b.maske).sum())
            if temas:
                o.daire = max(temas, key=temas.get)
                Y.uyarilar.append(f'{o.ad}: kapısı bulunamadı, {o.daire}. daireye bağlandı (anahtar yeri elle kontrol edilmeli)')
    daireler = sorted({o.daire for o in odalar if o.daire})
    for d in daireler:
        dod = [o for o in odalar if o.daire == d and o.maske is not None]
        _daire(Y, iz, d, dod, odalar, plan)
    return Y


def _anahtar(Y, iz, o, lambalar, dod=()):
    """Odanın ana kapısının kilit tarafına anahtar (banyo/WC/kiler/balkonda dışarıya)."""
    if o.tur == 'hol':
        Y.bekleyen_hol = (o, lambalar)                 # hol anahtarı tablo (giriş) yanına, tablo kurulunca
        return
    if not o.kapilar:
        # kapısı bulunamadı: holün bu odaya en yakın duvarına (elle kontrol)
        hol = next((b for b in dod if b.tur == 'hol'), None)
        if hol and lambalar:
            l = lambalar[0]
            a = _yayil(_duvar_adaylari(hol, kose=20, kenar_min=40), 1, bas=(l['x'], l['y']))
            if a:
                s = Y.ekle('anahtar', a[0][0], a[0][1], _aci(a[0][2]), hol, daire=o.daire, bagli=lambalar)
                for l in lambalar:
                    l['anahtar'] = s
        return
    kp = o.kapilar[0]
    if o.tur == 'balkon':
        kp = next((k for k in o.kapilar if any(b.tur in ('mutfak', 'salon', 'salon_mutfak') for b, _ in k.odalar)), kp)
    hedef = o
    if o.tur in DISARIDAN:
        hedef = next((b for b, _ in kp.odalar if b is not o), o)
    yer = None
    for (bx, by), yon, d in ((kp.kilit, 1, 18), (kp.kilit, 1, 35), (kp.mentese, -1, 18), (kp.mentese, -1, 35)):
        yer = _duvara_otur(iz, hedef.maske, bx + yon * kp.u[0] * d, by + yon * kp.u[1] * d, kp.n, en_cok=80)
        if yer:
            break
    if not yer:
        Y.uyarilar.append(f'{o.ad}: anahtar yeri bulunamadı'); return
    tur = 'etanj_anahtar' if o.tur == 'balkon' and hedef is o else ('vavien' if len(lambalar) > 1 and o.tur == 'hol' else 'anahtar')
    s = Y.ekle(tur, yer[0], yer[1], _aci(yer[2]), hedef, daire=o.daire, bagli=lambalar)
    for l in lambalar:
        l['anahtar'] = s


def _daire(Y, iz, d, dod, odalar, plan):
    tum_odalar = odalar
    tum = []
    for o in dod:
        lam = []
        alan = o.alan_yazi or o.alan
        # aydınlatma hesabı (lümen yöntemi): armatür sayısı ve gücü
        jj, ii = np.nonzero(o.maske)
        (_, _), (ra, rb), _ = cv2.minAreaRect(np.stack([ii, jj], 1).astype(np.float32))
        oa, ob = ra * O.PX / 100, rb * O.PX / 100
        adet0 = LAMBA_SAYISI.get(o.tur, lambda a: 1)(alan) if o.tur not in ('banyo', 'wc', 'balkon') else 1
        o.aydinlatma = AY.hesapla(o.tur, alan, oa, ob, adet0)
        if o.tur in ('salon', 'salon_mutfak', 'oda', 'mutfak', 'hol', 'kiler', 'isyeri', 'diger'):
            adet = o.aydinlatma['adet']
            for x, y in _lamba_yerleri(o, iz, adet):
                lam.append(Y.ekle('lamba', x, y, 0, o, daire=d, guc=LAMBA_W))
        elif o.tur in ('banyo', 'wc'):
            x, y = _lamba_yerleri(o, iz, 1)[0]
            lam.append(Y.ekle('etanj_lamba', x, y, 0, o, daire=d, guc=LAMBA_W))
        elif o.tur == 'balkon':
            kp = next((k for k in o.kapilar), None)
            if kp:
                yer = _duvara_otur(iz, o.maske, kp.kilit[0] + kp.u[0] * 35, kp.kilit[1] + kp.u[1] * 35, kp.n)
                if yer:
                    lam.append(Y.ekle('etanj_aplik', yer[0], yer[1], _aci(yer[2]), o, daire=d, guc=APLIK_W))
        # armatür gücü aydınlatma hesabından (yönetmelik: hesap yapılan binada güç hesaptan gelir)
        for l in lam:
            l['guc'] = o.aydinlatma['guc']
        _anahtar(Y, iz, o, lam, dod)
        tum += lam

        # prizler
        aday = _duvar_adaylari(o)
        if o.tur == 'banyo':
            secim = _yayil(aday, 2)
            if secim:
                x, y, n, _ = secim[0]
                ap = Y.ekle('aplik', x, y, _aci(n), o, daire=d, guc=APLIK_W)       # ayna apliği (lavabo üstü)
                ap['anahtar'] = lam[0].get('anahtar') if lam else None
                tum.append(ap)
                yer = _yayil([a for a in aday if 30 <= math.hypot(a[0] - x, a[1] - y) <= 60], 1)
                if yer:
                    Y.ekle('etanj_priz', yer[0][0], yer[0][1], _aci(yer[0][2]), o, daire=d, guc=PRIZ_W, sinif='priz')
            if len(secim) > 1 and o is max((b for b in dod if b.tur == 'banyo'), key=lambda b: b.alan):
                x, y, n, _ = secim[1]
                Y.ekle('cihaz_Ç', x, y, _aci(n), o, daire=d, guc=CIHAZ_W['Ç'], sinif='cihaz', harf='Ç')
        elif o.tur in ('mutfak', 'salon_mutfak'):
            tezgah = _tezgah_adaylari(o, aday, plan)
            pr = _yayil(tezgah, 3) if len(tezgah) >= 3 else _yayil(aday, 3)
            for x, y, n, _ in pr:
                Y.ekle('priz', x, y, _aci(n), o, daire=d, guc=PRIZ_W, sinif='priz')
            kalan = [a for a in aday if all(math.hypot(a[0] - p[0], a[1] - p[1]) > 60 for p in pr)]
            for harf, tur in (('B', 'cihaz_B'), ('F', 'cihaz_F')):
                s = _yayil([a for a in kalan if a in tezgah] or kalan, 1)
                if s:
                    x, y, n, _ = s[0]
                    Y.ekle(tur, x, y, _aci(n), o, daire=d, guc=CIHAZ_W[harf], sinif='cihaz', harf=harf)
                    kalan = [a for a in kalan if math.hypot(a[0] - x, a[1] - y) > 60]
            s = _yayil(kalan, 1)
            if s:                                  # buzdolabı
                x, y, n, _ = s[0]
                Y.ekle('priz', x, y, _aci(n), o, daire=d, guc=PRIZ_W, sinif='priz', not_='buzdolabı')
        elif o.tur in PRIZ_SAYISI:
            secilen = _duvarda_topla(o, aday, PRIZ_SAYISI[o.tur], odalar)
            for x, y, n, _ in secilen:
                Y.ekle('priz', x, y, _aci(n), o, daire=d, guc=PRIZ_W, sinif='priz')
            if o.tur in ('salon', 'salon_mutfak'):           # klima (kullanıcının projelerinde salonda 2200 W)
                kalan = [a for a in aday if all(math.hypot(a[0] - p[0], a[1] - p[1]) > 80 for p in secilen)]
                k = _yayil([a for a in kalan if a[3] not in {p[3] for p in secilen}] or kalan, 1)
                if k:
                    Y.ekle('cihaz_KL', k[0][0], k[0][1], _aci(k[0][2]), o, daire=d, guc=CIHAZ_W['KL'], sinif='cihaz', harf='KL')
            if o.tur in ('salon', 'salon_mutfak'):
                p = [s for s in Y.semboller if s['oda'] is o and s['tur'] == 'priz']
                if p:
                    tv = _yayil([a for a in aday if 35 <= math.hypot(a[0] - p[0]['x'], a[1] - p[0]['y']) <= 60], 1)
                    if tv:
                        Y.ekle('tv', tv[0][0], tv[0][1], _aci(tv[0][2]), o, daire=d, sinif='zayif')

    # kombi: "KOMBİ" yazısının yanındaki duvar
    for x, y, s, k in plan.yazilar:
        if 'KOMB' in s.upper():
            i, j = iz.px(x, y)
            o = next((b for b in dod if 0 <= j < b.maske.shape[0] and 0 <= i < b.maske.shape[1] and
                      cv2.dilate(b.maske.astype(np.uint8), np.ones((31, 31), np.uint8))[j, i]), None)
            if o:
                a = _yayil(_duvar_adaylari(o, kose=20), 1, bas=(x, y))
                if a:
                    Y.ekle('cihaz_K', a[0][0], a[0][1], _aci(a[0][2]), o, daire=d, guc=CIHAZ_W['K'], sinif='cihaz', harf='K')

    _tablo_ve_linye(Y, iz, d, dod, odalar, tum)


def _tezgah_adaylari(o, aday, plan):
    """Eviye / tezgah (tefriş) çizgilerine 70 cm'den yakın duvar noktaları."""
    tef = []
    for ad, x, y, *_ in plan.bloklar:
        if any(k in ad.upper() for k in ('SINK', 'EVİYE', 'EVIYE', 'OCAK', 'COOK')):
            tef.append((x, y))
    for x1, y1, x2, y2, k in plan.cizgiler:
        if 'TEFR' in k.upper():
            tef.append(((x1 + x2) / 2, (y1 + y2) / 2))
    if not tef:
        return []
    return [a for a in aday if min(math.hypot(a[0] - t[0], a[1] - t[1]) for t in tef) < 70]


def _tablo_ve_linye(Y, iz, d, dod, odalar, isiklar):
    hol = next((o for o in dod if o.tur == 'hol'), None) or max(dod, key=lambda o: o.alan)
    # daire girişi: holün kat holüne / merdivene en yakın duvarı
    ortak = [o for o in odalar if o.tur in O.ORTAK and o.maske is not None and o.tur == 'ortak']
    aday = _duvar_adaylari(hol, kose=25, kenar_min=50)
    if ortak and aday:
        om = ortak[0].maske
        jj, ii = np.nonzero(om)
        oc = iz.cm(int(ii.mean()), int(jj.mean()))
        t = min(aday, key=lambda a: math.hypot(a[0] - oc[0], a[1] - oc[1]))
    elif aday:
        t = aday[0]
    else:
        Y.uyarilar.append(f'{d}. daire: tablo yeri bulunamadı'); return
    tablo = Y.ekle('tablo', t[0], t[1], _aci(t[2]), hol, daire=d)
    bh = getattr(Y, 'bekleyen_hol', None)
    if bh and bh[0] is hol and bh[1]:
        a = [x for x in aday if 35 <= math.hypot(x[0] - t[0], x[1] - t[1]) <= 70] or aday
        a = min(a, key=lambda x: abs(math.hypot(x[0] - t[0], x[1] - t[1]) - 45))
        sw = Y.ekle('vavien' if len(bh[1]) > 1 else 'anahtar', a[0], a[1], _aci(a[2]), hol, daire=d, bagli=bh[1])
        for l in bh[1]:
            l['anahtar'] = sw

    gz = GZ.Izgara(iz, odalar, list({id(k): k for o in dod for k in o.kapilar}.values()), dod)
    def ic(sb, d=12):
        a = math.radians(sb['aci'])
        return sb['x'] - math.sin(a) * d, sb['y'] + math.cos(a) * d       # sembolün +y yönü (odanın içi)
    tp = ic(tablo, 18)

    def oda_sirasi(liste):
        return sorted({id(s['oda']): s['oda'] for s in liste}.values(),
                      key=lambda o: math.hypot(o.x - tablo['x'], o.y - tablo['y']))

    def grupla(liste, en_cok, en_az=1):
        """Oda oda gruplar (bir odanın sortileri bölünmez), tablodan yakından uzağa."""
        odalar_ = oda_sirasi(liste)
        k = max(en_az, math.ceil(len(liste) / en_cok))
        hedef = math.ceil(len(liste) / k)
        gruplar, g = [], []
        for o in odalar_:
            ss = [s for s in liste if s['oda'] is o]
            if g and (len(g) + len(ss) > en_cok or (len(g) >= hedef and len(gruplar) < k - 1)):
                gruplar.append(g); g = []
            g += ss
        if g:
            gruplar.append(g)
        return gruplar

    no = 0
    istek = []
    for grup in grupla(isiklar, EN_COK['aydinlatma'], en_az=2):
        no += 1
        L = dict(daire=d, ad=f'L{no}', sinif='aydinlatma', sira=grup, tablo=tablo, cizgiler=[], duz=[],
                 guc=sum(s['guc'] for s in grup), sigorta='10 A', kablo='3x2,5 mm² NYA')
        anahtarlar = {id(s['anahtar']): s['anahtar'] for s in grup if s.get('anahtar')}
        for sw in anahtarlar.values():
            b = ic(sw, 14)
            istek.append((L, b, [b]))
            for s in grup:
                if s.get('anahtar') is sw:
                    L['duz'].append((b, (s['x'], s['y'])))
        for s in grup:
            if not s.get('anahtar'):
                istek.append((L, (s['x'], s['y']), [(s['x'], s['y'])]))
        Y.linyeler.append(L)
    prizler = [s for s in Y.semboller if s.get('daire') == d and s.get('sinif') == 'priz']
    for grup in grupla(prizler, EN_COK['priz']):
        no += 1
        L = dict(daire=d, ad=f'L{no}', sinif='priz', sira=grup, tablo=tablo, cizgiler=[], duz=[],
                 guc=sum(s['guc'] for s in grup), sigorta='16 A', kablo='3x2,5 mm² NYA')
        for o in oda_sirasi(grup):
            pp = [s for s in grup if s['oda'] is o]
            r = GZ.priz_hatti(o, iz, pp)
            if not r:
                continue
            ana, baglar = r
            uc = min((ana[0], ana[-1]), key=lambda q: math.hypot(q[0] - tp[0], q[1] - tp[1]))
            istek.append((L, uc, [uc]))
            L['cizgiler'].append(ana)
            for p, q in baglar:
                L['duz'].append(((p['x'], p['y']), q))
        Y.linyeler.append(L)
    for s in [s for s in Y.semboller if s.get('daire') == d and s.get('sinif') == 'cihaz']:
        no += 1
        b = ic(s, 15)
        L = dict(daire=d, ad=f'L{no}', sinif='cihaz', sira=[s], tablo=tablo, cizgiler=[], duz=[(b, (s['x'], s['y']))],
                 guc=s['guc'], sigorta='16 A', kablo='3x2,5 mm² NYA', harf=s['harf'])
        istek.append((L, b, [b]))
        Y.linyeler.append(L)
    # uzaktaki hedefler önce: duvar dibindeki şeridi uzun hatlar alır, kısalar yanına dizilir (kesişme azalır)
    for L, hedef, ek in sorted(istek, key=lambda r: -math.hypot(r[1][0] - tp[0], r[1][1] - tp[1])):
        yol = gz.yol(tp, hedef)
        if yol:
            L['cizgiler'].insert(0, yol + ek)
    for l in Y.linyeler:
        if l['daire'] == d:
            for s in l['sira']:
                s['linye'] = l['ad']
