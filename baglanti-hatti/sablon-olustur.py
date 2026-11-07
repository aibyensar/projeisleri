# Bağlantı hattı projesi (BHP) şablonu — 3. sürüm (düzenli pafta).
#
# Kullanım (depo kökünden):
#   python3 baglanti-hatti/sablon-olustur.py <direkli-proje.dxf> <boxlu-proje.dxf> <kapak.json> <logo.png> <cikis.dxf>
#   kapak.json: kullanıcının KAPAK.dwg dosyasının libredwg-web ile okunmuş hali (baglanti-hatti/araclar/dwg-oku.mjs)
#
# Pafta: kullanıcının paftasıyla aynı kâğıt (954 x 900 mm), antet (kapak) sol altta.
# Pafta 1: numaralı çerçeveli bölümler; Pafta 2: TEDAŞ kablo döşeme usul ve esasları (kullanıcının metni, aynen).
# Sabit kısımlar burada çizilir; her işte değişenleri (tek hat, hesap, güç dağılım, malzeme, notlar, vaziyet
# işaretleri) web aracı ortak/bhp-cizim.js ile bu dosyanın başındaki 999 açıklamasında yazan bölgelere çizer.
import sys, json, math, ezdxf
from ezdxf import bbox
from ezdxf.addons import Importer
from ezdxf.enums import TextEntityAlignment as A
from ezdxf.math import Matrix44

kaynak, kaynakBox, kapakJson, logoPng, cikis = sys.argv[1:6]
from PIL import Image
LOGO_PX = Image.open(logoPng).size

d = ezdxf.new('R2018', setup=False, units=4)
m = d.modelspace()
d.header['$LTSCALE'] = 1.0
d.header['$PSLTSCALE'] = 0

# ---------- Yazı stilleri ve katmanlar (siyah baskı, tek yazı tipi) ----------
d.styles.add('BHP', font='arial.ttf')
d.styles.add('BHP-K', font='arialbd.ttf')
KAT = {  # ad: (renk, çizgi kalınlığı 1/100 mm)
    'BHP-CERCEVE': (7, 70), 'BHP-BOLUM': (7, 35), 'BHP-BASLIK': (7, 25), 'BHP': (7, 25), 'BHP-YAZI': (7, 18),
    'BHP-SEMBOL': (7, 35), 'BHP-KABLO': (1, 50), 'BHP-DOLGU': (254, 0), 'BHP-RESIM': (7, 13), 'BHP-PARSEL': (1, 50),
    'BHP-DETAY': (7, 18), 'BHP-DETAY-DIREK': (7, 18), 'BHP-DETAY-BOX': (7, 18), 'BHP-ANTET': (7, 25), 'BHP-VAZIYET': (1, 35),
}
for ad, (renk, lw) in KAT.items():
    d.layers.add(ad, color=renk, lineweight=lw)
for lt, desen in (('DASHED', [4.0, 2.5, -1.5]), ('HIDDEN', [1.5, 0.75, -0.75])):
    if lt not in d.linetypes: d.linetypes.add(lt, pattern=desen, description=lt)

def yazi(t, x, y, h=2.5, stil='BHP', hiza=A.MIDDLE_LEFT, katman='BHP-YAZI', yer=None):
    yer = yer or m
    yer.add_text(t, height=h, dxfattribs={'style': stil, 'layer': katman}).set_placement((x, y), align=hiza)
def cizgi(x1, y1, x2, y2, katman='BHP', lt=None, yer=None):
    a = {'layer': katman}
    if lt: a['linetype'] = lt
    (yer or m).add_line((x1, y1), (x2, y2), dxfattribs=a)
def kutu(x1, y1, x2, y2, katman='BHP', yer=None, lt=None):
    a = {'layer': katman}
    if lt: a['linetype'] = lt
    (yer or m).add_lwpolyline([(x1, y1), (x2, y1), (x2, y2), (x1, y2)], close=True, dxfattribs=a)
def dolu(noktalar, katman='BHP-SEMBOL', renk=7, yer=None):
    h = (yer or m).add_hatch(color=renk, dxfattribs={'layer': katman}); h.paths.add_polyline_path(noktalar, is_closed=True)

