# Paftayı düzenli bir ızgaraya yerleştirir: her bölüm aynı tip çerçeve + başlık şeridi içinde.
#
# Kullanım (depo kökünden; sablon-olustur.py ve kapak-ekle.py'den SONRA, bir kez):
#   python3 baglanti-hatti/pafta-duzen.py baglanti-hatti/BHP-SABLON.dxf
#
# Düzen (mm, kâğıt -269.5..684.6 x 5393.6..6293.6):
#   Sol sütun  (x -267.8..13): açıklamalar · GDZ uydu görüntüsü · vaziyet planı · güç dağıtım tablosu + vaziyet sembolleri ·
#                              kapak (antet) + PVC boru çapı tablosu
#   Orta sütun (x 18..388):    montaj detayı · kablo kanalı detayı · tek hat şeması · gerilim düşümü hesabı · semboller
#   Sağ sütun  (x 391..684.6): TEDAŞ usul ve esasları (yerinde kalır)
# Her işte değişen bölümler (tek hat, hesap, montaj detayı, güç tablosu, vaziyet işaretleri) ortak/bhp-cizim.js ile
# 999 açıklamasındaki yeni bölgelere aynı çerçeve biçimiyle çizilir.
import sys, io, json
import ezdxf
from ezdxf import bbox
from ezdxf.math import Matrix44
from ezdxf.enums import TextEntityAlignment as A

sablon = sys.argv[1]
ham = open(sablon, encoding='utf-8').read()
ust, bilgi_satir, govde = ham.split('\n', 2)
assert ust == '999' and bilgi_satir.startswith('BHP ')
bilgi = json.loads(bilgi_satir[4:])
if bilgi.get('duzen'): raise SystemExit('pafta zaten düzenlenmiş (duzen: %s)' % bilgi['duzen'])
d = ezdxf.read(io.StringIO(govde))
m = d.modelspace()

# ---------- Izgara ----------
Y0, Y1 = 5394.7, 6290.5                       # alt (kapak alt kenarı) ve üst
G = 5.4                                       # bölümler arası boşluk
AX0, AX1 = -267.8, 13.0                       # sol sütun
BX0, BX1 = 18.0, 388.0                        # orta sütun
BAND = 7.0                                    # başlık şeridi (gerilim düşümü hesabındaki gibi)


def dilim(yuks):                              # yukarıdan aşağı yükseklikler → [(alt, üst)]
    y, l = Y1, []
    for h in yuks:
        l.append((y - h, y)); y -= h + G
    return l


A0, A1, A2, A3, A4 = dilim([138, 160, 166, 134, 276.2])      # açıklama, uydu, vaziyet, güç, kapak
B1, B2, B3, B4, B5 = dilim([155, 158, 152, 140, 269.2])      # montaj, kanal, tek hat, hesap, semboller


def kut(e):
    b = bbox.extents([e])
    return (b.extmin.x, b.extmin.y, b.extmax.x, b.extmax.y) if b.has_data else None


def merkez(e, k):
    if e.dxftype() in ('TEXT', 'MTEXT'): return e.dxf.insert.x, e.dxf.insert.y
    return (k[0] + k[2]) / 2, (k[1] + k[3]) / 2


def metin(e):
    return ' '.join((e.dxf.text if e.dxftype() == 'TEXT' else e.plain_text() if e.dxftype() == 'MTEXT' else '').split())


def sec(x0, y0, x1, y1, haric=()):
    l = []
    for e in m:
        if e in haric: continue
        k = kut(e)
        if not k or (k[2] - k[0]) > 450 or (k[3] - k[1]) > 450: continue       # pafta çerçevesi
        cx, cy = merkez(e, k)
        if x0 <= cx <= x1 and y0 <= cy <= y1: l.append(e)
    return l


def tasi(liste, kaynak, hedef, enFazla=1.0, hiza='orta'):
    """kaynak kutuyu hedef kutuya oran koruyarak (en çok enFazla) taşır; hiza: orta / ust"""
    s = min((hedef[2] - hedef[0]) / (kaynak[2] - kaynak[0]), (hedef[3] - hedef[1]) / (kaynak[3] - kaynak[1]), enFazla)
    ox = (hedef[0] + hedef[2]) / 2 - (kaynak[0] + kaynak[2]) / 2 * s
    oy = ((hedef[1] + hedef[3]) / 2 - (kaynak[1] + kaynak[3]) / 2 * s) if hiza == 'orta' else hedef[3] - kaynak[3] * s
    M = Matrix44.scale(s, s, 1) @ Matrix44.translate(ox, oy, 0)
    for e in liste:
        try: e.transform(M)
        except Exception as x: print('taşınamadı', e.dxftype(), x)
    return s


def sil(liste):
    for e in liste: m.delete_entity(e)


L = 'BHP-TABLO'
def blok(x0, y0, x1, y1, baslik):
    """standart bölüm: kalın çerçeve + üstte başlık şeridi; iç kutuyu döndürür"""
    m.add_lwpolyline([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], close=True, dxfattribs={'layer': L, 'lineweight': 50})
    if baslik:
        m.add_line((x0, y1 - BAND), (x1, y1 - BAND), dxfattribs={'layer': L})
        m.add_text(baslik, height=3.0, dxfattribs={'style': 'BHP-K', 'layer': L}).set_placement(((x0 + x1) / 2, y1 - BAND / 2), align=A.MIDDLE_CENTER)
        return (x0 + 3, y0 + 3, x1 - 3, y1 - BAND - 3)
    return (x0 + 3, y0 + 3, x1 - 3, y1 - 3)


