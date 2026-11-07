# Kullanıcının kendi bağlantı hattı projelerinden (DXF) şablon üretir.
# Kullanım: python3 sablon-olustur.py <direkli-proje.dxf> <boxlu-proje.dxf> <cikis BHP-SABLON.dxf>
#
# Şablonda:
# - Değişmeyen kısımlar kullanıcının çizimindeki gibi kalır (açıklamalar, şartname, kablo kanalı detayı, antet).
# - Değişen yazılar {{ANAHTAR}} yer tutucusudur (konum, katman, yazı stili aynı).
# - Bağlantı detayı iki türlüdür: direkten (BHP-DETAY-DIREK) ve box'tan (BHP-DETAY-BOX). Web aracı
#   kullanılmayanın katmanını dondurur.
# - Excel/resim (OLE) nesneleri, eski tek hat şeması ve iç tesisattan gelen uzun sembol listesi silinir.
#   Yerine: bağlantı hattına özel sembol listesi (burada çizilir). Tek hat şeması, gerilim düşümü hesabı,
#   güç dağılım tablosu ve malzeme listesi web aracında (ortak/bhp-cizim.js) her proje için çizilir.
# - Uydu ve vaziyet resmi için dışarıdan bağlı resim (IMAGE) yerleri.
import sys, json, ezdxf
from ezdxf import bbox
from ezdxf.addons import Importer
from ezdxf.enums import TextEntityAlignment as A

kaynak, kaynakBox, cikis = sys.argv[1], sys.argv[2], sys.argv[3]
d = ezdxf.readfile(kaynak)
m = d.modelspace()

def icinde(e, x0, y0, x1, y1):
    b = bbox.extents([e])
    return b.has_data and b.extmin.x >= x0 and b.extmax.x <= x1 and b.extmin.y >= y0 and b.extmax.y <= y1

# 1) Değişen yazılar (tutamaç -> yer tutucu)
YER = {
    '1E152B': '{{MALSAHIBI}}', '1E1582': '{{KULLANIM}}', '1E15E8': '{{ADRES}}',
    '1E152C': '{{IL}}', '1E15E9': '{{ILCE}}', '1E15EB': '{{BELEDIYE}}', '1E1588': '{{MAHALLE}}',
    '1E2229': '{{PAFTA}}', '1E15F1': '{{ADA}}', '1E15EA': '{{PARSEL}}',
    '1E1589': '{{KURULU}}', '1E15EC': '{{TALEP}}', '1E37E7': '{{BB}}', '1E37EF': '{{KAT}}', '1E37F7': '{{ALAN}}',
    '1E58DA': '{{KABLO}}', '1E58DB': '{{KABLO}}',                       # direk detayı
    '1E7A2F': '{{ADAPARSEL}}', '1E7A60': '{{DIREK}}', '1E7A76': '{{KABLO}}', '1E7A77': '{{UZUNLUK}}', '1E7A78': '{{HATTIPI}}',
}
for h, t in YER.items():
    e = d.entitydb[h]; assert e.dxftype() == 'TEXT', h
    e.dxf.text = t

# 2) Silinenler
m.delete_entity(d.entitydb['1E4401'])                 # eski projeden kalmış uzak yazı
for e in list(m.query('OLE2FRAME')): m.delete_entity(e)
SIL = [(-44.5, 5393.0, 391.5, 5795.0),                # iç tesisat sembol listesi + eski tek hat şeması + sayaç panosu
       (-90.0, 5762.0, -10.0, 5824.0)]                # vaziyet planının küçük lejantı (ana sembol listesine taşındı)
for e in list(m):
    if e.dxftype() == 'IMAGE': continue
    if any(icinde(e, *r) for r in SIL): m.delete_entity(e)
    elif e.dxftype() == 'TEXT':   # sınırdan taşan eski sembol listesi yazıları (başlangıç noktası bölgedeyse)
        p = e.dxf.insert
        if any(r[0] <= p.x <= r[2] and r[1] <= p.y <= r[3] for r in SIL): m.delete_entity(e)

