"""'Evrak Bırak' formu: telefondaki formun (apps-script/Form.html) aynısını bilgisayarda açar.

Bilgisayarın içinde (127.0.0.1) küçük bir sunucu çalışır; form Edge'in adres çubuksuz uygulama penceresinde açılır.
Dışarıdan erişilemez; her pencerenin tek kullanımlık anahtarı vardır.
"""
import json
import os
import secrets
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

TURLER = ['İç Tesisat', 'Bağlantı Hattı', 'İç Tesisat + Bağlantı Hattı', 'Kompanzasyon']

# Google Apps Script yerine yerel sunucuya gönderen ara katman
ARA_KATMAN = """<style>html { zoom: .86; } .ust { padding: 12px 18px 56px; } .ust img { height: 38px; } main { padding-bottom: 96px; }</style>
<script>
window.google = { script: { run: {
  _s: null, _h: null,
  withSuccessHandler(f) { this._s = f; return this; },
  withFailureHandler(f) { this._h = f; return this; },
  bilgiKaydet(paket, veri) {
    const s = this._s, h = this._h;
    fetch('/kaydet?k=' + encodeURIComponent(paket), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) })
      .then(r => r.json()).then(j => { if (j.tamam) { s(j); setTimeout(() => window.close(), 1800); } else h(new Error(j.hata)); })
      .catch(e => h(e));
  } } } };
</script>"""


def form_sablonu() -> str:
    adaylar = [Path(getattr(sys, '_MEIPASS', '')) / 'Form.html', Path(__file__).resolve().parent.parent / 'apps-script' / 'Form.html']
    for a in adaylar:
        if a.is_file():
            return a.read_text(encoding='utf-8')
    raise FileNotFoundError('Form.html bulunamadı')


def _js(veri) -> str:
    return json.dumps(veri, ensure_ascii=False).replace('</', '<\\/')


