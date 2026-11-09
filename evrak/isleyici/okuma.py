"""Evrakın yazısını okur (OCR / PDF metni) ve türünü bulur: Tapu, Yapı Kayıt Belgesi, Kimlik, Vekaletname …

- PDF'in içinde yazı varsa (e-Devlet, Web Tapu) doğrudan okunur; yoksa ilk sayfa resme çevrilip OCR yapılır.
- OCR: Tesseract (Türkçe). Windows programında Tesseract programın içine gömülüdür; bulunamazsa tür yalnız
  dosya adından tahmin edilir (program çalışmaya devam eder).
- Okunan yazı hiçbir yere gönderilmez; yalnız tür bulmak ve _bilgi.txt'ye ada/parsel/adres yazmak için kullanılır.
"""
import io
import logging
import os
import re
import shutil
import sys
from pathlib import Path

log = logging.getLogger('evrak')

# (tür adı, [(desen, puan), …]) — desenler ASCII'ye çevrilmiş BÜYÜK harf metinde aranır (OCR'ın Türkçe harf hatalarına dayanıklı)
TURLER = [
    ('Yapı Kayıt Belgesi', [(r'YAPI KAYIT BELGES', 4), (r'IMAR KANUNU.{0,30}GECICI 16', 3), (r'BELGENIN KAPSAMI', 2),
                            (r'BELGENIN NITELIGI', 2), (r'IMAR.?BARISI.?BELGE.?DOGRULAMA', 3)]),
    ('Yapı Kayıt Başvurusu', [(r'IMAR BARISI KAYIT BASVURU', 4), (r'BASVURUSU VE SORGULAMASI', 4), (r'AYKIRILIGIN NITELIGI', 3),
                              (r'ARSA BIRIM DEGERI', 2), (r'YAPI SINIFI', 1), (r'TOPLAM YAPI ALANI', 1)]),
    ('Tapu', [(r'TAPU KAYD', 4), (r'WEB ?TAPU', 4), (r'TAPU SENEDI', 5), (r'MULKIYET BILGILERI', 3), (r'TASINMAZ KIMLIK NO', 3),
              (r'TAPU KAYIT BILGISI', 4), (r'HISSE PAY', 2), (r'EDINME SEBEBI', 2), (r'CILT.?SAYFA', 1)]),
    ('Adres Tespit Yazısı', [(r'ADRES TESPIT', 6)]),
    ('Yapı Ruhsatı', [(r'YAPI RUHSAT', 6)]),
    ('İskan', [(r'YAPI KULLANMA IZIN', 6), (r'\bISKAN BELGES', 5)]),
    ('Vekaletname', [(r'VEKALETNAME', 6), (r'VEKIL TAYIN', 4), (r'AHZU KABZ', 2)]),
    ('Kimlik', [(r'KIMLIK KARTI', 5), (r'IDENTITY CARD', 5), (r'REPUBLIC OF TURKEY', 3), (r'SURNAME', 3), (r'DATE OF BIRTH', 3),
                (r'T\.?C\.? KIMLIK NO', 2), (r'DOGUM TARIHI', 1), (r'NUFUS CUZDANI', 5)]),
    ('İmar Durumu', [(r'IMAR DURUM', 6)]),
    ('Aplikasyon Krokisi', [(r'APLIKASYON', 5), (r'KROKI', 3)]),
    ('Abonelik Sözleşmesi', [(r'ABONELIK SOZLESMES', 6), (r'PERAKENDE SATIS SOZLESMES', 5), (r'BAGLANTI ANLASMAS', 5)]),
    ('Elektrik Faturası', [(r'\bFATURA', 2), (r'TESISAT NO', 2), (r'SON ODEME TARIHI', 3), (r'TUKETIM', 1), (r'\bKWH\b', 2)]),
    ('Bağlantı Görüşü', [(r'BAGLANTI GORUS', 6)]),
    ('Muvafakatname', [(r'MUVAFAKAT', 6)]),
    ('Taahhütname', [(r'TAAHHUTNAME', 6)]),
    ('Vergi Levhası', [(r'VERGI LEVHA', 6)]),
    ('İmza Sirküleri', [(r'IMZA SIRKULER', 6)]),
    ('Ticaret Sicil Gazetesi', [(r'TICARET SICIL GAZETE', 6)]),
    ('Nüfus Kayıt Örneği', [(r'NUFUS KAYIT ORNEG', 6)]),
    ('Yerleşim Yeri Belgesi', [(r'YERLESIM YERI', 5), (r'IKAMETGAH', 5)]),
    ('DASK Poliçesi', [(r'\bDASK\b', 5), (r'ZORUNLU DEPREM SIGORTA', 5)]),
    ('Dilekçe', [(r'DILEKCE', 2), (r'ARZ EDERIM', 3), (r'GEREGINI ARZ', 2)]),
]
ILLER = set('ADANA ADIYAMAN AFYONKARAHISAR AGRI AMASYA ANKARA ANTALYA ARTVIN AYDIN BALIKESIR BILECIK BINGOL BITLIS BOLU BURDUR BURSA CANAKKALE CANKIRI CORUM DENIZLI DIYARBAKIR EDIRNE ELAZIG ERZINCAN ERZURUM ESKISEHIR GAZIANTEP GIRESUN GUMUSHANE HAKKARI HATAY ISPARTA MERSIN ISTANBUL IZMIR KARS KASTAMONU KAYSERI KIRKLARELI KIRSEHIR KOCAELI KONYA KUTAHYA MALATYA MANISA KAHRAMANMARAS MARDIN MUGLA MUS NEVSEHIR NIGDE ORDU RIZE SAKARYA SAMSUN SIIRT SINOP SIVAS TEKIRDAG TOKAT TRABZON TUNCELI SANLIURFA USAK VAN YOZGAT ZONGULDAK AKSARAY BAYBURT KARAMAN KIRIKKALE BATMAN SIRNAK BARTIN ARDAHAN IGDIR YALOVA KARABUK KILIS OSMANIYE DUZCE'.split())
ESIK = 4                 # bu puanın altı "türü belirsiz" (dosyanın eski adı kalır)
_ASCII = str.maketrans('İIıŞşĞğÜüÖöÇçÂâÎîÛû', 'IIISSGGUUOOCCAAIIUU')


