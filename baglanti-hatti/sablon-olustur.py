# Bağlantı hattı projesi (BHP) şablonu — 4. sürüm: kullanıcının GDZ'den onaylı iki projesi temel alınır.
#
# Kullanım (depo kökünden):
#   node baglanti-hatti/araclar/dwg-oku.mjs <boxlu-BHP.dwg> box.json      (aynısı direkli proje için)
#   python3 baglanti-hatti/sablon-olustur.py box.json direk.json baglanti-hatti/BHP-SABLON.dxf
#   python3 baglanti-hatti/kapak-ekle.py KAPAK.dxf baglanti-hatti/BHP-SABLON.dxf   (antetin yerine kullanıcının kapağı)
#   python3 baglanti-hatti/pafta-duzen.py baglanti-hatti/BHP-SABLON.dxf             (bölümleri ızgaraya yerleştirir, çerçeveler)
#
# Taban: boxlu onaylı proje (çok bağımsız bölümlü; yük dağılım cetveline yer var). Sabit kısımlar aynen kalır:
# elektrik tesisatı açıklamaları, kablo kanalı detayı ve uyarı yazısı, kuvvetli/zayıf akım sembolleri, TEDAŞ metni,
# vaziyet sembol kutusu, "geçiş izinleri" uyarısı, antet. Direkli projenin montaj detayı ayrı blok olarak eklenir;
# web aracı kullanılmayanı siler.
# DWG'deki gömülü Excel tabloları ve resimler (OLE) DXF'e geçmez; onların yerine:
#   - PVC boru çapı tablosu burada çizgi + yazı olarak çizilir (kullanıcının tablosu, aynen),
#   - güç dağıtım tablosu, yük dağılımı cetveli, gerilim düşümü hesabı, tek hat şeması ve vaziyet işaretleri
#     her işte ortak/bhp-cizim.js ile bu dosyanın başındaki 999 açıklamasında yazan bölgelere çizilir,
#   - uydu ve vaziyet resimleri IMAGE olarak bağlanır (dosyalar DXF ile aynı klasörde).
import sys, os, json, tempfile, ezdxf
from ezdxf import bbox
from ezdxf.addons import Importer
from ezdxf.enums import TextEntityAlignment as A

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'araclar'))
import importlib.util
_sp = importlib.util.spec_from_file_location('jsondxf', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'araclar', 'json-dxf.py'))
jsondxf = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(jsondxf)

boxJson, direkJson, cikis = sys.argv[1:4]
PAFTA = (-269.5, 5393.6, 684.6, 6293.6)                  # kullanıcının kâğıdı (954 x 900 mm)
gecici = tempfile.mkdtemp()
jsondxf.cevir(boxJson, os.path.join(gecici, 'box.dxf'), [PAFTA[0] - 6, PAFTA[1] - 6, PAFTA[2] + 6, PAFTA[3] + 6])
jsondxf.cevir(direkJson, os.path.join(gecici, 'direk.dxf'), [PAFTA[0] - 6, PAFTA[1] - 6, PAFTA[2] + 6, PAFTA[3] + 6])
d = ezdxf.readfile(os.path.join(gecici, 'box.dxf'))
dd = ezdxf.readfile(os.path.join(gecici, 'direk.dxf'))
m = d.modelspace()


# ---------- Sadeleştirme: AutoCAD'i yoracak/dağınık görünen şeyleri temizle ----------
# Bloklar çizgiye açılır, elips → çoklu çizgi, nokta ve boş yazılar silinir.
def sadelestir(doc):
    sm = doc.modelspace()
    for tur in range(8):
        ins = [e for e in sm if e.dxftype() in ('INSERT', 'DIMENSION')]
        if not ins: break
        for e in ins:
            try: e.explode()
            except Exception as x: print('açılamadı', e.dxf.handle, x); sm.delete_entity(e)
    for e in list(sm):
        t = e.dxftype()
        if t in ('POINT', 'ATTDEF', 'ATTRIB'): sm.delete_entity(e)
        elif t == 'ELLIPSE':
            pts = [(v.x, v.y) for v in e.flattening(0.05)]
            if len(pts) > 1: sm.add_lwpolyline(pts, dxfattribs={'layer': e.dxf.layer, 'color': e.dxf.get('color', 256)})
            sm.delete_entity(e)
        elif t == 'MTEXT' and not e.plain_text().strip(): sm.delete_entity(e)
        elif t == 'TEXT' and not e.dxf.text.strip(): sm.delete_entity(e)


