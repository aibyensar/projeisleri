"""Evrak işleyici çekirdeği: 0-Gelen'deki paketleri işleyip "Çizilecek Projeler" klasörüne koyar.

Kurgu: evrak/KURGU.md (sürüm 4). Kişisel veri hiçbir yere gönderilmez; kayıtlarda (log) yalnız paket kodu tutulur.
"""
import csv
import datetime as dt
import difflib
import hashlib
import json
import io
import logging
import os
import re
import secrets
import shutil
import time
from pathlib import Path

import goruntu
import okuma

log = logging.getLogger('evrak')

GELEN, KUYRUK, KONTROL, ARSIV = '0-Gelen', 'Çizilecek Projeler', '8-Kontrol Et', '9-Arşiv'
BILDIRIM = '7-Bildirim'          # Google tarafı buradaki dosyaları e-posta olarak gönderip siler
YENI_ALT = '_YENİ GELEN EVRAK'
ORIJINAL = '_orijinal'
BILGI = '_bilgi.txt'
TUMU = 'Tümü.pdf'
BULANIK_ESIK = 60.0
YASAK = re.compile(r'[\\/:*?"<>|\x00-\x1f]')


# ---------------------------------------------------------------- yardımcılar
def simdi():
    return dt.datetime.now().replace(microsecond=0)


def buyuk(s):
    """Türkçe büyük harf (i→İ, ı→I)."""
    return str(s).replace('i', 'İ').replace('ı', 'I').upper()


def anahtar(s):
    """Karşılaştırma anahtarı: Türkçe büyük harf, noktalama ve boşluk farkı yok."""
    return re.sub(r'\s+', ' ', re.sub(r'[^\w+ ]', ' ', buyuk(s))).strip()


def temiz(s, uzunluk=80):
    s = YASAK.sub(' ', str(s or ''))
    s = re.sub(r'\s+', ' ', s).strip(' .')
    return s[:uzunluk].strip(' .') or 'adsız'


def benzersiz(yol: Path) -> Path:
    if not yol.exists():
        return yol
    for i in range(2, 1000):
        aday = yol.with_name(f'{yol.stem} ({i}){yol.suffix}')
        if not aday.exists():
            return aday
    raise RuntimeError('ad bulunamadı')


def ozet(yol: Path) -> str:
    h = hashlib.sha256()
    with open(yol, 'rb') as f:
        for parca in iter(lambda: f.read(1 << 20), b''):
            h.update(parca)
    return h.hexdigest()


# WhatsApp dosya adlarındaki alış zamanı: PHOTO-2026-10-22-10-48-46 · IMG-20261022-WA0012 · WhatsApp Image 2026-10-22 at 10.48.46
ZAMAN_DESEN = [
    (re.compile(r'(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})'), 6),
    (re.compile(r'(\d{4})-(\d{2})-(\d{2}) at (\d{2})\.(\d{2})\.(\d{2})'), 6),
    (re.compile(r'(?:IMG|DOC|VID)-(\d{4})(\d{2})(\d{2})-WA(\d{4})'), 4),
]


def wa_zamani(ad: str):
    for desen, n in ZAMAN_DESEN:
        m = desen.search(ad)
        if m:
            g = [int(x) for x in m.groups()]
            try:
                if n == 6:
                    return dt.datetime(*g)
                return dt.datetime(g[0], g[1], g[2]) + dt.timedelta(seconds=g[3])   # sıra numarası
            except ValueError:
                return None
    return None


def sira_no(ad: str) -> int:
    m = re.match(r'^(\d+)_', ad)
    return int(m.group(1)) if m else 9999


def asil_ad(ad: str) -> str:
    """Kestirmenin eklediği '01_' sıra önekini atar."""
    return re.sub(r'^\d+_', '', ad)


def evrak_adi(dosya_adi: str) -> str:
    """Çıkış dosyasının adı (uzantısız)."""
    kok = Path(asil_ad(dosya_adi)).stem
    z = wa_zamani(kok)
    if z and re.match(r'(?i)^(PHOTO|IMG|WhatsApp Image)', kok):
        return 'Fotoğraf ' + z.strftime('%Y-%m-%d %H.%M.%S')
    if z and re.match(r'(?i)^(DOC|WhatsApp Document)', kok):
        return 'Belge ' + z.strftime('%Y-%m-%d %H.%M')
    return temiz(kok, 70)


