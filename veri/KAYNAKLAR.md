# Kablo akım taşıma değerleri: kaynaklar

Veri dosyaları:
- `katalog.js`: firma tabloları, sitede yayınlandığı haliyle (bütün sütunlar ve dipnotlar)
- `kablolar.js`: hesapta kullanılan akım değerleri, `katalog.js`'ten üretilir

## Ana kaynak
**Öznur Kablo ürün katalogları** (oznurkablo.com.tr), Kasım 2026'da okundu.

| Kablo | Tip (TSE / VDE) | Standart | Maks. iletken sıcaklığı | Verilen değerler |
|---|---|---|---|---|
| NYY | YVV-U/R, NYY, Cu/PVC/PVC 0,6/1 kV | TS IEC 60502-1, VDE 0276 | 70 °C | Toprakta, havada |
| N2XY | YXV-U/R, N2XY, Cu/XLPE/PVC 0,6/1 kV | TS IEC 60502-1, VDE 0276 | 90 °C | Toprakta, havada |
| N2XH | N2XH, Cu/XLPE/HFFR 0,6/1 kV | TS HD 604 S1, VDE 0276 | 90 °C | Havada (2, 3, 4, 5 damar) |
| NYM | NVV / 05VV-U/R, NYM 300/500 V | TS HD 21.4 S2, VDE 0281 | 70 °C | Havada |
| NYA | H07V-U/R, NYA 450/750 V | TS EN 50525-2-31, VDE 0281 | 70 °C | Boruda, havada |
| NAYY | YAVV-R, NAYY, Al/PVC/PVC 0,6/1 kV | TS IEC 60502-1, VDE 0276 | 70 °C | Toprakta, havada (2 damarda sadece havada) |
| NA2XY | YAXV-R, NA2XY, Al/XLPE/PVC 0,6/1 kV | TS IEC 60502-1, VDE 0276 | 90 °C | Toprakta, havada (2 damarda sadece havada) |

## Kabul şartları
- **Öznur Kablo:** sayfalarında sadece "toprakta 20 °C, havada 30 °C" yazıyor.
- **Hes Kablo** dipnotu daha ayrıntılı: toprakta 20 °C, 70 cm derinlik, toprak ısıl direnci 1 K·m/W, yük faktörü 0,7;
  havada 30 °C, yük faktörü 1,0; tek sistem.
- Yan yana birden fazla kablo, farklı sıcaklık veya derinlik varsa düzeltme katsayısı uygulanmalı.

## Çapraz kontrol
**Hes Kablo** NYY kataloğu (hes.com.tr, ürün PDF 216) ile karşılaştırıldı. Değerler aynı mertebede,
fark çoğunlukla %2–5 arası. Örnek, 4x16 NYY: Öznur 102 A toprak / 79 A hava, Hes 98 A / 80 A.

## Bilinen eksikler
- N2XY 2 damarlı kablolarda 70 mm² ve üstü için katalogda değer yok.
- NYA boruda değeri 150 mm² ve üstü için katalogda yok.
- N2XH ve NYM için katalog yalnızca havada değeri veriyor.
- Alüminyum kablolar 10 mm² (NAYY) ve 25 mm² (NA2XY) altında katalogda yok.