sadelestir(d); sadelestir(dd)


def kut(e):
    b = bbox.extents([e])
    return (b.extmin.x, b.extmin.y, b.extmax.x, b.extmax.y) if b.has_data else None


def icinde(e, x0, y0, x1, y1):
    k = kut(e)
    return k and k[0] >= x0 and k[1] >= y0 and k[2] <= x1 and k[3] <= y1


def metin(e):
    t = e.dxftype()
    if t == 'TEXT': return e.dxf.text
    if t == 'MTEXT': return e.plain_text()
    return ''


def sil(bolge, koru=lambda e: False, yer=m):
    n = 0
    for e in list(yer):
        if icinde(e, *bolge) and not koru(e): yer.delete_entity(e); n += 1
    return n


# ---------- Katmanlar ve yazı stilleri (üretilen çizimler için) ----------
d.styles.add('BHP', font='arial.ttf') if 'BHP' not in d.styles else None
d.styles.add('BHP-K', font='arialbd.ttf') if 'BHP-K' not in d.styles else None
for ad, (renk, lw) in {'BHP': (7, 25), 'BHP-SEMBOL': (7, 35), 'BHP-KABLO': (7, 50), 'BHP-DOLGU': (254, 0), 'BHP-RESIM': (7, 13),
                       'BHP-TABLO': (7, 25), 'BHP-DETAY-DIREK': (7, 18), 'BHP-DETAY-BOX': (7, 18), 'BHP-VAZIYET': (1, 35),
                       'BHP-ANTET': (7, 25)}.items():
    if ad not in d.layers: d.layers.add(ad, color=renk, lineweight=lw)
for lt, desen in (('BHP-KESIK', [4.0, 2.5, -1.5]), ('BHP-GIZLI', [1.5, 0.75, -0.75])):
    if lt not in d.linetypes: d.linetypes.add(lt, pattern=desen, description=lt)

# ---------- Her işte değişen kısımlar: silinir (yerlerine web aracı çizer) ----------
SEMBOL_BASLIK = lambda e: any(s in metin(e).upper() for s in ('KUVVETL', 'ZAYIF', 'SEMBOLLER'))
print('tek hat silindi', sil((-35, 5712, 390, 5796), SEMBOL_BASLIK))
GECIS = lambda e: 'GEÇİŞ' in metin(e).upper() or 'GECIS' in metin(e).upper()
VAZ_RESIM = (-263.2, 5822.0, 13.7, 5989.7)               # boxlu projede TKGM resminin yeri (silme bölgesi)
UYDU_RESIM = (-261.5, 5994.8, 52.7, 6159.8)              # GDZ uydu görüntüsünün yeri (silme bölgesi)
# yeni resim kutuları: ikisi aynı boyutta (277 x 150 mm), boşluksuz doldurulur
RESIM_W, RESIM_H = 277.0, 150.0
VAZ_KUTU = (-263.2, 5830.0, -263.2 + RESIM_W, 5830.0 + RESIM_H)
UYDU_KUTU = (-263.2, 6003.0, -263.2 + RESIM_W, 6003.0 + RESIM_H)
print('vaziyet yazıları silindi', sil((VAZ_RESIM[0] - 2, VAZ_RESIM[1] - 2, VAZ_RESIM[2] + 2, VAZ_RESIM[3] + 2), GECIS))
print('uydu üstü silindi', sil(UYDU_RESIM, GECIS))

# ---------- Montaj detayları: boxlu ve direkli projeden ayrı bloklar ----------
DETAY = (55, 6139.5, 388, 6292)                           # iki projede de aynı yer (çerçeve çizgileri hariç)
cerceve = lambda e: e.dxftype() == 'LINE' and kut(e) and ((kut(e)[2] - kut(e)[0]) > 200 or (kut(e)[3] - kut(e)[1]) > 140)


