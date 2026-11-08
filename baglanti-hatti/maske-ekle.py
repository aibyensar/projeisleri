# Şablona AutoCAD maske (WIPEOUT) desteği ekler: WIPEOUT sınıfı ve ACAD_WIPEOUT_VARS sözlüğü (çerçeve kapalı).
# Web aracı vaziyet açıklama kutusunu ve numaralı işaretleri maskeyle çizer: arkasındaki resmi gizler,
# ekranda arka plan renginde, kâğıtta beyaz görünür; üstündeki yazı her durumda okunur.
# Kullanım (bir kez, pafta-duzen.py'den sonra): python3 baglanti-hatti/maske-ekle.py baglanti-hatti/BHP-SABLON.dxf
import sys, io, json, ezdxf
sablon = sys.argv[1]
ust, bilgi_satir, govde = open(sablon, encoding='utf-8').read().split('\n', 2)
bilgi = json.loads(bilgi_satir[4:])
if bilgi.get('maske'): raise SystemExit('maske desteği zaten var')
d = ezdxf.read(io.StringIO(govde)); m = d.modelspace()
# sınıf ve sözlük ancak bir maske varlığıyla yazılır: kâğıt köşesinde görünmeyecek kadar küçük bir maske
w = m.add_wipeout([(-269.45, 5393.65), (-269.4, 5393.65), (-269.4, 5393.7), (-269.45, 5393.7)], dxfattribs={'layer': 'BHP-VAZIYET'})
d.set_wipeout_variables(frame=0)
bilgi['maske'] = 1
cik = io.StringIO(); d.write(cik)
open(sablon, 'w', encoding='utf-8').write('999\nBHP ' + json.dumps(bilgi) + '\n' + cik.getvalue())
print('maske desteği eklendi')