for ad, renk in (('BHP', 7), ('BHP-RESIM', 7), ('BHP-DOLGU', 2), ('BHP-SEMBOL', 7), ('BHP-KABLO', 1),
                 ('BHP-DETAY-DIREK', 7), ('BHP-DETAY-BOX', 7), ('BHP-PARSEL', 1)):
    if ad not in d.layers: d.layers.add(ad, color=renk)

# 3) Bağlantı detayları: direkli (bu çizimden) ve box'lı (öbür çizimden), aynı çerçeve yerine
CER = (123.0, 6145.0, 331.5, 6289.0)
bd = d.blocks.new('BHP_DETAY_DIREK')
for e in list(m):
    if icinde(e, *CER): m.move_to_layout(e, bd)
m.add_blockref('BHP_DETAY_DIREK', (0, 0), dxfattribs={'layer': 'BHP-DETAY-DIREK'})

sb = ezdxf.readfile(kaynakBox); sm = sb.modelspace()
CERB = (117.0, 6141.0, 325.5, 6285.0)
for e in sm.query('TEXT'):
    if icinde(e, *CERB) and 'NAYY' in e.dxf.text: e.dxf.text = '{{KABLO}}'
secilen = [e for e in sm if e.dxftype() != 'OLE2FRAME' and icinde(e, *CERB)]
bb = d.blocks.new('BHP_DETAY_BOX')
imp = Importer(sb, d); imp.import_entities(secilen, target_layout=bb); imp.finalize()
m.add_blockref('BHP_DETAY_BOX', (124.2 - 118.3, 6145.8 - 6141.8), dxfattribs={'layer': 'BHP-DETAY-BOX'})

KALIN, INCE = 'style2', 'TR'   # arialbd.ttf / arial.ttf (çizimde zaten var)
def yazi(t, x, y, h=2.5, stil=INCE, hiza=A.MIDDLE_LEFT, katman='BHP'):
    m.add_text(t, height=h, dxfattribs={'style': stil, 'layer': katman}).set_placement((x, y), align=hiza)
def cizgi(x1, y1, x2, y2, katman='BHP', lt=None, renk=None):
    a = {'layer': katman}
    if lt: a['linetype'] = lt
    if renk is not None: a['color'] = renk
    m.add_line((x1, y1), (x2, y2), dxfattribs=a)
def kutu(x1, y1, x2, y2, katman='BHP', lt=None):
    a = {'layer': katman}
    if lt: a['linetype'] = lt
    m.add_lwpolyline([(x1, y1), (x2, y1), (x2, y2), (x1, y2)], close=True, dxfattribs=a)
def dolu(noktalar, katman='BHP-SEMBOL', renk=7):
    h = m.add_hatch(color=renk, dxfattribs={'layer': katman}); h.paths.add_polyline_path(noktalar, is_closed=True)
def daire(x, y, r, katman='BHP-SEMBOL'): m.add_circle((x, y), r, dxfattribs={'layer': katman})
for lt in ('DASHED', 'HIDDEN'):
    if lt not in d.linetypes:
        d.linetypes.add(lt, pattern=[3.0, 2.0, -1.0] if lt == 'DASHED' else [1.5, 0.75, -0.75], description=lt)

