# Deneme için sahte iç tesisat çizimi (DXF, 6 m uzunluğunda pafta; kişisel bilgi yok). python3 sahte-ic-cad.py cikis.dxf
# Yerleşim sahte-ic.py'deki PDF ile aynı oranlarda (2400 x 800): sağda 8 bantlı güç tablosu, solda alt köşede antet, ortada kolon şeması.
# Birim mm; 1 PDF birimi = 2,5 mm. Yazılar gerçek TEXT nesnesi (AutoCAD'den gelen dosyada olduğu gibi).
import sys, ezdxf
d = ezdxf.new('R2018', setup=True); m = d.modelspace()
K = 2.5
P = lambda x, y: (x * K, (800 - y) * K)                    # PDF koordinatı (y aşağı) → çizim (y yukarı)
def cz(a, b): m.add_line(P(*a), P(*b))
def yaz(t, x, y, h=6): m.add_text(t, height=h, dxfattribs={'style': 'OpenSans'}).set_placement(P(x, y))
m.add_lwpolyline([P(0, 0), P(2400, 0), P(2400, 800), P(0, 800)], close=True)                     # pafta çerçevesi
x0, x1, y = 1500, 2300, 200
for i in range(9): cz((x0, y + i * 30), (x1, y + i * 30))
for x in range(x0, x1 + 1, 100): cz((x, y), (x, y + 240))
for j, t in enumerate(['B.B.', 'TABLO', 'KURULU', 'BAĞLANTI', 'SAYAÇ', 'KULLANIM', 'TESİSAT', '']): yaz(t, x0 + j * 100 + 8, y + 20)
for i in range(6):
    for j, t in enumerate([str(i + 1), f'D{i + 1}', '20440', '12776', '3x10 A', 'MESKEN']): yaz(t, x0 + j * 100 + 8, y + 50 + i * 30 + 20)
m.add_lwpolyline([P(100, 600), P(600, 600), P(600, 780), P(100, 780)], close=True)
for i, t in enumerate(['MAL SAHİBİ: ÖRNEK MAL SAHİBİ', 'KURULU GÜÇ: 122640 W', 'TALEP GÜCÜ: 32962 W', 'BAĞIMSIZ BÖLÜM: 6']): yaz(t, 120, 630 + i * 35, 8)
m.add_lwpolyline([P(800, 100), P(1400, 100), P(1400, 450), P(800, 450)], close=True)            # kolon şeması
for i in range(6):
    xx = 860 + i * 90; m.add_circle(P(xx, 200), 20 * K); cz((xx, 220), (xx, 380)); yaz(f'D{i + 1}', xx - 10, 160, 7)
cz((860, 380), (1310, 380)); yaz('4x100A 300mA', 1000, 420, 7)
d.saveas(sys.argv[1])
