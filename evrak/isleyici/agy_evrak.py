"""AGY Evrak İşleyici — Windows'ta arka planda çalışır (saatin yanında simge).

- Şirket Drive'ındaki 0-Gelen'i yoklar, paketleri işler, "Çizilecek Projeler"e koyar (islem.py).
- Masaüstündeki "Evrak Bırak" klasörüne bırakılan dosyalar için telefondaki formun aynısını açar (yerel_form.py).
- Sağ tık → Gönder → AGY Evrak ile gönderilen dosyalar da "Evrak Bırak"a kopyalanır.
Kayıt (log): %APPDATA%\\AGY Evrak\\islem.log (kişisel veri yazılmaz).
"""
import datetime as dt
import json
import logging
import logging.handlers
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path

import ayar as ayarlar
import islem

PENCERESIZ = 0x08000000 if sys.platform == 'win32' else 0
BIRAK = 'Evrak Bırak'
log = logging.getLogger('evrak')


# ---------------------------------------------------------------- Windows yardımcıları
def ps(komut: str):
    if sys.platform != 'win32':
        return
    subprocess.run(['powershell', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', komut],
                   creationflags=PENCERESIZ, capture_output=True, timeout=30)


def bildirim(baslik: str, metin: str):
    log.info('bildirim: %s', baslik)
    if sys.platform != 'win32':
        return
    kac = lambda s: s.replace("'", "''").replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    komut = (
        "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null;"
        "[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null;"
        f"$x = New-Object Windows.Data.Xml.Dom.XmlDocument; $x.LoadXml('<toast><visual><binding template=\"ToastGeneric\"><text>{kac(baslik)}</text><text>{kac(metin)}</text></binding></visual></toast>');"
        "$t = [Windows.UI.Notifications.ToastNotification]::new($x);"
        "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe').Show($t)"
    )
    threading.Thread(target=lambda: ps(komut), daemon=True).start()


def kisayol(lnk: Path, hedef: str, argumanlar: str = '', simge: str = ''):
    lnk.parent.mkdir(parents=True, exist_ok=True)
    ps(f"$s = (New-Object -ComObject WScript.Shell).CreateShortcut('{str(lnk).replace(chr(39), chr(39) * 2)}');"
       f"$s.TargetPath = '{hedef.replace(chr(39), chr(39) * 2)}'; $s.Arguments = '{argumanlar}';"
       + (f"$s.IconLocation = '{simge}';" if simge else '') + '$s.Save()')


def exe_yolu() -> str:
    return sys.executable if getattr(sys, 'frozen', False) else f'"{sys.executable}" "{Path(__file__).resolve()}"'


def acilista_baslat(ac: bool):
    if sys.platform != 'win32':
        return
    import winreg
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Software\Microsoft\Windows\CurrentVersion\Run', 0, winreg.KEY_ALL_ACCESS) as k:
        if ac:
            winreg.SetValueEx(k, 'AGY Evrak', 0, winreg.REG_SZ, f'"{sys.executable}"' if getattr(sys, 'frozen', False) else exe_yolu())
        else:
            try:
                winreg.DeleteValue(k, 'AGY Evrak')
            except FileNotFoundError:
                pass


def acilista_mi() -> bool:
    if sys.platform != 'win32':
        return False
    import winreg
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Software\Microsoft\Windows\CurrentVersion\Run') as k:
            winreg.QueryValueEx(k, 'AGY Evrak')
            return True
    except OSError:
        return False


def tek_kopya() -> bool:
    """İkinci kez açılırsa False (Windows adlı mutex)."""
    if sys.platform != 'win32':
        return True
    import ctypes
    ctypes.windll.kernel32.CreateMutexW(None, False, 'AGY_Evrak_Isleyici_Tek')
    return ctypes.windll.kernel32.GetLastError() != 183      # ERROR_ALREADY_EXISTS


def ac(yol):
    if sys.platform == 'win32':
        os.startfile(str(yol))


# ---------------------------------------------------------------- uygulama
class Uygulama:
    def __init__(self):
        self.ayar = ayarlar.yukle()
        self.durum = 'başlıyor'
        self.isleyici = None
        self.dur = threading.Event()
        self.simdi_tara = threading.Event()
        self.birak = Path(self.ayar['masaustu']) / BIRAK
        self.form = None
        self._izlenen = None          # (imza, ilk görülme)
        self._acilan = None           # form açılmış içerik imzası (aynı içerik için tekrar açılmaz)
        self.simge = None

    # ---------- kurulum işleri (ilk açılış)
    def hazirla(self):
        kok = ayarlar.kok_bul(self.ayar['kok'])
        if kok is None:
            return False
        self.ayar['kok'] = str(kok)
        self.isleyici = islem.Isleyici(self.ayar, bildirim)
        self.birak.mkdir(exist_ok=True)
        masa = Path(self.ayar['masaustu'])
        if sys.platform == 'win32':
            if not (masa / 'Çizilecek Projeler.lnk').exists():
                kisayol(masa / 'Çizilecek Projeler.lnk', str(kok / islem.KUYRUK))
            sendto = Path(os.environ.get('APPDATA', '')) / 'Microsoft' / 'Windows' / 'SendTo' / 'AGY Evrak.lnk'
            if getattr(sys, 'frozen', False) and not sendto.exists():
                kisayol(sendto, sys.executable)
            bayrak = ayarlar.veri_klasoru() / 'ilk-kurulum'
            if not bayrak.exists():
                acilista_baslat(True)
                bayrak.write_text(dt.datetime.now().isoformat())
        return True

    # ---------- Drive döngüsü
    def dongu(self):
        while not self.dur.is_set():
            try:
                if self.isleyici is None and not self.hazirla():
                    self.durum = "Drive klasörü bulunamadı (AGY Evrak). Google Drive açık mı?"
                else:
                    self.durum = 'işliyor…'
                    n = self.isleyici.tur()
                    self.gunluk_uyari()
                    self.durum = f"çalışıyor · son kontrol {dt.datetime.now():%H:%M}" + (f' · {n} paket işlendi' if n else '')
            except Exception:
                log.exception('döngü hatası')
                self.durum = 'hata (kayda bakın)'
            self.simdi_tara.wait(self.ayar['yokla_sn'])
            self.simdi_tara.clear()

    def gunluk_uyari(self):
        """Günde bir kez (günün ilk kontrolünde): 3 günü geçen iş varsa Windows bildirimi."""
        dosya = ayarlar.veri_klasoru() / 'son-gunluk-uyari.txt'
        bugun = dt.date.today().isoformat()
        try:
            if dosya.exists() and dosya.read_text().strip() == bugun:
                return
        except OSError:
            pass
        gec = self.isleyici.gecikenler(self.isleyici.kuyruktaki_isler())
        if gec:
            adlar = ', '.join(f"{islem.buyuk(x['elektrikci'])} – {x['proje']}" for x in gec[:3]) + (' …' if len(gec) > 3 else '')
            bildirim(f"{len(gec)} iş {self.ayar['gecikme_gun']} günü geçti", adlar)
        try:
            dosya.write_text(bugun)
        except OSError:
            pass

    # ---------- "Evrak Bırak" izleyici (saniyede bir; 1,5 sn sabit kalınca form açılır)
    def birak_izle(self):
        while not self.dur.is_set():
            try:
                self.birak_kontrol()
            except Exception:
                log.exception('Evrak Bırak izleme hatası')
            self.dur.wait(1)

    def birak_dosyalari(self):
        if not self.birak.exists():
            return []
        return sorted((f for f in self.birak.iterdir() if f.is_file() and not f.name.startswith(('~$', '.', 'desktop.ini'))
                       and f.suffix.lower() not in ('.tmp', '.crdownload', '.part', '.partial')), key=lambda f: f.stat().st_mtime)

    def birak_kontrol(self):
        dosyalar = self.birak_dosyalari()
        if not dosyalar:
            self._izlenen = self._acilan = None
            return
        imza = tuple((f.name, f.stat().st_size) for f in dosyalar)
        if imza == self._acilan or self.isleyici is None or self.form is None:
            return
        if not self._izlenen or self._izlenen[0] != imza:
            self._izlenen = (imza, time.time())
            return
        if time.time() - self._izlenen[1] >= 1.5:
            self._acilan = imza
            self.form.ac([str(f) for f in dosyalar], self.oneriler())

    def form_kaydet(self, oturum, bilgi):
        """Formdan gelen bilgiyle dosyaları 0-Gelen'e paket olarak taşır."""
        dosyalar = [Path(f) for f in oturum['dosyalar'] if Path(f).exists()]
        if not dosyalar:
            return False, 'Dosyalar Evrak Bırak klasöründe bulunamadı (taşınmış ya da silinmiş).'
        ad = dt.datetime.now().strftime('%Y%m%d-%H%M%S') + '-pc'
        p = Path(self.ayar['kok']) / islem.GELEN / ad
        p.mkdir(parents=True)
        for i, f in enumerate(dosyalar, 1):
            shutil.move(str(f), str(p / f'{i:02d}_{f.name}'))
        bilgi = dict(bilgi, surum=1, paket=ad, dosyaSayisi=len(dosyalar), kayit=dt.datetime.now().isoformat(), kaynak='pc')
        (p / 'paket.json').write_text(json.dumps(bilgi, ensure_ascii=False, indent=2), encoding='utf-8')
        self._acilan = None
        self.simdi_tara.set()
        return True, None

    def formu_yeniden_ac(self):
        self._acilan = self._izlenen = None

    def oneriler(self):
        isler = list(self.isleyici.kayit.isler.values()) if self.isleyici else []
        isler.sort(key=lambda x: x.get('son_evrak') or x['olusturma'], reverse=True)
        return isler

    # ---------- çalıştır: arka plan iş parçacıkları + saat yanı simgesi (ana iş parçacığı)
    def calistir(self):
        import yerel_form
        self.form = yerel_form.FormSunucusu(self.form_kaydet)
        threading.Thread(target=self.dongu, daemon=True).start()
        threading.Thread(target=self.birak_izle, daemon=True).start()
        self.simge = self.simge_kur()
        if self.simge is None:                 # simge kurulamazsa (ör. sunucu ortamı) yine çalışsın
            self.dur.wait()
            return
        self.simge.run()                       # Çıkış'a kadar bekler

    def cikis(self):
        self.dur.set()
        self.simdi_tara.set()
        if self.simge:
            self.simge.stop()

    def simge_kur(self):
        try:
            import pystray
            from PIL import Image, ImageDraw
        except Exception:
            return None
        resim = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        d = ImageDraw.Draw(resim)
        d.rounded_rectangle((2, 2, 62, 62), 14, fill=(21, 40, 75))
        for y0, x1 in ((16, 46), (29, 40), (42, 46)):
            d.rectangle((18, y0, x1, y0 + 6), fill='white')
        d.rectangle((18, 16, 24, 48), fill='white')
        kok = lambda: Path(self.ayar['kok'])
        menu = pystray.Menu(
            pystray.MenuItem(lambda _: f'AGY Evrak {ayarlar.SURUM} — {self.durum}', None, enabled=False),
            pystray.MenuItem("Çizilecek Projeler'i aç", lambda: ac(kok() / islem.KUYRUK), default=True),
            pystray.MenuItem('Evrak Bırak klasörünü aç', lambda: ac(self.birak)),
            pystray.MenuItem('Evrak Bırak formunu yeniden aç', lambda: self.formu_yeniden_ac()),
            pystray.MenuItem('Şimdi kontrol et', lambda: self.simdi_tara.set()),
            pystray.MenuItem('Kontrol Et klasörü', lambda: ac(kok() / islem.KONTROL)),
            pystray.MenuItem('Kayıt (Excel)', lambda: ac(kok() / 'Kayıt.csv')),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem('Windows açılışında başlat', lambda: acilista_baslat(not acilista_mi()), checked=lambda _: acilista_mi()),
            pystray.MenuItem('Ayar dosyası', lambda: ac(ayarlar.veri_klasoru() / 'ayar.json')),
            pystray.MenuItem('Program kaydı (log)', lambda: ac(ayarlar.veri_klasoru() / 'islem.log')),
            pystray.MenuItem('Çıkış', lambda: self.cikis()),
        )
        return pystray.Icon('AGY Evrak', resim, 'AGY Evrak', menu)


def kayit_kur():
    d = ayarlar.veri_klasoru() / 'islem.log'
    h = logging.handlers.RotatingFileHandler(d, maxBytes=1_000_000, backupCount=3, encoding='utf-8')
    h.setFormatter(logging.Formatter('%(asctime)s %(levelname)s %(message)s'))
    log.addHandler(h)
    log.setLevel(logging.INFO)
    if not getattr(sys, 'frozen', False):
        log.addHandler(logging.StreamHandler())


def main():
    if '--surum' in sys.argv:
        print(ayarlar.SURUM)
        return
    kayit_kur()
    a = ayarlar.yukle()
    # "Gönder → AGY Evrak": dosyaları Evrak Bırak klasörüne kopyala ve çık (çalışan program pencereyi açar)
    if len(sys.argv) > 1:
        hedef = Path(a['masaustu']) / BIRAK
        hedef.mkdir(exist_ok=True)
        for f in sys.argv[1:]:
            f = Path(f)
            if f.is_file():
                shutil.copy2(f, islem.benzersiz(hedef / f.name))
            elif f.is_dir():
                for g in f.iterdir():
                    if g.is_file():
                        shutil.copy2(g, islem.benzersiz(hedef / g.name))
        if not tek_kopya():
            return
    elif not tek_kopya():
        bildirim('AGY Evrak', 'Program zaten çalışıyor (saatin yanındaki simge).')
        return
    log.info('başladı %s', ayarlar.SURUM)
    Uygulama().calistir()


if __name__ == '__main__':
    main()