def detay_blok(kaynak, ad):
    sm = kaynak.modelspace()
    sec = [e for e in sm if icinde(e, *DETAY) and not cerceve(e)]
    for e in sec:
        if e.dxftype() == 'TEXT':
            t = e.dxf.text.strip().upper()
            if 'NAYY' in t or 'NYY' in t: e.dxf.text = '{{KABLO}}'
    b = d.blocks.new(ad)
    if kaynak is d:
        for e in sec:
            b.add_entity(e.copy()); sm.delete_entity(e)
    else:
        imp = Importer(kaynak, d); imp.import_entities(sec, target_layout=b); imp.finalize()
    return b


bBox = detay_blok(d, 'BHP_DETAY_BOX')
bDirek = detay_blok(dd, 'BHP_DETAY_DIREK')
# montaj detayı artık her işte web aracı tarafından çizilir (bhp-cizim.js detay); eski çerçeve çizgileri silinir
print('detay çerçevesi silindi', sil((60, 6135, 390, 6292)))

# ---------- Yazı düzeltmeleri (Türkçe karakter) ve kablo adı ----------
DUZELT = {'BITMIS ZEMIN KOTU': 'BİTMİŞ ZEMİN KOTU', 'IKAZ SERIDI': 'İKAZ ŞERİDİ', 'TUGLA': 'TUĞLA', 'NYY KABLO': '{{KABLO}}',
          'YOL GEÇISLERINDE 100lük': "YOL GEÇİŞLERİNDE Ø100'lük"}
for e in m.query('TEXT'):
    t = e.dxf.text.strip()
    if t in DUZELT: e.dxf.text = DUZELT[t]

# kablo kanalı üstündeki uyarı yazısı "BİTMİŞ ZEMİN KOTU" yazısına biniyordu: biraz küçült (üst kenarı yerinde kalır)
for e in m.query('MTEXT'):
    if 'demiryolu' in e.plain_text() and kut(e)[2] < 390:
        e.dxf.char_height = e.dxf.char_height * 0.86

# ---------- Antet değerleri → yer tutucular ----------
ANTET = [  # (yaklaşık sol alt x, y, yer tutucu)
    (-221.9, 5537.3, '{{MALSAHIBI}}'), (-221.8, 5530.7, '{{KULLANIM}}'), (-221.2, 5523.2, '{{ADRES}}'),
    (-261.8, 5500.6, '{{IL}}'), (-239.9, 5501.2, '{{ILCE}}'), (-211.5, 5501.2, '{{BELEDIYE}}'), (-180.0, 5500.9, '{{MAHALLE}}'),
    (-144.1, 5501.0, '{{PAFTA}}'), (-116.3, 5501.2, '{{ADA}}'), (-96.2, 5501.2, '{{PARSEL}}'),
    (-209.0, 5468.9, '{{KURULU}}'), (-173.6, 5468.9, '{{TALEP}}'), (-137.8, 5469.2, '{{BB}}'), (-117.7, 5469.2, '{{KAT}}'),
    (-97.3, 5469.0, '{{ALAN}}'),
]
for x, y, yt in ANTET:
    aday = [e for e in m.query('TEXT') if kut(e) and abs(kut(e)[0] - x) < 1.2 and abs(kut(e)[1] - y) < 1.2]
    if len(aday) != 1: raise SystemExit(f'antet yeri bulunamadı: {yt} {len(aday)}')
    e = aday[0]
    # hücrenin ortasına hizala (değerler uzunluğa göre taşmasın diye ortalı yazılır)
    if yt in ('{{MALSAHIBI}}', '{{KULLANIM}}', '{{ADRES}}'):
        e.dxf.text = yt
    else:
        k = kut(e); cx = {'{{IL}}': -252.0, '{{ILCE}}': -225.5, '{{BELEDIYE}}': -197.0, '{{MAHALLE}}': -167.5, '{{PAFTA}}': -140.0,
                         '{{ADA}}': -113.5, '{{PARSEL}}': -89.0, '{{KURULU}}': -200.0, '{{TALEP}}': -165.0, '{{BB}}': -136.5,
                         '{{KAT}}': -116.5, '{{ALAN}}': -90.5}[yt]
        e.dxf.text = yt
        e.set_placement((cx, (k[1] + k[3]) / 2), align=A.MIDDLE_CENTER)

