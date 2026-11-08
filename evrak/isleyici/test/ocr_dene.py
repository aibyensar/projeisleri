"""OCR ve tür bulma denemesi: örnek klasördeki 'WEB TAPU.pdf' (yazısız, resimden yapılmış) okunup 'Tapu' bulunmalı.
Kullanım: python test/ocr_dene.py <örnek-klasörü>"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import okuma

ornek = Path(sys.argv[1])
if not okuma.ocr_var():
    sys.exit('HATA: Tesseract bulunamadı')
resim = okuma.pdf_ilk_sayfa_resmi(ornek / 'WEB TAPU.pdf')
metin = okuma.resim_metni(resim)
tur = okuma.tur_bul(metin)
print('okunan (ilk 120):', metin[:120].replace('\n', ' '))
print('tür:', tur, 'bilgi:', okuma.bilgi_cikar(metin))
if tur[0] != 'Tapu':
    sys.exit('HATA: tür bulunamadı')
