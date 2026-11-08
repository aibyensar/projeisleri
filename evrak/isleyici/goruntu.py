"""Telefonla çekilmiş evrak fotoğrafını tarama kalitesine getirir ve PDF yapar.

Adımlar: sayfa kenarını bul → düz dikdörtgene aç → gölge/sarılık gider → renk kararı (mühür, imza, kimlik → renkli;
yoksa gri) → çözünürlüğü A4 / ~240-300 dpi eşdeğerine getir. Kenar bulunamazsa kırpmadan devam eder.
"""
import io

import cv2
import img2pdf
import numpy as np
from PIL import Image, ImageOps

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except Exception:  # HEIC desteği yoksa diğer biçimler yine çalışır
    pass

RESIM_UZANTILARI = {'.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp', '.bmp', '.tif', '.tiff'}
A4_MM = (210, 297)


def oku(yol) -> np.ndarray:
    with Image.open(yol) as im:
        im = ImageOps.exif_transpose(im).convert('RGB')
        return cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR)


def bulaniklik(bgr) -> float:
    """Laplace varyansı (1200 px'e küçültülmüş griden). Düşük = bulanık. ~60 altı okunması zor."""
    g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    s = 1200 / max(g.shape)
    if s < 1:
        g = cv2.resize(g, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    return float(cv2.Laplacian(g, cv2.CV_64F).var())


def _sirala(p):
    p = np.asarray(p, dtype='float32').reshape(4, 2)
    t = p.sum(axis=1)
    f = np.diff(p, axis=1).ravel()
    return np.array([p[np.argmin(t)], p[np.argmin(f)], p[np.argmax(t)], p[np.argmax(f)]], dtype='float32')  # sol-üst, sağ-üst, sağ-alt, sol-alt


def sayfa_bul(bgr):
    """Sayfanın 4 köşesi (orijinal ölçekte) ya da None."""
    h, w = bgr.shape[:2]
    s = 1000 / max(h, w)
    k = cv2.resize(bgr, None, fx=s, fy=s, interpolation=cv2.INTER_AREA) if s < 1 else bgr.copy()
    s = min(s, 1)
    alan = k.shape[0] * k.shape[1]
    gri = cv2.GaussianBlur(cv2.cvtColor(k, cv2.COLOR_BGR2GRAY), (5, 5), 0)
    adaylar = []
    kenar = cv2.dilate(cv2.Canny(gri, 40, 140), np.ones((3, 3), np.uint8), iterations=2)
    adaylar += list(cv2.findContours(kenar, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0])
    _, esik = cv2.threshold(gri, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)   # sayfa zeminden açık
    esik = cv2.morphologyEx(esik, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    adaylar += list(cv2.findContours(esik, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0])
    for c in sorted(adaylar, key=cv2.contourArea, reverse=True)[:10]:
        a = cv2.contourArea(c)
        if a < 0.2 * alan or a > 0.985 * alan:   # çok küçük ya da zaten bütün kare
            continue
        yaklasik = cv2.approxPolyDP(c, 0.02 * cv2.arcLength(c, True), True)
        if len(yaklasik) == 4 and cv2.isContourConvex(yaklasik):
            return _sirala(yaklasik / s)
        kutu = cv2.boxPoints(cv2.minAreaRect(c))
        if a > 0.85 * cv2.contourArea(kutu.astype('float32')):   # dikdörtgene yakın
            return _sirala(kutu / s)
    return None


def duzlestir(bgr, k):
    sol_ust, sag_ust, sag_alt, sol_alt = k
    gen = int(max(np.linalg.norm(sag_ust - sol_ust), np.linalg.norm(sag_alt - sol_alt)))
    yuk = int(max(np.linalg.norm(sol_alt - sol_ust), np.linalg.norm(sag_alt - sag_ust)))
    hedef = np.array([[0, 0], [gen - 1, 0], [gen - 1, yuk - 1], [0, yuk - 1]], dtype='float32')
    return cv2.warpPerspective(bgr, cv2.getPerspectiveTransform(k, hedef), (gen, yuk), flags=cv2.INTER_CUBIC)


def _zemin_duzelt(kanal):
    """Gölge ve sarılığı giderir: zemin tahmini (yazıyı silen genişletme + bulanıklaştırma) ile bölme."""
    boy = max(15, (min(kanal.shape) // 40) | 1)
    zemin = cv2.medianBlur(cv2.dilate(kanal, np.ones((7, 7), np.uint8)), boy)
    sonuc = cv2.divide(kanal, zemin, scale=255)
    return sonuc


def beyaz_dengesi(bgr):
    """Kağıdın rengini (en açık %10'un ortalaması) beyaza çeker: sarılık / mavimsi ışık gider."""
    k = bgr.reshape(-1, 3).astype(np.float32)
    parlak = k[k.sum(axis=1) >= np.percentile(k.sum(axis=1), 90)]
    zemin = np.maximum(parlak.mean(axis=0), 1)
    return np.clip(bgr.astype(np.float32) * (245.0 / zemin), 0, 255).astype(np.uint8)


def renkli_mi(bgr) -> bool:
    """Doygun renk (mavi imza / kırmızı mühür / kimlik fotoğrafı) oranı ‰4'ü geçerse renkli.
    Kenardan %4'lük şerit (kırpmada kalan zemin) sayılmaz."""
    h, w = bgr.shape[:2]
    m = int(0.04 * min(h, w))
    bgr = bgr[m:h - m, m:w - m]
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    maske = (hsv[..., 1] > 70) & (hsv[..., 2] > 60)
    return float(maske.mean()) > 0.004


def _boyutla(bgr):
    uzun = max(bgr.shape[:2])
    if uzun < 1800:
        s = 2200 / uzun
        return cv2.resize(bgr, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC)
    if uzun > 3600:
        s = 3300 / uzun
        return cv2.resize(bgr, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    return bgr


def iyilestir(bgr, kalite='tam'):
    """(PIL.Image, bilgi) döner. kalite: tam | hafif | ham."""
    bilgi = {'bulaniklik': round(bulaniklik(bgr), 1), 'kirpildi': False, 'renkli': True}
    if kalite == 'ham':
        return Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)), bilgi
    k = sayfa_bul(bgr)
    if k is not None:
        bgr = duzlestir(bgr, k)
        h, w = bgr.shape[:2]
        m = max(2, int(0.008 * min(h, w)))                 # kenarda kalan zemin çizgisini at
        bgr = bgr[m:h - m, m:w - m]
        bilgi['kirpildi'] = True
    bgr = beyaz_dengesi(bgr)
    bilgi['renkli'] = renkli_mi(bgr)
    bgr = _boyutla(bgr)
    if bilgi['renkli']:
        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
        if kalite == 'tam':
            hsv[..., 2] = _zemin_duzelt(hsv[..., 2])
        bgr = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
        return Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)), bilgi
    gri = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    if kalite == 'tam':
        gri = _zemin_duzelt(gri)
        # yazıyı biraz koyulaştır (beyaz zemini bozmadan)
        gri = cv2.LUT(gri, np.array([min(255, int(255 * (i / 255) ** 1.35)) for i in range(256)], dtype=np.uint8))
    return Image.fromarray(gri), bilgi


def pdf_yap(resimler, cikis, jpeg_kalite=85):
    """PIL resimlerini A4 sayfalı tek PDF yapar (yatay resim yatay sayfaya)."""
    parcalar = []
    for im in resimler:
        b = io.BytesIO()
        im.save(b, format='JPEG', quality=jpeg_kalite, optimize=True, dpi=(300, 300))
        parcalar.append(b.getvalue())
    duzen = img2pdf.get_layout_fun((img2pdf.mm_to_pt(A4_MM[0]), img2pdf.mm_to_pt(A4_MM[1])), fit=img2pdf.FitMode.into, auto_orient=True)
    with open(cikis, 'wb') as f:
        f.write(img2pdf.convert(parcalar, layout_fun=duzen))
