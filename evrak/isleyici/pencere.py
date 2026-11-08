"""'Evrak Bırak' penceresi: PC'den gelen dosyalar için elektrikçi / proje / tür / ACİL / evrak durumu sorar."""
import tkinter as tk
from tkinter import ttk

LACIVERT = '#15284b'


def _b(s):
    return ' '.join(str(s or '').replace('i', 'İ').replace('ı', 'I').upper().split())


class OneriKutusu:
    """Yazarken altında öneri listesi açılan giriş kutusu."""

    def __init__(self, ust, etiket, kaynak, secilince=None):
        self.kaynak, self.secilince = kaynak, secilince
        ttk.Label(ust, text=etiket, style='Etiket.TLabel').pack(anchor='w', pady=(8, 2))
        self.deger = tk.StringVar()
        self.giris = ttk.Entry(ust, textvariable=self.deger, font=('Segoe UI', 11))
        self.giris.pack(fill='x')
        self.liste = tk.Listbox(ust, height=0, font=('Segoe UI', 10), activestyle='none', relief='solid', borderwidth=1,
                                selectbackground=LACIVERT, selectforeground='white')
        self.giris.bind('<KeyRelease>', self._yaz)
        self.giris.bind('<FocusIn>', self._yaz)
        self.giris.bind('<Down>', lambda e: (self.liste.focus_set(), self.liste.selection_set(0)) if self.liste.winfo_ismapped() else None)
        self.giris.bind('<FocusOut>', lambda e: self.giris.after(150, self._gizle_odak_yoksa))
        self.liste.bind('<ButtonRelease-1>', self._sec)
        self.liste.bind('<Return>', self._sec)

    def _yaz(self, e=None):
        if e is not None and getattr(e, 'keysym', '') in ('Return', 'Escape', 'Tab'):
            if e.keysym == 'Escape':
                self._gizle()
            return
        q = _b(self.deger.get())
        gor, adaylar = set(), []
        for v in self.kaynak():
            if v and _b(v) not in gor:
                gor.add(_b(v)); adaylar.append(v)
        bas = [v for v in adaylar if _b(v).startswith(q) or any(w.startswith(q) for w in _b(v).split())]
        ic = [v for v in adaylar if v not in bas and q in _b(v)]
        l = [v for v in (bas + ic if q else adaylar) if _b(v) != q][:6]
        self.liste.delete(0, 'end')
        for v in l:
            self.liste.insert('end', v)
        if l:
            self.liste.configure(height=len(l))
            self.liste.pack(fill='x', after=self.giris)
        else:
            self._gizle()

    def _gizle(self):
        self.liste.pack_forget()

    def _gizle_odak_yoksa(self):
        if self.liste.focus_get() is not self.liste:
            self._gizle()

    def _sec(self, e=None):
        s = self.liste.curselection()
        if not s:
            return
        v = self.liste.get(s[0])
        self.deger.set(v)
        self._gizle()
        self.giris.icursor('end')
        if self.secilince:
            self.secilince(v)


