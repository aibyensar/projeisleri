"""Birleşik PDF ayırma denemesi: tapu (2 sayfa) + kimlik + adres tespit tek PDF'te (yazısız, taranmış gibi) →
Tapu.pdf (2 sayfa), Kimlik.pdf, Adres Tespit Yazısı.pdf olmalı.  Kullanım: python test/bol_dene.py"""
import sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from PIL import Image, ImageDraw, ImageFont
import islem, okuma

if not okuma.ocr_var():
    sys.exit('HATA: Tesseract bulunamadı')


def yazi(boy, kalin=False):
    for f in (['arialbd.ttf', 'DejaVuSans-Bold.ttf'] if kalin else ['arial.ttf', 'DejaVuSans.ttf']):
        for k in (Path.home() / '.fonts', Path('C:/Windows/Fonts'), Path('/usr/share/fonts/truetype/dejavu')):
            if (k / f).exists():
                return ImageFont.truetype(str(k / f), boy)
    return ImageFont.load_default()


def sayfa(baslik, satirlar):
    im = Image.new('RGB', (1240, 1754), 'white')
    d = ImageDraw.Draw(im)
    d.text((160, 140), baslik, fill='black', font=yazi(52, True))
    for i, s in enumerate(satirlar):
        d.text((160, 320 + i * 70), s, fill='black', font=yazi(34))
    return im


sayfalar = [
    sayfa('TAPU SENEDİ', ['Taşınmaz Kimlik No: 123456', 'Mülkiyet Bilgileri', 'Ada/Parsel: 2720/1', 'Edinme Sebebi: Satış']),
    sayfa('', ['Hisse Pay / Payda: 1/1', 'Cilt / Sayfa: 12/345', 'Açıklama: şerh yoktur']),
    sayfa('TÜRKİYE CUMHURİYETİ KİMLİK KARTI', ['REPUBLIC OF TURKEY IDENTITY CARD', 'Soyadı / Surname: ÖRNEK',
                                             'Doğum Tarihi / Date of Birth: 01.01.1980']),
    sayfa('ADRES TESPİT YAZISI', ['Belediye İmar Müdürlüğü', 'Mahalle: ÖRNEK', 'Ada 2720 Parsel 1 için adres tespiti']),
]
tmp = Path(tempfile.mkdtemp())
pdf = tmp / '01_CamScanner 11-12-2026.pdf'
sayfalar[0].save(pdf, save_all=True, append_images=sayfalar[1:], resolution=150)
k = tmp / 'is'; k.mkdir()
sonuc = islem.Isleyici._pdf_bol(None, pdf, k, 'CamScanner 11-12-2026')
adlar = sorted(e['ad'] for e in sonuc or [])
print('çıkan:', [(e['ad'], e['sayfa'], e['aciklama']) for e in sonuc or []])
beklenen = sorted(['Tapu.pdf', 'Kimlik.pdf', 'Adres Tespit Yazısı.pdf'])
if adlar != beklenen:
    sys.exit(f'HATA: beklenen {beklenen}')
if next(e for e in sonuc if e['ad'] == 'Tapu.pdf')['sayfa'] != 2:
    sys.exit('HATA: tapunun arka sayfası ayrı düştü')
print('AYIRMA: TAMAM')
