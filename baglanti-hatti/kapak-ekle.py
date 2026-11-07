# Kullanıcının kapağını (KAPAK.dxf) şablondaki antetin yerine koyar.
#
# Kullanım (depo kökünden; sablon-olustur.py'den SONRA çalıştırılır):
#   python3 baglanti-hatti/kapak-ekle.py KAPAK.dxf baglanti-hatti/BHP-SABLON.dxf
# Gerekli: pip install ezdxf olefile pillow; ~/.fonts/arial.ttf, arialbd.ttf, times.ttf (yazı genişliği ölçümü için)
#
# Kapak, antet kutusuna (190 x 276 mm) yazılar bozulmadan, aynı oranda küçültülerek oturtulur. Kutuya sığsın diye
# yalnız boş yerler kısaltılır: imza kutusu, alttaki onay kutuları ve arsa satırı ile güç tablosu arasındaki boş şerit.
# Üstteki logo şeridi DWG'de gömülü resim (OLE); içinden logo çıkarılır, lacivert şerit + logo + iletişim bilgileri
# olarak baglanti-hatti/logo/agy-kapak.png yazılır ve DXF'e resim ({{LOGO}}) olarak bağlanır.
# Yazılar tek yazı tipine (Arial) çevrilir, hücresine ortalanır; her işte değişen değerlere yer tutucu konur.
import sys, os, io, struct, json
import ezdxf, olefile
from ezdxf import bbox
from ezdxf.enums import TextEntityAlignment as A
from ezdxf.fonts import fonts
from PIL import Image, ImageDraw, ImageFont

kapakDxf, sablon = sys.argv[1:3]
KOK = os.path.dirname(os.path.abspath(__file__))
LOGO_PNG = os.path.join(KOK, 'logo', 'agy-kapak.png')

# ---------- Şablonu oku (ilk iki satır: 999 / BHP {json}) ----------
ham = open(sablon, encoding='utf-8').read()
ust, bilgi_satir, govde = ham.split('\n', 2)
assert ust == '999' and bilgi_satir.startswith('BHP ')
bilgi = json.loads(bilgi_satir[4:])
d = ezdxf.read(io.StringIO(govde))
m = d.modelspace()
k = ezdxf.readfile(kapakDxf)
km = k.modelspace()

# ---------- Antet kutusu ve kapak sınırı ----------
KUTU = (-267.83, 5394.67, -78.14, 5670.91)                 # şablondaki antet çerçevesi
kb = bbox.extents(km.query('LINE LWPOLYLINE'))
KX0, KY0, KX1, KY1 = kb.extmin.x, kb.extmin.y, kb.extmax.x, kb.extmax.y
S = (KUTU[2] - KUTU[0]) / (KX1 - KX0)                      # ölçek (yaklaşık 1/5)
fazla = (KY1 - KY0) - (KUTU[3] - KUTU[1]) / S              # kısaltılacak yükseklik (kapak biriminde)

# ---------- Çizgiler: önce yakın koordinatlar birleştirilir (kapakta 0,5-1,5 birimlik kaymalar var) ----------
parcalar = []                                              # (x1, y1, x2, y2, dış çerçeve mi)
for e in km.query('LINE'):
    parcalar.append([e.dxf.start.x, e.dxf.start.y, e.dxf.end.x, e.dxf.end.y])
for e in km.query('LWPOLYLINE'):
    p = [(q[0], q[1]) for q in e.get_points('xy')]
    if e.closed: p.append(p[0])
    for a, b in zip(p, p[1:]): parcalar.append([a[0], a[1], b[0], b[1]])
parcalar = [s for s in parcalar if abs(s[0] - s[2]) > 0.01 or abs(s[1] - s[3]) > 0.01]


def topla(degerler, tol):
    v = sorted(degerler); gruplar = [[v[0]]]
    for x in v[1:]:
        if x - gruplar[-1][-1] <= tol: gruplar[-1].append(x)
        else: gruplar.append([x])
    harita = {}
    for g in gruplar:
        o = max(set(g), key=g.count) if len(g) > 2 else sum(g) / len(g)
        for x in g: harita[x] = o
    return harita


