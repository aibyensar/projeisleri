# Kullanıcının kendi bağlantı hattı projesinden (DXF) şablon üretir.
# Kullanım: python3 sablon-olustur.py <kaynak.dxf> <cikis BHP-SABLON.dxf>
# - Değişen yazılar {{ANAHTAR}} yer tutucularına çevrilir (konum, katman, yazı stili aynen kalır).
# - Çizime yapıştırılmış Excel/resim nesneleri (OLE) silinir; yerlerine AutoCAD çizgileri ve yazıları konur.
# - Uydu ve vaziyet resimleri için dışarıdan bağlı resim (IMAGE) yerleri açılır.
import sys, ezdxf
from ezdxf.enums import TextEntityAlignment as A

kaynak, cikis = sys.argv[1], sys.argv[2]
d = ezdxf.readfile(kaynak)
m = d.modelspace()

# 1) Değişen yazılar (tutamaç -> yer tutucu)
YER = {
    '1E152B': '{{MALSAHIBI}}', '1E1582': '{{KULLANIM}}', '1E15E8': '{{ADRES}}',
    '1E152C': '{{IL}}', '1E15E9': '{{ILCE}}', '1E15EB': '{{BELEDIYE}}', '1E1588': '{{MAHALLE}}',
    '1E2229': '{{PAFTA}}', '1E15F1': '{{ADA}}', '1E15EA': '{{PARSEL}}',
    '1E1589': '{{KURULU}}', '1E15EC': '{{TALEP}}', '1E37E7': '{{BB}}', '1E37EF': '{{KAT}}', '1E37F7': '{{ALAN}}',
    # tek hat şeması
    '1E15C5': '{{KABLO}}', '1E15C7': '{{UZUNLUK}}', '1E2386': '{{HATTIPI}}', '1E78DE': '{{DIREK}}',
    # detaylar
    '1E58DA': '{{KABLO}}', '1E58DB': '{{KABLO}}',
    # vaziyet planı üzerindeki yazılar
    '1E7A2F': '{{ADAPARSEL}}', '1E7A60': '{{DIREK}}', '1E7A76': '{{KABLO}}', '1E7A77': '{{UZUNLUK}}', '1E7A78': '{{HATTIPI}}',
}
for h, t in YER.items():
    e = d.entitydb[h]
    assert e.dxftype() == 'TEXT', h
    e.dxf.text = t

# 2) Eski projeden kalmış, çizimin çok uzağındaki yazı ve OLE nesneleri
d.entitydb['1E4401'].destroy() if False else m.delete_entity(d.entitydb['1E4401'])
for e in list(m.query('OLE2FRAME')):
    m.delete_entity(e)

if 'BHP' not in d.layers: d.layers.add('BHP', color=7)
if 'BHP-RESIM' not in d.layers: d.layers.add('BHP-RESIM', color=7)
if 'BHP-DOLGU' not in d.layers: d.layers.add('BHP-DOLGU', color=2)
KALIN, INCE = 'style2', 'TR'   # arialbd.ttf / arial.ttf (çizimde zaten var)

def yazi(t, x, y, h=3.2, stil=KALIN, hiza=A.MIDDLE_LEFT, katman='BHP', siyah=False):
    e = m.add_text(t, height=h, dxfattribs={'style': stil, 'layer': katman})
    if siyah: e.rgb = (0, 0, 0)   # sarı zemin üstünde ekranda da okunsun
    e.set_placement((x, y), align=hiza)
def cizgi(x1, y1, x2, y2, katman='BHP', lt=None):
    a = {'layer': katman}
    if lt: a['linetype'] = lt
    m.add_line((x1, y1), (x2, y2), dxfattribs=a)
def kutu(x1, y1, x2, y2, katman='BHP'):
    m.add_lwpolyline([(x1, y1), (x2, y1), (x2, y2), (x1, y2)], close=True, dxfattribs={'layer': katman})
def dolgu(x1, y1, x2, y2, renk=2):
    h = m.add_hatch(color=renk, dxfattribs={'layer': 'BHP-DOLGU'})
    h.paths.add_polyline_path([(x1, y1), (x2, y1), (x2, y2), (x1, y2)], is_closed=True)
def sari(t, x1, x2, y, h=3.4):   # sarı zeminli giriş değeri (Excel'deki gibi)
    dolgu(x1, y - 2.6, x2, y + 2.6)
    yazi(t, (x1 + x2) / 2, y, h, hiza=A.MIDDLE_CENTER, siyah=True)