# ---------- Kâğıt ve bölümler ----------
PX0, PY0, PX1, PY1 = -269.5, 5393.6, 684.6, 6293.6      # kullanıcının paftası (954 x 900 mm)
G = 5.0                                                   # bölümler arası boşluk
BAS = 9.0                                                 # bölüm başlık şeridi yüksekliği
BOLUM = {                                                 # ad: (x0, y0, x1, y1, no, başlık)
    'vaziyet': (-264.5, 6088.6, 88.0, 6288.6, 1, 'VAZİYET PLANI (TKGM PARSEL SORGU)'),
    'kroki':   (93.0, 6088.6, 386.0, 6288.6, 2, 'GDZ BAĞLANTI KROKİSİ (BAĞLANTI GÖRÜŞÜ EKİ)'),
    'detay':   (-264.5, 5919.6, -34.5, 6083.6, 3, 'BAĞLANTI HATTI TESİS / MONTAJ DETAYI'),
    'kanal':   (-264.5, 5754.6, -34.5, 5914.6, 4, 'KABLO KANALI DETAYI'),
    'tekhat':  (-29.5, 5974.6, 386.0, 6083.6, 5, 'TEK HAT ŞEMASI'),
    'hesap':   (-29.5, 5754.6, 386.0, 5969.6, 6, 'GERİLİM DÜŞÜMÜ VE AKIM HESABI'),
    'guc':     (-29.5, 5398.6, 176.0, 5749.6, 7, 'GÜÇ DAĞILIM TABLOSU'),
    'malzeme': (181.0, 5398.6, 386.0, 5749.6, 8, 'MALZEME LİSTESİ'),
    'sembol':  (391.0, 6128.6, 679.6, 6288.6, 9, 'SEMBOL LİSTESİ'),
    'notlar':  (391.0, 5418.6, 679.6, 6123.6, 10, 'GENEL NOTLAR'),
}
ANTET = (-264.5, 5398.6, -34.5, 5749.6)
SERIT = (391.0, 5398.6, 679.6, 5413.6)                    # tarih / başvuru / pafta no şeridi

def bolum(x0, y0, x1, y1, no, ad, yer=None):
    kutu(x0, y0, x1, y1, 'BHP-BOLUM', yer)
    dolu([(x0, y1 - BAS), (x1, y1 - BAS), (x1, y1), (x0, y1)], 'BHP-DOLGU', 254, yer)
    cizgi(x0, y1 - BAS, x1, y1 - BAS, 'BHP-BOLUM', yer=yer)
    yazi(f'{no}. {ad}' if no else ad, x0 + 3, y1 - BAS / 2, 3.2, 'BHP-K', yer=yer, katman='BHP-BASLIK')

kutu(PX0, PY0, PX1, PY1, 'BHP-CERCEVE')
for ad, (x0, y0, x1, y1, no, baslik) in BOLUM.items():
    bolum(x0, y0, x1, y1, no, baslik)
# şerit (tarih, başvuru no, pafta)
x0, y0, x1, y1 = SERIT
kutu(x0, y0, x1, y1, 'BHP-BOLUM')
for i, (et, yt) in enumerate((('PROJE TARİHİ', '{{TARIH}}'), ('GDZ BAŞVURU NO', '{{BASVURU}}'), ('ÖLÇEK', 'ÖLÇEKSİZ'), ('PAFTA', '1 / 2'))):
    w = (x1 - x0) / 4; xx = x0 + i * w
    if i: cizgi(xx, y0, xx, y1, 'BHP-BOLUM')
    yazi(et, xx + w / 2, y1 - 3.6, 2.0, 'BHP', A.MIDDLE_CENTER)
    yazi(yt, xx + w / 2, y0 + 4.4, 3.0, 'BHP-K', A.MIDDLE_CENTER)

# ---------- Kullanıcının çizimlerinden detay blokları ----------
def icinde(e, x0, y0, x1, y1):
    b = bbox.extents([e])
    return b.has_data and b.extmin.x >= x0 and b.extmax.x <= x1 and b.extmin.y >= y0 and b.extmax.y <= y1
def blok_al(kaynakDoc, ad, bolge, haric=lambda e: False, kablo_yaz=True):
    sm = kaynakDoc.modelspace()
    secilen = [e for e in sm if e.dxftype() not in ('OLE2FRAME', 'IMAGE') and icinde(e, *bolge) and not haric(e)]
    if kablo_yaz:
        for e in secilen:
            if e.dxftype() == 'TEXT' and 'NAYY' in e.dxf.text.upper(): e.dxf.text = '{{KABLO}}'
    b = d.blocks.new(ad)
    imp = Importer(kaynakDoc, d); imp.import_entities(secilen, target_layout=b); imp.finalize()
    return b