class EvrakPenceresi:
    def __init__(self, kok, dosyalar, isler, geri_cagir):
        self.dosyalar, self.isler, self.geri = dosyalar, isler, geri_cagir
        self.p = p = tk.Toplevel(kok)
        p.title('AGY Evrak — Evrak Bırak')
        p.configure(bg='white')
        p.attributes('-topmost', True)
        p.protocol('WM_DELETE_WINDOW', self.vazgec)
        stil = ttk.Style(p)
        try:
            stil.theme_use('vista')
        except tk.TclError:
            pass
        stil.configure('TFrame', background='white')
        stil.configure('TLabel', background='white', font=('Segoe UI', 10))
        stil.configure('Etiket.TLabel', foreground='#64708a', font=('Segoe UI', 9, 'bold'))
        stil.configure('Baslik.TLabel', background=LACIVERT, foreground='white', font=('Segoe UI', 13, 'bold'))
        stil.configure('Alt.TLabel', background=LACIVERT, foreground='#c9d3e6', font=('Segoe UI', 9))
        stil.configure('TCheckbutton', background='white', font=('Segoe UI', 10))
        stil.configure('TRadiobutton', background='white', font=('Segoe UI', 10, 'bold'))
        stil.configure('Ana.TButton', font=('Segoe UI', 11, 'bold'), padding=(16, 8))

        bas = tk.Frame(p, bg=LACIVERT, padx=18, pady=12)
        bas.pack(fill='x')
        ttk.Label(bas, text=f'{len(dosyalar)} evrak bırakıldı', style='Baslik.TLabel').pack(anchor='w')
        ttk.Label(bas, text='  ·  '.join(f.name for f in dosyalar[:4]) + (' …' if len(dosyalar) > 4 else ''), style='Alt.TLabel').pack(anchor='w')

        g = ttk.Frame(p, padding=(18, 8, 18, 16))
        g.pack(fill='both', expand=True)
        if isler:
            ttk.Label(g, text='SON İŞLER (tıkla, doldursun)', style='Etiket.TLabel').pack(anchor='w', pady=(6, 2))
            self.son = tk.Listbox(g, height=min(5, len(isler)), font=('Segoe UI', 10), activestyle='none', relief='solid', borderwidth=1,
                                  selectbackground=LACIVERT, selectforeground='white')
            for x in isler[:12]:
                self.son.insert('end', f"{x['elektrikci']} – {x['proje']}   ({x['tur']})")
            self.son.pack(fill='x')
            self.son.bind('<<ListboxSelect>>', self._son_sec)

        self.e = OneriKutusu(g, 'ELEKTRİKÇİ ADI', lambda: [x['elektrikci'] for x in isler], lambda v: self.pr.giris.focus_set())
        self.pr = OneriKutusu(g, 'PROJE ADI', lambda: [x['proje'] for x in isler if not self.e.deger.get() or _b(x['elektrikci']) == _b(self.e.deger.get())],
                              self._proje_secildi)
        turler = ['İç Tesisat', 'Bağlantı Hattı', 'İç Tesisat + Bağlantı Hattı', 'Kompanzasyon']
        self.t = OneriKutusu(g, 'PROJE TÜRÜ', lambda: [x['tur'] for x in isler] + turler)

        d = ttk.Frame(g)
        d.pack(fill='x', pady=(12, 0))
        self.acil = tk.BooleanVar()
        ttk.Checkbutton(d, text='ACİL (listenin en üstüne)', variable=self.acil).pack(anchor='w')
        self.tamam = tk.StringVar(value='eksik')
        r = ttk.Frame(g)
        r.pack(fill='x', pady=(8, 0))
        ttk.Label(r, text='EVRAK DURUMU', style='Etiket.TLabel').pack(anchor='w')
        ttk.Radiobutton(r, text='EVRAK EKSİK (iş bekler)', value='eksik', variable=self.tamam).pack(anchor='w')
        ttk.Radiobutton(r, text='EVRAK TAMAM (çizime hazır)', value='tamam', variable=self.tamam).pack(anchor='w')

        ttk.Label(g, text='NOT (isteğe bağlı)', style='Etiket.TLabel').pack(anchor='w', pady=(10, 2))
        self.not_ = tk.StringVar()
        ttk.Entry(g, textvariable=self.not_, font=('Segoe UI', 10)).pack(fill='x')

        self.uyari = ttk.Label(g, text='', foreground='#c0392b')
        self.uyari.pack(anchor='w', pady=(8, 0))
        alt = ttk.Frame(g)
        alt.pack(fill='x', pady=(6, 0))
        ttk.Button(alt, text='Kaydet', style='Ana.TButton', command=self.kaydet).pack(side='right')
        ttk.Button(alt, text='Vazgeç', command=self.vazgec).pack(side='right', padx=8)
        p.bind('<Control-Return>', lambda e: self.kaydet())

        p.update_idletasks()
        w, h = 480, p.winfo_reqheight()
        p.minsize(w, 1)                       # yükseklik serbest: öneri listesi açılınca pencere uzar, düğmeler görünür kalır
        p.geometry(f'+{(p.winfo_screenwidth() - w) // 2}+{max(20, (p.winfo_screenheight() - h - 160) // 3)}')
        p.lift(); p.focus_force()
        self.e.giris.focus_set()

    def _son_sec(self, e=None):
        s = self.son.curselection()
        if not s:
            return
        x = self.isler[s[0]]
        self.e.deger.set(x['elektrikci']); self.pr.deger.set(x['proje']); self.t.deger.set(x['tur'])

    def _proje_secildi(self, v):
        is_ = next((x for x in self.isler if _b(x['proje']) == _b(v) and (not self.e.deger.get() or _b(x['elektrikci']) == _b(self.e.deger.get()))), None)
        if is_ and not self.t.deger.get():
            self.t.deger.set(is_['tur'])

    def kaydet(self):
        e, pr, t = self.e.deger.get().strip(), self.pr.deger.get().strip(), self.t.deger.get().strip()
        if not (e and pr and t):
            self.uyari.configure(text='Elektrikçi, proje adı ve proje türü boş olamaz.')
            return
        bilgi = {'elektrikci': e, 'proje': pr, 'tur': t, 'acil': self.acil.get(), 'evrakTamam': self.tamam.get() == 'tamam', 'not': self.not_.get().strip()}
        self.p.destroy()
        self.geri(self.dosyalar, bilgi)

    def vazgec(self):
        self.p.destroy()
        self.geri(self.dosyalar, None)