# ---------- PVC boru çapı tablosu (kullanıcının tablosu; DWG'de Excel olarak gömülüydü) ----------
BX0, BY0, BX1, BY1 = -263.0, 6167.3, -163.3, 6289.9
L = 'BHP-TABLO'
def cz(x1, y1, x2, y2): m.add_line((x1, y1), (x2, y2), dxfattribs={'layer': L})
def yz(t, x, y, h=2.3, hiza=A.MIDDLE_CENTER, st='BHP'):
    m.add_text(t, height=h, dxfattribs={'style': st, 'layer': L}).set_placement((x, y), align=hiza)
KES = ['1,5', '2,5', '4', '6', '10', '16', '25', '35', '50', '70', '95', '120', '150', '185']
CAP = [[14, 14, 14, 18], [14, 14, 14, 18], [14, 14, 18, 26], [14, 18, 26, 26], [14, 26, 26, 32], [14, 26, 32, 32], [18, 32, 32, 40],
       [18, 40, 40, 50], [26, 40, 50, 50], [26, 50, 50, 50], [32, 50, 50, 50], [32, 50, 50, '-'], [40, 50, '-', '-'], [40, '-', '-', '-']]
W = BX1 - BX0
kx = [BX0, BX0 + W * 0.29] + [BX0 + W * (0.29 + 0.1775 * i) for i in range(1, 5)]
y = BY1
m.add_lwpolyline([(BX0, BY0), (BX1, BY0), (BX1, BY1), (BX0, BY1)], close=True, dxfattribs={'layer': L})
yz('NV (NYA) iletkenleri kullanılması durumunda gerekli', (BX0 + BX1) / 2, y - 3.2, 2.3)
yz('en küçük PVC boru çapları', (BX0 + BX1) / 2, y - 6.4, 2.3)
y -= 8.6; cz(BX0, y, BX1, y)
ust = y; y -= 15.5                                       # daire resimleri satırı
for i in range(4):
    cx, cy, r = (kx[i + 1] + kx[i + 2]) / 2, ust - 7.4, 6.6
    m.add_circle((cx, cy), r, dxfattribs={'layer': L})
    yer = {0: [(0, 0)], 1: [(-2.9, 0), (2.9, 0)], 2: [(0, 2.9), (-2.9, -1.9), (2.9, -1.9)], 3: [(-2.4, 2.4), (2.4, 2.4), (-2.4, -2.4), (2.4, -2.4)]}[i]
    rr = 2.6 if i < 2 else 2.1
    for dx, dy in yer:
        h = m.add_hatch(color=7, dxfattribs={'layer': L}); h.paths.add_polyline_path(
            [(cx + dx + rr * __import__('math').cos(a / 16 * 6.2832), cy + dy + rr * __import__('math').sin(a / 16 * 6.2832)) for a in range(16)], is_closed=True)
        m.add_circle((cx + dx, cy + dy), rr, dxfattribs={'layer': L})
cz(kx[1], y, BX1, y)
for t, yy in (('İletkenlerin', ust - 6), ('boru içindeki', ust - 9.6), ('durumu', ust - 13.2)): yz(t, (kx[0] + kx[1]) / 2, yy, 2.2)
yz('Boru İç Çapı', (kx[1] + BX1) / 2, y - 3.4, 2.3)
y -= 6.8; cz(BX0, y, BX1, y)
bas = y; y -= 12
for t, yy in (('İletken', bas - 2.6), ('kesiti', bas - 6), ('mm²', bas - 9.4)): yz(t, (kx[0] + kx[1]) / 2, yy, 2.2)
for i in range(4):
    for t, yy in (('Sıva', bas - 2.6), ('altı', bas - 6), ('mm', bas - 9.4)): yz(t, (kx[i + 1] + kx[i + 2]) / 2, yy, 2.2)
cz(BX0, y, BX1, y)
sh = (y - BY0) / len(KES)
for j, k in enumerate(KES):
    yy = y - sh * (j + 0.5)
    yz(k, (kx[0] + kx[1]) / 2, yy, 2.2)
    for i in range(4): yz(str(CAP[j][i]), (kx[i + 1] + kx[i + 2]) / 2, yy, 2.2)
    if j: cz(BX0, y - sh * j, BX1, y - sh * j)