src = ezdxf.readfile(kaynak); srcb = ezdxf.readfile(kaynakBox)
# direk detayı: çerçeve çizgileri ve eski başlık hariç
cer = lambda e: (e.dxftype() == 'LINE' and (abs(e.dxf.start.y - e.dxf.end.y) < 0.01 or abs(e.dxf.start.x - e.dxf.end.x) < 0.01)
                 and (bbox.extents([e]).size.x > 150 or bbox.extents([e]).size.y > 100)) or \
                (e.dxftype() == 'TEXT' and 'TESİS/UYGULAMA/MONTAJ' in e.dxf.text)
bDirek = blok_al(src, 'BHP_DETAY_DIREK', (123.0, 6145.0, 331.5, 6289.0), cer)
bBox = blok_al(srcb, 'BHP_DETAY_BOX', (117.0, 6141.0, 325.5, 6285.0), cer)
alinti = lambda e: e.dxf.layer == 'LINYE' and ((e.dxftype() == 'TEXT' and abs(e.dxf.height - 3.2) < 0.05) or (e.dxftype() == 'MTEXT' and abs(e.dxf.char_height - 3.2) < 0.05))
bKanal = blok_al(src, 'BHP_KANAL', (98.0, 5980.0, 353.0, 6137.5), alinti)
# şartname metni: iki sütun; her biri iki yarıya bölünüp 2. paftaya 4 sütun olarak büyük yazılır
def sart_parcalari(n=4):
    """Metni okuma sırasıyla (1. sütun yukarıdan aşağı, sonra 2. sütun) tek akış yapar ve n eşit sütuna böler."""
    sm = src.modelspace()
    ogeler = [e for e in sm if e.dxftype() in ('TEXT', 'MTEXT') and icinde(e, 400.0, 5410.0, 690.0, 6270.0) and not alinti(e)]
    akis = []
    for k in (0, 1):
        l = []
        for e in ogeler:
            bb_ = bbox.extents([e])
            if (bb_.center.x < 551.0) == (k == 0): l.append((bb_.extmax.y, bb_, e))
        l.sort(key=lambda t: -t[0])
        akis += [(k, t) for t in l]
    SOL = {0: 405.0, 1: 548.0}
    # her satıra akış içinde yerel bir y ver (aralıklar korunur, sütun geçişinde bir satır boşluk)
    yer, imlec, onceki = [], 0.0, None
    for k, (ust, bb_, e) in akis:
        if onceki is not None:
            pk, pust, pbb = onceki
            imlec -= (min(max(pust - ust, 0.0), 12.0)) if pk == k else (pbb.size.y + 3.0)
        yer.append((k, ust, bb_, e, imlec)); onceki = (k, ust, bb_)
    toplam = -yer[-1][4] + yer[-1][2].size.y
    parcalar, bas = [], 0
    for i in range(1, n):
        hedef = -toplam * i / n
        j = min(range(bas + 1, len(yer)), key=lambda j: abs(yer[j][4] - hedef))
        parcalar.append(yer[bas:j]); bas = j
    parcalar.append(yer[bas:])
    bloklar = []
    for i, p in enumerate(parcalar):
        b = d.blocks.new(f'BHP_SARTNAME_{i + 1}')
        imp = Importer(src, d); imp.import_entities([t[3] for t in p], target_layout=b); imp.finalize()
        y0 = p[0][4]
        for (k, ust, bb_, e, yy), yeni_e in zip(p, list(b)):
            yeni_e.translate(-SOL[k], (yy - y0) - ust, 0)
        bloklar.append(b)
    return bloklar
bSartlar = sart_parcalari()

# İçe alınanları sadeleştir: tek yazı tipi, siyah baskı (taramalar gri)
for b in (bDirek, bBox, bKanal, *bSartlar):
    for e in b:
        if e.dxftype() == 'HATCH': e.dxf.color = 8
        else: e.dxf.color = 0          # BYBLOCK: bloğu yerleştiren katmanın rengini alır (siyah)
        if e.dxftype() in ('TEXT', 'MTEXT', 'DIMENSION'):
            pass
        e.dxf.lineweight = -2          # BYBLOCK
