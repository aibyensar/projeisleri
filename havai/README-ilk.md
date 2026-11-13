# AG Cer Hesabı ve Direk Seçimi

AG havai hat projeleri için tarayıcıda çalışan bir araç. Kroki resmi, TKGM KML/GeoJSON ya da DXF altlık üzerinde direkleri işaretlersin. Araç şunları çıkarır:

- hat açıları ve cer (bileşke kuvvet) hesabı,
- direk tipi seçimi,
- kesit ve gerilim düşümü kontrolü,
- proje krokisi ile mühendislik cer raporunu içeren tek bir DXF dosyası.

Sunucu ya da ek bağımlılık gerekmez. `dist/index.html` dosyasını tarayıcıda açman yeterli.

## Klasör yapısı

```
src/
  cer-core.js      Hesap çekirdeği (DOM'a bağımlı değil, Node'da da çalışır)
                   - POLES: demir direk tepe kuvvetleri (rüzgarsız / rüzgarlı / zayıf eksen)
                   - BARE, TERTIP: buz yükü bölgesine göre çıplak iletken cer'leri ve AG tertipleri
                   - parseCer(): "AER 3x25+35", "4R", "3P+R/I", "416" gibi yazılardan cer (kg)
                   - computeAll(): her direk için hatlar, açı, bileşke, görev, direk tipi, uygunluk
                   - kesitCheck(): akım + gerilim düşümü ile ALPEK kesit kontrolü
                   - toDXF() / dxfBytes(): R12 ASCII DXF yazıcı (ANSI_1254), toSVG(), parseDXF(), makeZip()
                   - sheetPrims(): eski 4 adımlı "klasik" cer şablonu (arayüzde kullanılmıyor)
  kroki-rapor.js   Çizim katmanı
                   - tmProject(), parseGeo(), projectGeo(): KML/GeoJSON -> ITRF96 TM3
                   - krokiPrims2(): proje krokisi (parsel, yol, hat, semboller, KT/İT topraklama,
                     açı yayları, açıklık yazıları, lejant, kuzey oku), yazı çakışmalarını azaltan yerleşim
                   - reportPrims(): A3 mühendislik cer raporu (kabuller, kuvvet tablosu, kuvvet şemaları,
                     kesit kontrolü, sonuç)
                   - drawPrims(): aynı çizimi canvas'a basar
  parsel-bul.js    Resimden otomatik parsel bulma (sınır çizgisi maskesi + bağlı bileşenler + kontur)
  app.html         Arayüz şablonu. /*__CORE__*/ ve /*__WAND__*/ yer tutucuları build sırasında doldurulur
build.py           src/ dosyalarını tek bir dist/index.html'de birleştirir
dist/index.html    Derlenmiş, tek dosyalık uygulama
test/test-core.js  Çekirdek testleri:  node test/test-core.js
ornek/             Örnek TKGM KML dosyası
```

## Derleme ve test

```bash
python3 build.py          # dist/index.html'i yeniden üretir
node test/test-core.js    # hesap çekirdeğini doğrular
```

## Başka bir projeye entegrasyon

### Sadece hesap çekirdeği (Node / backend)

`cer-core.js` ve `kroki-rapor.js` dosyaları global fonksiyon tanımlar. Dosyaların sonunda `module.exports` ataması da vardır. İkisini tek bir dosyada birleştirip `require` edebilirsin. Ya da `test/test-core.js` dosyasındaki gibi `vm` ile yükleyebilirsin.

Direk verisinin biçimi:

```js
// Koordinatlar metre cinsinden, y yukarı doğru.
// ex: bu direğe bağlı mevcut hat yönleri (hattın gittiği bir nokta + iletken).
const poles = [
  { x: 0, y: 0, mev: true, mevName: '9.30/8', mevCap: 800, ex: [{ x: 0, y: -20, c: '4R' }] },
  { x: 0, y: 20, ex: [] },
  { x: -24, y: 26, ex: [], ov: 'auto' },   // ov: 'auto' ya da elle tip ('10I', 'K1'...)
];
const P = Object.assign({}, DEFAULTS, { bolge: 1, routeCond: 'AER 3x25+35' });
const results = computeAll(poles, P);       // [{name, catName, R, type, cap, ok, interior, ...}]
const kroki = krokiPrims2({ poles, parcels: [], roads: [] }, results, P, { h: 1, mpu: 1 });
const rapor = reportPrims(results, P, { proje: 'Proje adı' });
```

`toDXF(prims, { scale })` DXF metnini üretir. `dxfBytes()` bu metni Windows-1254 baytlarına çevirir.

### Arayüzün tamamı

`dist/index.html` kendi başına çalışır. Bir uygulamaya iframe ile gömebilir ya da bir route olarak servis edebilirsin. Dış bağımlılığı sadece Google Fonts'tur (IBM Plex); bu bağlantı yoksa sistem fontu kullanılır.

İndirme davranışı:
- Claude artifact içinde `claude.use('downloads')` kullanılır ve dosya zip olarak iner, çünkü artifact `.dxf` uzantısına izin vermiyor.
- Normal tarayıcıda dosya doğrudan `.dxf` olarak iner.

## Hesap kabulleri ve kaynakları

- **ALPEK cer:** askı teli kesiti × σ, σ = 12 kg/mm² (Alpek El Kitabı). Örnek: 3x25+35 → 420 kg.
- **Çıplak iletkenler:** buz yükü bölgesine göre müşterek hat çekme kuvvetleri (Konen teknik tablosu). Tertiplerin cer'i iletkenler toplanarak bulunur.
- **Demir direk tepe kuvvetleri:** 8I 300, 10I 500, 12I 900, 10U 700, 12U 1200, K1 1000 … K5 5000 kg (rüzgarsız). SBA beton direkte tepe kuvveti = tip × 100 kg.
- **Bileşke kuvvet:** R = √[(ΣTx)² + (ΣTy)²]. Şart: R ≤ P. K kuralı köşe ve branşman direklerinde varsayılan olarak açıktır.
- **Kesit:** I = N / (√3·380·cosφ). Gerilim düşümü %e = 100·N·L / (κ·S·U²) (trifaze) ya da 200·N·L / (κ·S·U²) (monofaze). Varsayılan sınır %1, κ = 35.
- **Topraklama:** yeni demir direklerde koruma topraklaması (KT), nihayet direğinde ayrıca işletme topraklaması (İT).
- **İzmir ilçeleri** EMO'nun ilçe tablosuna göre 1. buz yükü bölgesindedir. 600 m üzeri rakımda hesap 2. bölgeye göre yapılır.

Değerler arayüzden değiştirilebilir. Projeyi onaylatacağın dağıtım şirketinin şartnamesiyle karşılaştırmayı unutma.