# 4) Sembol listesi (yalnız bu projede kullanılanlar; tek hat şemasındakilerle aynı çizim)
SX0, SX1, SY1 = -44.0, 190.0, 5708.0
SATIR = 15.0
SEMBOLLER = [
    ('direk', 'Mevcut AG direği (enerji alınacak nokta)'),
    ('box', 'AG saha dağıtım kutusu (box)'),
    ('nokta', 'Bağlantı noktası'),
    ('yeralti', 'Yeraltı kablosu (bağlantı hattı)'),
    ('havai', 'Havai hat (mevcut AG şebekesi)'),
    ('baslik', 'Kablo başlığı'),
    ('boru', 'Koruma borusu (yol geçişi / direk inişi)'),
    ('pano', 'Sayaç panosu (mühürlenebilir bölüm)'),
    ('sigorta', 'Sigorta (NH / otomatik)'),
    ('kar', 'Kaçak akım rölesi (K.A.R)'),
    ('tms', 'Yük kesicili şalter / TMŞ'),
    ('sayac', 'Elektronik sayaç'),
    ('toprak', 'Topraklama (galvaniz kazık)'),
    ('parsel', 'Parsel sınırı'),
    ('ok', 'Enerji yönü'),
]
ust = SY1
yazi('SEMBOL LİSTESİ', (SX0 + SX1) / 2, ust - 5.5, 4.0, KALIN, A.MIDDLE_CENTER)
ust -= 11
kutu(SX0, ust - SATIR * (len(SEMBOLLER) + 1), SX1, ust)
cizgi(SX0, ust - SATIR, SX1, ust - SATIR)
CX = SX0 + 52     # sembol sütunu sınırı
cizgi(CX, ust, CX, ust - SATIR * (len(SEMBOLLER) + 1))
yazi('SEMBOL', (SX0 + CX) / 2, ust - SATIR / 2, 3.0, KALIN, A.MIDDLE_CENTER)
yazi('ANLAMI', (CX + SX1) / 2, ust - SATIR / 2, 3.0, KALIN, A.MIDDLE_CENTER)
def sembol(tur, x, y):   # x,y: sembolün ortası; ~40 birim genişlikte
    s = 'BHP-SEMBOL'
    if tur == 'direk': daire(x, y, 4.5)
    elif tur == 'box':
        kutu(x - 7, y - 4.5, x + 7, y + 4.5, s); cizgi(x - 7, y - 4.5, x + 7, y + 4.5, s); cizgi(x - 7, y + 4.5, x + 7, y - 4.5, s)
    elif tur == 'nokta': dolu([(x + 2.2 * __import__('math').cos(a / 8 * 6.2832), y + 2.2 * __import__('math').sin(a / 8 * 6.2832)) for a in range(8)])
    elif tur == 'yeralti': cizgi(x - 16, y, x + 16, y, 'BHP-KABLO', 'DASHED')
    elif tur == 'havai': cizgi(x - 16, y, x + 16, y, s); cizgi(x - 2, y - 2.5, x + 2, y + 2.5, s)
    elif tur == 'baslik': cizgi(x - 12, y, x - 3, y, s); dolu([(x - 3, y), (x + 5, y + 3.5), (x + 5, y - 3.5)]); cizgi(x + 5, y, x + 12, y, s)
    elif tur == 'boru': cizgi(x - 14, y + 2.2, x + 14, y + 2.2, s); cizgi(x - 14, y - 2.2, x + 14, y - 2.2, s); cizgi(x - 16, y, x + 16, y, 'BHP-KABLO', 'DASHED')
    elif tur == 'pano':
        kutu(x - 10, y - 5, x + 10, y + 5, s); dolu([(x - 10, y - 5), (x + 10, y + 5), (x + 10, y - 5)])
    elif tur == 'sigorta':
        cizgi(x - 14, y, x - 6, y, s); kutu(x - 6, y - 2.4, x + 6, y + 2.4, s); cizgi(x - 6, y, x + 6, y, s); cizgi(x + 6, y, x + 14, y, s)
    elif tur == 'kar':
        cizgi(x - 14, y, x - 5, y, s); cizgi(x - 5, y, x + 5, y + 4.5, s); cizgi(x + 5, y, x + 14, y, s)
        kutu(x - 2.5, y - 6.5, x + 2.5, y - 3.5, s); cizgi(x, y - 3.5, x, y + 1.8, s, 'HIDDEN')
    elif tur == 'tms':
        cizgi(x - 14, y, x - 5, y, s); cizgi(x - 5, y, x + 5, y + 4.5, s); cizgi(x + 5, y, x + 14, y, s)
        cizgi(x + 3.2, y - 1.2, x + 6.8, y + 1.2, s); cizgi(x + 3.2, y + 1.2, x + 6.8, y - 1.2, s)
    elif tur == 'sayac':
        kutu(x - 6, y - 5, x + 6, y + 5, s); cizgi(x - 6, y + 1, x + 6, y + 1, s)
        yazi('kWh', x, y + 3, 1.8, INCE, A.MIDDLE_CENTER, s)
    elif tur == 'toprak':
        cizgi(x, y + 5, x, y + 1, s)
        for i, w in enumerate((5, 3.4, 1.8)): cizgi(x - w, y + 1 - i * 1.6, x + w, y + 1 - i * 1.6, s)
    elif tur == 'parsel': m.add_lwpolyline([(x - 16, y), (x + 16, y)], dxfattribs={'layer': 'BHP-PARSEL', 'const_width': 0.8})
    elif tur == 'ok': cizgi(x - 14, y, x + 6, y, s); dolu([(x + 14, y), (x + 5, y + 3), (x + 5, y - 3)])