for s in list(d.styles):
    if s.dxf.name not in ('BHP', 'BHP-K'):
        s.dxf.font = 'arial.ttf'
        if s.dxf.get('bigfont'): s.dxf.bigfont = ''

def yerlestir(blok, katman, kutu_):
    """Bloğu bölümün içine (başlık şeridinin altına) ortalayarak, oranı bozmadan sığdırır."""
    bb = bbox.extents(blok)
    x0, y0, x1, y1 = kutu_[0] + 4, kutu_[1] + 4, kutu_[2] - 4, kutu_[3] - BAS - 4
    s = min((x1 - x0) / bb.size.x, (y1 - y0) / bb.size.y, 1.6)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    ins = (cx - bb.center.x * s, cy - bb.center.y * s)
    m.add_blockref(blok.name, ins, dxfattribs={'layer': katman, 'xscale': s, 'yscale': s})
    return s
yerlestir(bDirek, 'BHP-DETAY-DIREK', BOLUM['detay'])
yerlestir(bBox, 'BHP-DETAY-BOX', BOLUM['detay'])
yerlestir(bKanal, 'BHP-DETAY', BOLUM['kanal'])

# ---------- Sembol listesi ----------
SEMBOLLER = [
    ('direk', 'Mevcut AG direği (enerji alınacak nokta)'), ('box', 'AG saha dağıtım kutusu (box)'),
    ('nokta', 'Bağlantı noktası'), ('yeralti', 'Yeraltı kablosu (bağlantı hattı)'),
    ('havai', 'Havai hat (mevcut AG şebekesi)'), ('baslik', 'Kablo başlığı'),
    ('boru', 'Koruma borusu (yol geçişi / direk inişi)'), ('pano', 'Sayaç panosu (mühürlenebilir bölüm)'),
    ('sigorta', 'Sigorta'), ('kar', 'Kaçak akım rölesi (K.A.R)'), ('tms', 'Termik manyetik şalter (TMŞ)'),
    ('tmsyks', 'TMŞ + yük koruma (kaçak akımlı)'), ('sayac', 'Elektronik sayaç'), ('toprak', 'Topraklama'),
    ('parsel', 'Parsel sınırı'), ('ok', 'Enerji yönü'),
]
def sembol(tur, x, y):
    s = 'BHP-SEMBOL'
    if tur == 'direk': m.add_circle((x, y), 3.2, dxfattribs={'layer': s})
    elif tur == 'box':
        kutu(x - 6, y - 3.5, x + 6, y + 3.5, s); cizgi(x - 6, y - 3.5, x + 6, y + 3.5, s); cizgi(x - 6, y + 3.5, x + 6, y - 3.5, s)
    elif tur == 'nokta': dolu([(x + 1.6 * math.cos(a / 12 * 2 * math.pi), y + 1.6 * math.sin(a / 12 * 2 * math.pi)) for a in range(12)])
    elif tur == 'yeralti': cizgi(x - 14, y, x + 14, y, 'BHP-KABLO', 'DASHED')
    elif tur == 'havai': cizgi(x - 14, y, x + 14, y, s); cizgi(x - 1.5, y - 2, x + 1.5, y + 2, s)
    elif tur == 'baslik': cizgi(x - 12, y, x - 3, y, s); dolu([(x - 3, y), (x + 4, y + 2.8), (x + 4, y - 2.8)]); cizgi(x + 4, y, x + 12, y, s)
    elif tur == 'boru': cizgi(x - 12, y + 1.8, x + 12, y + 1.8, s); cizgi(x - 12, y - 1.8, x + 12, y - 1.8, s); cizgi(x - 14, y, x + 14, y, 'BHP-KABLO', 'DASHED')
    elif tur == 'pano': kutu(x - 8, y - 4, x + 8, y + 4, s); dolu([(x - 8, y - 4), (x + 8, y + 4), (x + 8, y - 4)])
    elif tur == 'sigorta': cizgi(x - 12, y, x - 5, y, s); kutu(x - 5, y - 2, x + 5, y + 2, s); cizgi(x - 5, y, x + 5, y, s); cizgi(x + 5, y, x + 12, y, s)
    elif tur in ('kar', 'tms', 'tmsyks'):
        cizgi(x - 12, y, x - 4, y, s); cizgi(x - 4, y, x + 4, y + 3.6, s); cizgi(x + 5, y, x + 12, y, s)
        if tur in ('tms', 'tmsyks'): cizgi(x + 3.4, y - 1, x + 6.4, y + 1, s); cizgi(x + 3.4, y + 1, x + 6.4, y - 1, s)
        if tur in ('kar', 'tmsyks'): kutu(x - 2, y - 5.2, x + 2, y - 2.8, s); cizgi(x, y - 2.8, x, y + 1.6, s, 'HIDDEN')
    elif tur == 'sayac':
        kutu(x - 5, y - 4, x + 5, y + 4, s); cizgi(x - 5, y + 0.6, x + 5, y + 0.6, s)
        yazi('kWh', x, y + 2.3, 1.6, 'BHP', A.MIDDLE_CENTER, s)
    elif tur == 'toprak':
        cizgi(x, y + 4, x, y + 1, s)
        for i, w in enumerate((4, 2.7, 1.4)): cizgi(x - w, y + 1 - i * 1.3, x + w, y + 1 - i * 1.3, s)
    elif tur == 'parsel': m.add_lwpolyline([(x - 14, y), (x + 14, y)], dxfattribs={'layer': 'BHP-PARSEL', 'const_width': 0.7})
    elif tur == 'ok': cizgi(x - 12, y, x + 5, y, s); dolu([(x + 12, y), (x + 4, y + 2.6), (x + 4, y - 2.6)])