# 3) GERİLİM DÜŞÜMÜ HESABI (Excel nesnesinin yerine; alan x 43..361, y 5796..5963)
X, Y = 43.0, 5963.0
yazi('GERİLİM DÜŞÜMÜ HESABI', X + 50, Y - 14, 4.0)
yazi('A.G. PANOSU (GDZ)', X + 33, Y - 34, 3.4, hiza=A.MIDDLE_RIGHT)
dolgu(X + 36, Y - 37, X + 44, Y - 31, renk=7)
cizgi(X + 44, Y - 34, X + 186, Y - 34)
sari('{{KABLO}}', X + 70, X + 160, Y - 26)
sari('{{H_L}}', X + 103, X + 115, Y - 42)
yazi('m', X + 117, Y - 42, 3.4)
kutu(X + 186, Y - 48, X + 194, Y - 20)
cizgi(X + 186, Y - 20, X + 194, Y - 48)
yazi('ADP', X + 190, Y - 15, 3.6, hiza=A.MIDDLE_CENTER)
yazi('BAĞLANTI GÜÇ', X + 180, Y - 56, 3.4, hiza=A.MIDDLE_RIGHT)
sari('{{H_N}}', X + 184, X + 202, Y - 56)
yazi('W', X + 204, Y - 56, 3.4, stil=INCE)
yazi('ANA BESLEME HATTI', X + 50, Y - 70, 3.6)
yazi('% e1=', X + 30, Y - 84, 3.4, hiza=A.MIDDLE_RIGHT)
sari('{{H_C}}', X + 31, X + 59, Y - 84)
for t, x in (('x', 66), ('{{H_N}}', 82), ('x', 100), ('{{H_L}}', 114), ('/', 128)):
    yazi(t, X + x, Y - 84, 3.4, stil=INCE, hiza=A.MIDDLE_CENTER)
sari('{{H_S}}', X + 134, X + 148, Y - 84)
yazi('=', X + 154, Y - 84, 3.4, stil=INCE, hiza=A.MIDDLE_CENTER)
yazi('{{H_E1}}', X + 159, Y - 84, 3.4, stil=INCE)
yazi('TOPLAM GERİLİM DÜŞÜMÜ', X + 50, Y - 100, 3.6)
yazi('% e=', X + 30, Y - 114, 3.4, hiza=A.MIDDLE_RIGHT)
yazi('{{H_E}}', X + 82, Y - 114, 3.4, hiza=A.MIDDLE_CENTER)
for t, x in (('=', 154), ('{{H_ER}}', 166), ('<', 180), ('1,5', 192)):
    yazi(t, X + x, Y - 114, 3.4, stil=INCE, hiza=A.MIDDLE_CENTER)
yazi('{{H_SONUC}}', X + 202, Y - 114, 3.0)
cizgi(X + 201, Y - 117.5, X + 312, Y - 117.5)
yazi('AKIM KONTROLU', X + 50, Y - 130, 3.6)
yazi('I=', X + 30, Y - 144, 3.4, hiza=A.MIDDLE_RIGHT)
for t, x in (('{{H_N}}', 44), ('/', 66), ('527', 82), ('=', 100), ('{{H_I}}', 118), ('<', 134)):
    yazi(t, X + x, Y - 144, 3.4, stil=INCE, hiza=A.MIDDLE_CENTER)
sari('{{H_IZ}}', X + 140, X + 156, Y - 144)
yazi('A', X + 159, Y - 144, 3.4)
yazi('{{KABLO}}', X + 190, Y - 144, 3.4)

# 4) GÜÇ DAĞILIM TABLOSU (resmin yerine; alan x -267.8..-79.2, y 5672.3..5708.8)
x0, x1, yu, ya = -267.8, -79.2, 5708.8, 5672.3
K = [0, 22.0, 42.0, 62.0, 88.0, 114.0, 132.0, 158.0, 188.6]   # sütun sınırları (x0'dan)
yS = [yu, yu - 4.4, yu - 20.2, yu - 24.0, yu - 30.2, ya]        # satır sınırları
kutu(x0, ya, x1, yu)
cizgi(x0, yS[1], x1, yS[1]); cizgi(x0 + K[1], yS[2], x1, yS[2])
cizgi(x0 + K[1], yS[3], x0 + K[5], yS[3]); cizgi(x0 + K[1], yS[4], x0 + K[5], yS[4])
for i in range(1, 8):
    cizgi(x0 + K[i], yS[1], x0 + K[i], yS[3] if i > 5 else (ya if i in (1,) else yS[3]))
cizgi(x0 + K[4], yS[3], x0 + K[4], ya); cizgi(x0 + K[5], yS[3], x0 + K[5], ya)
yazi('GÜÇ DAĞILIM TABLOSU', (x0 + x1) / 2, yu - 2.2, 2.2, hiza=A.MIDDLE_CENTER)
bas = [('Bağlantı Hattı',), ('Bağımsız Bölüm', 'No'), ('Enerji Aldığı', 'Tablo Adı'), ('Kurulu Güç (W)',),
       ('Bağlantı Gücü (W)',), ('Sayaç Tipi',), ('Kullanım Amacı',), ('Tesis Mevcut İse', 'Tesisat Numarası')]
for i, b in enumerate(bas):
    cx = x0 + (K[i] + K[i + 1]) / 2
    ys = [yS[1] - 7.9] if len(b) == 1 else [yS[1] - 6.2, yS[1] - 9.6]
    for t, yy in zip(b, ys):
        yazi(t, cx, yy, 1.9, hiza=A.MIDDLE_CENTER)