# ---------------------------------------------------------------- iş kaydı
class Kayit:
    """isler.json: bütün işlerin durumu (Drive'da, eşitlenir)."""

    def __init__(self, yol: Path):
        self.yol = yol
        self.veri = {'surum': 1, 'isler': {}}
        if yol.exists():
            try:
                self.veri = json.loads(yol.read_text(encoding='utf-8'))
            except Exception:
                log.exception('isler.json okunamadı; yedeklenip yeniden başlanıyor')
                shutil.copy2(yol, benzersiz(yol.with_suffix('.bozuk.json')))

    @property
    def isler(self):
        return self.veri.setdefault('isler', {})

    def kaydet(self):
        gecici = self.yol.with_suffix('.tmp')
        gecici.write_text(json.dumps(self.veri, ensure_ascii=False, indent=1), encoding='utf-8')
        os.replace(gecici, self.yol)

    def bul(self, elektrikci, proje):
        """(iş, 'ayni'|'benzer') ya da (None, None)."""
        a = anahtar(elektrikci) + '|' + anahtar(proje)
        en, puan = None, 0.0
        for is_ in self.isler.values():
            b = anahtar(is_['elektrikci']) + '|' + anahtar(is_['proje'])
            if a == b:
                return is_, 'ayni'
            p = difflib.SequenceMatcher(None, a, b).ratio()
            if p > puan:
                en, puan = is_, p
        if en and puan >= 0.9:
            return en, 'benzer'
        return None, None

    def yeni(self, b):
        kimlik = secrets.token_hex(3).upper()
        while kimlik in self.isler:
            kimlik = secrets.token_hex(3).upper()
        is_ = {
            'id': kimlik, 'elektrikci': temiz(b.get('elektrikci')), 'proje': temiz(b.get('proje')), 'tur': temiz(b.get('tur')),
            'acil': False, 'tamam': False, 'olusturma': simdi().isoformat(), 'son_evrak': None, 'revizyon': 0,
            'durum': 'kuyruk', 'klasor': None, 'elle_ad': False, 'evraklar': [], 'notlar': [], 'uyarilar': [],
            'yeni_evrak': None,
        }
        self.isler[kimlik] = is_
        return is_