hx = topla([s[0] for s in parcalar] + [s[2] for s in parcalar], 1.7)
hy = topla([s[1] for s in parcalar] + [s[3] for s in parcalar], 1.7)
for s in parcalar: s[0], s[2], s[1], s[3] = hx[s[0]], hx[s[2]], hy[s[1]], hy[s[3]]
yatay = [s for s in parcalar if abs(s[1] - s[3]) < 0.01]
dikey = [s for s in parcalar if abs(s[0] - s[2]) < 0.01]
xs = sorted({s[0] for s in dikey})
ys = sorted({s[1] for s in yatay})
sol_ic, sag_ic = xs[1], xs[-2]                             # iç bölümlerin sol/sağ kenarı (dış çerçevenin içi)


def yakin(liste, v): return min(liste, key=lambda a: abs(a - v))


# arsa bilgileri (il..parsel) ile güç tablosu arasındaki boş şerit: kapakta iki bölümün kenar çizgileri birbirine
# taşıyor; arsa bölümü kendi alt çizgisinde, güç bölümü kendi üst çizgisinde biter.
ARSA_ALT = yakin(ys, 2363.0); GUC_UST = yakin(ys, 2305.8)
for s in dikey:
    lo, hi = sorted((s[1], s[3]))
    if s[0] in (sol_ic, sag_ic) and GUC_UST < lo < ARSA_ALT and hi > ARSA_ALT: lo = ARSA_ALT        # arsa kenarı
    if s[0] in (sol_ic, sag_ic) and GUC_UST < hi < ARSA_ALT and lo < GUC_UST: hi = GUC_UST          # güç kenarı
    s[1], s[3] = lo, hi
if not any(abs(s[1] - ARSA_ALT) < 0.01 and s[0] <= sol_ic + 1 and s[2] >= sag_ic - 1 for s in yatay):
    parcalar.append([sol_ic, ARSA_ALT, sag_ic, ARSA_ALT])

# ---------- Dikey sıkıştırma: boş yerler kısaltılır ----------
BOSLUK = 8.6                                               # bölümler arası olağan boşluk (kapaktaki gibi)
IMZA = (yakin(ys, 2633.1) + 15, yakin(ys, 2828.8) - 45)    # imza / EMO onay kutusunun boş kısmı
ONAY = (yakin(ys, 1806.8) + 15, yakin(ys, 2145.6) - 15)    # GDZ / YD / belediye onay kutularının boş kısmı
serit = (GUC_UST, ARSA_ALT, (ARSA_ALT - GUC_UST) - BOSLUK)
kalan = (fazla - serit[2]) / 2
bolgeler = sorted([serit, (IMZA[0], IMZA[1], kalan), (ONAY[0], ONAY[1], kalan)])


def Y(y):                                                  # kapak y → kısaltılmış y
    kay = 0.0
    for a, b, r in bolgeler:
        if y >= b: kay += r
        elif y > a: kay += r * (y - a) / (b - a)
    return y - kay


def P(x, y): return (KUTU[0] + (x - KX0) * S, KUTU[1] + (Y(y) - KY0) * S)


# ---------- Eski anteti sil ----------
def kut(e):
    b = bbox.extents([e])
    return (b.extmin.x, b.extmin.y, b.extmax.x, b.extmax.y) if b.has_data else None


n = 0
for e in list(m):
    b = kut(e)
    if not b: continue
    cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2           # ortası kutuda olan her şey (kenardan taşan yazılar dahil)
    if e.dxftype() in ('TEXT', 'MTEXT'): cx, cy = e.dxf.insert.x, e.dxf.insert.y   # MTEXT kutusu sütun genişliğinde: başlangıç noktası
    if KUTU[0] - 1.5 <= cx <= KUTU[2] and KUTU[1] - 1 <= cy <= KUTU[3] + 1.2 and (b[2] <= KUTU[2] + 15 or e.dxftype() == 'MTEXT') and b[3] <= KUTU[3] + 2:
        m.delete_entity(e); n += 1