veri = ['{{G_BB}}', '{{G_TABLO}}', '{{G_KURULU}}', '{{G_BAGLANTI}}', '{{G_SAYAC}}', '{{G_KULLANIM}}', '{{G_TESIS}}']
for i, t in enumerate(veri, start=1):
    yazi(t, x0 + (K[i] + K[i + 1]) / 2, (yS[2] + yS[3]) / 2, 1.9, stil=INCE, hiza=A.MIDDLE_CENTER)
yazi('{{G_TABLO}}', x0 + K[1] / 2, (yS[3] + ya) / 2, 2.4, hiza=A.MIDDLE_CENTER)
yazi('Toplam Bağlantı Gücü', x0 + (K[1] + K[4]) / 2, (yS[3] + yS[4]) / 2, 1.9, hiza=A.MIDDLE_CENTER)
yazi('{{G_TOPLAM}}', x0 + (K[4] + K[5]) / 2, (yS[3] + yS[4]) / 2, 2.2, hiza=A.MIDDLE_CENTER)
yazi('DİVERSİTE%', x0 + (K[1] + K[4]) / 2, (yS[4] + ya) / 2, 1.9, hiza=A.MIDDLE_CENTER)
yazi('{{G_TOPLAM}}', x0 + (K[4] + K[5]) / 2, (yS[4] + ya) / 2, 2.2, hiza=A.MIDDLE_CENTER)
# sol sütun: Bağlantı Hattı başlığı üst iki satırı kaplar
cizgi(x0, yS[3], x0 + K[1], yS[3])

# 5) SAYAÇ PANOSU içi (resmin yerine; kesik çizgili kutu x 238.9..321.1, y 5731.6..5783.7)
yh = 5741.6
cizgi(250.6, yh, 256, yh)
kutu(256, yh - 2.6, 268, yh + 2.6)                 # sigorta
m.add_circle((262, yh), 1.6, dxfattribs={'layer': 'BHP'})
for xx in (257.8, 259.4, 264.6, 266.2):
    cizgi(xx, yh - 2.6, xx, yh + 2.6)
yazi('{{P_SIGKA}}', 262, yh + 9.0, 2.8, stil=INCE, hiza=A.MIDDLE_CENTER)
yazi('{{P_SIG}}', 262, yh + 5.4, 2.8, stil=INCE, hiza=A.MIDDLE_CENTER)
cizgi(268, yh, 280, yh)
cizgi(280, yh, 290, yh + 5.5)                      # kaçak akım rölesi kontağı
cizgi(288.4, yh + 2.2, 290.4, yh + 1.0)
cizgi(291, yh, 300, yh)
yazi('K.A.R', 286, yh + 17.0, 2.8, stil=INCE, hiza=A.MIDDLE_CENTER)
yazi('{{P_KAR}}', 286, yh + 13.4, 2.8, stil=INCE, hiza=A.MIDDLE_CENTER)
yazi('{{P_KARMA}}', 286, yh + 9.8, 2.8, stil=INCE, hiza=A.MIDDLE_CENTER)
cizgi(300, yh, 300, yh + 4)
kutu(296, yh + 4, 316, yh + 26)                    # sayaç
cizgi(296, yh + 15, 316, yh + 15)
yazi('kWh', 306, yh + 20.5, 3.0, stil=INCE, hiza=A.MIDDLE_CENTER)
yazi('{{P_SAYACTUR}}', 306, yh + 9.5, 2.0, stil=INCE, hiza=A.MIDDLE_CENTER)
yazi('Elektronik', 306, yh + 34.5, 2.8, stil=INCE, hiza=A.MIDDLE_CENTER)
yazi('{{P_SAYAC}}', 306, yh + 30.5, 2.8, stil=INCE, hiza=A.MIDDLE_CENTER)

# 6) Resim yerleri (dosyalar DXF ile aynı klasörde durur; boyutlar web aracının ürettiği resimlerle aynı)
def resim(ad, isim, x1, y1, x2, y2, px):
    py = round(px * (y2 - y1) / (x2 - x1))
    tanim = d.add_image_def(filename=ad, size_in_pixel=(px, py), name=isim)
    return m.add_image(tanim, insert=(x1, y1), size_in_units=(x2 - x1, y2 - y1), rotation=0, dxfattribs={'layer': 'BHP-RESIM'}), py
r1, p1 = resim('{{UYDU}}', 'BHP-UYDU', -263.4, 5988.2, 58.0, 6162.9, 2000)
r2, p2 = resim('{{VAZIYET}}', 'BHP-VAZIYET', -263.2, 5824.1, 39.6, 5984.0, 2000)
print('uydu resmi 2000x%d, vaziyet resmi 2000x%d' % (p1, p2))
# resimler diğer her şeyin altında görünsün
m.set_redraw_order([(r1.dxf.handle, '1'), (r2.dxf.handle, '2')])

# 7) Kullanılmayan blok tanımlarını temizle (dosya küçülsün)
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
    try:
        d.blocks.delete_block(b.name, safe=False); silinen += 1
    except Exception as x:
        pass
print('silinen blok', silinen, 'kalan', len(d.blocks))
d.audit()
d.saveas(cikis, encoding='utf-8')