# ---------------------------------------------------------------- işleyici
class Isleyici:
    def __init__(self, ayar: dict, bildir=None):
        self.a = ayar
        self.kok = Path(ayar['kok'])
        self.masaustu = Path(ayar['masaustu'])
        self.bildir = bildir or (lambda baslik, metin: log.info('%s: %s', baslik, metin))
        for k in (GELEN, KUYRUK, KONTROL, ARSIV, BILDIRIM):
            (self.kok / k).mkdir(parents=True, exist_ok=True)
        self.kayit = Kayit(self.kok / 'isler.json')
        self._boyutlar = {}          # paket → (boyut imzası, ilk görülme)

    # ---------- klasör adı
    def klasor_adi(self, is_):
        if is_['acil']:
            parca = ['0 ACİL', 'HAZIR' if is_['tamam'] else 'EVRAK EKSİK']
        else:
            parca = ['1 HAZIR' if is_['tamam'] else '2 BEKLİYOR']
        parca += [is_['olusturma'][:10], f"{buyuk(is_['elektrikci'])} – {is_['proje']}", is_['tur']]
        if is_['revizyon']:
            parca.append('REVİZYON' + (f" {is_['revizyon']}" if is_['revizyon'] > 1 else ''))
        if is_['uyarilar']:
            parca.append('KONTROL')
        if is_.get('yeni_evrak'):
            parca.append('YENİ EVRAK')
        return temiz(' · '.join(parca), 180)

    def kuyruktaki_isler(self):
        """id → klasör (Çizilecek Projeler'deki her klasörün _bilgi.txt ilk satırından)."""
        sonuc = {}
        for k in (self.kok / KUYRUK).iterdir():
            kimlik = bilgi_kimligi(k)
            if kimlik:
                sonuc[kimlik] = k
        return sonuc

    def masaustunde_bul(self, kimlik):
        try:
            for k in self.masaustu.iterdir():
                if k.is_dir() and bilgi_kimligi(k) == kimlik:
                    return k
        except OSError:
            pass
        return None

    # ---------- elle yapılan değişiklikleri oku (durum öneki, ad)
    def elle_degisiklikler(self, kuyruk):
        for kimlik, is_ in self.kayit.isler.items():
            if is_['durum'] != 'kuyruk':
                continue
            k = kuyruk.get(kimlik)
            if k is None:
                masa = self.masaustunde_bul(kimlik)
                is_['durum'] = 'masaustu' if masa else 'bitti'
                is_['alinma'] = simdi().isoformat()
                self.kayit_yaz([{'tarih': is_['alinma'], 'is': kimlik, 'olay': 'masaüstüne alındı' if masa else 'listeden kalktı'}])
                continue
            ad = k.name
            if ad == is_.get('klasor'):
                continue
            # kullanıcı adı değiştirmiş: durum önekini oku
            if ad.startswith('1 HAZIR'):
                is_['tamam'], is_['acil'] = True, False
            elif ad.startswith('2 BEKLİYOR'):
                is_['tamam'], is_['acil'] = False, False
            elif ad.startswith('0 ACİL'):
                is_['acil'] = True
                is_['tamam'] = 'HAZIR' in ad.split(' · ')[1:2]
            if 'KONTROL' not in ad.split(' · ') and is_['uyarilar']:
                is_['uyarilar'] = []          # kullanıcı KONTROL sözcüğünü sildi: kontrol edildi
            if 'YENİ EVRAK' not in ad.split(' · '):
                is_['yeni_evrak'] = None
            if not re.match(r'^[012] (ACİL|HAZIR|BEKLİYOR)', ad):
                is_['elle_ad'] = True        # tamamen kendi adını vermiş: dokunma
            is_['klasor'] = ad
        # masaüstündeki iş tekrar listeye konmuşsa
        for kimlik, k in kuyruk.items():
            is_ = self.kayit.isler.get(kimlik)
            if is_ and is_['durum'] != 'kuyruk':
                is_['durum'] = 'kuyruk'
                is_['klasor'] = k.name

    def adlandir(self, is_, k: Path) -> Path:
        if is_.get('elle_ad'):
            return k
        hedef = k.with_name(self.klasor_adi(is_))
        if hedef == k:
            return k
        hedef = benzersiz(hedef)
        try:
            k.rename(hedef)
            is_['klasor'] = hedef.name
            return hedef
        except OSError:          # içinde açık dosya var: sonra yeniden denenir
            log.info('ad değiştirilemedi (açık dosya?), sonra denenecek: %s', is_['id'])
            return k

    # ---------- paket
    def paket_hazir(self, p: Path):
        if not (p / 'paket.json').exists():
            return False
        imza = tuple(sorted((f.name, f.stat().st_size) for f in p.iterdir() if f.is_file()))
        onceki = self._boyutlar.get(p.name)
        if not onceki or onceki[0] != imza:
            self._boyutlar[p.name] = (imza, time.time())
            return False
        return time.time() - onceki[1] >= self.a['kararli_sn']

    def paket_isle(self, p: Path):
        b = json.loads((p / 'paket.json').read_text(encoding='utf-8'))
        dosyalar = [f for f in p.iterdir() if f.is_file() and f.name != 'paket.json']
        dosyalar.sort(key=lambda f: (wa_zamani(asil_ad(f.name)) or dt.datetime.max, sira_no(f.name)))
        paket_zamani = paket_tarihi(p.name) or simdi()

        is_, eslesme = self.kayit.bul(b.get('elektrikci', ''), b.get('proje', ''))
        yeni_is = is_ is None
        if yeni_is:
            is_ = self.kayit.yeni(b)
            is_['olusturma'] = paket_zamani.isoformat()
        elif eslesme == 'benzer':
            is_['notlar'].append(f"{simdi():%Y-%m-%d}: yazım farkı — '{b.get('elektrikci')} – {b.get('proje')}' bu işe eklendi")
        if b.get('acil'):
            is_['acil'] = True
        if b.get('evrakTamam'):
            is_['tamam'] = True                 # "eksik" seçimi HAZIR'ı geri almaz
        if b.get('tur') and anahtar(b['tur']) != anahtar(is_['tur']):
            is_['notlar'].append(f"{simdi():%Y-%m-%d}: proje türü '{b['tur']}' olarak gönderildi (klasörde '{is_['tur']}')")
        if b.get('not'):
            is_['notlar'].append(f"{paket_zamani:%Y-%m-%d %H:%M}: {b['not']}")

        # hedef klasör
        kuyruk = self.kuyruktaki_isler()
        masaustu_klasoru = None
        mevcut_klasor = is_['id'] in kuyruk
        if mevcut_klasor:
            k = kuyruk[is_['id']]
            is_['durum'] = 'kuyruk'
        else:
            masaustu_klasoru = self.masaustunde_bul(is_['id']) if not yeni_is else None
            if masaustu_klasoru is None:
                if not yeni_is:                  # bitmiş işe yeni evrak: revizyon
                    is_['revizyon'] += 1
                    is_['evraklar_onceki'] = len(is_['evraklar'])
                    is_['olusturma'] = paket_zamani.isoformat()
                    is_['tamam'] = bool(b.get('evrakTamam'))
                    is_['uyarilar'] = []
                    is_['yeni_evrak'] = None
                    is_['elle_ad'] = False
                is_['durum'] = 'kuyruk'
                k = self.kok / KUYRUK / ('.' + is_['id'])   # geçici; sonunda adlandırılır
                k.mkdir(parents=True, exist_ok=True)
            else:
                k = masaustu_klasoru / YENI_ALT

        ozetler = set()                                                   # revizyonda yalnız bu turun evrakı
        for e in is_['evraklar'][is_.get('evraklar_onceki', 0):]:
            ozetler.add(e['ozet']); ozetler.update(e.get('ek_ozetler', []))
        eklenen, kayitlar = [], []
        for f in dosyalar:
            oz = ozet(f)
            if oz in ozetler:
                kayitlar.append({'tarih': simdi().isoformat(), 'is': is_['id'], 'olay': 'tekrar evrak atlandı', 'dosya': f.suffix.lstrip('.').lower()})
                continue
            ozetler.add(oz)
            (k / ORIJINAL).mkdir(parents=True, exist_ok=True)
            e = self.evrak_isle(f, k)
            e.update(ozet=oz, tarih=paket_zamani.isoformat(), paket=p.name)
            is_['evraklar'].append(e)
            eklenen.append(e)
            if e.get('uyari'):
                is_['uyarilar'].append(f"{e['ad']}: {e['uyari']}")
            kayitlar.append({'tarih': simdi().isoformat(), 'is': is_['id'], 'olay': 'evrak eklendi', 'dosya': e['tur']})

        if len(eklenen) > 1:
            self.ayni_turu_birlestir(k, is_, eklenen)
        self.okunanlari_denetle(is_)
        if eklenen:
            is_['son_evrak'] = paket_zamani.isoformat()
            if mevcut_klasor:
                is_['yeni_evrak'] = simdi().isoformat()

        ad = f"{buyuk(is_['elektrikci'])} – {is_['proje']}"
        # telefondan gelen pakette e-posta form kaydedilince Google tarafından gönderildi; yeni bir şey yoksa tekrar atılmaz
        tekrar_yok = bool(b.get('epostaGitti')) and not any(e.get('uyari') for e in eklenen)
        if masaustu_klasoru and not eklenen:
            self.bildir('Evrak zaten var', f'{ad}: gönderilen evrak işte zaten vardı')
            self.eposta(f'{ad} · evrak zaten vardı', ['Gönderilen evrak bu işte zaten vardı, yeni dosya eklenmedi.'])
        elif masaustu_klasoru:
            bilgi_yaz(masaustu_klasoru / YENI_ALT, is_, sadece=eklenen)
            self.bildir('Masaüstündeki işe yeni evrak', f"{ad}: {len(eklenen)} evrak '{YENI_ALT}' klasörüne kondu")
            if not tekrar_yok:
                self.eposta(f'{ad} · {len(eklenen)} yeni evrak (masaüstündeki iş)',
                            [f'Masaüstündeki iş klasörüne, "{YENI_ALT}" içine kondu.'] + self._bulanik_satiri(eklenen))
        else:
            tumu_yap(k, is_)
            bilgi_yaz(k, is_)
            k = self.adlandir(is_, k) if not k.name.startswith('.') else self._ilk_ad(is_, k)
            durum = 'HAZIR' if is_['tamam'] else 'EVRAK EKSİK'
            self.bildir('Evrak işlendi', f"{ad}: {len(eklenen)} evrak · {durum}" + (' · KONTROL' if is_['uyarilar'] else ''))
            satir = [f"{len(eklenen)} evrak geldi, Çizilecek Projeler'e kondu."] + self._bulanik_satiri(eklenen)
            konu = f"{ad} · {len(eklenen)} evrak · {'HAZIR' if is_['tamam'] else 'EVRAK EKSİK'}" + (' · ACİL' if is_['acil'] else '')
            if not (tekrar_yok and not is_['uyarilar']):
                self.eposta(konu, satir)

        arsiv = benzersiz(self.kok / ARSIV / p.name)
        shutil.move(str(p), str(arsiv))
        self._boyutlar.pop(p.name, None)
        self.kayit_yaz(kayitlar)
        self.kayit.kaydet()

    @staticmethod
    def okunanlari_denetle(is_):
        """Evraklardan okunan ada/parsel farklıysa KONTROL uyarısı."""
        ada_parsel = {(e['okunan'].get('ada'), e['okunan'].get('parsel')) for e in is_['evraklar']
                      if e.get('okunan', {}).get('ada') and e.get('okunan', {}).get('parsel')}
        if len(ada_parsel) > 1:
            u = 'evraklarda farklı ada/parsel okundu: ' + ', '.join(f'{a}/{p}' for a, p in sorted(ada_parsel))
            if u not in is_['uyarilar']:
                is_['uyarilar'] = [x for x in is_['uyarilar'] if not x.startswith('evraklarda farklı ada/parsel')] + [u]

    @staticmethod
    def _bulanik_satiri(evraklar):
        n = sum(1 for e in evraklar if e.get('uyari'))
        return [f'{n} evrak bulanık olabilir, kontrol edin (müşteriye hazır mesaj _bilgi.txt dosyasında).'] if n else []

    @staticmethod
    def _evrak_satirlari(evraklar):
        return [f"  • {e['ad']}" + (f"  ({e['aciklama']})" if e.get('aciklama') else '') + (f"  ⚠ {e['uyari']}" if e.get('uyari') else '')
                for e in evraklar]

    def eposta(self, konu, satirlar):
        """E-posta özeti: Drive'daki 7-Bildirim klasörüne yazılır; Google tarafı (Kod.gs bildirimGonder) gönderip siler."""
        if not self.a.get('eposta', True):
            return
        try:
            yol = benzersiz(self.kok / BILDIRIM / f"{simdi():%Y%m%d-%H%M%S}.json")
            yol.write_text(json.dumps({'konu': 'AGY Evrak — ' + konu, 'metin': '\n'.join(satirlar), 'zaman': simdi().isoformat()},
                                      ensure_ascii=False, indent=1), encoding='utf-8')
        except OSError:
            log.exception('bildirim dosyası yazılamadı')

    def _ilk_ad(self, is_, k: Path) -> Path:
        hedef = benzersiz(k.with_name(self.klasor_adi(is_)))
        k.rename(hedef)
        is_['klasor'] = hedef.name
        return hedef

    def evrak_isle(self, f: Path, k: Path) -> dict:
        """Tek dosya: orijinali sakla, resimse iyileştirip PDF yap, PDF'i olduğu gibi koy."""
        uz = f.suffix.lower()
        ad = evrak_adi(f.name)
        shutil.copy2(f, benzersiz(k / ORIJINAL / temiz(asil_ad(f.name), 120)))
        e = {'ad': None, 'kaynak': asil_ad(f.name), 'tur': uz.lstrip('.')}
        if uz in goruntu.RESIM_UZANTILARI:
            try:
                im, b = goruntu.iyilestir(goruntu.oku(f), self.a.get('kalite', 'tam'))
                metin = okuma.resim_metni(im)
                tur, _ = okuma.tur_bul(metin, f.name)
                e.update(evrak_turu=tur, okunan=okuma.bilgi_cikar(metin))
                hedef = benzersiz(k / f'{tur or ad}.pdf')
                goruntu.pdf_yap([im], hedef, self.a.get('jpeg_kalite', 85))
                e.update(ad=hedef.name, aciklama='fotoğraftan tarandı' + ('' if b['kirpildi'] else ', kenar bulunamadı'),
                         bulaniklik=b['bulaniklik'])
                if b['bulaniklik'] < BULANIK_ESIK:
                    e['uyari'] = 'bulanık olabilir, kontrol edin'
            except Exception as hata:            # bozuk resim: olduğu gibi konur
                log.exception('resim işlenemedi')
                hedef = benzersiz(k / temiz(asil_ad(f.name), 120))
                shutil.copy2(f, hedef)
                e.update(ad=hedef.name, uyari=f'resim işlenemedi ({type(hata).__name__}), olduğu gibi kondu')
        else:
            metin = ''
            if uz == '.pdf':
                metin = okuma.pdf_metni(f)
                if len(metin.strip()) < 40:                    # taranmış PDF: ilk sayfayı oku
                    sayfa = okuma.pdf_ilk_sayfa_resmi(f)
                    metin = okuma.resim_metni(sayfa) if sayfa is not None else ''
            tur, _ = okuma.tur_bul(metin, f.name)
            e.update(evrak_turu=tur, okunan=okuma.bilgi_cikar(metin))
            hedef = benzersiz(k / ((tur or ad) + uz))
            shutil.copy2(f, hedef)
            e['ad'] = hedef.name
        return e

    def ayni_turu_birlestir(self, k: Path, is_, eklenen):
        """Aynı gönderimde aynı türden birden çok PDF (ör. tapunun 1. ve 2. sayfası) tek PDF'te birleşir."""
        from pypdf import PdfReader, PdfWriter
        gruplar = {}
        for e in eklenen:
            if e.get('evrak_turu') and e['ad'] and e['ad'].lower().endswith('.pdf') and (k / e['ad']).exists():
                gruplar.setdefault(e['evrak_turu'], []).append(e)
        for tur, liste in gruplar.items():
            if len(liste) < 2:
                continue
            try:
                yazar = PdfWriter()
                for e in liste:
                    for sayfa in PdfReader(io.BytesIO((k / e['ad']).read_bytes())).pages:
                        yazar.add_page(sayfa)
                gecici = k / f'.{liste[0]["ad"]}.tmp'
                with open(gecici, 'wb') as fp:
                    yazar.write(fp)
                ilk = liste[0]
                for e in liste[1:]:
                    (k / e['ad']).unlink()
                    ilk.setdefault('ek_ozetler', []).append(e['ozet'])
                    ilk.setdefault('ek_kaynaklar', []).append(e['kaynak'])
                    if e.get('uyari') and not ilk.get('uyari'):
                        ilk['uyari'] = e['uyari']
                    is_['evraklar'].remove(e)
                    eklenen.remove(e)
                os.replace(gecici, k / ilk['ad'])
                ilk['sayfa'] = len(liste)
                ilk['aciklama'] = f'{len(liste)} sayfa birleştirildi'
            except Exception:
                log.exception('aynı tür birleştirilemedi')

    # ---------- bilgisiz / bozuk paket
    def kontrole_tasi(self, p: Path, neden: str):
        hedef = benzersiz(self.kok / KONTROL / p.name)
        shutil.move(str(p), str(hedef))
        (hedef / 'NEDEN.txt').write_text(neden + '\n', encoding='utf-8')
        self._boyutlar.pop(p.name, None)
        self.bildir('Evrak kontrol bekliyor', f'Bir paket "8-Kontrol Et" klasörüne kondu: {neden}')
        self.eposta('1 gönderim kontrol bekliyor', [f'"8-Kontrol Et" klasörüne kondu. Sebep: {neden}'])

    # ---------- kayıt ve liste
    def kayit_yaz(self, satirlar):
        if not satirlar:
            return
        yol = self.kok / 'Kayıt.csv'
        yeni = not yol.exists()
        with open(yol, 'a', newline='', encoding='utf-8-sig') as f:
            w = csv.DictWriter(f, fieldnames=['tarih', 'is', 'olay', 'dosya'], delimiter=';')
            if yeni:
                w.writeheader()
            for s in satirlar:
                w.writerow({k: s.get(k, '') for k in ['tarih', 'is', 'olay', 'dosya']})

    def liste_yaz(self, kuyruk):
        satirlar, bugun = [], simdi()
        for kimlik, k in sorted(kuyruk.items(), key=lambda x: x[1].name):
            is_ = self.kayit.isler.get(kimlik)
            if not is_:
                continue
            gun = max(0, (bugun - dt.datetime.fromisoformat(is_['olusturma'])).days)
            uyari = '  ⚠ GECİKİYOR' if gun >= self.a['gecikme_gun'] else ''
            satirlar.append(f"{k.name}\n    {gun} gündür bekliyor{uyari} · {len(is_['evraklar'])} evrak"
                            + (f" · kontrol: {'; '.join(is_['uyarilar'])}" if is_['uyarilar'] else ''))
        metin = (f'ÇİZİLECEK PROJELER — {bugun:%d.%m.%Y %H:%M}\n'
                 f'Sıra: ACİL → HAZIR (en eski üstte) → BEKLİYOR. {self.a["gecikme_gun"]} günü geçen iş GECİKİYOR olarak işaretlenir.\n\n'
                 + ('\n\n'.join(satirlar) if satirlar else 'Bekleyen iş yok.') + '\n')
        yol = self.kok / KUYRUK / '_LİSTE.txt'
        try:
            if not yol.exists() or yol.read_text(encoding='utf-8').split('\n', 1)[1:] != metin.split('\n', 1)[1:]:
                yol.write_text(metin, encoding='utf-8')
        except OSError:
            pass

    def gecikenler(self, kuyruk):
        bugun = simdi()
        return [self.kayit.isler[i] for i in kuyruk if i in self.kayit.isler and
                (bugun - dt.datetime.fromisoformat(self.kayit.isler[i]['olusturma'])).days >= self.a['gecikme_gun']]

    # ---------- bir tur
    def tur(self):
        kuyruk = self.kuyruktaki_isler()
        self.elle_degisiklikler(kuyruk)
        islenen = 0
        for p in sorted((self.kok / GELEN).iterdir(), key=lambda x: x.name):
            if not p.is_dir():
                continue
            try:
                if self.paket_hazir(p):
                    self.paket_isle(p)
                    islenen += 1
                elif not (p / 'paket.json').exists():
                    yas = (simdi() - (paket_tarihi(p.name) or dt.datetime.fromtimestamp(p.stat().st_mtime))).total_seconds() / 3600
                    if yas > self.a['bilgisiz_paket_saat']:
                        self.kontrole_tasi(p, 'Paket bilgisi (elektrikçi / proje) girilmemiş: telefonda form kaydedilmemiş.')
            except Exception as hata:
                log.exception('paket işlenemedi: %s', p.name)
                say = self.kayit.veri.setdefault('hatalar', {}).get(p.name, 0) + 1
                self.kayit.veri['hatalar'][p.name] = say
                if say >= 3:
                    self.kontrole_tasi(p, f'3 denemede işlenemedi: {type(hata).__name__}: {hata}')
        # YENİ EVRAK işaretinin süresi
        kuyruk = self.kuyruktaki_isler()
        for kimlik, k in kuyruk.items():
            is_ = self.kayit.isler.get(kimlik)
            if not is_:
                continue
            if is_.get('yeni_evrak') and (simdi() - dt.datetime.fromisoformat(is_['yeni_evrak'])).total_seconds() > self.a['yeni_evrak_saat'] * 3600:
                is_['yeni_evrak'] = None
            if k.name != self.klasor_adi(is_) and not is_.get('elle_ad'):
                self.adlandir(is_, k)
        kuyruk = self.kuyruktaki_isler()
        self.liste_yaz(kuyruk)
        self.kayit.kaydet()
        return islenen