print('eski antet silindi:', n)

LA = 'BHP-ANTET'
if LA not in d.layers: d.layers.add(LA, color=7, lineweight=25)
for x1, y1, x2, y2 in [s[:4] for s in parcalar]:
    dis = (x1 in (xs[0], xs[-1]) and x2 in (xs[0], xs[-1])) or (y1 in (ys[0], ys[-1]) and y2 in (ys[0], ys[-1]))
    m.add_line(P(x1, y1), P(x2, y2), dxfattribs={'layer': LA, 'lineweight': 50 if dis else 25})

# ---------- Yazılar ----------
_F = {}


def gen(t, h, ad):
    if (ad, h) not in _F: _F[(ad, h)] = fonts.make_font(ad, h)
    return _F[(ad, h)].text_width(t)


DUZ = {'ODA SICIL NO': 'ODA SİCİL NO', 'BURO TESCİL NO': 'BÜRO TESCİL NO'}
KALIN = {'ELEKTRİK BAĞLANTI HATTI PROJESİ', 'PROJE MÜELLİFİ', 'EMO ONAYI'}
yazilar = []
for e in km.query('TEXT'):
    t = DUZ.get(e.dxf.text.strip(), e.dxf.text.strip())
    if not t: continue
    h = e.dxf.height; x, y = e.dxf.insert.x, e.dxf.insert.y
    w = gen(t, h, 'times.ttf')                             # kapaktaki yazı tipi (Times New Roman)
    yazilar.append(dict(t=t, h=h, x=x, y=y, w=w, cx=x + w / 2, cy=y + h / 2))


def hucre(cx, cy):
    """yazının bulunduğu hücre: solundaki/sağındaki ilk dikey, altındaki/üstündeki ilk yatay çizgi"""
    sol = max([s[0] for s in dikey if s[0] < cx and min(s[1], s[3]) <= cy <= max(s[1], s[3])], default=KX0)
    sag = min([s[0] for s in dikey if s[0] > cx and min(s[1], s[3]) <= cy <= max(s[1], s[3])], default=KX1)
    alt = max([s[1] for s in yatay if s[1] < cy and min(s[0], s[2]) <= cx <= max(s[0], s[2])], default=KY0)
    ust = min([s[1] for s in yatay if s[1] > cy and min(s[0], s[2]) <= cx <= max(s[0], s[2])], default=KY1)
    return sol, alt, sag, ust


gruplar = {}
for z in yazilar:
    z['hc'] = hucre(z['cx'], z['cy'])
    gruplar.setdefault(z['hc'], []).append(z)
PAY = 6.0                                                  # hücre kenar payı (kapak biriminde)
for hc, grup in gruplar.items():
    sol, alt, sag, ust = hc
    grup.sort(key=lambda z: -z['y'])
    yuk = ust - alt
    buyuk_kutu = yuk > 4 * max(z['h'] for z in grup) * len(grup)    # imza kutusu gibi: yazı yerinde kalır
    # birden çok satırlı hücre (BAĞIMSIZ / BÖLÜM / ADEDİ): satırlar arası aynı, blok ortalanır
    blok_ust = max(z['y'] + z['h'] for z in grup); blok_alt = min(z['y'] for z in grup)
    kay = 0 if buyuk_kutu else ((alt + ust) / 2 - (blok_ust + blok_alt) / 2)
    for z in grup:
        # mühendis ve yapı bilgileri tablosunda etiketler/değerler sola dayalı; başlıklar ve sütun başlıkları ortalı
        ortali = z['t'] in KALIN or not (z['cy'] > yakin(ys, 2479.6) or (sag - sol) > 0.8 * (sag_ic - sol_ic))
        ad = 'arialbd.ttf' if z['t'] in KALIN else 'arial.ttf'
        h = z['h'] * S
        en = gen(z['t'], h, ad); yer = (sag - sol - 2 * PAY) * S
        gf = round(min(1.0, yer / en), 3) if en > 0 else 1.0
        yb = z['y'] + kay                                  # taban çizgisi (kapak biriminde)
        st = 'BHP-K' if ad == 'arialbd.ttf' else 'BHP'
        e = m.add_text(z['t'], height=round(h, 3), dxfattribs={'style': st, 'layer': LA, 'width': gf})
        if ortali: e.set_placement(P((sol + sag) / 2, yb), align=A.CENTER)
        else: e.set_placement(P(sol + PAY * 2, yb), align=A.LEFT)

