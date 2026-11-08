# Paftadaki sabit yazıların üst üste binmesini ve tablo çizgilerinden taşmasını düzeltir.
#
# Kullanım (depo kökünden; pafta-duzen.py ve maske-ekle.py'den SONRA, bir kez):
#   python3 baglanti-hatti/yazi-duzelt.py baglanti-hatti/BHP-SABLON.dxf
#
# Yapılanlar:
#   - tablo hücresinden taşan yazılar (sağdaki çizgiyi geçen) yazı genişliği daraltılarak hücreye sığdırılır
#   - sembol tablosunda "30 mA / 300 mA" ile "K.A.R" ve "B T K" ile "P T T" küçültülüp ayrılır
#   - açıklamalarda sağ sütuna taşan satır daraltılır
#   - PVC boru tablosunda "Boru İç Çapı" başlığının ortasından geçen çizgi o satırda kesilir
import sys, io, json
import ezdxf
from ezdxf import bbox

sablon = sys.argv[1]
ham = open(sablon, encoding='utf-8').read()
ust, bilgi_satir, govde = ham.split('\n', 2)
assert ust == '999' and bilgi_satir.startswith('BHP ')
bilgi = json.loads(bilgi_satir[4:])
if bilgi.get('yazi'): raise SystemExit('yazılar zaten düzeltilmiş (yazi: %s)' % bilgi['yazi'])
d = ezdxf.read(io.StringIO(govde))
m = d.modelspace()


def kut(e):
    b = bbox.extents([e])
    return (b.extmin.x, b.extmin.y, b.extmax.x, b.extmax.y) if b.has_data else None


def metin(e):
    return ' '.join(e.dxf.text.split())


def bul(t):
    l = [e for e in m.query('TEXT') if metin(e) == t]
    assert l, 'bulunamadı: ' + t
    return l


def sigdir(e, sag):
    """sol hizalı yazıyı sağ ucu 'sag' değerini geçmeyecek kadar daraltır"""
    k = kut(e)
    if k[2] <= sag: return False
    e.dxf.width = e.dxf.get('width', 1) * (sag - k[0]) / (k[2] - k[0])
    return True


# ---------- Dikey çizgilerden taşan yazılar ----------
seg = []
for e in m.query('LINE'):
    seg.append(((e.dxf.start.x, e.dxf.start.y), (e.dxf.end.x, e.dxf.end.y)))
for e in m.query('LWPOLYLINE'):
    p = [(a[0], a[1]) for a in e.get_points()]
    if e.closed: p.append(p[0])
    seg += list(zip(p, p[1:]))
dikey = [(a[0], min(a[1], c[1]), max(a[1], c[1])) for a, c in seg if abs(a[0] - c[0]) < 0.01 and abs(a[1] - c[1]) > 1]

n = 0
for e in m.query('TEXT'):
    t = metin(e)
    if len(t) < 6 or e.dxf.get('rotation', 0) or e.get_placement()[0].name != 'LEFT': continue
    k = kut(e)
    if not k: continue
    x0, y0, x1, y1 = k; h = y1 - y0
    for x, ya, yb in dikey:
        # çizgi yazının sağ üçte birinden geçiyorsa yazı hücreden taşmıştır
        if x0 + (x1 - x0) * 0.6 < x < x1 - 0.3 and ya < y0 + h * 0.3 and yb > y1 - h * 0.3:
            if sigdir(e, x - 0.8): n += 1; print('sığdırıldı:', t[:45])
            break
print('hücreye sığdırılan yazı:', n)

# ---------- Sembol tablosu: kaçak akım rölesi ve zayıf akım kutusu ----------
for kar in bul('K.A.R'):
    ka = kut(kar)
    ma = min((e for e in m.query('TEXT') if metin(e) in ('30 mA', '300 mA')), key=lambda e: abs(kut(e)[1] - ka[1]) + abs(kut(e)[0] - ka[0]))
    kar.dxf.height = ma.dxf.height = 1.9
    ust_k = kut(kar)[3]
    dy = ust_k + 0.25 - kut(ma)[1]
    ma.dxf.insert = (ma.dxf.insert.x, ma.dxf.insert.y + dy)
    if ma.dxf.hasattr('align_point'): ma.dxf.align_point = (ma.dxf.align_point.x, ma.dxf.align_point.y + dy)
for t in ('B T K', 'P T T'):
    for e in bul(t): e.dxf.height = 1.9
btk, ptt = bul('B T K')[0], bul('P T T')[0]
if kut(ptt)[3] > kut(btk)[1] - 0.2:
    dy = kut(ptt)[3] - kut(btk)[1] + 0.2
    btk.dxf.insert = (btk.dxf.insert.x, btk.dxf.insert.y + dy / 2); ptt.dxf.insert = (ptt.dxf.insert.x, ptt.dxf.insert.y - dy / 2)

# ---------- Açıklamalar: sağ sütuna taşan satır ----------
for e in [e for e in m.query('TEXT') if metin(e).startswith('duvar birleşim noktalarından')]:
    k = kut(e)
    sag = min((kut(o)[0] for o in m.query('TEXT') if o is not e and kut(o) and kut(o)[0] > k[0] + 20
               and kut(o)[1] < k[3] and kut(o)[3] > k[1]), default=k[2])
    sigdir(e, sag - 1.5)

# ---------- PVC boru tablosu: "Boru İç Çapı" başlığını bölen çizgi ----------
bic = bul('Boru İç Çapı')[0]
bk = kut(bic)
for e in list(m.query('LINE')):
    a, c = e.dxf.start, e.dxf.end
    if abs(a.x - c.x) < 0.01 and bk[0] < a.x < bk[2] and min(a.y, c.y) < bk[1] and max(a.y, c.y) > bk[3]:
        # başlık satırının alt ve üst yatay çizgileri
        yat = sorted(y for (p, q) in seg if abs(p[1] - q[1]) < 0.01 and min(p[0], q[0]) < a.x < max(p[0], q[0])
                     for y in [p[1]] if min(a.y, c.y) < y < max(a.y, c.y))
        alt = max(y for y in yat if y < bk[1]); ustc = min(y for y in yat if y > bk[3])
        lo, hi = min(a.y, c.y), max(a.y, c.y)
        e.dxf.start = (a.x, lo); e.dxf.end = (a.x, alt)
        m.add_line((a.x, ustc), (a.x, hi), dxfattribs={'layer': e.dxf.layer, 'color': e.dxf.color, 'linetype': e.dxf.linetype})
        print('çizgi kesildi: x', round(a.x, 2), 'y', round(alt, 2), '..', round(ustc, 2))

bilgi['yazi'] = 1
d.audit()
cik = io.StringIO(); d.write(cik)
open(sablon, 'w', encoding='utf-8').write('999\nBHP ' + json.dumps(bilgi) + '\n' + cik.getvalue())
print('tamam')