x0, y0, x1, y1 = BOLUM['sembol'][:4]
iki = (x1 - x0) / 2
satir = (y1 - BAS - y0 - 4) / 8
for i, (tur, anlam) in enumerate(SEMBOLLER):
    kol, sira = divmod(i, 8)
    xs = x0 + kol * iki
    yy = y1 - BAS - 2 - satir * (sira + 0.5)
    sembol(tur, xs + 18, yy)
    yazi(anlam, xs + 36, yy, 2.6)
cizgi(x0 + iki, y0, x0 + iki, y1 - BAS, 'BHP-BOLUM')

# ---------- Antet (kullanıcının KAPAK çizimi) ----------
kap = json.load(open(kapakJson, encoding='utf-8'))
KX0, KY0, KX1, KY1 = 3771.62, 1796.93, 4718.76, 3274.35
s_ant = min((ANTET[2] - ANTET[0]) / (KX1 - KX0), (ANTET[3] - ANTET[1]) / (KY1 - KY0))
ax = ANTET[0]; ay = ANTET[1]
def T(x, y): return (ax + (x - KX0) * s_ant, ay + (y - KY0) * s_ant)
BASLIK_KUTU = (3785.0, 3068.0, 4708.0, 3262.0)             # kapakta logo + iletişim bölümü
for e in kap['entities']:
    t = e['type']
    if t == 'LINE':
        a, b = e['startPoint'], e['endPoint']; cizgi(*T(a['x'], a['y']), *T(b['x'], b['y']), 'BHP-ANTET')
    elif t == 'LWPOLYLINE':
        p = [T(v['x'], v['y']) for v in e['vertices']]
        m.add_lwpolyline(p, close=bool(e.get('flag', 0) & 1) or len(p) == 4, dxfattribs={'layer': 'BHP-ANTET'})
    elif t == 'TEXT':
        x, y = T(e['startPoint']['x'], e['startPoint']['y'])
        h = e['textHeight'] * s_ant
        st = 'BHP-K' if e['textHeight'] > 20 else 'BHP'
        metin = e['text'].strip()
        # kapaktaki küçük yazım düzeltmeleri: ikinci "YAPININ" arsa bilgileri başlığıdır; Türkçe karakterler
        if metin == 'YAPININ' and e['startPoint']['y'] < 2500: metin = 'ARSA BİLGİLERİ'
        metin = {'ODA SICIL NO': 'ODA SİCİL NO', 'BURO TESCİL NO': 'BÜRO TESCİL NO'}.get(metin, metin)
        m.add_text(metin, height=h, dxfattribs={'style': st, 'layer': 'BHP-ANTET', 'insert': (x, y)})