def sade(metin: str) -> str:
    """Türkçe → ASCII büyük harf, tek boşluk (OCR'ın İ/I, Ş/S karışıklığına dayanıklı karşılaştırma)."""
    s = metin.replace('i', 'İ').upper().translate(_ASCII)
    return re.sub(r'\s+', ' ', s)


def tur_bul(metin: str, dosya_adi: str = ''):
    """(tür adı | None, puan). Başlık bölgesindeki (ilk ~500 karakter) eşleşme 1,5 kat sayılır; dosya adı da ipucu."""
    m = sade(metin or '')
    bas = m[:500]
    ad = sade(Path(dosya_adi).stem.replace('_', ' ')) if dosya_adi else ''
    en, en_puan = None, 0.0
    for tur, desenler in TURLER:
        puan = 0.0
        for desen, p in desenler:
            if re.search(desen, bas):
                puan += p * 1.5
            elif re.search(desen, m):
                puan += p
            if ad and re.search(desen, ad):
                puan += p
        if puan > en_puan:
            en, en_puan = tur, puan
    return (en, en_puan) if en_puan >= ESIK else (None, en_puan)


def bilgi_cikar(metin: str) -> dict:
    """Ada, parsel, il/ilçe, mahalle (bulunabilirse). Yalnız _bilgi.txt için."""
    m = sade(metin or '')
    b = {}
    r = re.search(r'ADA\s*/\s*PARSEL\D{0,5}(\d{1,6})\s*/\s*(\d{1,5})', m)
    if r:
        b['ada'], b['parsel'] = r.group(1), r.group(2)
    else:
        a = re.search(r'\bADA(?: NUMARASI| NO)?\s*[:.]?\s*(\d{1,6})\b', m)
        p = re.search(r'\bPARSEL(?: NUMARASI| NO)?\s*[:.]?\s*(\d{1,5})\b', m)
        if a:
            b['ada'] = a.group(1)
        if p:
            b['parsel'] = p.group(1)
    r = re.search(r'\bIL\s*:\s*([A-Z]+)\s*,?\s*ILCE\s*:\s*([A-Z]+)', m)
    if not r:                                         # "IZMIR/BORNOVA" gibi — yalnız gerçek il adıyla
        r = next((x for x in re.finditer(r'\b([A-Z]{3,})\s*/\s*([A-Z]{3,})\b', m) if x.group(1) in ILLER), None)
    if r:
        b['il_ilce'] = f'{r.group(1)}/{r.group(2)}'
    r = re.search(r'\bMAHALLE\b\s*[:|]?\s*\b(?!(?:S?OKAK|CADDE|KAPI|DAIRE|ILCE|PARSEL)\b)([A-Z]{4,})\b', m)   # "X Mah." araması yapılmaz: antetteki kurum adresini alıyordu
    if r:
        b['mahalle'] = r.group(1)
    return b


# ---------------------------------------------------------------- metin alma
def pdf_metni(yol, en_cok_sayfa=2) -> str:
    try:
        from pypdf import PdfReader
        r = PdfReader(io.BytesIO(Path(yol).read_bytes()))   # dosya açık kalmasın (Windows taşıyamaz)
        if r.is_encrypted:
            return ''
        return '\n'.join((s.extract_text() or '') for s in r.pages[:en_cok_sayfa])
    except Exception:
        return ''


def pdf_ilk_sayfa_resmi(yol, dpi=200):
    try:
        import pypdfium2 as pdfium
        belge = pdfium.PdfDocument(Path(yol).read_bytes())   # dosya açık kalmasın
        try:
            return belge[0].render(scale=dpi / 72).to_pil()
        finally:
            belge.close()
    except Exception:
        return None


_TESS = None


def _tesseract():
    """Gömülü (PyInstaller) ya da kurulu Tesseract'ı bulur; yoksa None."""
    global _TESS
    if _TESS is not None:
        return _TESS or None
    try:
        import pytesseract
    except Exception:
        _TESS = ''
        return None
    adaylar = []
    if getattr(sys, 'frozen', False):
        adaylar.append(Path(getattr(sys, '_MEIPASS', '')) / 'tesseract' / 'tesseract.exe')
    adaylar += [Path(os.environ.get('ProgramFiles', r'C:\Program Files')) / 'Tesseract-OCR' / 'tesseract.exe']
    bulunan = next((str(a) for a in adaylar if a.is_file()), None) or shutil.which('tesseract')
    if not bulunan:
        _TESS = ''
        return None
    pytesseract.pytesseract.tesseract_cmd = bulunan
    veri = Path(bulunan).parent / 'tessdata'
    if veri.is_dir():
        os.environ['TESSDATA_PREFIX'] = str(veri)
    _TESS = bulunan
    return bulunan


def resim_metni(pil) -> str:
    if not _tesseract():
        return ''
    try:
        import pytesseract
        im = pil.convert('L')
        if max(im.size) > 2600:                      # hız: OCR için 2600 px yeter
            s = 2600 / max(im.size)
            im = im.resize((int(im.width * s), int(im.height * s)))
        return pytesseract.image_to_string(im, lang='tur', config='--psm 3')
    except Exception:
        log.exception('OCR yapılamadı')
        return ''


def ocr_var() -> bool:
    return bool(_tesseract())