cz(kx[1], BY0, kx[1], ust)
for i in range(2, 5): cz(kx[i], BY0, kx[i], ust);
# ---------- Resimler ----------
def resim(ad, isim, k, px, py):
    x0, y0, x1, y1 = k
    w, h = x1 - x0, y1 - y0
    s = min(w / px, h / py); gw, gh = px * s, py * s
    ins = (x0 + (w - gw) / 2, y0 + (h - gh) / 2)
    tanim = d.add_image_def(filename=ad, size_in_pixel=(px, py), name=isim)
    r = m.add_image(tanim, insert=ins, size_in_units=(gw, gh), rotation=0, dxfattribs={'layer': 'BHP-RESIM'})
    return r, [round(ins[0], 4), round(ins[1], 4), round(ins[0] + gw, 4), round(ins[1] + gh, 4)]
UYDU_PX = VAZ_PX = (2000, round(2000 * RESIM_H / RESIM_W))
r1, kUydu = resim('{{UYDU}}', 'BHP-UYDU', UYDU_KUTU, *UYDU_PX)
r2, kVaz = resim('{{VAZIYET}}', 'BHP-VAZIYET', VAZ_KUTU, *VAZ_PX)
for k in (UYDU_KUTU, VAZ_KUTU):                            # resim çerçevesi
    m.add_lwpolyline([(k[0], k[1]), (k[2], k[1]), (k[2], k[3]), (k[0], k[3])], close=True, dxfattribs={'layer': 'BHP-TABLO', 'lineweight': 35})
m.add_text('GDZ BAĞLANTI GÖRÜŞÜ EKİ UYDU GÖRÜNTÜSÜ', height=2.8, dxfattribs={'style': 'BHP-K', 'layer': 'BHP-TABLO'}).set_placement((UYDU_KUTU[0], UYDU_KUTU[3] + 2.2), align=A.BOTTOM_LEFT)
# "geçiş izinleri" uyarısı iki resmin arasına
for e in m.query('MTEXT'):
    if 'GEÇİŞ' in e.plain_text().upper():
        e.dxf.attachment_point = 4; e.dxf.insert = (UYDU_KUTU[0], (VAZ_KUTU[3] + UYDU_KUTU[1]) / 2); e.dxf.width = RESIM_W; e.dxf.char_height = 3.6
        e.text = e.plain_text().replace('\n', ' ').strip()
m.set_redraw_order([(r1.dxf.handle, '1'), (r2.dxf.handle, '2')])

# ---------- Tek düzen: tek yazı tipi (Arial), tek renk, iki çizgi tipi ----------
KALINLAR = ('BD', 'BOLD', 'BLACK', 'HEAVY')
def kalin_mi(doc, e):
    st = doc.styles.get(e.dxf.get('style', 'Standard')) if e.dxf.get('style', 'Standard') in doc.styles else None
    f = ((st.dxf.font if st else '') + ' ' + (st.dxf.name if st else '')).upper()
    if any(k in f for k in KALINLAR): return True
    return e.dxftype() == 'MTEXT' and '|b1' in e.text
def duzenle(yer):
    for e in yer:
        t = e.dxftype()
        if e.dxf.layer.startswith('BHP'): continue
        e.dxf.color = 256
        lt = (e.dxf.get('linetype') or 'BYLAYER').upper()
        if lt not in ('BYLAYER', 'CONTINUOUS', 'BYBLOCK'):
            e.dxf.linetype = 'BHP-KESIK'
        if e.dxf.hasattr('ltscale'): e.dxf.discard('ltscale')
        if t == 'TEXT':
            k0 = kut(e); w0 = (k0[2] - k0[0]) if k0 else 0
            e.dxf.style = 'BHP-K' if kalin_mi(d, e) else 'BHP'
            e.dxf.width = 1; e.dxf.oblique = 0
            k1 = kut(e); w1 = (k1[2] - k1[0]) if k1 else 0
            if w0 > 0.5 and w1 > w0 * 1.02: e.dxf.width = round(max(0.6, w0 / w1), 3)   # eski genişliğine sığsın
        elif t == 'MTEXT':
            k = kalin_mi(d, e)
            e.text = e.plain_text(split=False).replace('\n', '\\P')
            e.dxf.style = 'BHP-K' if k else 'BHP'
        elif t == 'HATCH' and not e.dxf.solid_fill:
            e.dxf.color = 256
