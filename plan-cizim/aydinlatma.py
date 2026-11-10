"""Aydınlatma hesabı (lümen yöntemi) — kurulu gücü yönetmelik içinde en aza indirmek için.

Yönetmelik (İç Tesisler, değişik md. 57, RG 08.12.2000/24254): "Aydınlatma gücü, aydınlatma hesabı yapılan binalarda bu
hesap sonucunda elde edilir. Aydınlatma hesabı yapılmayan yerler için … en az 12 W/m²". Bu modül her oda için hesabı
yapar; proje güç tablosundaki armatür gücü bu hesaptan gelir (12 W/m² kuralı yerine).

Yöntem: Φ = E · A / (η · d)
  E  istenen ortalama aydınlık düzeyi (lx) — konut için resmî değer yok; yaygın önerilerin alt ucu (kullanıcı onaylar)
  A  oda alanı (m²), η kullanma faktörü (oda indeksi k = a·b / (h·(a+b)) ile tablodan), d bakım faktörü
  Armatür gücü = Φ / ışık verimi (lm/W), standart LED güçlerine yukarı yuvarlanır.
"""
import math

# lx — konut genel aydınlatması (kaynaklardaki aralıkların alt ucu; ayarlanabilir)
AYDINLIK = {'salon': 100, 'salon_mutfak': 150, 'oda': 100, 'mutfak': 150, 'banyo': 150, 'wc': 100,
            'hol': 75, 'kiler': 50, 'balkon': 50, 'isyeri': 300, 'diger': 75}
TAVAN = 2.80             # m, net kat yüksekliği (mimari kesitten değiştirilebilir)
CALISMA = 0.85           # m, çalışma düzlemi
BAKIM = 0.80             # bakım faktörü (LED, temiz ortam)
VERIM = 100              # lm/W, LED plafonyer / panel (katalogdan değiştirilebilir)
GUCLER = [10, 12, 15, 18, 20, 24, 30, 36, 40, 48, 60]      # standart LED armatür güçleri (W)
# kullanma faktörü η — açık/yarı açık LED armatür, yansıtma tavan 0,7 / duvar 0,5 / döşeme 0,2 (tipik tablo)
ETA = [(0.6, 0.35), (0.8, 0.43), (1.0, 0.49), (1.25, 0.55), (1.5, 0.59), (2.0, 0.65), (2.5, 0.69), (3.0, 0.72),
       (4.0, 0.76), (5.0, 0.78)]


def kullanma_faktoru(k):
    if k <= ETA[0][0]:
        return ETA[0][1]
    for (k1, e1), (k2, e2) in zip(ETA, ETA[1:]):
        if k <= k2:
            return e1 + (e2 - e1) * (k - k1) / (k2 - k1)
    return ETA[-1][1]


def hesapla(tur, alan, a, b, adet):
    """alan m², a·b oda kenarları (m), adet armatür sayısı → dict (tablo satırı)."""
    E = AYDINLIK.get(tur, AYDINLIK['diger'])
    h = TAVAN - CALISMA
    k = (a * b) / (h * (a + b)) if a > 0 and b > 0 else 1.0
    eta = kullanma_faktoru(k)
    phi = E * alan / (eta * BAKIM)
    w_gerek = phi / VERIM
    adet = max(1, adet)
    guc = next((g for g in GUCLER if g * adet >= w_gerek), None)
    while guc is None:                                     # tek armatüre sığmıyorsa armatür sayısını artır
        adet += 1
        guc = next((g for g in GUCLER if g * adet >= w_gerek), None)
    return dict(E=E, alan=round(alan, 2), a=round(a, 2), b=round(b, 2), h=round(h, 2), k=round(k, 2), eta=round(eta, 2),
                d=BAKIM, phi=round(phi), w_gerek=round(w_gerek, 1), adet=adet, guc=guc, toplam=guc * adet,
                w_m2=round(guc * adet / alan, 1) if alan else 0)
