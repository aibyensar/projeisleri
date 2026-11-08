"""Uçtan uca akış denemesi (Linux/Windows): sahte Drive ve masaüstü klasörlerinde paketleri işler.
Kullanım: python test/akis_dene.py <örnek-resim-ve-pdf-klasörü>"""
import json, shutil, sys, tempfile, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import islem

ornek = Path(sys.argv[1])
tmp = Path(tempfile.mkdtemp())
kok, masa = tmp / 'AGY Evrak', tmp / 'Masaüstü'
masa.mkdir()
ayar = {'kok': str(kok), 'masaustu': str(masa), 'kararli_sn': 0, 'bilgisiz_paket_saat': 2, 'gecikme_gun': 3, 'yeni_evrak_saat': 24, 'kalite': 'tam', 'jpeg_kalite': 85}
bildirimler = []
isl = islem.Isleyici(ayar, lambda b, m: bildirimler.append(f'{b}: {m}'))

def paket(ad, dosyalar, bilgi):
    p = kok / '0-Gelen' / ad
    p.mkdir(parents=True)
    for i, f in enumerate(dosyalar, 1):
        shutil.copy(ornek / f, p / f'{i:02d}_{f}')
    if bilgi:
        (p / 'paket.json').write_text(json.dumps(bilgi, ensure_ascii=False), encoding='utf-8')

def tur2():
    isl.tur(); isl.tur()

def goster(baslik):
    print(f'\n== {baslik}')
    for k in sorted((kok / 'Çizilecek Projeler').iterdir()):
        print('  ', k.name, '' if k.is_file() else sorted(x.name for x in k.iterdir()))
    for k in masa.iterdir():
        print('  MASAÜSTÜ', k.name, sorted(x.name for x in k.rglob('*') if x.is_file()))
    print('  bildirim:', bildirimler[-1] if bildirimler else '-')

b = {'elektrikci': 'ahmet usta', 'proje': 'Yılmaz Apartmanı', 'tur': 'İç Tesisat + Bağlantı Hattı', 'acil': False, 'evrakTamam': False, 'not': 'tapunun arkası gelecek'}
paket('20261108-210000', ['PHOTO-2026-10-22-10-48-46.jpg', 'PHOTO-2026-10-22-10-48-45.jpg', 'WEB TAPU.pdf'], b)
tur2(); goster('1. paket (yeni iş, evrak eksik)')

paket('20261108-220000', ['PHOTO-2026-10-22-10-48-45.jpg', 'ekran.png'], dict(b, elektrikci='Ahmet  USTA', proje='Yilmaz Apartmani', evrakTamam=True, **{'not': ''}))
tur2(); goster('2. paket (yazım farkı, tekrar evrak, evrak tamam)')

k = next(x for x in (kok / 'Çizilecek Projeler').iterdir() if x.is_dir())
shutil.move(str(k), str(masa / k.name)); tur2(); goster('iş masaüstüne alındı')

paket('20261109-090000', ['ekran.png', 'PHOTO-2026-10-22-10-48-47.jpg'], dict(b, evrakTamam=True, proje='Yılmaz Apartmanı'))
paket('20261109-091000', ['PHOTO-2026-10-22-10-48-46.jpg'], dict(b, elektrikci='Veli Usta', proje='Kaya Sitesi', tur='Bağlantı Hattı', acil=True))

tur2(); goster('masaüstündeki işe evrak + yeni ACİL iş')
print((masa / k.name / '_YENİ GELEN EVRAK' / '_bilgi.txt').read_text(encoding='utf-8'))

shutil.rmtree(masa / k.name); tur2()
paket('20261110-100000', ['WEB TAPU.pdf'], b); tur2(); goster('bitmiş işe evrak → revizyon')

ilk = next(x for x in (kok / 'Çizilecek Projeler').iterdir() if x.is_dir() and 'ACİL' in x.name)
ilk.rename(ilk.with_name(ilk.name.replace('0 ACİL · EVRAK EKSİK', '1 HAZIR'))); tur2(); goster('elle HAZIR yapıldı')

paket('20261101-080000', ['ekran.png'], None); tur2(); goster('bilgisiz eski paket')
print('kontrol:', [x.name for x in (kok / '8-Kontrol Et').iterdir()])
print((kok / 'Çizilecek Projeler' / '_LİSTE.txt').read_text(encoding='utf-8'))
print(open(kok / 'Kayıt.csv', encoding='utf-8-sig').read()[:600])
r = next(x for x in (kok / 'Çizilecek Projeler').iterdir() if 'REVİZYON' in x.name)
print((r / '_bilgi.txt').read_text(encoding='utf-8'))
print('TMP', tmp)
