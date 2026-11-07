# Bağlantı hattı aracını claude.ai'de ayrı sayfa olarak yayınlamak için klasör hazırlar.
# Kullanım: python3 baglanti-hatti/yayin-hazirla.py <cikis-klasoru>   (depo kökünden)
# Yayın: index.html sayfa (doctype/html/head/body etiketsiz), diğer dosyalar `files` ile;
# capabilities: {downloads: true, sample: {images: true}}
import os, re, shutil, sys
c = sys.argv[1]
for d in ('ortak', 'veri', 'baglanti-hatti'): os.makedirs(os.path.join(c, d), exist_ok=True)
for f in ('ortak/bhp.js', 'ortak/bhp-cizim.js', 'ortak/stil.css', 'veri/katalog.js'): shutil.copy(f, os.path.join(c, f))
shutil.copy('baglanti-hatti/BHP-SABLON.dxf', os.path.join(c, 'baglanti-hatti/BHP-SABLON.txt'))
s = open('araclar/baglanti-hatti.html', encoding='utf-8').read()
s = s.replace('../ortak/', 'ortak/').replace('../veri/', 'veri/').replace("'../baglanti-hatti/", "'baglanti-hatti/")
s = s.replace('<a href="../index.html">← Proje İşleri</a>', '<a href="https://claude.ai/artifact/7ozTZyAZtsX2Yng1KXgvk5" target="_top">← Proje İşleri</a>')
bas = re.sub(r'<meta[^>]*>\s*', '', re.search(r'<head>(.*?)</head>', s, re.S).group(1))
govde = re.search(r'<body>(.*)</body>', s, re.S).group(1)
open(os.path.join(c, 'index.html'), 'w', encoding='utf-8').write(bas.strip() + '\n' + govde.strip() + '\n')
print('hazır:', c)