# ---------- Yer tutucular (her işte doldurulur) ----------
def satir(y):                                              # y'yi içeren satırın alt/üst çizgisi
    return max(v for v in ys if v <= y), min(v for v in ys if v > y)


DEG_H = 2.8                                                # değer yazı yüksekliği (mm)


def deger(yt, x0, x1, y, sola=False, h=DEG_H):
    a, b = satir(y)
    ym = (a + b) / 2
    p = P(x0 + PAY * 2, ym) if sola else P((x0 + x1) / 2, ym)
    m.add_text(yt, height=h, dxfattribs={'style': 'BHP', 'layer': LA}).set_placement(p, align=A.MIDDLE_LEFT if sola else A.MIDDLE_CENTER)


etiket = {z['t']: z for z in yazilar}
DEG_X = yakin(xs, 4057.0)                                  # mal sahibi / kullanım / adres değer sütunu
for ad, yt in (('MAL SAHİBİ', '{{MALSAHIBI}}'), ('KULLANIM AMACI', '{{KULLANIM}}'), ('ADRES', '{{ADRES}}')):
    deger(yt, DEG_X, sag_ic, etiket[ad]['cy'], sola=True, h=DEG_H if ad != 'ADRES' else 2.4)
# il .. parsel: başlık satırının altındaki satır
il_y = (ys[ys.index(ARSA_ALT)] + ys[ys.index(ARSA_ALT) + 1]) / 2
kol = [sol_ic] + [x for x in xs if sol_ic < x < sag_ic and any(s[0] == x and min(s[1], s[3]) <= il_y <= max(s[1], s[3]) for s in dikey)] + [sag_ic]
for (x0, x1), yt in zip(zip(kol, kol[1:]), ('{{IL}}', '{{ILCE}}', '{{BELEDIYE}}', '{{MAHALLE}}', '{{PAFTA}}', '{{ADA}}', '{{PARSEL}}')):
    deger(yt, x0, x1, il_y, h=2.5)
# güç bilgileri: başlıkların altındaki satır
guc_y = (ys[ys.index(GUC_UST) - 2] + ys[ys.index(GUC_UST) - 3]) / 2
kol = [sol_ic] + [x for x in xs if sol_ic < x < sag_ic and any(s[0] == x and min(s[1], s[3]) <= guc_y <= max(s[1], s[3]) for s in dikey)] + [sag_ic]
for (x0, x1), yt in zip(zip(kol, kol[1:]), ('{{KURULUW}}', '{{TALEPW}}', '{{BB}}', '{{KAT}}', '{{ALAN}}', '{{YAPISINIFI}}')):
    deger(yt, x0, x1, guc_y, h=2.5)
assert len(kol) == 7, ('güç sütunları', kol)