# değer yerleri (kapaktaki boş hücreler)
DEGER = [  # (yer tutucu, x, y, yükseklik, hiza) kapak koordinatlarında
    ('{{MALSAHIBI}}', 4070, 2563, 16, A.MIDDLE_LEFT), ('{{KULLANIM}}', 4070, 2530, 16, A.MIDDLE_LEFT),
    ('{{ADRES}}', 4070, 2497, 13, A.MIDDLE_LEFT),
    ('{{IL}}', 3831, 2381, 14, A.MIDDLE_CENTER), ('{{ILCE}}', 3947, 2381, 14, A.MIDDLE_CENTER),
    ('{{BELEDIYE}}', 4100, 2381, 14, A.MIDDLE_CENTER), ('{{MAHALLE}}', 4291, 2381, 14, A.MIDDLE_CENTER),
    ('{{PAFTA}}', 4448, 2381, 14, A.MIDDLE_CENTER), ('{{ADA}}', 4550, 2381, 14, A.MIDDLE_CENTER),
    ('{{PARSEL}}', 4656, 2381, 14, A.MIDDLE_CENTER),
    ('{{KURULU}}', 3892, 2216, 15, A.MIDDLE_CENTER), ('{{TALEP}}', 4102, 2216, 15, A.MIDDLE_CENTER),
    ('{{BB}}', 4268, 2216, 15, A.MIDDLE_CENTER), ('{{KAT}}', 4395, 2216, 13, A.MIDDLE_CENTER),
    ('{{ALAN}}', 4525, 2216, 15, A.MIDDLE_CENTER), ('{{YAPISINIFI}}', 4649, 2216, 15, A.MIDDLE_CENTER),
]
for t, x, y, h, hz in DEGER:
    m.add_text(t, height=h * s_ant, dxfattribs={'style': 'BHP-K', 'layer': 'BHP-ANTET'}).set_placement(T(x, y), align=hz)
# başlık bölümü: solda logo, sağda iletişim
bx0, by0, bx1, by1 = BASLIK_KUTU
lh = (by1 - by0) - 22; lw = lh * LOGO_PX[0] / LOGO_PX[1]
lx0, ly0 = bx0 + 12, by0 + 11
cizgi(*T(lx0 + lw + 16, by0 + 14), *T(lx0 + lw + 16, by1 - 14), 'BHP-ANTET')
ix = lx0 + lw + 32
for i, (et, deger) in enumerate((('Adres', 'Atatürk Mh. 5925/1 Sk. No:7/9'), ('', 'Yunusemre / MANİSA'), ('Tel', '0542 321 45 23'),
                                 ('E-posta', 'agyenerjimuhendislik@gmail.com'), ('Web', 'www.agymuhendislik.com'))):
    yy = by1 - 30 - i * 33
    if et: m.add_text(et, height=13 * s_ant, dxfattribs={'style': 'BHP-K', 'layer': 'BHP-ANTET'}).set_placement(T(ix, yy), align=A.MIDDLE_LEFT)
    m.add_text(deger, height=14 * s_ant, dxfattribs={'style': 'BHP', 'layer': 'BHP-ANTET'}).set_placement(T(ix + 78, yy), align=A.MIDDLE_LEFT)
logo_ins = T(lx0, ly0)

# ---------- Resimler (dosyalar DXF ile aynı klasörde) ----------
def resim(ad, isim, kutu_, px, py):
    x0, y0, x1, y1 = kutu_[0] + 3, kutu_[1] + 3, kutu_[2] - 3, kutu_[3] - BAS - 3
    w, h = x1 - x0, y1 - y0
    s = min(w / px, h / py); gw, gh = px * s, py * s
    ins = (x0 + (w - gw) / 2, y0 + (h - gh) / 2)
    tanim = d.add_image_def(filename=ad, size_in_pixel=(px, py), name=isim)
    r = m.add_image(tanim, insert=ins, size_in_units=(gw, gh), rotation=0, dxfattribs={'layer': 'BHP-RESIM'})
    return r, [round(ins[0], 4), round(ins[1], 4), round(ins[0] + gw, 4), round(ins[1] + gh, 4)]
UYDU_PX, VAZ_PX = (2000, 1087), (2000, 1056)
r1, kUydu = resim('{{UYDU}}', 'BHP-UYDU', BOLUM['kroki'], *UYDU_PX)
r2, kVaz = resim('{{VAZIYET}}', 'BHP-VAZIYET', BOLUM['vaziyet'], *VAZ_PX)
tl = d.add_image_def(filename='.\\agy-logo.png', size_in_pixel=LOGO_PX, name='BHP-LOGO')
r3 = m.add_image(tl, insert=logo_ins, size_in_units=(lw * s_ant, lh * s_ant), rotation=0, dxfattribs={'layer': 'BHP-ANTET'})
m.set_redraw_order([(r1.dxf.handle, '1'), (r2.dxf.handle, '2')])

