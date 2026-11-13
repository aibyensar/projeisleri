# Bağlantı hattı aracını claude.ai'de ayrı sayfa olarak yayınlamak için klasör hazırlar.
# Kullanım: python3 baglanti-hatti/yayin-hazirla.py <cikis-klasoru>   (depo kökünden)
# Yayın: index.html sayfa (doctype/html/head/body etiketsiz), diğer dosyalar `files` ile;
# capabilities: {downloads: true, sample: {images: true}}
# DWG okuyucunun çekirdeği (libredwg-web.wasm, ~11 MB) sayfanın yanında yayınlanır: yayın sayfası dış adreslerden yalnız betik
# yükleyebilir, .wasm dosyasını jsDelivr'den çekemez. Dosya npm'den indirilir (npm pack), depoya konmaz.
# Yayında files'a ekleyin: "baglanti-hatti/kutuphane/libredwg-web.wasm" (contentType application/wasm), ortak/bhp-havai.js, havai-cer.html.
import os, re, shutil, sys, subprocess, tarfile, tempfile
c = sys.argv[1]
for d in ('ortak', 'veri', 'baglanti-hatti/logo'): os.makedirs(os.path.join(c, d), exist_ok=True)
for f in ('agy-kapak.png', 'logo-beyaz.png'): shutil.copy('baglanti-hatti/logo/' + f, os.path.join(c, 'baglanti-hatti/logo/' + f))
for f in ('ortak/bhp.js', 'ortak/bhp-cizim.js', 'ortak/bhp-havai.js', 'ortak/cad-oku.js', 'ortak/stil.css', 'veri/katalog.js'): shutil.copy(f, os.path.join(c, f))
# havai hat cer aracı (havai/build.py ile üretilir), sayfada iframe: src="havai-cer.html?gomulu=1" — yayında kök klasörde durur
shutil.copy('araclar/havai-cer.html', os.path.join(c, 'havai-cer.html'))
DWG_SURUM = re.search(r"DWG_SURUM = '([\d.]+)'", open('ortak/cad-oku.js', encoding='utf-8').read()).group(1)
wasm = os.path.join(c, 'baglanti-hatti/kutuphane/libredwg-web.wasm')
if not os.path.exists(wasm):
    os.makedirs(os.path.dirname(wasm), exist_ok=True)
    with tempfile.TemporaryDirectory() as g:
        ad = subprocess.run(['npm', 'pack', '@mlightcad/libredwg-web@' + DWG_SURUM, '--silent'], cwd=g, check=True, capture_output=True, text=True).stdout.strip().splitlines()[-1]
        with tarfile.open(os.path.join(g, ad)) as t:
            with t.extractfile('package/wasm/libredwg-web.wasm') as k, open(wasm, 'wb') as h: shutil.copyfileobj(k, h)
shutil.copy('baglanti-hatti/BHP-SABLON.dxf', os.path.join(c, 'baglanti-hatti/BHP-SABLON.txt'))
s = open('araclar/baglanti-hatti.html', encoding='utf-8').read()
s = s.replace('../ortak/', 'ortak/').replace('../veri/', 'veri/').replace("'../baglanti-hatti/", "'baglanti-hatti/").replace('"../baglanti-hatti/', '"baglanti-hatti/')
s = s.replace("from 'ortak/", "from './ortak/")                     # modül yolu ./ ile başlamalı
assert "const CAD_WASM_YERI = null;" in s
s = s.replace("const CAD_WASM_YERI = null;", "const CAD_WASM_YERI = 'baglanti-hatti/kutuphane';")
s = s.replace('href="../index.html">← Proje İşleri</a>', 'href="https://claude.ai/artifact/7ozTZyAZtsX2Yng1KXgvk5" target="_top">← Proje İşleri</a>')
bas = re.sub(r'<meta[^>]*>\s*', '', re.search(r'<head>(.*?)</head>', s, re.S).group(1))
govde = re.search(r'<body>(.*)</body>', s, re.S).group(1)
open(os.path.join(c, 'index.html'), 'w', encoding='utf-8').write(bas.strip() + '\n' + govde.strip() + '\n')
print('hazır:', c)