# ---------- Eski başlıklar ve çerçeveler ----------
eski = [e for e in m.query('TEXT MTEXT') if metin(e) in ('GDZ BAĞLANTI GÖRÜŞÜ EKİ UYDU GÖRÜNTÜSÜ', 'VAZİYET PLANI', 'KABLO KANALI DETAYI',
                                                         'ELEKTRİK TESİSATI İLE İLGİLİ AÇIKLAMALAR')]
eski += [e for e in m.query('LWPOLYLINE') if kut(e) and kut(e)[0] < 70 and kut(e)[2] > -170 and kut(e)[1] > 6160 and (kut(e)[2] - kut(e)[0]) > 200]  # açıklama çift çerçevesi
eski += [e for e in m.query('LWPOLYLINE') if e.dxf.layer == L and kut(e) and abs((kut(e)[2] - kut(e)[0]) - 277) < 1 and abs((kut(e)[3] - kut(e)[1]) - 150) < 1]  # resim çerçeveleri
print('silinen eski başlık / çerçeve:', len(eski)); sil(eski)

# ---------- Gruplar (eski yerlerinden) ----------
imaj = {round(kut(e)[1]): e for e in m.query('IMAGE') if kut(e)[0] < -200 and kut(e)[3] > 5800}
uydu_im, vaz_im = imaj[6003], imaj[5830]
gecis = [e for e in m.query('MTEXT') if 'GEÇİŞ' in metin(e).upper()]
g_aciklama = sec(-162.5, 6159, 67, 6292)
g_pvc = sec(-265, 6159, -162.5, 6292)
g_kanal = sec(60, 5988, 390, 6139)
g_sembol = sec(-48, 5390, 390, 5708)
g_lejant = sec(-90, 5760, 20, 5826, haric=[vaz_im])
print('gruplar: açıklama', len(g_aciklama), 'pvc', len(g_pvc), 'kanal', len(g_kanal), 'sembol', len(g_sembol), 'lejant', len(g_lejant))

def sinir(l):
    k = [kut(e) for e in l]
    return (min(a[0] for a in k), min(a[1] for a in k), max(a[2] for a in k), max(a[3] for a in k))

# ---------- Sol sütun ----------
ic = blok(AX0, A0[0], AX1, A0[1], 'ELEKTRİK TESİSATI İLE İLGİLİ AÇIKLAMALAR')
print('açıklama ölçek', round(tasi(g_aciklama, sinir(g_aciklama), ic), 3))
ic = blok(AX0, A1[0], AX1, A1[1], 'GDZ BAĞLANTI GÖRÜŞÜ EKİ UYDU GÖRÜNTÜSÜ')
RES_W = ic[2] - ic[0] + 4; RES_H = RES_W * 1083 / 2000                 # resimler 2000 x 1083 px oranında
uydu_k = (AX0 + 1, A1[0] + 1, AX0 + 1 + RES_W, A1[0] + 1 + RES_H)
tasi([uydu_im], kut(uydu_im), uydu_k, enFazla=5)
ic = blok(AX0, A2[0], AX1, A2[1], 'VAZİYET PLANI')
vaz_k = (AX0 + 1, A2[1] - BAND - 1 - RES_H, AX0 + 1 + RES_W, A2[1] - BAND - 1)
tasi([vaz_im], kut(vaz_im), vaz_k, enFazla=5)
for e in gecis:                                                          # uyarı: vaziyet resminin altında
    e.dxf.insert = ((AX0 + AX1) / 2, (A2[0] + vaz_k[1]) / 2); e.dxf.attachment_point = 5; e.dxf.width = AX1 - AX0 - 6; e.dxf.char_height = 3.0
m.add_line((AX0, vaz_k[1]), (AX1, vaz_k[1]), dxfattribs={'layer': L})
# güç tablosu (sol) + vaziyet sembolleri (sağ)
lj = sinir(g_lejant); LJ_W = (lj[2] - lj[0]) * 1.12
tasi(g_lejant, lj, (AX1 - LJ_W, A3[1] - (lj[3] - lj[1]) * 1.12, AX1, A3[1]), enFazla=1.12, hiza='ust')
GUC = [AX0, A3[0], AX1 - LJ_W - G, A3[1]]
# kapak (antet) yerinde; sağına PVC boru çapı tablosu
pv = sinir(g_pvc)
tasi(g_pvc, pv, (-78.1 + G, A4[0], AX1, A4[1]), hiza='ust')

# ---------- Orta sütun ----------
DETAY = [BX0, B1[0], BX1, B1[1]]                                         # çerçeveyi bhp-cizim çizer
ic = blok(BX0, B2[0], BX1, B2[1], 'KABLO KANALI DETAYI')
print('kanal ölçek', round(tasi(g_kanal, sinir(g_kanal), ic, enFazla=1.1), 3))
TEKHAT = [BX0, B3[0], BX1, B3[1]]
HESAP = [BX0, B4[0], BX1, B4[1]]
ic = blok(BX0, B5[0], BX1, B5[1], 'SEMBOLLER')
print('sembol ölçek', round(tasi(g_sembol, sinir(g_sembol), ic), 3))
# sol ve orta sütun arasında boşluk; TEDAŞ sütunu ayrı çizgiyle zaten ayrık

# ---------- Kaydet ----------
r = lambda k: [round(v, 4) for v in k]
bilgi['bolgeler'] = {'tekhat': r(TEKHAT), 'hesap': r(HESAP), 'detay': r(DETAY), 'guc': r(GUC)}
bilgi['resim'] = {'uydu': r(uydu_k), 'vaziyet': r(vaz_k)}
bilgi['duzen'] = 1
d.audit()
cik = io.StringIO(); d.write(cik)
open(sablon, 'w', encoding='utf-8').write('999\nBHP ' + json.dumps(bilgi) + '\n' + cik.getvalue())
print(json.dumps(bilgi))