class FormSunucusu:
    def __init__(self, kaydet_cb):
        """kaydet_cb(oturum, bilgi) -> (tamam: bool, hata: str|None)"""
        self.kaydet_cb = kaydet_cb
        self.oturumlar = {}            # anahtar → {'dosyalar': [...], 'isler': [...], ...}
        sunucu = self

        class Isleyici(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def _gonder(self, kod, govde, tur='text/html; charset=utf-8'):
                b = govde.encode('utf-8')
                self.send_response(kod)
                self.send_header('Content-Type', tur)
                self.send_header('Content-Length', str(len(b)))
                self.send_header('Cache-Control', 'no-store')
                self.end_headers()
                self.wfile.write(b)

            def do_GET(self):
                if not self.path.startswith('/form?k='):
                    return self._gonder(404, 'yok')
                o = sunucu.oturumlar.get(self.path.split('=', 1)[1])
                if not o:
                    return self._gonder(410, '<meta charset=utf-8><p style="font:16px sans-serif;padding:24px">Bu pencerenin süresi doldu. Kapatabilirsiniz.</p>')
                self._gonder(200, sunucu.sayfa(o))

            def do_POST(self):
                if not self.path.startswith('/kaydet?k='):
                    return self._gonder(404, 'yok')
                anahtar = self.path.split('=', 1)[1]
                o = sunucu.oturumlar.get(anahtar)
                if not o:
                    return self._gonder(200, json.dumps({'tamam': False, 'hata': 'Pencerenin süresi doldu.'}), 'application/json')
                uzunluk = int(self.headers.get('Content-Length', 0))
                try:
                    bilgi = json.loads(self.rfile.read(uzunluk).decode('utf-8'))
                    for alan in ('elektrikci', 'proje', 'tur'):
                        if not str(bilgi.get(alan, '')).strip():
                            raise ValueError('Elektrikçi, proje adı ve proje türü boş olamaz.')
                    tamam, hata = sunucu.kaydet_cb(o, {
                        'elektrikci': bilgi['elektrikci'].strip(), 'proje': bilgi['proje'].strip(), 'tur': bilgi['tur'].strip(),
                        'acil': bool(bilgi.get('acil')), 'evrakTamam': bool(bilgi.get('tamam')), 'not': str(bilgi.get('not', ''))[:500]})
                except Exception as e:
                    tamam, hata = False, str(e)
                if tamam:
                    sunucu.oturumlar.pop(anahtar, None)
                self._gonder(200, json.dumps({'tamam': tamam, 'hata': hata, 'dosyaSayisi': len(o['dosyalar'])}, ensure_ascii=False), 'application/json')

        self.http = ThreadingHTTPServer(('127.0.0.1', 0), Isleyici)
        self.port = self.http.server_address[1]
        threading.Thread(target=self.http.serve_forever, daemon=True).start()

    def sayfa(self, o) -> str:
        isler = o['isler']
        durum = {'paket': o['anahtar'], 'dosyaSayisi': len(o['dosyalar']), 'dosyalar': [Path(f).name for f in o['dosyalar']], 'bilgi': None}
        html = form_sablonu()
        html = (html.replace('<?!= durum ?>', _js(durum))
                .replace('<?!= isler ?>', _js([{'elektrikci': x['elektrikci'], 'proje': x['proje'], 'tur': x['tur']} for x in isler]))
                .replace('<?!= elektrikciler ?>', _js([x['elektrikci'] for x in isler]))
                .replace('<?!= turler ?>', _js([x['tur'] for x in isler] + TURLER)))
        html = html.replace('<title>', '<title>').replace('<base target="_top">', '<base target="_top"><title>AGY Evrak — Evrak Bırak</title>')
        html = html.replace('<script>', ARA_KATMAN + '<script>', 1)
        html = html.replace('evrak alındı', 'evrak bırakıldı')
        return html

    def ac(self, dosyalar, isler, ek=None) -> str:
        anahtar = secrets.token_urlsafe(12)
        self.oturumlar[anahtar] = dict(ek or {}, anahtar=anahtar, dosyalar=list(dosyalar), isler=isler)
        url = f'http://127.0.0.1:{self.port}/form?k={anahtar}'
        pencere_ac(url)
        return anahtar


def edge_yolu():
    for taban in (os.environ.get('ProgramFiles(x86)'), os.environ.get('ProgramFiles'), os.environ.get('LOCALAPPDATA')):
        if taban:
            p = Path(taban) / 'Microsoft' / 'Edge' / 'Application' / 'msedge.exe'
            if p.is_file():
                return str(p)
    return None


def pencere_olcusu():
    """Ekranın çalışma alanına göre pencere boyu (fiziksel piksel): yüksekliğin en çok %80'i, ortada."""
    try:
        import ctypes
        from ctypes import wintypes
        ctypes.windll.user32.SetProcessDPIAware()
        r = wintypes.RECT()
        ctypes.windll.user32.SystemParametersInfoW(0x0030, 0, ctypes.byref(r), 0)       # SPI_GETWORKAREA
        olcek = ctypes.windll.user32.GetDpiForSystem() / 96 if hasattr(ctypes.windll.user32, 'GetDpiForSystem') else 1
        ekran_g, ekran_y = r.right - r.left, r.bottom - r.top
        yuk = int(min(720 * olcek, ekran_y * 0.8))
        gen = int(min(440 * olcek, ekran_g * 0.5))
        return gen, yuk, r.left + (ekran_g - gen) // 2, r.top + (ekran_y - yuk) // 2
    except Exception:
        return 440, 680, 200, 60


def pencere_ac(url):
    if sys.platform != 'win32':
        print('FORM:', url)
        return
    edge = edge_yolu()
    if edge:
        gen, yuk, x, y = pencere_olcusu()
        subprocess.Popen([edge, f'--app={url}', f'--window-size={gen},{yuk}', f'--window-position={x},{y}', '--new-window'],
                         creationflags=0x08000000)
    else:
        os.startfile(url)
