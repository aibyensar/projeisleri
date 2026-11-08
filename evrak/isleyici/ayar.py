"""Ayarlar ve yollar. Ayar dosyası: %APPDATA%\\AGY Evrak\\ayar.json (ilk çalışmada oluşturulur)."""
import json
import os
import string
import sys
from pathlib import Path

UYGULAMA = 'AGY Evrak'
SURUM = '1.0.7'

VARSAYILAN = {
    'kok': r"H:\Drive'ım\AGY Evrak",   # şirket Drive'ındaki AGY Evrak klasörü
    'masaustu': '',                     # boşsa Windows'tan bulunur
    'yokla_sn': 15,                     # klasörleri kaç saniyede bir kontrol etsin
    'kararli_sn': 10,                   # dosya boyutları bu kadar sabit kalınca işlenir
    'bilgisiz_paket_saat': 2,           # paket.json bu süre gelmezse "Kontrol Et"e
    'gecikme_gun': 3,                   # bu kadar gün bekleyen iş için uyarı
    'yeni_evrak_saat': 24,              # "YENİ EVRAK" işareti bu süre sonra kalkar
    'kalite': 'tam',                    # tam | hafif | ham
    'jpeg_kalite': 85,
    'eposta': True,                     # her pakette e-posta özeti (Google tarafı gönderir)
}


def veri_klasoru() -> Path:
    taban = os.environ.get('APPDATA') or str(Path.home() / '.config')
    p = Path(taban) / UYGULAMA
    p.mkdir(parents=True, exist_ok=True)
    return p


def masaustu_bul() -> Path:
    if sys.platform == 'win32':
        try:
            import ctypes
            from ctypes import wintypes
            from uuid import UUID

            class GUID(ctypes.Structure):
                _fields_ = [('Data1', wintypes.DWORD), ('Data2', wintypes.WORD), ('Data3', wintypes.WORD), ('Data4', wintypes.BYTE * 8)]

            u = UUID('{B4BFCC3A-DB2C-424C-B029-7FE99A87C641}')   # FOLDERID_Desktop (OneDrive yönlendirmesini de verir)
            g = GUID(u.fields[0], u.fields[1], u.fields[2], (wintypes.BYTE * 8)(*u.bytes[8:]))
            yol = ctypes.c_wchar_p()
            if ctypes.windll.shell32.SHGetKnownFolderPath(ctypes.byref(g), 0, None, ctypes.byref(yol)) == 0:
                p = Path(yol.value)
                ctypes.windll.ole32.CoTaskMemFree(yol)
                return p
        except Exception:
            pass
    return Path.home() / 'Desktop'


def kok_bul(ayarlanan: str) -> Path | None:
    """Ayarlanan yol yoksa bütün sürücülerde 'Drive'ım\\AGY Evrak' / 'My Drive\\AGY Evrak' aranır."""
    p = Path(ayarlanan)
    if p.is_dir():
        return p
    if sys.platform == 'win32':
        for harf in string.ascii_uppercase:
            for ara in ("Drive'ım", 'My Drive', 'Drive\'im'):
                aday = Path(f'{harf}:\\') / ara / UYGULAMA
                try:
                    if aday.is_dir():
                        return aday
                except OSError:
                    pass
    return None


def yukle() -> dict:
    dosya = veri_klasoru() / 'ayar.json'
    a = dict(VARSAYILAN)
    if dosya.exists():
        try:
            a.update(json.loads(dosya.read_text(encoding='utf-8')))
        except Exception:
            pass
    else:
        dosya.write_text(json.dumps(VARSAYILAN, ensure_ascii=False, indent=2), encoding='utf-8')
    if not a.get('masaustu'):
        a['masaustu'] = str(masaustu_bul())
    return a