duzenle(m)
# Arial eski yazı tiplerinden geniş: tablo hücresinden taşan yazıyı sağındaki ilk dikey çizgiye sığacak kadar daralt
dikey = []
for e in m.query('LINE LWPOLYLINE'):
    pts = [(e.dxf.start.x, e.dxf.start.y), (e.dxf.end.x, e.dxf.end.y)] if e.dxftype() == 'LINE' else [(p[0], p[1]) for p in e.get_points()]
    if e.dxftype() == 'LWPOLYLINE' and e.closed: pts.append(pts[0])
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        if abs(ax - bx) < 0.05 and abs(ay - by) > 2: dikey.append((ax, min(ay, by), max(ay, by)))
daralan = 0
for e in m.query('TEXT'):
    if e.dxf.layer.startswith('BHP') or (e.dxf.get('halign', 0) or 0) != 0: continue
    k = kut(e)
    if not k: continue
    ym = (k[1] + k[3]) / 2
    sag = [x for x, y0, y1 in dikey if x > k[0] + 1 and y0 <= ym <= y1]
    if not sag: continue
    xr = min(sag)
    if k[2] > xr - 0.5 and xr - k[0] > 3:
        e.dxf.width = round(max(0.5, (xr - 0.8 - k[0]) / (k[2] - k[0])), 3); daralan += 1
print('daraltılan yazı', daralan)
for ad in ('BHP_DETAY_BOX', 'BHP_DETAY_DIREK'): duzenle(d.blocks.get(ad))
# taramalar: ilişkisiz, sınır bayrakları yalnız dış/çoklu çizgi (AutoCAD "expected group code 47" hatası vermesin)
for yer in [m] + [d.blocks.get(a) for a in ('BHP_DETAY_BOX', 'BHP_DETAY_DIREK')]:
    for h in yer.query('HATCH'):
        h.dxf.associative = 0
        for p in h.paths:
            p.path_type_flags = (p.path_type_flags & 2) | 1
            if hasattr(p, 'source_boundary_objects'): p.source_boundary_objects = []
# katmanlar: siyah/beyaz, düz çizgi (renk 7); kullanıcının "uyarı" katmanları da tek renk
for k in d.layers:
    if k.dxf.name.startswith('BHP'): continue
    k.dxf.color = 7; k.dxf.linetype = 'Continuous'
# ---------- TEDAŞ "Enerji kabloları uygulama usul ve esasları" metni: doğru sırayla birleştirilip iki eşit sütuna dizilir ----------
# Kullanıcının paftasında metin parçalı duruyordu: belgenin başı sağ sütunda, devamı sol sütunun alt yarısında (Madde 4'ten),
# sonu sol sütunun üst yarısında (Madde 7'den). Satırlar paragraflara birleştirilir, aynı yazı boyuyla yeniden kırılır.
import re as _re
from ezdxf.fonts import fonts as _fonts
_FN = {}
def gen(t, h, kalin=False):                                # gerçek Arial ölçüsü (AutoCAD yazı yüksekliği = büyük harf yüksekliği)
    k = (h, kalin)
    if k not in _FN: _FN[k] = _fonts.make_font('arialbd.ttf' if kalin else 'arial.ttf', h)
    return _FN[k].text_width(t)
SX0, SX1, SY0, SY1 = 391.0, 684.6, 5393.6, 6293.6
sag, solA, solU, alinti, kmt = [], [], [], None, None
for e in list(m):
    k = kut(e)
    if not k or k[0] < SX0 - 1 or e.dxftype() not in ('TEXT', 'MTEXT'): continue
    t = metin(e).strip()
    if e.dxftype() == 'MTEXT' and 'demiryolu' in t: alinti = ' '.join(t.split()); m.delete_entity(e); continue
    if e.dxftype() == 'MTEXT': kmt = ' '.join(t.split()); m.delete_entity(e); continue
    (sag if k[0] > 548 else solU if k[1] >= 5851 else solA).append((-k[1], t)); m.delete_entity(e)
