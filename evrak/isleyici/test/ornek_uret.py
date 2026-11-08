"""Deneme için sahte evrak fotoğrafları üretir (gerçek kişi bilgisi yok). Kullanım: python test/ornek_uret.py <klasör>"""
import sys
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import goruntu

hedef = Path(sys.argv[1]); hedef.mkdir(parents=True, exist_ok=True)


def yazi(boy, kalin=False):
    for ad in (('arialbd.ttf' if kalin else 'arial.ttf'), ('DejaVuSans-Bold.ttf' if kalin else 'DejaVuSans.ttf'),
               '/usr/share/fonts/truetype/dejavu/' + ('DejaVuSans-Bold.ttf' if kalin else 'DejaVuSans.ttf')):
        try:
            return ImageFont.truetype(ad, boy)
        except OSError:
            pass
    return ImageFont.load_default()


def sayfa(renkli):
    im = Image.new('RGB', (1240, 1754), 'white'); d = ImageDraw.Draw(im)
    d.text((380, 120), 'TAPU SENEDİ', fill='black', font=yazi(48, True))
    for i in range(30):
        d.text((100, 260 + i * 44), f'Satır {i + 1}: Ada 1234 Parsel 56 Mahalle Örnek İlçe Deneme ğüşıöç', fill='black', font=yazi(30))
    if renkli:
        d.ellipse((850, 1500, 1100, 1700), outline=(200, 20, 20), width=8); d.line((150, 1600, 500, 1560), fill=(20, 40, 200), width=5)
    return cv2.cvtColor(np.array(im), cv2.COLOR_RGB2BGR)


def foto(p, bulanik=False):
    H, W = 3000, 2250
    rng = np.random.default_rng(1)
    bg = np.clip(np.full((H, W, 3), (60, 90, 120), np.float32) + rng.random((H, W, 3)) * 40, 0, 255).astype(np.uint8)
    M = cv2.getPerspectiveTransform(np.float32([[0, 0], [1239, 0], [1239, 1753], [0, 1753]]), np.float32([[300, 350], [1950, 250], [2050, 2700], [200, 2800]]))
    w = cv2.warpPerspective(p, M, (W, H)); m = cv2.warpPerspective(np.full_like(p, 255), M, (W, H))
    out = np.where(m > 0, w, bg).astype(np.float32)
    g = np.linspace(0.55, 1.0, W)[None, :, None] * np.linspace(0.8, 1, H)[:, None, None]
    out = (out * g * np.array([0.85, 0.95, 1.0])).clip(0, 255).astype(np.uint8)
    out = cv2.resize(cv2.GaussianBlur(out, (15, 15) if bulanik else (3, 3), 6 if bulanik else 0), (1200, 1600), interpolation=cv2.INTER_AREA)
    return out


cv2.imwrite(str(hedef / 'PHOTO-2026-10-22-10-48-45.jpg'), foto(sayfa(False)), [cv2.IMWRITE_JPEG_QUALITY, 70])
cv2.imwrite(str(hedef / 'PHOTO-2026-10-22-10-48-46.jpg'), foto(sayfa(True)), [cv2.IMWRITE_JPEG_QUALITY, 70])
cv2.imwrite(str(hedef / 'PHOTO-2026-10-22-10-48-47.jpg'), foto(sayfa(False), bulanik=True), [cv2.IMWRITE_JPEG_QUALITY, 70])
cv2.imwrite(str(hedef / 'ekran.png'), sayfa(False))
im, _ = goruntu.iyilestir(goruntu.oku(hedef / 'PHOTO-2026-10-22-10-48-45.jpg'))
goruntu.pdf_yap([im], hedef / 'WEB TAPU.pdf')
print('örnekler:', sorted(x.name for x in hedef.iterdir()))
