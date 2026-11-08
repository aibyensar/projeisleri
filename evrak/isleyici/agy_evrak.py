"""AGY Evrak İşleyici — Windows'ta arka planda çalışır (saatin yanında simge).

- Şirket Drive'ındaki 0-Gelen'i yoklar, paketleri işler, "Çizilecek Projeler"e koyar (islem.py).
- Masaüstündeki "Evrak Bırak" klasörüne bırakılan dosyalar için küçük bir pencere açar (PC'deki WhatsApp, tarayıcı, e-Devlet).
- Sağ tık → Gönder → AGY Evrak ile gönderilen dosyalar da "Evrak Bırak"a kopyalanır.
Kayıt (log): %APPDATA%\\AGY Evrak\\islem.log (kişisel veri yazılmaz).
"""
import datetime as dt
import json
import logging
import logging.handlers
import os
import queue
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
        self.kuyruk_q = queue.Queue()          # arka plandan arayüze iş
        self.durum = 'başlıyor'
        self.isleyici = None
        self.dur = threading.Event()
        self.simdi_tara = threading.Event()
        self.birak = Path(self.ayar['masaustu']) / BIRAK
        self._birak_boyut = {}
        self.pencere_acik = False

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

    # ---------- arka plan döngüsü
    def dongu(self):
        while not self.dur.is_set():
            try:
                if self.isleyici is None and not self.hazirla():
                    self.durum = "Drive klasörü bulunamadı (AGY Evrak). Google Drive açık mı?"
                else:
                    self.durum = 'işliyor…'
                    n = self.isleyici.tur()
                    self.birak_kontrol()
                    self.durum = f"çalışıyor · son kontrol {dt.datetime.now():%H:%M}" + (f' · {n} paket işlendi' if n else '')
            except Exception:
                log.exception('döngü hatası')
                self.durum = 'hata (kayda bakın)'
            self.simdi_tara.wait(self.ayar['yokla_sn'])
            self.simdi_tara.clear()

    def birak_kontrol(self):
        if self.pencere_acik or not self.birak.exists():
            return
        dosyalar = [f for f in self.birak.iterdir() if f.is_file() and not f.name.startswith(('~$', '.')) and f.suffix.lower() not in ('.tmp', '.crdownload', '.part')]
        imza = tuple(sorted((f.name, f.stat().st_size) for f in dosyalar))
        if not dosyalar:
            self._birak_boyut = {}
            return
        if imza == getattr(self, '_iptal_imza', None):      # "Vazgeç" denmiş: içerik değişene kadar sorma
            return
        if self._birak_boyut.get('imza') != imza:
            self._birak_boyut = {'imza': imza, 'zaman': time.time()}
            return
        if time.time() - self._birak_boyut['zaman'] >= 3:
            self.pencere_acik = True
            self._acik_imza = imza
            self.kuyruk_q.put(('birak', sorted(dosyalar, key=lambda f: f.stat().st_mtime)))

    # ---------- "Evrak Bırak" penceresi → 0-Gelen'e paket
    def paket_olustur(self, dosyalar, bilgi):
        ad = dt.datetime.now().strftime('%Y%m%d-%H%M%S') + '-pc'
        p = Path(self.ayar['kok']) / islem.GELEN / ad
        p.mkdir(parents=True)
        for i, f in enumerate(dosyalar, 1):
            shutil.move(str(f), str(p / f'{i:02d}_{f.name}'))
        bilgi = dict(bilgi, surum=1, paket=ad, dosyaSayisi=len(dosyalar), kayit=dt.datetime.now().isoformat(), kaynak='pc')
        (p / 'paket.json').write_text(json.dumps(bilgi, ensure_ascii=False, indent=2), encoding='utf-8')
        self.simdi_tara.set()

    def oneriler(self):
        isler = list(self.isleyici.kayit.isler.values()) if self.isleyici else []
        isler.sort(key=lambda x: x.get('son_evrak') or x['olusturma'], reverse=True)
        return isler

    # ---------- arayüz (ana iş parçacığı: tkinter + saat yanı simgesi)
    def calistir(self):
        import tkinter as tk
        import pencere
        self.kok_tk = tk.Tk()
        self.kok_tk.withdraw()
        simge = self.simge_kur()
        threading.Thread(target=self.dongu, daemon=True).start()

        def bak():
            try:
                while True:
                    tur, veri = self.kuyruk_q.get_nowait()
                    if tur == 'birak':
                        pencere.EvrakPenceresi(self.kok_tk, veri, self.oneriler(), self._pencere_sonuc)
                    elif tur == 'cikis':
                        self.dur.set(); self.simdi_tara.set()
                        if simge:
                            simge.stop()
                        self.kok_tk.destroy()
                        return
            except queue.Empty:
                pass
            self.kok_tk.after(400, bak)
        self.kok_tk.after(400, bak)
        self.kok_tk.mainloop()

    def _pencere_sonuc(self, dosyalar, bilgi):
        try:
            if bilgi:
                self.paket_olustur(dosyalar, bilgi)
            else:
                self._iptal_imza = getattr(self, '_acik_imza', None)
        finally:
            self.pencere_acik = False
            self._birak_boyut = {}

    def simge_kur(self):
        try:
            import pystray
            from PIL import Image, ImageDraw
        except Exception:
            return None
        resim = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        d = ImageDraw.Draw(resim)
        d.rounded_rectangle((2, 2, 62, 62), 14, fill=(21, 40, 75))
        d.rectangle((18, 16, 46, 22), fill='white'); d.rectangle((18, 29, 40, 35), fill='white'); d.rectangle((18, 42, 46, 48), fill='white')
        d.rectangle((18, 16, 24, 48), fill='white')
        kok = lambda: Path(self.ayar['kok'])
        menu = pystray.Menu(
            pystray.MenuItem(lambda _: f'AGY Evrak {ayarlar.SURUM} — {self.durum}', None, enabled=False),
            pystray.MenuItem("Çizilecek Projeler'i aç", lambda: ac(kok() / islem.KUYRUK), default=True),
            pystray.MenuItem('Evrak Bırak klasörünü aç', lambda: ac(self.birak)),
            pystray.MenuItem('Şimdi kontrol et', lambda: self.simdi_tara.set()),
            pystray.MenuItem('Kontrol Et klasörü', lambda: ac(kok() / islem.KONTROL)),
            pystray.MenuItem('Kayıt (Excel)', lambda: ac(kok() / 'Kayıt.csv')),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Windows açılışında başlat", lambda: acilista_baslat(not acilista_mi()), checked=lambda _: acilista_mi()),
            pystray.MenuItem('Ayar dosyası', lambda: ac(ayarlar.veri_klasoru() / 'ayar.json')),
            pystray.MenuItem('Program kaydı (log)', lambda: ac(ayarlar.veri_klasoru() / 'islem.log')),
            pystray.MenuItem('Çıkış', lambda: self.kuyruk_q.put(('cikis', None))),
        )
        simge = pystray.Icon('AGY Evrak', resim, 'AGY Evrak', menu)
        simge.run_detached()
        return simge


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