# ---------- Logo şeridi: gömülü resimden logo çıkarılır ----------
ole = [e for e in km.query('OLE2FRAME') if len(e.binary_data()) > 1000][0]
ob = bbox.BoundingBox(ole.bbox())        # OLE çerçevesinin köşeleri
veri = ole.binary_data()
of = olefile.OleFileIO(veri[veri.find(b'\xd0\xcf\x11\xe0'):])
emf = of.openstream('CONTENTS').read()
png = None
i = emf.find(b' EMF') - 40                                 # EMF başlığı
obj = b''
while i + 8 <= len(emf):                                   # EMF+ yorum kayıtlarındaki resim nesnesi
    t, s = struct.unpack_from('<II', emf, i)
    if s < 8: break
    if t == 70 and emf[i + 12:i + 16] == b'EMF+':
        dd = emf[i + 12:i + s]; j = 4
        while j + 12 <= len(dd):
            pt, fl, sz, ds = struct.unpack_from('<HHII', dd, j)
            if sz < 12: break
            if pt == 0x4008 and (fl >> 8) & 0x7f == 5: obj += dd[j + 16:j + 12 + ds] if fl & 0x8000 else dd[j + 12:j + 12 + ds]
            j += sz
    i += s
a = obj.find(b'\x89PNG')
logo = Image.open(io.BytesIO(obj[a:obj.find(b'IEND', a) + 8])).convert('RGB')
# şerit: kapaktaki çerçeve oranında, lacivert zemin, logo ortada (gerçek oranında), iletişim bilgileri sağda
SW = 3600; SH = round(SW * (ob.extmax.y - ob.extmin.y) / (ob.extmax.x - ob.extmin.x))
zemin = logo.getpixel((5, 5))
serit_im = Image.new('RGB', (SW, SH), zemin)
lw = round(logo.width * SH / logo.height)
serit_im.paste(logo.resize((lw, SH), Image.LANCZOS), ((SW - lw) // 2, 0))
cz = ImageDraw.Draw(serit_im)
yaziF = ImageFont.truetype(os.path.expanduser('~/.fonts/arial.ttf'), 50)
x0 = round(SW * 0.735)
# iletişim bilgileri kapaktaki yazılardan (şeridin içindekiler, simge yazıları hariç), yukarıdan aşağı; uzun satır bölünür
ilet = []
for e in sorted(km.query('MTEXT'), key=lambda e: -e.dxf.insert.y):
    t = ' '.join(e.plain_text().split())
    if not (ob.extmin.x <= e.dxf.insert.x <= ob.extmax.x and ob.extmin.y <= e.dxf.insert.y <= ob.extmax.y): continue
    if not any(ch.isdigit() or ch == '@' or ch == '.' for ch in t) or 'Wingdings' in e.text and len(t) < 6: continue
    if t.replace(' ', '').isdigit(): t = 'Tel: ' + t
    sat = ''
    for w in t.split():
        if sat and yaziF.getlength(sat + ' ' + w) > SW - x0 - 60: ilet.append(sat); sat = w
        else: sat = (sat + ' ' + w).strip()
    ilet.append(sat)
print('iletişim:', ilet); ara = 74; y0 = (SH - ara * len(ilet)) // 2 + 10
cz.line([(x0 - 40, y0 - 10), (x0 - 40, y0 + ara * len(ilet) - 20)], fill=(205, 212, 225), width=3)
for n_, t in enumerate(ilet): cz.text((x0, y0 + n_ * ara), t, font=yaziF, fill=(225, 230, 238))
serit_im.save(LOGO_PNG, optimize=True)
print('logo şeridi:', LOGO_PNG, serit_im.size)
x0m, y0m = P(ob.extmin.x, ob.extmin.y); x1m, y1m = P(ob.extmax.x, ob.extmax.y)
tanim = d.add_image_def(filename='{{LOGO}}', size_in_pixel=(SW, SH), name='BHP-LOGO')
m.add_image(tanim, insert=(x0m, y0m), size_in_units=(x1m - x0m, y1m - y0m), rotation=0, dxfattribs={'layer': 'BHP-RESIM'})

# ---------- Kaydet ----------
d.audit()
cik = io.StringIO(); d.write(cik)
open(sablon, 'w', encoding='utf-8').write('999\n' + bilgi_satir + '\n' + cik.getvalue())
print('ölçek', round(S, 5), 'kısaltma', round(fazla, 1), 'kapak birimi; şablon yazıldı:', sablon)