# ---------------------------------------------------------------- dosya yardımcıları
def paket_tarihi(ad: str):
    m = re.match(r'^(\d{8})-(\d{6})', ad)
    if m:
        try:
            return dt.datetime.strptime(m.group(1) + m.group(2), '%Y%m%d%H%M%S')
        except ValueError:
            return None
    return None


def bilgi_kimligi(k: Path):
    try:
        with open(k / BILGI, encoding='utf-8') as f:
            m = re.match(r'İş kimliği:\s*([0-9A-F]{6})', f.readline())
            return m.group(1) if m else None
    except OSError:
        return None


def bilgi_yaz(k: Path, is_, sadece=None):
    durum = ('ACİL · ' if is_['acil'] else '') + ('EVRAK TAMAM (HAZIR)' if is_['tamam'] else 'EVRAK EKSİK (BEKLİYOR)')
    evraklar = sadece if sadece is not None else is_['evraklar'][is_.get('evraklar_onceki', 0):] if is_['revizyon'] else is_['evraklar']
    s = [f"İş kimliği: {is_['id']}",
         f"Elektrikçi: {is_['elektrikci']}", f"Proje: {is_['proje']}", f"Proje türü: {is_['tur']}", f'Durum: {durum}',
         f"İlk evrak: {is_['olusturma'][:16].replace('T', ' ')}"]
    if is_['revizyon']:
        s.append(f"REVİZYON {is_['revizyon']}: önceki evrak kendi proje klasörünüzde.")
    if sadece is not None:
        s.append('Bu klasördeki evrak, iş masaüstündeyken geldi.')
    okunan = {}
    for e in evraklar:
        for a, v in (e.get('okunan') or {}).items():
            okunan.setdefault(a, v)
    if okunan:
        s.append('Evraklardan okunan: ' + ' · '.join(f'{ {"ada": "Ada", "parsel": "Parsel", "il_ilce": "İl/İlçe", "mahalle": "Mahalle"}.get(a, a)} {v}'
                                                    for a, v in okunan.items()) + '  (kontrol edin; okuma hatalı olabilir)')
    s += ['', 'Evraklar:']
    for e in evraklar:
        s.append(f"  - {e['tarih'][:16].replace('T', ' ')}  {e['ad']}" + (f"  ({e['aciklama']})" if e.get('aciklama') else '')
                 + (f"  ⚠ {e['uyari']}" if e.get('uyari') else ''))
    if is_['notlar']:
        s += ['', 'Notlar:'] + [f'  - {n}' for n in is_['notlar']]
    bulanik = [e['ad'] for e in evraklar if e.get('uyari', '').startswith('bulanık')]
    if is_['uyarilar']:
        s += ['', 'Kontrol edilecekler:'] + [f'  - {u}' for u in is_['uyarilar']]
        s.append('  (Kontrol bitince bu bölümü silmenize gerek yok; klasör adındaki KONTROL sözcüğünü silmeniz yeterli.)')
    if bulanik:
        s += ['', 'Müşteriye gönderilecek hazır mesaj:',
              '  Merhaba, gönderdiğiniz evraklardan bazıları net okunmuyor. Rica etsek aydınlık bir yerde, düz ve'
              ' tamamı görünecek şekilde yeniden çekip WhatsApp\'tan "Belge" olarak gönderebilir misiniz? Teşekkürler.']
    (k / BILGI).write_text('\n'.join(s) + '\n', encoding='utf-8')


def tumu_yap(k: Path, is_):
    """Klasördeki bütün PDF'leri (ve resimleri) evrak sırasıyla tek dosyada birleştirir."""
    from pypdf import PdfReader, PdfWriter
    yazar = PdfWriter()
    sira = [e['ad'] for e in is_['evraklar']]
    pdfler = [k / a for a in sira if a and a.lower().endswith('.pdf') and (k / a).exists()]
    for p in pdfler:
        try:
            r = PdfReader(io.BytesIO(p.read_bytes()))
            if r.is_encrypted:
                continue
            for sayfa in r.pages:
                yazar.add_page(sayfa)
        except Exception:
            log.warning('Tümü.pdf için okunamadı: %s', p.suffix)
    if len(yazar.pages):
        with open(k / TUMU, 'wb') as f:
            yazar.write(f)