akis = [t for _, t in sorted(sag)] + [t for _, t in sorted(solA)] + ([kmt] if kmt else []) + [t for _, t in sorted(solU)]
BAS = _re.compile(r'^(BÖLÜM|Madde|MADDE|[A-Z]\s*-\s*[A-ZÇĞİÖŞÜ]|\d+(\.\d+)+\.?\s|\d+-[A-ZÇĞİÖŞÜ])')
MAD = _re.compile(r'^[a-zçğıöşü]\)\s')
par = []                                                   # (tür, metin): baslik / madde / normal
for t in akis:
    t = ' '.join(t.split())
    if not t: continue
    ustbas = t.upper() == t and any(ch.isalpha() for ch in t)
    if BAS.match(t) or (ustbas and len(t) < 90):
        if par and par[-1][0] == 'baslik' and ustbas and not BAS.match(t): par[-1] = ('baslik', par[-1][1] + ' ' + t)
        else: par.append(('baslik', t))
    elif MAD.match(t) or not par: par.append(('madde', t))
    elif par[-1][0] == 'baslik' and par[-1][1].endswith(':') is False and len(par[-1][1]) < 40 and not t[0].isupper(): par[-1] = ('baslik', par[-1][1] + ' ' + t)
    else:
        if par[-1][0] == 'baslik': par.append(('normal', t))
        else: par[-1] = (par[-1][0], par[-1][1] + ' ' + t)
ilk_baslik = par.pop(0)[1] if par and 'ELEKTRİK DAĞITIM' in par[0][1] else ''
print('usul ve esaslar:', len(akis), 'satır →', len(par), 'paragraf')
GAP = 4.0
KW = (SX1 - SX0 - 3 * GAP) / 2
UST = SY1 - 4 - 12                                         # başlık şeridinin altı
ALT = SY0 + 4 + 22                                         # alıntı kutusunun üstü
def diz(h):
    satirlar = []                                          # (metin, kalin, paragraf başı)
    for tur, t in par:
        kal = tur == 'baslik'
        sat, cur = [], ''
        for w in t.split():
            aday = (cur + ' ' + w).strip()
            if gen(aday, h, kal) > KW - 7 and cur: sat.append(cur); cur = w
            else: cur = aday
        if cur: sat.append(cur)
        for i, x in enumerate(sat): satirlar.append((x, kal, i == 0))
    return satirlar
def yukseklik(sat, h): return sum(h * 1.5 + (h * 0.6 if bas else 0) for _, _, bas in sat)
h = 3.4
while h > 1.6 and yukseklik(diz(h), h) > 2 * (UST - ALT) * 0.985: h -= 0.02
sat = diz(h)
print('usul ve esaslar yazı boyu', round(h, 2), 'satır', len(sat))
kol, y = 0, UST
for x, kal, bas in sat:
    dy = h * 1.5 + (h * 0.6 if bas else 0)
    if y - dy < ALT:
        kol += 1; y = UST
        if kol > 1: print('UYARI: metin sığmadı'); break
    y -= dy
    m.add_text(x, height=h, dxfattribs={'style': 'BHP-K' if kal else 'BHP', 'layer': 'BHP-TABLO', 'insert': (SX0 + GAP + kol * (KW + GAP), y)})
