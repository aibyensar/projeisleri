# Kablo akım taşıma değerleri: kaynaklar

Veri dosyası: `kablolar.js`

## Ana kaynak
**Öznur Kablo ürün katalogları** (oznurkablo.com.tr), Kasım 2026'da okundu.

| Kablo | Tip (TSE / VDE) | Standart | Maks. iletken sıcaklığı | Verilen değerler |
|---|---|---|---|---|
| NYY | YVV-U/R, NYY, Cu/PVC/PVC 0,6/1 kV | TS IEC 60502-1, VDE 0276 | 70 °C | Toprakta, havada |
| N2XY | YXV-U/R, N2XY, Cu/XLPE/PVC 0,6/1 kV | TS IEC 60502-1, VDE 0276 | 90 °C | Toprakta, havada |
| N2XH | N2XH, Cu/XLPE/HFFR 0,6/1 kV | TS HD 604 S1, VDE 0276 | 90 °C | Havada |
| NYM | NVV / 05VV-U/R, NYM 300/500 V | TS HD 21.4 S2, VDE 0281 | 70 °C | Havada |
| NYA | H07V-U/R, NYA 450/750 V | TS EN 50525-2-31, VDE 0281 | 70 °C | Boruda, havada |

## Kabul şartları (katalog notu)
- **Toprakta:** 20 °C toprak, 70 cm derinlik, toprak ısıl direnci 1 K·m/W, yük faktörü 0,7
- **Havada:** 30 °C ortam, yük faktörü 1,0
- Tek sistem. Yan yana birden fazla kablo, farklı sıcaklık veya derinlik varsa düzeltme katsayısı uygulanmalı.

## Çapraz kontrol
**Hes Kablo** NYY kataloğu (hes.com.tr, ürün PDF 216) ile karşılaştırıldı. Değerler aynı mertebede,
fark çoğunlukla %2–5 arası. Örnek, 4x16 NYY: Öznur 102 A toprak / 79 A hava, Hes 98 A / 80 A.

## Bilinen eksikler
- N2XY 2 damarlı kablolarda 70 mm² ve üstü için katalogda değer yok.
- NYA boruda değeri 150 mm² ve üstü için katalogda yok.
- N2XH ve NYM için katalog yalnızca havada değeri veriyor.
- Alüminyum iletkenli kablolar henüz eklenmedi.