for i, (tur, anlam) in enumerate(SEMBOLLER):
    yu = ust - SATIR * (i + 1); ya = yu - SATIR
    cizgi(SX0, ya, SX1, ya)
    sembol(tur, (SX0 + CX) / 2, (yu + ya) / 2)
    yazi(anlam, CX + 4, (yu + ya) / 2, 3.0)

# 5) Resim yerleri (dosyalar DXF ile aynı klasörde durur; boyutlar web aracının ürettiği resimlerle aynı)
def resim(ad, isim, x1, y1, x2, y2, px):
    py = round(px * (y2 - y1) / (x2 - x1))
    tanim = d.add_image_def(filename=ad, size_in_pixel=(px, py), name=isim)
    return m.add_image(tanim, insert=(x1, y1), size_in_units=(x2 - x1, y2 - y1), rotation=0, dxfattribs={'layer': 'BHP-RESIM'}), py
r1, p1 = resim('{{UYDU}}', 'BHP-UYDU', -263.4, 5988.2, 58.0, 6162.9, 2000)
r2, p2 = resim('{{VAZIYET}}', 'BHP-VAZIYET', -263.2, 5824.1, 39.6, 5984.0, 2000)
m.set_redraw_order([(r1.dxf.handle, '1'), (r2.dxf.handle, '2')])   # resimler her şeyin altında
print('uydu resmi 2000x%d, vaziyet resmi 2000x%d' % (p1, p2))

# 6) Kullanılmayan blok tanımlarını temizle (dosya küçülsün)
kullanilan, bekleyen = set(), [m] + [l for l in d.layouts if l.name != 'Model']
while bekleyen:
    alan = bekleyen.pop()
    for e in alan:
        ad = e.dxf.get('name') if e.dxftype() == 'INSERT' else (e.dxf.get('geometry') if e.dxftype() == 'DIMENSION' else None)
        if ad and ad not in kullanilan and ad in d.blocks:
            kullanilan.add(ad); bekleyen.append(d.blocks[ad])
silinen = 0
for b in list(d.blocks):
    if b.name.lower().startswith(('*model_space', '*paper_space', '_')) or b.name in kullanilan or b.block_record.is_any_layout:
        continue
    try: d.blocks.delete_block(b.name, safe=False); silinen += 1
    except Exception: pass
print('silinen blok', silinen, 'kalan', len(d.blocks))
d.audit()
d.saveas(cikis, encoding='utf-8')

# 7) Web aracının ihtiyaç duyduğu bilgiyi dosyanın başına DXF açıklaması (999) olarak yaz
bilgi = {'model': d.modelspace().block_record_handle,
         'bolgeler': {'tekhat': [-40, 5715, 390, 5792], 'hesap': [43, 5796, 361, 5963], 'guc': [-268, 5672, -79, 5806],
                      'malzeme': [200, 5395, 391, 5708]}}
s = open(cikis, encoding='utf-8').read()
open(cikis, 'w', encoding='utf-8').write('999\nBHP ' + json.dumps(bilgi) + '\n' + s)
print(bilgi)