m.add_line((SX0 + GAP + KW + GAP / 2, ALT), (SX0 + GAP + KW + GAP / 2, UST + 2), dxfattribs={'layer': 'BHP-TABLO'})
bas_t = 'ELEKTRİK DAĞITIM ŞEBEKELERİ ENERJİ KABLOLARI UYGULAMA USUL VE ESASLARI'
m.add_text(bas_t, height=3.2, dxfattribs={'style': 'BHP-K', 'layer': 'BHP-TABLO'}).set_placement(((SX0 + SX1) / 2, SY1 - 6.5), align=A.MIDDLE_CENTER)
m.add_line((SX0, SY1 - 12), (SX1, SY1 - 12), dxfattribs={'layer': 'BHP-TABLO', 'lineweight': 35})
if ilk_baslik: print('ilk başlık:', ilk_baslik[:90])
if alinti:
    ab = (SX0 + GAP, SY0 + 4, SX1 - GAP, SY0 + 4 + 18)
    m.add_lwpolyline([(ab[0], ab[1]), (ab[2], ab[1]), (ab[2], ab[3]), (ab[0], ab[3])], close=True, dxfattribs={'layer': 'BHP-TABLO', 'lineweight': 35})
    mt = m.add_mtext(alinti, dxfattribs={'style': 'BHP-K', 'layer': 'BHP-TABLO', 'char_height': 2.4, 'width': ab[2] - ab[0] - 4, 'attachment_point': 5})
    mt.dxf.insert = ((ab[0] + ab[2]) / 2, (ab[1] + ab[3]) / 2)

# kullanılmayan bloklar, çizgi tipleri, yazı stilleri silinir
kullanilan = {'BHP_DETAY_BOX', 'BHP_DETAY_DIREK'}
def blok_ref(yer):
    for e in yer.query('INSERT'):
        if e.dxf.name not in kullanilan:
            kullanilan.add(e.dxf.name); blok_ref(d.blocks.get(e.dxf.name))
blok_ref(m)
for ad in ('BHP_DETAY_BOX', 'BHP_DETAY_DIREK'): blok_ref(d.blocks.get(ad))
for ds in d.dimstyles:                                     # ölçü oku blokları kalmalı
    for a in ('dimblk', 'dimblk1', 'dimblk2', 'dimldrblk'):
        v = ds.dxf.get(a)
        if v: kullanilan.add(v)
for b in list(d.blocks):
    if not b.name.startswith(('*', '_')) and b.name not in kullanilan and not b.is_any_layout:
        try: d.blocks.delete_block(b.name, safe=False)
        except Exception as x: print('blok silinemedi', b.name, x)
lt_kul = {'BYLAYER', 'BYBLOCK', 'CONTINUOUS', 'BHP-KESIK', 'BHP-GIZLI'}
for lt in list(d.linetypes):
    if lt.dxf.name.upper() not in lt_kul:
        try: d.linetypes.remove(lt.dxf.name)
        except Exception: pass
for st in list(d.styles):
    if st.dxf.name not in ('Standard', 'BHP', 'BHP-K'):
        try: d.styles.remove(st.dxf.name)
        except Exception: pass
d.styles.get('Standard').dxf.font = 'arial.ttf'
# boyut stilleri yazı stili olarak silinen stilleri gösterebilir: Standard'a çevir
for ds in d.dimstyles:
    try: ds.dxf.dimtxsty = 'Standard'
    except Exception: pass

# ---------- Kaydet; web aracının bölgelerini başa yaz ----------
TX0, TY0, TX1, TY1 = PAFTA[0] - 10, PAFTA[1] - 10, PAFTA[2] + 10, PAFTA[3] + 10
m.dxf.extmin = (TX0, TY0, 0); m.dxf.extmax = (TX1, TY1, 0)
d.header['$EXTMIN'] = (TX0, TY0, 0); d.header['$EXTMAX'] = (TX1, TY1, 0)
d.header['$LIMMIN'] = (TX0, TY0); d.header['$LIMMAX'] = (TX1, TY1)
d.set_modelspace_vport(height=(TY1 - TY0) * 1.05, center=((TX0 + TX1) / 2, (TY0 + TY1) / 2))
d.audit()
d.saveas(cikis, encoding='utf-8')
bilgi = {'model': m.block_record_handle, 'surum': 4,
         'bolgeler': {'tekhat': [18, 5714, 386, 5841], 'hesap': [18, 5847, 386, 5986], 'detay': [68, 6141, 386, 6290],
                      'guc': [-267.5, 5673, -79, 5803]},
         'resim': {'uydu': kUydu, 'vaziyet': kVaz}}
s = open(cikis, encoding='utf-8').read()
open(cikis, 'w', encoding='utf-8').write('999\nBHP ' + json.dumps(bilgi) + '\n' + s)
print(json.dumps(bilgi))