# ---------- Pafta 2: kablo döşeme usul ve esasları (kullanıcının metni, aynen) ----------
DX = PX1 - PX0 + 60.0                                     # 2. pafta, 1. paftanın sağında
kutu(PX0 + DX, PY0, PX1 + DX, PY1, 'BHP-CERCEVE')
sx0, sy0, sx1, sy1 = PX0 + DX + 5, PY0 + 25, PX1 + DX - 5, PY1 - 5
bolum(sx0, sy0, sx1, sy1, 0, 'ELEKTRİK DAĞITIM ŞEBEKELERİ ENERJİ KABLOLARI UYGULAMA USUL VE ESASLARI (TEDAŞ) — PROJENİN EKİDİR')
kw = (sx1 - sx0 - 10) / 4
bbs = [bbox.extents(b) for b in bSartlar]
s2 = min(min((kw - 8) / b.size.x for b in bbs), min((sy1 - BAS - sy0 - 12) / b.size.y for b in bbs), 2.0)
for i, (b, bb) in enumerate(zip(bSartlar, bbs)):
    kx0 = sx0 + 5 + i * kw
    if i: cizgi(kx0, sy0 + 4, kx0, sy1 - BAS - 4, 'BHP')
    ust = sy1 - BAS - 6
    m.add_blockref(b.name, (kx0 + kw / 2 - bb.center.x * s2, ust - bb.extmax.y * s2), dxfattribs={'layer': 'BHP-DETAY', 'xscale': s2, 'yscale': s2})
x0, y0, x1, y1 = PX0 + DX + 5, PY0 + 5, PX1 + DX - 5, PY0 + 20
kutu(x0, y0, x1, y1, 'BHP-BOLUM')
for i, (et, yt) in enumerate((('PROJE', 'ELEKTRİK BAĞLANTI HATTI PROJESİ'), ('MAL SAHİBİ', '{{MALSAHIBI}}'), ('ADA / PARSEL', '{{ADAPARSEL}}'), ('PAFTA', '2 / 2'))):
    w = (x1 - x0) / 4; xx = x0 + i * w
    if i: cizgi(xx, y0, xx, y1, 'BHP-BOLUM')
    yazi(et, xx + w / 2, y1 - 3.6, 2.0, 'BHP', A.MIDDLE_CENTER)
    yazi(yt, xx + w / 2, y0 + 4.4, 3.0, 'BHP-K', A.MIDDLE_CENTER)

# ---------- Kaydet; web aracının ihtiyaç duyduğu bilgileri başa yaz ----------
# AutoCAD açılışta çizimin tamamını göstersin: sınırlar ve aktif görünüm (yoksa boş bir yere bakar)
TX0, TY0, TX1, TY1 = PX0 - 10, PY0 - 10, PX1 + DX + 10, PY1 + 10
m.dxf.extmin = (TX0, TY0, 0); m.dxf.extmax = (TX1, TY1, 0)          # ezdxf kayıtta başlığa bunları yazar
m.dxf.limmin = (TX0, TY0); m.dxf.limmax = (TX1, TY1)
d.set_modelspace_vport(height=(TY1 - TY0) * 1.05, center=((TX0 + TX1) / 2, (TY0 + TY1) / 2))
d.audit()
d.saveas(cikis, encoding='utf-8')
ic = lambda k: [BOLUM[k][0] + 3, BOLUM[k][1] + 3, BOLUM[k][2] - 3, BOLUM[k][3] - BAS - 3]
bilgi = {'model': m.block_record_handle,
         'bolgeler': {k: ic(k) for k in ('tekhat', 'hesap', 'guc', 'malzeme', 'notlar')},
         'resim': {'uydu': kUydu, 'vaziyet': kVaz}, 'pafta2': [PX0 + DX, PY0, PX1 + DX, PY1]}
s = open(cikis, encoding='utf-8').read()
open(cikis, 'w', encoding='utf-8').write('999\nBHP ' + json.dumps(bilgi) + '\n' + s)
print(json.dumps(bilgi), 'antet ölçeği', round(s_ant, 4), 'şartname ölçeği', round(s2, 3))
